// IMPORTANT: ./instrument.js must be the very first import — it loads .env and
// initialises Sentry before any other module (Express, our routes, etc.) is loaded,
// so Sentry's auto-instrumentation can patch http/https and Express.
import "./instrument.js";

import * as Sentry from "@sentry/node";
import http from "node:http";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import postsRouter from "./routes/posts.js";
import usersRouter from "./routes/users.js";
import { ensureUsersSchema } from "./lib/plan-quota.js";
import webhooksRouter from "./routes/webhooks.js";
import sharesRouter from "./routes/shares.js";
import stripeRouter, { stripeWebhook } from "./routes/stripe.js";
import { isStripeLiveMode, isStripeTestMode, isStripeConfigured } from "./lib/stripe.js";

if (!String(process.env.DATABASE_URL || "").trim()) {
  console.warn(
    "[env] DATABASE_URL is empty or missing. In server/.env set: DATABASE_URL=postgresql://... (from Neon → Connection string, one line, no spaces around =)."
  );
}

const app = express();
const PORT = process.env.PORT || 5000;

const isProd = process.env.NODE_ENV === "production";
const localhostDev = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

/** Comma-separated CLIENT_URL values (e.g. prod + local) are all allowed. */
function parseClientOrigins() {
  const raw = String(process.env.CLIENT_URL || "").trim();
  if (!raw) return ["http://localhost:5173"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const configuredOrigins = new Set(parseClientOrigins());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (configuredOrigins.has(origin)) return cb(null, true);
      // Local Vite dev when CLIENT_URL points only at production
      if (!isProd && localhostDev.test(origin)) return cb(null, true);
      // Optional: allow any *.vercel.app preview (set CORS_ALLOW_VERCEL=1 on the API host)
      if (process.env.CORS_ALLOW_VERCEL === "1") {
        try {
          const host = new URL(origin).hostname;
          if (host.endsWith(".vercel.app")) return cb(null, true);
        } catch {
          /* ignore */
        }
      }
      return cb(null, false);
    },
  })
);
app.use("/api/webhooks", webhooksRouter);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(express.json({ limit: "1mb" }));

app.use("/api/stripe", stripeRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Verify Sentry is reachable from this deploy:  curl http://<host>/api/health/sentry
// Throws on purpose so the error handler captures it. Returns 500 to the caller.
app.get("/api/health/sentry", () => {
  throw new Error("Sentry health check");
});

// Cap LinkedIn-post generation per IP. Each call hits Replicate (paid) and Gemini.
// Skipped in tests via NODE_ENV=test if needed.
const postsLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.POSTS_RATE_LIMIT_PER_MIN || 10),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error:
      "Rate limit hit (10 LinkedIn-post generations per minute per IP). Wait ~60s and try again.",
  },
});
app.use("/api/posts", postsLimiter, postsRouter);
app.use("/api/users", usersRouter);

// Two mount points for the same router:
//   POST /api/share         → JSON, creates a share row.
//   GET  /share/:id         → SSR HTML page with OG meta tags (LinkedIn crawls this).
app.use("/api/share", sharesRouter);
app.use("/share", sharesRouter);

// MUST be registered AFTER all routes so it can capture thrown errors.
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Final fallback error handler (runs after Sentry has captured the event).
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const server = http.createServer(app);
/** Avoid MaxListenersExceededWarning during brief EADDRINUSE retry loops. */
server.setMaxListeners(32);

/** Let the OS release the port before `node --watch` / nodemon starts the next process. */
function gracefulShutdown(signal) {
  console.log(`[server] ${signal} — closing HTTP listener`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGINT", () => gracefulShutdown("SIGINT"));

function logListenBanner() {
  console.log(`Server running on port ${PORT}`);
  // Fire-and-forget schema bootstrap so the new credits_reset_at column exists before
  // the first authenticated request arrives. Failures are logged but non-fatal —
  // requireAuth re-runs the same idempotent ALTER if this skips for any reason.
  if (process.env.DATABASE_URL) {
    ensureUsersSchema()
      .then(() => console.log("[server] users.credits_reset_at column ready"))
      .catch(() => {
        /* already logged inside ensureUsersSchema */
      });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn(
      "[auth] SUPABASE_URL and SUPABASE_ANON_KEY are not set — /api/* protected routes will return 503 until they match your client Supabase project."
    );
  }
  if (isStripeConfigured()) {
    if (isStripeTestMode()) {
      console.log("[stripe] test mode (sk_test_...) — use Test mode in Dashboard, test card 4242 4242 4242 4242");
    } else if (isStripeLiveMode()) {
      console.warn(
        "[stripe] LIVE mode (sk_live_...) — real charges. For test-only, replace with sk_test_ from Dashboard (Test mode) and test Price ids."
      );
    }
  }
}

let bindAttempts = 0;
const MAX_BIND_ATTEMPTS = 8;

function bindOrRetry() {
  bindAttempts += 1;

  const onError = (err) => {
    server.removeListener("error", onError);
    if (err.code !== "EADDRINUSE") {
      console.error(err);
      process.exit(1);
    }
    if (bindAttempts >= MAX_BIND_ATTEMPTS) {
      console.error(
        `[server] Port ${PORT} is still in use after ${MAX_BIND_ATTEMPTS} tries.\n` +
          `Another process owns that port (duplicate "npm run dev", old Node, or IIS). Stop it, then restart.\n` +
          `  PowerShell:  Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n` +
          `  Or use another port: set PORT=5001 in server/.env and VITE_DEV_API_PORT=5001 when starting Vite (see client/vite.config.js).`
      );
      process.exit(1);
    }
    const ms = Math.min(1200, 120 + bindAttempts * 100);
    console.warn(
      `[server] Port ${PORT} in use — retry ${bindAttempts}/${MAX_BIND_ATTEMPTS} in ${ms}ms (nodemon race vs stuck process)`
    );
    setTimeout(() => {
      server.close(() => bindOrRetry());
    }, ms);
  };

  server.once("error", onError);
  server.listen(PORT, () => {
    server.removeListener("error", onError);
    bindAttempts = 0;
    logListenBanner();
  });
}

bindOrRetry();
