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

/**
 * Supabase may redirect to **Site URL** (often still `http://localhost:5173`) when
 * Redirect URLs / Site URL are misconfigured. If we're on localhost with session
 * fragments in the hash and `VITE_SITE_URL` points at production, forward the hash
 * there so `detectSessionInUrl` can run on the real site.
 */
export function redirectAuthHashFromLocalhostToConfiguredSite(): void {
  if (typeof window === 'undefined') return
  const { hostname, hash, pathname, search } = window.location
  const isLoopback =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  if (!isLoopback) return
  if (!hash || !hash.includes('access_token=')) return

  const raw = import.meta.env.VITE_SITE_URL?.trim()
  if (!raw) return

  let targetOrigin: string | null = null
  try {
    const u = new URL(raw)
    const h = u.hostname
    if (h === 'localhost' || h === '127.0.0.1') return
    targetOrigin = u.origin
  } catch {
    return
  }

  window.location.replace(targetOrigin + pathname + search + hash)
}
