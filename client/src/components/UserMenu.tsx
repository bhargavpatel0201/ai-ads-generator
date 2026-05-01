import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CrownIcon,
  LogOutIcon,
  ReceiptIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  CreditCardIcon,
  type LucideIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { createBillingPortalSession, getUser, type CurrentUser } from '../lib/api'

type MenuItem = {
  to: string
  label: string
  icon: LucideIcon
}

/** Items above the billing block — same for everyone. */
const PRIMARY_MENU_ITEMS: MenuItem[] = [
  { to: '/create', label: 'Generate', icon: SparklesIcon },
  { to: '/community', label: 'Community', icon: UsersIcon },
  { to: '/plans', label: 'Plans', icon: CreditCardIcon },
]

function getInitials(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return 'U'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Pull the user's avatar URL out of Supabase's auth user object.
 * Supabase puts Google's photo URL in two places depending on history:
 *   1. `user_metadata.avatar_url` / `picture` — populated on most Google sign-ins.
 *   2. `identities[i].identity_data.avatar_url` / `picture` — reliably present for
 *      accounts that signed up via email and later linked Google, where
 *      `user_metadata` may be empty.
 * Returns the first non-empty match.
 */
function resolveAvatarUrl(
  metaIn: Record<string, unknown> | undefined,
  identitiesIn: ReadonlyArray<{ identity_data?: Record<string, unknown> | null }> | undefined
): string | null {
  const meta = metaIn ?? {}
  const candidates: unknown[] = [meta.avatar_url, meta.picture]
  if (Array.isArray(identitiesIn)) {
    for (const identity of identitiesIn) {
      const data = identity?.identity_data ?? {}
      candidates.push(data.avatar_url, data.picture)
    }
  }
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
  }
  return null
}

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Lazy-load plan info the first time the user opens the menu so we know whether to
  // show "Manage billing" (subscribed) or "Upgrade to Pro" (free). Cheap one-shot fetch.
  useEffect(() => {
    if (!open || !user || me !== null) return
    let cancelled = false
    getUser()
      .then((data) => {
        if (!cancelled) setMe(data)
      })
      .catch(() => {
        /* silent — menu still works without plan info */
      })
    return () => {
      cancelled = true
    }
  }, [open, user, me])

  async function handleOpenBillingPortal() {
    setOpen(false)
    setOpeningPortal(true)
    const loadingId = toast.loading('Opening Stripe billing portal…')
    try {
      const { url } = await createBillingPortalSession()
      toast.dismiss(loadingId)
      window.location.assign(url)
    } catch (err) {
      const m =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : err instanceof Error
            ? err.message
            : null
      toast.dismiss(loadingId)
      toast.error(m || 'Could not open billing portal.')
    } finally {
      setOpeningPortal(false)
    }
  }

  const profile = useMemo(() => {
    if (!user) return null
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const name =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      (user.email ? user.email.split('@')[0] : 'User')
    const avatar = resolveAvatarUrl(meta, user.identities)
    return {
      name,
      email: user.email ?? '',
      avatar,
      initials: getInitials(typeof name === 'string' ? name : ''),
    }
  }, [user])

  // Reset the "broken image" flag whenever the avatar URL changes (e.g. linking Google
  // to an email account during the same session would refresh user_metadata).
  useEffect(() => {
    setAvatarBroken(false)
  }, [profile?.avatar])

  if (!profile) return null

  const showAvatar = Boolean(profile.avatar) && !avatarBroken

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        data-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white transition hover:ring-2 hover:ring-white/30 focus:outline-none focus:ring-2 focus:ring-white/40"
        title={profile.name}
      >
        {showAvatar ? (
          <img
            src={profile.avatar!}
            alt={profile.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setAvatarBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{profile.initials}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border border-white/10 bg-[#0d0d10]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10 text-sm font-semibold">
              {showAvatar ? (
                <img
                  src={profile.avatar!}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => setAvatarBroken(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{profile.initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
              {profile.email && (
                <p className="truncate text-xs text-gray-400">{profile.email}</p>
              )}
            </div>
          </div>

          <div className="my-1 h-px bg-white/10" />

          <ul className="py-1">
            {PRIMARY_MENU_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"
                  >
                    <Icon className="size-4 text-gray-400" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="my-1 h-px bg-white/10" />

          {/* Billing block — context-aware:
                · subscribed → "Manage billing" (one click into Stripe Customer Portal)
                · free      → "Upgrade to Pro" (drives the conversion).
              "Invoices & receipts" always points at /account#billing where the in-app list lives. */}
          <ul className="py-1">
            {me?.isSubscribed ? (
              <li>
                <button
                  type="button"
                  onClick={() => void handleOpenBillingPortal()}
                  disabled={openingPortal}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CreditCardIcon className="size-4 text-gray-400" />
                  <span>{openingPortal ? 'Opening Stripe…' : 'Manage billing'}</span>
                </button>
              </li>
            ) : (
              <li>
                <Link
                  to="/plans"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-amber-100 transition hover:bg-amber-500/10"
                >
                  <CrownIcon className="size-4 text-amber-300" />
                  <span>Upgrade to Pro</span>
                </Link>
              </li>
            )}
            <li>
              <Link
                to="/account#billing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"
              >
                <ReceiptIcon className="size-4 text-gray-400" />
                <span>Invoices &amp; receipts</span>
              </Link>
            </li>
            <li>
              <Link
                to="/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"
              >
                <SettingsIcon className="size-4 text-gray-400" />
                <span>Manage account</span>
              </Link>
            </li>
          </ul>

          <div className="my-1 h-px bg-white/10" />

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-200 transition hover:bg-white/5 hover:text-white"
          >
            <LogOutIcon className="size-4 text-gray-400" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}
