/**
 * Returns a safe internal path for client-side redirects.
 *
 * Accepts only same-origin absolute paths (e.g. `/dashboard`) and rejects:
 *   - protocol-relative URLs ("//evil.com")
 *   - absolute URLs ("https://evil.com")
 *   - empty / null inputs
 *
 * Use whenever the redirect target comes from user-controlled input
 * (e.g. `?next=...`) to prevent open-redirect attacks.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/create'): string {
  if (!raw) return fallback
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return fallback
}
