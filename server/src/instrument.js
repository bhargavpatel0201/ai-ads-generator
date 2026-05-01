/**
 * Sentry initialisation.
 *
 * Per the @sentry/node v9 docs, this MUST be imported before any other module
 * we want to monitor (Express, http, our routes, etc.). It runs at side-effect
 * import time so auto-instrumentation can patch Node's http/https and Express.
 *
 * Set SENTRY_DSN in server/.env to enable. Without it, this is a no-op.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

if (process.env.SENTRY_DSN) {
  const Sentry = await import("@sentry/node");

  const env = process.env.NODE_ENV || "development";
  const isProd = env === "production";

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: env,
    release: process.env.SENTRY_RELEASE,

    // Performance monitoring (transactions). Lower in prod to control quota.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? (isProd ? 0.1 : 1.0)),

    // Capture user IPs / request headers / cookies. Opt-in per v9 best practice.
    sendDefaultPii: true,

    // Drop noisy expected errors before they hit Sentry's quota.
    ignoreErrors: [
      "ECONNRESET",
      "EPIPE",
      "Stripe webhook verify",
    ],

    // Strip secrets from breadcrumbs and request data.
    beforeSend(event) {
      const headers = event.request?.headers;
      if (headers) {
        for (const k of Object.keys(headers)) {
          if (/authorization|cookie|stripe-signature|x-api-key/i.test(k)) {
            headers[k] = "[Filtered]";
          }
        }
      }
      const data = event.request?.data;
      if (data && typeof data === "object") {
        for (const k of Object.keys(data)) {
          if (/password|secret|token|key/i.test(k)) {
            data[k] = "[Filtered]";
          }
        }
      }
      return event;
    },
  });

  console.log(`[sentry] enabled (env=${env}, tracesSampleRate=${process.env.SENTRY_TRACES_SAMPLE_RATE ?? (isProd ? 0.1 : 1.0)})`);
}
