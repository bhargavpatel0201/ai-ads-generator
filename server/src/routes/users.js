import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { readQuotaStatus } from "../lib/plan-quota.js";

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

export default router;
