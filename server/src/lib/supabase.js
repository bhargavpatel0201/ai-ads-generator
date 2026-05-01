import { createClient } from "@supabase/supabase-js";

let client;

/**
 * Anon client — used to validate end-user JWTs from the Authorization header.
 * Must match the same Supabase project as the client (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 * Configure SUPABASE_URL and SUPABASE_ANON_KEY in server/.env
 */
export function getSupabaseAuth() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return null;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
