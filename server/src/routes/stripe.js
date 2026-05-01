import express from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { getDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { getPriceIdForPlan, getPlanForPriceId, getStripe, isStripeConfigured, getCreditsForPlan } from "../lib/stripe.js";
import { applyCompletedSubscriptionCheckoutToUser } from "../lib/stripeCheckout.js";
import { nextMonthBoundary } from "../lib/plan-quota.js";

const router = express.Router();

/** First origin from comma-separated CLIENT_URL (used for Stripe redirect URLs). */
function primaryClientOrigin() {
  const raw = String(process.env.CLIENT_URL || "").trim();
  if (!raw) return "http://localhost:5173";
  const first = raw
    .split(",")
    .map((s) => s.trim())
    .find(Boolean);
  return first || "http://localhost:5173";
}

const CLIENT = () => primaryClientOrigin();

/**
 * Must be mounted in index.js *before* express.json(), with:
 * express.raw({ type: "application/json" })
 */
export async function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET not set" });
  }
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: "STRIPE_SECRET_KEY not set" });
  }

  let event;
  try {
    const rawBody = req.body;
    const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(JSON.stringify(rawBody));
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook verify:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  let db;
  try {
    db = getDb();
  } catch (e) {
    console.error("Stripe webhook: database:", e?.message);
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;
        const appUserId = session.metadata?.appUserId;
        if (!appUserId) {
          console.warn("checkout.session.completed: missing appUserId", session.id);
          break;
        }
        const id = parseInt(String(appUserId), 10);
        if (Number.isNaN(id)) break;

        let full = session;
        let result = await applyCompletedSubscriptionCheckoutToUser(db, { userId: id, session: full });
        if (
          !result.ok &&
          (result.error === "plan_unresolved" || result.error === "missing_customer_or_subscription")
        ) {
          const stripe = getStripe();
          full = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["line_items", "line_items.data.price", "subscription"],
          });
          result = await applyCompletedSubscriptionCheckoutToUser(db, { userId: id, session: full });
        }
        if (!result.ok) {
          console.warn("checkout.session.completed: apply failed", session.id, result.error);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const fromMeta = sub.metadata?.plan;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!customerId) break;

        const bySubList = await db
          .select()
          .from(users)
          .where(eq(users.stripeSubscriptionId, sub.id));
        const byCustList = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, customerId));
        const row = bySubList[0] || byCustList[0];
        if (!row) {
          console.warn("Stripe subscription event: no user for", sub.id, customerId);
          break;
        }

        if (event.type === "customer.subscription.deleted" || sub.status === "canceled") {
          await db
            .update(users)
            .set({
              planTier: "free",
              isSubscribed: false,
              stripeSubscriptionId: null,
              credits: getCreditsForPlan("free"),
              creditsResetAt: nextMonthBoundary(),
            })
            .where(eq(users.id, row.id));
          break;
        }

        const active = ["active", "trialing"].includes(sub.status);
        const plan =
          (fromMeta === "pro" || fromMeta === "premium" ? fromMeta : null) ||
          (active ? getPlanForPriceId(priceId) : "free");
        const finalPlan = active ? plan : "free";

        await db
          .update(users)
          .set({
            planTier: finalPlan,
            isSubscribed: active,
            stripeCustomerId: customerId,
            stripeSubscriptionId: active ? sub.id : null,
            credits: getCreditsForPlan(finalPlan),
            creditsResetAt: nextMonthBoundary(),
          })
          .where(eq(users.id, row.id));
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Stripe webhook handler:", e);
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  return res.json({ received: true });
}

router.post("/checkout", requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error:
        "Missing STRIPE_SECRET_KEY in server/.env. Stripe Dashboard → Developers → API keys → copy Secret key (sk_test_...). Restart the server after saving.",
    });
  }
  const plan = req.body?.plan;
  if (plan !== "pro" && plan !== "premium") {
    return res.status(400).json({ error: "Invalid plan. Use pro or premium." });
  }
  const priceId = getPriceIdForPlan(plan);
  if (!priceId) {
    return res.status(503).json({
      error: `Set STRIPE_PRICE_ID_${plan.toUpperCase()} in server/.env (Dashboard → Product → price id).`,
    });
  }
  if (String(priceId).startsWith("prod_")) {
    return res.status(400).json({
      error:
        "STRIPE_PRICE_ID_* must be a Price id (price_...), not a Product id (prod_...). In Stripe: Product catalog → open the product → under Pricing, copy the id that starts with price_ for your monthly plan.",
    });
  }
  if (!String(priceId).startsWith("price_")) {
    return res.status(400).json({
      error:
        "Price id in server/.env should start with price_. Copy it from the product’s Pricing section in Stripe (monthly recurring price).",
    });
  }

  const stripe = getStripe();
  const { dbUser } = req;
  const base = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // session_id lets the app call POST /sync-checkout so Pro unlocks without webhooks (local dev)
    success_url: `${CLIENT()}/plans?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${CLIENT()}/plans?checkout=cancel`,
    client_reference_id: String(dbUser.id),
    metadata: {
      appUserId: String(dbUser.id),
      plan,
    },
    subscription_data: {
      metadata: {
        appUserId: String(dbUser.id),
        plan,
      },
    },
  };

  if (dbUser.stripeCustomerId) {
    base.customer = dbUser.stripeCustomerId;
  } else {
    base.customer_email = dbUser.email;
  }

  try {
    const session = await stripe.checkout.sessions.create(base);
    if (!session.url) {
      return res.status(500).json({ error: "No checkout URL from Stripe" });
    }
    return res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout:", err);
    return res.status(500).json({ error: err.message || "Checkout failed" });
  }
});

/**
 * After returning from Checkout, the browser calls this so Neon updates even when webhooks
 * are not set up (e.g. localhost without `stripe listen`).
 */
router.post("/sync-checkout", requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error: "STRIPE_SECRET_KEY missing in server/.env",
    });
  }
  const sessionId = req.body?.sessionId;
  if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    return res.status(400).json({ error: "Invalid or missing sessionId (cs_...)." });
  }

  const db = req.db;
  if (!db) {
    return res.status(500).json({ error: "Database not available" });
  }

  const stripe = getStripe();
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "line_items.data.price", "subscription"],
    });

    const own = String(session.metadata?.appUserId || session.client_reference_id || "");
    if (!own || own !== String(req.dbUser.id)) {
      return res.status(403).json({ error: "This payment session is for a different user." });
    }

    const result = await applyCompletedSubscriptionCheckoutToUser(db, {
      userId: req.dbUser.id,
      session,
    });
    if (!result.ok) {
      if (result.error === "session_not_complete") {
        return res.status(400).json({ error: "Checkout is not complete yet. Refresh in a few seconds." });
      }
      if (result.error === "not_subscription_mode") {
        return res.status(400).json({ error: "This session is not a subscription." });
      }
      if (result.error === "plan_unresolved") {
        return res.status(400).json({ error: "Could not match plan (metadata or price id)." });
      }
      if (result.error === "missing_customer_or_subscription") {
        return res.status(500).json({ error: "Session missing customer or subscription id." });
      }
      return res.status(500).json({ error: "Could not apply checkout" });
    }

    return res.json({ ok: true, plan: result.plan });
  } catch (err) {
    console.error("sync-checkout:", err);
    return res.status(500).json({ error: err.message || "Could not confirm checkout" });
  }
});

/**
 * GET /api/stripe/invoices
 *
 * Returns the current user's recent invoices from Stripe so the Account page can render
 * them in-app (download PDF, view hosted page) without bouncing through the Customer
 * Billing Portal. Free users (no `stripeCustomerId`) get an empty list — not a 4xx —
 * so the UI can render a friendly "no invoices yet" state without special-casing.
 */
router.get("/invoices", requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error:
        "Missing STRIPE_SECRET_KEY in server/.env. Stripe Dashboard → Developers → API keys → Secret key (sk_test_...).",
    });
  }
  if (!req.dbUser.stripeCustomerId) {
    return res.json({ invoices: [], hasCustomer: false });
  }

  const stripe = getStripe();
  try {
    const list = await stripe.invoices.list({
      customer: req.dbUser.stripeCustomerId,
      limit: 12,
    });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number ?? null,
      status: inv.status ?? null,
      amountPaid: inv.amount_paid ?? 0,
      amountDue: inv.amount_due ?? 0,
      currency: (inv.currency || "usd").toUpperCase(),
      created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
      description: inv.lines?.data?.[0]?.description ?? null,
    }));
    return res.json({ invoices, hasCustomer: true });
  } catch (err) {
    console.error("Stripe invoices:", err);
    return res.status(500).json({ error: err.message || "Could not list invoices" });
  }
});

router.post("/portal", requireAuth, async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error:
        "Missing STRIPE_SECRET_KEY in server/.env. Stripe Dashboard → Developers → API keys → Secret key (sk_test_...).",
    });
  }
  if (!req.dbUser.stripeCustomerId) {
    return res.status(400).json({
      error: "No billing account yet. Start a Pro or Premium subscription first.",
    });
  }
  const stripe = getStripe();
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: req.dbUser.stripeCustomerId,
      return_url: `${CLIENT()}/plans`,
    });
    if (!session.url) {
      return res.status(500).json({ error: "No portal URL from Stripe" });
    }
    return res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal:", err);
    return res.status(500).json({ error: err.message || "Portal failed" });
  }
});

export default router;
