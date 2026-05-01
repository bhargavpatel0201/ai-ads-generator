/**
 * Public origin used for Supabase OAuth and email redirect URLs.
 * On Vercel/production, set VITE_SITE_URL to your canonical URL (e.g.
 * https://www.aiadsbypatel.online) so redirects never go to localhost after Google sign-in.
 */
export function getSiteOrigin(): string {
  const raw = import.meta.env.VITE_SITE_URL?.trim()
  if (raw) {
    try {
      return new URL(raw).origin
    } catch {
      // invalid URL, fall back below
    }
  }
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
