import express from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { readQuotaStatus } from "../lib/plan-quota.js";
import { users } from "../db/schema.js";
import { getSupabaseAdmin } from "../lib/supabase.js";
import { getStripe, isStripeConfigured } from "../lib/stripe.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res) => {
  const { id, email, name, imageUrl, isSubscribed, createdAt } = req.dbUser;

  // Apply any pending monthly reset and return the live cycle snapshot — keeps the UI
  // in sync without a separate fetch.
  let quota;
  try {
    quota = await readQuotaStatus(req.db, req.dbUser);
  } catch (err) {
    console.warn("[users/me] readQuotaStatus failed, returning raw row", err?.message || err);
    quota = {
      remainingCredits: req.dbUser.credits ?? 0,
      planLimit: 5,
      planTier: req.dbUser.planTier || "free",
      resetAt: req.dbUser.creditsResetAt || null,
    };
  }

  res.json({
    id,
    email,
    name,
    imageUrl,
    credits: quota.remainingCredits,
    planLimit: quota.planLimit,
    planTier: quota.planTier,
    creditsResetAt: quota.resetAt?.toISOString?.() ?? quota.resetAt ?? null,
    isSubscribed,
    createdAt,
  });
});

/**
 * Permanent account teardown: Stripe cancel (when applicable), Neon row delete, Supabase Auth delete (when service_role is set).
 */
router.delete("/me", requireAuth, async (req, res) => {
  const dbUser = req.dbUser;
  const db = req.db;
  let stripeCanceled = false;

  if (isStripeConfigured() && dbUser.stripeSubscriptionId) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.cancel(dbUser.stripeSubscriptionId);
        stripeCanceled = true;
      } catch (err) {
        const msg = String(err?.message || err || "");
        if (/no such subscription|already been canceled|does not exist/i.test(msg)) {
          stripeCanceled = true;
        } else {
          console.error("[users/me DELETE] Stripe cancel failed:", msg);
          return res.status(503).json({
            error:
              "Could not cancel your Stripe subscription from here. Open billing and cancel the plan, then try deleting your account again.",
          });
        }
      }
    }
  }

  try {
    await db.delete(users).where(eq(users.id, dbUser.id));
  } catch (err) {
    console.error("[users/me DELETE] DB delete failed:", err?.message || err);
    return res.status(500).json({ error: "Could not remove account data from the database." });
  }

  let authRemoved = false;
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(dbUser.authUserId);
    if (error) {
      console.error("[users/me DELETE] Supabase admin deleteUser:", error.message);
    } else {
      authRemoved = true;
    }
  }

  return res.json({ ok: true, stripeCanceled, authRemoved });
});

export default router;
