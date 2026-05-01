import toast from 'react-hot-toast'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

const providers = ['google', 'github', 'discord'] as const
export type OAuthProvider = (typeof providers)[number]

const providerLabel: Record<OAuthProvider, string> = {
  google: 'Google',
  github: 'GitHub',
  discord: 'Discord',
}

function isProvider(p: string): p is OAuthProvider {
  return (providers as readonly string[]).includes(p)
}

export function getSupabaseProjectRefFromUrl(): string | null {
  const u = import.meta.env.VITE_SUPABASE_URL
  if (!u) return null
  try {
    const host = new URL(u).hostname
    if (host.endsWith('.supabase.co')) {
      return host.replace('.supabase.co', '')
    }
  } catch {
    // ignore
  }
  return null
}

function toastOAuthNotEnabled(p: OAuthProvider) {
  const name = providerLabel[p]
  const ref = getSupabaseProjectRefFromUrl()
  const providersPage = ref
    ? `https://supabase.com/dashboard/project/${ref}/auth/providers`
    : 'https://supabase.com/dashboard'
  toast.error(
    `${name} is not enabled in Supabase. Open: ${providersPage} → turn on ${name}, add Client ID & Secret from Google Cloud, Save. In Google Cloud, set redirect URI to ${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/auth/v1/callback`,
    { duration: 14000 }
  )
}

export async function signInWithOAuth(p: string) {
  if (!isSupabaseConfigured) {
    toast.error('Add Supabase keys in client/.env to use social sign-in.')
    return
  }
  if (!isProvider(p)) {
    toast.error('Unknown provider')
    return
  }
  const redirectTo = `${window.location.origin}/create`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: p,
    options: { redirectTo },
  })
  if (!error) return

  const msg = (error.message || '').toLowerCase()
  if (
    msg.includes('not enabled') ||
    msg.includes('validation_failed') ||
    msg.includes('unsupported provider') ||
    (error as { code?: string }).code === 'validation_failed'
  ) {
    toastOAuthNotEnabled(p)
    return
  }
  toast.error(error.message)
}

/**
 * OAuth section is visible by default. Set `VITE_SHOW_OAUTH=false` to hide it
 * (e.g. before any provider is enabled in Supabase, to avoid showing buttons that toast).
 *
 * Each provider still has to be enabled in Supabase Dashboard → Authentication → Providers
 * (paste Client ID / Secret from Google Cloud / GitHub / Discord). If a user clicks a
 * disabled provider, `signInWithOAuth` shows a toast with the exact setup link.
 */
export function isOAuthSectionVisible() {
  return import.meta.env.VITE_SHOW_OAUTH !== 'false'
}
