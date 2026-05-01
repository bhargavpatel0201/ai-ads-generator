/**
 * Per-user monthly post-generation quota.
 *
 * Each plan gets a fixed number of LinkedIn-post generations per calendar month.
 * The limits below match the copy on the Pricing page (client/src/sections/pricing-plans.tsx).
 *
 *   free    →  5 posts / month
 *   pro     → 80 posts / month
 *   premium → 240 posts / month
 *
 * Storage:
 *   users.credits          — remaining generations for the current cycle (decremented per call)
 *   users.credits_reset_at — UTC timestamp at which credits should be reset to plan limit
 *                            (next 1st-of-month at 00:00 UTC)
 *
 * The column is added at runtime via an idempotent ALTER TABLE so users don't need to run
 * Drizzle migrations to enable quotas — same pattern as routes/shares.js.
 */

import { eq, sql as sqlOp } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { users } from "../db/schema.js";

/**
 * One generation = one Gemini text call + one Replicate SDXL call. Numbers are tied to
 * the user-visible features in client/src/sections/pricing-plans.tsx — keep them in sync.
 */
export const PLAN_LIMITS = Object.freeze({
  free: 5,
  pro: 80,
  premium: 240,
});

export const DEFAULT_PLAN = "free";

/** Normalise whatever planTier value is on the DB row into a key we have a limit for. */
export function normalizePlanTier(planTier) {
  const t = String(planTier || "").toLowerCase().trim();
  if (t === "pro" || t === "premium" || t === "free") return t;
  return DEFAULT_PLAN;
}

/** Limit (number) for a plan tier. Falls back to free for unknown values. */
export function getPlanLimit(planTier) {
  return PLAN_LIMITS[normalizePlanTier(planTier)];
}

/** Returns next 1st-of-month at 00:00 UTC after `now`. Independent of the server timezone. */
export function nextMonthBoundary(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/** True when there's no reset timestamp yet, or the reset moment has already passed. */
export function isCycleExpired(creditsResetAt, now = new Date()) {
  if (!creditsResetAt) return true;
  const reset = creditsResetAt instanceof Date ? creditsResetAt : new Date(creditsResetAt);
  if (Number.isNaN(reset.getTime())) return true;
  return reset.getTime() <= now.getTime();
}

/** Thrown when a user has no credits remaining in the current cycle. */
export class PlanQuotaError extends Error {
  constructor({ planTier, planLimit, resetAt }) {
    super(
      `Monthly limit reached for ${planTier} plan (${planLimit} posts). ` +
        `Resets on ${resetAt instanceof Date ? resetAt.toISOString().slice(0, 10) : "next month"}.`
    );
    this.name = "PlanQuotaError";
    this.code = "PLAN_QUOTA_EXHAUSTED";
    this.planTier = planTier;
    this.planLimit = planLimit;
    this.resetAt = resetAt;
  }
}

let columnEnsured = false;
let columnEnsurePromise = null;

/**
 * Idempotent `ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMP`.
 *
 * MUST be awaited BEFORE any code path that runs a Drizzle `SELECT` against `users` —
 * Drizzle auto-generates the column list from the schema, so a missing column makes the
 * SELECT itself fail (Postgres "column ... does not exist") before our quota helpers
 * ever run. Use the bare Neon HTTP driver instead of `db.execute` so this works even when
 * the wider Drizzle session is in a bad state.
 *
 * The result is cached after the first successful run; concurrent first-callers all share
 * the same in-flight promise so we never fire two ALTERs.
 */
export async function ensureUsersSchema() {
  if (columnEnsured) return;
  if (!process.env.DATABASE_URL) return; // tests / no-DB envs — silently skip
  if (columnEnsurePromise) return columnEnsurePromise;
  columnEnsurePromise = (async () => {
    try {
      const sql = neon(process.env.DATABASE_URL);
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMP`;
      columnEnsured = true;
    } catch (err) {
      console.error(
        "[plan-quota] failed to ensure users.credits_reset_at column:",
        err?.message || err
      );
      throw err;
    } finally {
      columnEnsurePromise = null;
    }
  })();
  return columnEnsurePromise;
}

/**
 * Atomically consume one generation credit for `user`. Resets the cycle when needed.
 *
 * Behaviour:
 *   1. If the cycle is expired (or never started), credits are bumped to the plan limit
 *      and `credits_reset_at` is set to the next month boundary BEFORE any decrement.
 *   2. We then `UPDATE ... SET credits = credits - 1 WHERE id = $id AND credits > 0`,
 *      which is race-safe under concurrent requests (no double-decrement).
 *   3. If 0 rows are returned, the user is out of credits → throws `PlanQuotaError`.
 *
 * Returns: { remainingCredits, planLimit, planTier, resetAt }
 */
export async function assertAndConsumeCredit(db, user, now = new Date()) {
  await ensureUsersSchema();

  const planTier = normalizePlanTier(user.planTier);
  const planLimit = PLAN_LIMITS[planTier];
  let resetAt = user.creditsResetAt instanceof Date ? user.creditsResetAt : (user.creditsResetAt ? new Date(user.creditsResetAt) : null);
  let credits = Number.isFinite(user.credits) ? user.credits : 0;

  if (isCycleExpired(resetAt, now)) {
    resetAt = nextMonthBoundary(now);
    credits = planLimit;
    await db
      .update(users)
      .set({ credits, creditsResetAt: resetAt })
      .where(eq(users.id, user.id));
  }

  const [updated] = await db
    .update(users)
    .set({ credits: sqlOp`${users.credits} - 1` })
    .where(sqlOp`${users.id} = ${user.id} AND ${users.credits} > 0`)
    .returning({ credits: users.credits });

  if (!updated) {
    throw new PlanQuotaError({ planTier, planLimit, resetAt });
  }

  return {
    remainingCredits: updated.credits,
    planLimit,
    planTier,
    resetAt,
  };
}

/**
 * Read-only equivalent of `assertAndConsumeCredit` — returns the current cycle snapshot
 * after applying any pending reset, but does NOT decrement. Used by `/api/users/me` so
 * the UI can show "X / Y posts left this month" before the user hits Generate.
 */
export async function readQuotaStatus(db, user, now = new Date()) {
  await ensureUsersSchema();

  const planTier = normalizePlanTier(user.planTier);
  const planLimit = PLAN_LIMITS[planTier];
  let resetAt = user.creditsResetAt instanceof Date ? user.creditsResetAt : (user.creditsResetAt ? new Date(user.creditsResetAt) : null);
  let credits = Number.isFinite(user.credits) ? user.credits : 0;

  if (isCycleExpired(resetAt, now)) {
    resetAt = nextMonthBoundary(now);
    credits = planLimit;
    await db
      .update(users)
      .set({ credits, creditsResetAt: resetAt })
      .where(eq(users.id, user.id));
  }

  return {
    remainingCredits: Math.max(0, credits),
    planLimit,
    planTier,
    resetAt,
  };
}
