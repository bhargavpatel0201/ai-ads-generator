import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAN_LIMITS,
  DEFAULT_PLAN,
  normalizePlanTier,
  getPlanLimit,
  nextMonthBoundary,
  isCycleExpired,
  PlanQuotaError,
} from "./plan-quota.js";

test("PLAN_LIMITS matches the user-visible pricing copy (5 / 80 / 240)", () => {
  assert.equal(PLAN_LIMITS.free, 5);
  assert.equal(PLAN_LIMITS.pro, 80);
  assert.equal(PLAN_LIMITS.premium, 240);
  assert.equal(DEFAULT_PLAN, "free");
});

test("normalizePlanTier accepts canonical values, falls back to free for anything else", () => {
  assert.equal(normalizePlanTier("free"), "free");
  assert.equal(normalizePlanTier("pro"), "pro");
  assert.equal(normalizePlanTier("premium"), "premium");
  assert.equal(normalizePlanTier("PRO"), "pro");
  assert.equal(normalizePlanTier(" Premium "), "premium");
  assert.equal(normalizePlanTier(undefined), "free");
  assert.equal(normalizePlanTier(null), "free");
  assert.equal(normalizePlanTier(""), "free");
  assert.equal(normalizePlanTier("enterprise"), "free");
});

test("getPlanLimit returns the correct number for each plan tier", () => {
  assert.equal(getPlanLimit("free"), 5);
  assert.equal(getPlanLimit("pro"), 80);
  assert.equal(getPlanLimit("premium"), 240);
  // Unknown → free fallback
  assert.equal(getPlanLimit("custom"), 5);
});

test("nextMonthBoundary returns 1st-of-next-month at 00:00 UTC", () => {
  const mid = new Date(Date.UTC(2026, 4, 15, 12, 30, 0)); // 15 May 2026 12:30 UTC
  const next = nextMonthBoundary(mid);
  assert.equal(next.toISOString(), "2026-06-01T00:00:00.000Z");
});

test("nextMonthBoundary rolls year over from December → January", () => {
  const dec = new Date(Date.UTC(2026, 11, 31, 23, 59, 59));
  const next = nextMonthBoundary(dec);
  assert.equal(next.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("nextMonthBoundary called from the very first second of a month still advances", () => {
  // Edge case: caller is exactly on the boundary already.
  const start = new Date(Date.UTC(2026, 6, 1, 0, 0, 0)); // 1 Jul 2026 00:00 UTC
  const next = nextMonthBoundary(start);
  assert.equal(next.toISOString(), "2026-08-01T00:00:00.000Z");
});

test("isCycleExpired treats null / undefined / invalid dates as expired", () => {
  assert.equal(isCycleExpired(null), true);
  assert.equal(isCycleExpired(undefined), true);
  assert.equal(isCycleExpired("not a date"), true);
});

test("isCycleExpired returns true for past timestamps and false for future ones", () => {
  const now = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
  const past = new Date(Date.UTC(2026, 4, 1, 0, 0, 0));
  const future = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));
  assert.equal(isCycleExpired(past, now), true);
  assert.equal(isCycleExpired(future, now), false);
});

test("isCycleExpired treats 'exactly now' as expired so ties trigger a fresh cycle", () => {
  const now = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
  const sameInstant = new Date(now.getTime());
  assert.equal(isCycleExpired(sameInstant, now), true);
});

test("PlanQuotaError carries plan metadata and a stable error code", () => {
  const reset = new Date(Date.UTC(2026, 6, 1));
  const err = new PlanQuotaError({ planTier: "free", planLimit: 5, resetAt: reset });
  assert.equal(err.name, "PlanQuotaError");
  assert.equal(err.code, "PLAN_QUOTA_EXHAUSTED");
  assert.equal(err.planTier, "free");
  assert.equal(err.planLimit, 5);
  assert.equal(err.resetAt, reset);
  assert.match(err.message, /free plan/i);
  assert.match(err.message, /5 posts/);
});
