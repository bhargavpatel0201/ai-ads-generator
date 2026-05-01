import Stripe from "stripe";
import { PLAN_LIMITS } from "./plan-quota.js";

let _stripe = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True when the secret key is a test key (`sk_test_...`) — use Dashboard test mode + test prices. */
export function isStripeTestMode() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"));
}

export function isStripeLiveMode() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"));
}

export function getPriceIdForPlan(plan) {
  if (plan === "pro") return process.env.STRIPE_PRICE_ID_PRO || null;
  if (plan === "premium") return process.env.STRIPE_PRICE_ID_PREMIUM || null;
  return null;
}

export function getPlanForPriceId(priceId) {
  if (!priceId) return "free";
  if (process.env.STRIPE_PRICE_ID_PRO && priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  if (process.env.STRIPE_PRICE_ID_PREMIUM && priceId === process.env.STRIPE_PRICE_ID_PREMIUM) return "premium";
  return "pro";
}

/**
 * Monthly credit grants. Sourced from `plan-quota.PLAN_LIMITS` so the Stripe webhook,
 * the Account UI, and the per-request quota guard all see the same numbers.
 */
export const PLAN_CREDITS = PLAN_LIMITS;

/** @param {string|null|undefined} plan */
export function getCreditsForPlan(plan) {
  if (plan === "pro") return PLAN_CREDITS.pro;
  if (plan === "premium") return PLAN_CREDITS.premium;
  return PLAN_CREDITS.free;
}
