/**
 * Origin for Supabase OAuth and email redirect URLs (`redirectTo`, `emailRedirectTo`).
 *
 * On a real deployed host (custom domain or *.vercel.app), we always use
 * `window.location.origin` so redirects never use a wrong baked-in `VITE_SITE_URL`
 * (e.g. localhost) from the build.
 *
 * Local dev: use `VITE_SITE_URL` if set (e.g. force redirects to production), else
 * the current tab origin (usually http://localhost:5173).
 */
export function getSiteOrigin(): string {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    const isLocal =
      h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.local')
    if (!isLocal) {
      return window.location.origin
    }
  }

  const raw = import.meta.env.VITE_SITE_URL?.trim()
  if (raw) {
    try {
      return new URL(raw).origin
    } catch {
      // invalid URL, fall through
    }
  }

  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
