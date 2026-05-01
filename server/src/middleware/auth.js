import { getDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getSupabaseAuth } from "../lib/supabase.js";
import {
  PLAN_LIMITS,
  ensureUsersSchema,
  nextMonthBoundary,
} from "../lib/plan-quota.js";

/** True when Node's fetch cannot resolve or connect to Supabase (DNS, offline, firewall). */
function isSupabaseNetworkFailure(err) {
  const msg = String(err?.message || err || "");
  const cause = err?.cause;
  const code = cause?.code || err?.code;
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ECONNREFUSED" || code === "ETIMEDOUT") {
    return true;
  }
  if (/fetch failed/i.test(msg)) return true;
  return false;
}

function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

export async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabaseAuth();
  if (!supabase) {
    return res.status(503).json({
      error:
        "Server auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in server/.env (same project as the client).",
    });
  }

  let supabaseUser;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      if (isSupabaseNetworkFailure(error)) {
        const host = (() => {
          try {
            return new URL(process.env.SUPABASE_URL || "").hostname || "your-project.supabase.co";
          } catch {
            return "your-project.supabase.co";
          }
        })();
        console.error("Supabase getUser failed (network/DNS):", error.message, error.cause || "");
        return res.status(503).json({
          error:
            `Cannot reach Supabase at ${host} (DNS or network). Check internet connection, VPN, firewall, and that SUPABASE_URL in server/.env matches your Supabase project. Try: nslookup ${host}`,
        });
      }
      console.error("Supabase getUser failed:", error.message);
      return res.status(401).json({ error: "Invalid or expired session. Sign in again." });
    }
    if (!data.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    supabaseUser = data.user;
  } catch (err) {
    if (isSupabaseNetworkFailure(err)) {
      console.error("Supabase auth error (network/DNS):", err);
      return res.status(503).json({
        error:
          "Cannot reach Supabase (network/DNS). See server logs and verify SUPABASE_URL plus connectivity.",
      });
    }
    console.error("Supabase auth error:", err);
    return res.status(500).json({ error: "Auth service unavailable" });
  }

  const email = supabaseUser.email || "user@local";
  const name =
    (typeof supabaseUser.user_metadata?.full_name === "string" &&
      supabaseUser.user_metadata.full_name) ||
    (typeof supabaseUser.user_metadata?.name === "string" && supabaseUser.user_metadata.name) ||
    email.split("@")[0] ||
    "User";
  const imageUrl =
    (typeof supabaseUser.user_metadata?.avatar_url === "string" &&
      supabaseUser.user_metadata.avatar_url) ||
    null;

  try {
    const db = getDb();
    // Add the credits_reset_at column on legacy DBs before Drizzle's auto-generated
    // SELECT lists it. Cached after first run, so this is a single HTTP roundtrip on
    // boot and a no-op afterwards.
    await ensureUsersSchema();
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, supabaseUser.id));

    if (existing) {
      req.dbUser = existing;
      req.db = db;
      return next();
    }

    const [inserted] = await db
      .insert(users)
      .values({
        authUserId: supabaseUser.id,
        email,
        name,
        imageUrl,
        credits: PLAN_LIMITS.free,
        creditsResetAt: nextMonthBoundary(),
      })
      .returning();

    if (!inserted) {
      return res.status(500).json({ error: "Could not create user" });
    }

    req.dbUser = inserted;
    req.db = db;
    next();
  } catch (err) {
    if (err?.code === "23505") {
      try {
        const db = getDb();
        const [retry] = await db
          .select()
          .from(users)
          .where(eq(users.authUserId, supabaseUser.id));
        if (retry) {
          req.dbUser = retry;
          req.db = db;
          return next();
        }
      } catch (_) {
        // fall through
      }
    }
    const statusCode = err?.statusCode || 500;
    if (statusCode === 500) {
      console.error("requireAuth / DB error:", err?.message || err);
    }
    res.status(statusCode).json({
      error:
        statusCode === 503
          ? "Database not configured. Check server/.env (DATABASE_URL)."
          : "Server error",
    });
  }
}
