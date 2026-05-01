import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  LogOutIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  createBillingPortalSession,
  getUser,
  listInvoices,
  type CurrentUser,
  type StripeInvoice,
} from '../lib/api'

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  premium: 'Premium',
}

/** Format a Stripe minor-unit amount (cents) as a localised currency string. */
function formatStripeAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

function formatInvoiceDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Account() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()
  const [me, setMe] = useState<CurrentUser | null>(null)

  const [name, setName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [openingPortal, setOpeningPortal] = useState(false)

  const [invoices, setInvoices] = useState<StripeInvoice[]>([])
  const [hasStripeCustomer, setHasStripeCustomer] = useState<boolean | null>(null)
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/sign-in?next=/account', { replace: true })
      return
    }
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const initial =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      ''
    setName(initial)
    getUser()
      .then(setMe)
      .catch(() => setMe(null))

    // Load invoices in parallel. Free users return an empty list, not an error.
    setInvoicesLoading(true)
    setInvoicesError(null)
    listInvoices()
      .then((data) => {
        setInvoices(data.invoices)
        setHasStripeCustomer(data.hasCustomer)
      })
      .catch((err: unknown) => {
        const m =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : err instanceof Error
              ? err.message
              : null
        setInvoicesError(m || 'Could not load invoices.')
      })
      .finally(() => setInvoicesLoading(false))
  }, [user, authLoading, navigate])

  const isOAuth = useMemo(() => {
    if (!user) return false
    const providers = user.app_metadata?.providers as string[] | undefined
    if (Array.isArray(providers) && providers.length > 0) {
      return providers.some((p) => p && p !== 'email')
    }
    return user.app_metadata?.provider !== 'email'
  }, [user])

  async function handleSaveName(e: FormEvent) {
    e.preventDefault()
    setSavingName(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name, name } })
      if (error) throw error
      toast.success('Profile updated')
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Could not update profile'
      toast.error(m)
    } finally {
      setSavingName(false)
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Password updated')
      setPassword('')
      setConfirm('')
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Could not update password'
      toast.error(m)
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleOpenPortal() {
    setOpeningPortal(true)
    try {
      const { url } = await createBillingPortalSession()
      window.location.assign(url)
    } catch (err) {
      const m =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : err instanceof Error
            ? err.message
            : undefined
      toast.error(m || 'Could not open billing portal.')
    } finally {
      setOpeningPortal(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  const planLabel = PLAN_LABEL[me?.planTier ?? 'free'] ?? 'Free'

  return (
    <main className="mx-auto max-w-3xl px-4 pt-28 pb-16 text-gray-200 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Account</h1>
          <p className="mt-2 text-sm text-gray-400">
            Manage your profile, security, and subscription.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-200 hover:bg-white/5"
        >
          <LogOutIcon className="size-4" />
          Sign out
        </button>
      </div>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <p className="mt-1 text-sm text-gray-400">{user.email}</p>

        <form onSubmit={(e) => void handleSaveName(e)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-medium uppercase tracking-wider text-gray-500">
              Display name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
              placeholder="Your name"
            />
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-gray-200 disabled:opacity-60"
          >
            {savingName ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section id="billing" className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Subscription &amp; billing</h2>
        <p className="mt-1 text-sm text-gray-400">
          You are on the <span className="font-medium text-white">{planLabel}</span> plan
          {typeof me?.credits === 'number' && typeof me?.planLimit === 'number' && (
            <>
              {' '}— <span className="font-medium text-white">{me.credits}</span> of{' '}
              <span className="font-medium text-white">{me.planLimit}</span> posts left this month
            </>
          )}
          .
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {me?.isSubscribed ? (
            <button
              type="button"
              onClick={() => void handleOpenPortal()}
              disabled={openingPortal}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-100 transition hover:bg-white/10 disabled:opacity-60"
            >
              {openingPortal ? <Loader2Icon className="size-4 animate-spin" /> : <ExternalLinkIcon className="size-4" />}
              {openingPortal ? 'Opening…' : 'Manage billing on Stripe'}
            </button>
          ) : (
            <Link
              to="/plans"
              className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Upgrade plan
            </Link>
          )}
          <Link to="/plans" className="text-sm text-gray-400 underline-offset-4 hover:text-white hover:underline">
            View all plans
          </Link>
        </div>

        {/* Invoices live below the subscription panel — Stripe is the source of truth, we
            just render their list in-app so users can download PDFs without bouncing
            through the Customer Portal. */}
        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileTextIcon className="size-4" />
                Invoices &amp; receipts
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                Past 12 invoices from Stripe. Click an invoice to view it on Stripe, or download the PDF directly.
              </p>
            </div>
            {invoicesLoading ? (
              <Loader2Icon className="size-4 animate-spin text-gray-400" />
            ) : null}
          </div>

          {invoicesError ? (
            <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {invoicesError}
            </p>
          ) : invoices.length === 0 ? (
            <p className="mt-4 rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-xs text-gray-300">
              {hasStripeCustomer === false
                ? 'No invoices yet — you’ll see them here after your first Pro or Premium payment.'
                : invoicesLoading
                  ? 'Loading invoices…'
                  : 'No invoices found for your Stripe customer.'}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-black/30">
              {invoices.map((inv) => {
                const dateLabel = formatInvoiceDate(inv.created)
                const amountLabel = formatStripeAmount(inv.amountPaid || inv.amountDue, inv.currency)
                const statusLabel = (inv.status || 'unknown').toLowerCase()
                const statusColor =
                  statusLabel === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-300/40'
                    : statusLabel === 'open' || statusLabel === 'draft'
                      ? 'bg-amber-500/20 text-amber-200 ring-amber-300/40'
                      : statusLabel === 'void' || statusLabel === 'uncollectible'
                        ? 'bg-rose-500/20 text-rose-200 ring-rose-300/40'
                        : 'bg-white/10 text-gray-200 ring-white/15'
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{inv.number || inv.id}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${statusColor}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {dateLabel}
                        {inv.description ? ` · ${inv.description}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-white">{amountLabel}</span>
                      {inv.invoicePdf ? (
                        <a
                          href={inv.invoicePdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download PDF"
                          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/90 transition hover:bg-white/10"
                        >
                          <DownloadIcon className="size-3.5" />
                          PDF
                        </a>
                      ) : null}
                      {inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View on Stripe"
                          className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-xs text-white transition hover:bg-white/20"
                        >
                          <ExternalLinkIcon className="size-3.5" />
                          View
                        </a>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      {!isOAuth && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Security</h2>
          <p className="mt-1 text-sm text-gray-400">Change the password you use to sign in.</p>

          <form onSubmit={(e) => void handleChangePassword(e)} className="mt-5 space-y-4">
            <div>
              <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-gray-500">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-xs font-medium uppercase tracking-wider text-gray-500">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
                placeholder="Re-enter the new password"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-gray-200 disabled:opacity-60"
            >
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>
      )}
    </main>
  )
}
