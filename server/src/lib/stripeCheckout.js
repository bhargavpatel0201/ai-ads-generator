import { eq } from "drizzle-orm";
import { users } from "../db/schema.js";
import { getPlanForPriceId, getCreditsForPlan } from "./stripe.js";
import { nextMonthBoundary } from "./plan-quota.js";

/**
 * @param {import("stripe").Stripe.Checkout.Session} session
 */
function resolvePlanFromCheckoutSession(session) {
  const meta = session.metadata?.plan;
  if (meta === "pro" || meta === "premium") return meta;
  const priceId = session.line_items?.data?.[0]?.price?.id;
  if (priceId) {
    const p = getPlanForPriceId(priceId);
    if (p === "pro" || p === "premium") return p;
  }
  return null;
}

/**
 * @param {import("stripe").Stripe.Checkout.Session} session
 */
function extractCustomerSubscriptionIds(session) {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  let subId = session.subscription;
  if (subId && typeof subId === "object" && "id" in subId) {
    subId = subId.id;
  }
  return { customerId, subscriptionId: subId || null };
}

/**
 * Apply a successful subscription Checkout session to a Neon user row.
 * One code path for webhooks and POST /sync-checkout.
 * @param {*} db
 * @param {{ userId: number, session: import("stripe").Stripe.Checkout.Session }} o
 * @returns {Promise<{ ok: true, plan: string } | { ok: false, error: string }>}
 */
export async function applyCompletedSubscriptionCheckoutToUser(db, { userId, session }) {
  if (session.mode !== "subscription") {
    return { ok: false, error: "not_subscription_mode" };
  }
  if (session.status !== "complete") {
    return { ok: false, error: "session_not_complete" };
  }

  const plan = resolvePlanFromCheckoutSession(session);
  if (!plan) {
    return { ok: false, error: "plan_unresolved" };
  }

  const { customerId, subscriptionId: subId } = extractCustomerSubscriptionIds(session);
  if (!customerId || !subId) {
    return { ok: false, error: "missing_customer_or_subscription" };
  }

  await db
    .update(users)
    .set({
      planTier: plan,
      isSubscribed: true,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      // Upgrade gives the user the FULL plan quota immediately and starts a fresh
      // monthly cycle — they shouldn't have to wait for the next reset to enjoy Pro.
      credits: getCreditsForPlan(plan),
      creditsResetAt: nextMonthBoundary(),
    })
    .where(eq(users.id, userId));

  return { ok: true, plan };
}

export { resolvePlanFromCheckoutSession, extractCustomerSubscriptionIds };
