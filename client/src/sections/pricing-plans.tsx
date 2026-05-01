import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../contexts/AuthContext'
import {
  getUser,
  createCheckoutSession,
  createBillingPortalSession,
  syncCheckoutSession,
  type CurrentUser,
} from '../lib/api'

type PlanId = 'free' | 'pro' | 'premium'

type Plan = {
  id: PlanId
  name: string
  price: string
  priceSuffix?: string
  sub: string
  features: string[]
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    sub: 'Always free',
    features: [
      '5 LinkedIn posts / month',
      'Auto image style',
      '1200×624 header image',
      'Topic text overlay (Sharp)',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9',
    priceSuffix: '/month',
    sub: 'Only billed monthly',
    features: [
      '80 LinkedIn posts / month',
      'All image styles (Cyberpunk, Isometric, …)',
      '3-variant generation',
      'Image-only regeneration',
      'Priority support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$29',
    priceSuffix: '/month',
    sub: 'Only billed monthly',
    features: [
      '240 LinkedIn posts / month',
      'All Pro features',
      'Higher rate limits',
      'Saved history (server-side)',
      'Chat + Email support',
    ],
  },
]

/**
 * Supabase `user_metadata.plan` or `app_metadata.plan` (e.g. from Stripe webhooks) overrides DB.
 * Otherwise, `is_subscribed` in Neon → Pro; else Free.
 */
function readMetadataPlan(user: User): PlanId | undefined {
  const raw =
    (user.user_metadata as { plan?: string } | undefined)?.plan ??
    (user.app_metadata as { plan?: string } | undefined)?.plan
  if (raw == null || String(raw).trim() === '') return undefined
  const n = String(raw).toLowerCase().trim()
  if (n === 'free' || n === 'pro' || n === 'premium') return n
  return undefined
}

function resolveCurrentPlanId(user: User, me: CurrentUser | null): PlanId {
  const fromMeta = readMetadataPlan(user)
  if (fromMeta !== undefined) return fromMeta
  const t = me?.planTier
  if (t === 'free' || t === 'pro' || t === 'premium') return t
  if (me?.isSubscribed) return 'pro'
  return 'free'
}

type Props = {
  showHeading?: boolean
}

export default function PricingPlans({ showHeading = true }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [me, setMe] = useState<CurrentUser | null | undefined>(undefined)
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null)
  const checkoutSyncing = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setMe(null)
      return
    }
    let cancelled = false
    getUser()
      .then((data) => {
        if (!cancelled) setMe(data)
      })
      .catch(() => {
        if (!cancelled) setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  useEffect(() => {
    const c = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')

    if (c === 'cancel') {
      toast('Checkout canceled', { icon: 'ℹ️' })
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          n.delete('checkout')
          n.delete('session_id')
          return n
        },
        { replace: true }
      )
      return
    }

    if (c !== 'success' || !user) return
    if (checkoutSyncing.current) return
    checkoutSyncing.current = true

    ;(async () => {
      try {
        if (sessionId) {
          const { plan } = await syncCheckoutSession(sessionId)
          toast.success(
            plan === 'premium'
              ? 'Premium is active — your subscription is connected.'
              : 'Pro is active — your subscription is connected.'
          )
        } else {
          toast.success('Subscription updated — you’re on your new plan.')
        }
        const data = await getUser()
        setMe(data)
      } catch (e) {
        const m =
          e && typeof e === 'object' && 'response' in e
            ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
            : undefined
        toast.error(
          m ||
            'Could not confirm payment in the app. Check the API is running and STRIPE_SECRET_KEY is set, or set up Stripe webhooks for production.',
          { duration: 8000 }
        )
      } finally {
        checkoutSyncing.current = false
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev)
            n.delete('checkout')
            n.delete('session_id')
            return n
          },
          { replace: true }
        )
      }
    })()
  }, [searchParams, setSearchParams, user])

  const currentPlanId = useMemo((): PlanId | null => {
    if (authLoading) return null
    if (!user) return null
    if (me === undefined) return null
    return resolveCurrentPlanId(user, me)
  }, [user, me, authLoading])

  async function handlePlanCta(plan: Plan) {
    const q = new URLSearchParams()
    if (plan.id === 'pro' || plan.id === 'premium') q.set('next', '/plans')
    const qs = q.toString() ? `?${q.toString()}` : ''

    if (!user) {
      navigate(`/sign-in${qs}`)
      return
    }

    if (plan.id === 'free') {
      if (currentPlanId && currentPlanId !== 'free') {
        setLoadingPlan('free')
        try {
          const { url } = await createBillingPortalSession()
          window.location.assign(url)
        } catch (e) {
          const m =
            e && typeof e === 'object' && 'response' in e
              ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          toast.error(m || 'Open the billing portal from Stripe (configure STRIPE_ keys & portal).')
        } finally {
          setLoadingPlan(null)
        }
      }
      return
    }

    setLoadingPlan(plan.id)
    try {
      const { url } = await createCheckoutSession(plan.id)
      window.location.assign(url)
    } catch (e) {
      const m =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(
        m ||
          'Could not start checkout. Set STRIPE_SECRET_KEY and price IDs on the server, then restart the API.',
        { duration: 6000 }
      )
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <section
      className={`w-full ${showHeading ? 'mt-10 md:mt-12' : 'mt-12 md:mt-16'}`}
      id="pricing"
    >
      {showHeading && (
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Pricing Plans</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-[15px]">
            Our Pricing Plans are simple, transparent and flexible. Choose the plan that best suits your needs.
          </p>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-md grid-cols-1 items-stretch gap-6 lg:max-w-6xl lg:grid-cols-3 lg:gap-6">
        {PLANS.map((plan, index) => {
          const isActive = currentPlanId !== null && currentPlanId === plan.id
          return (
          <motion.article
            key={plan.id}
            className={`plan-card relative flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl border p-7 shadow-black/20 md:min-h-[500px] md:p-8 ${
              isActive
                ? 'border-[#5865F2]/50 bg-gradient-to-b from-[#1a1a24] to-[#0f0f16] shadow-[0_0_0_1px_rgba(88,101,242,0.25),0_24px_60px_rgba(0,0,0,0.5)]'
                : 'border-white/[0.09] bg-gradient-to-b from-[#18181d] to-[#0c0c10] shadow-lg'
            }`}
            initial={{ y: 32, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, type: 'spring', stiffness: 280, damping: 72, mass: 1 }}
          >
            {isActive && (
              <span className="absolute right-5 top-5 rounded-md bg-[#5865F2] px-2.5 py-1 text-[11px] font-semibold text-white md:right-7 md:top-7">
                Active
              </span>
            )}

            {/* — Top: plan name + price — */}
            <div className={`shrink-0 ${isActive ? 'pr-12' : ''}`}>
              <h3 className="text-base font-semibold text-white md:text-lg">{plan.name}</h3>
              <div className="mt-4 md:mt-5">
                <p className="text-[2.125rem] font-semibold leading-none tracking-tight text-white md:text-4xl">
                  {plan.price}
                  {plan.priceSuffix && (
                    <span className="text-base font-medium text-zinc-200 md:text-lg"> {plan.priceSuffix}</span>
                  )}
                </p>
                <p className="mt-2.5 text-sm text-zinc-500">{plan.sub}</p>
              </div>
            </div>

            {/* — Divider — */}
            <div className="my-6 h-px w-full shrink-0 bg-white/[0.12]" />

            {/* — Features (grow) — */}
            <ul className="flex grow flex-col gap-3.5 text-[14px] leading-relaxed text-zinc-300">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckIcon
                    className="mt-0.5 size-[18px] shrink-0 text-white/90"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* — Bottom CTA — */}
            <div className="mt-auto w-full shrink-0 pt-6 md:pt-8">
              {!isActive ? (
                <button
                  type="button"
                  className="w-full rounded-xl bg-[#5865F2] py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition hover:bg-[#4752C4] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loadingPlan !== null}
                  onClick={() => void handlePlanCta(plan)}
                >
                  {loadingPlan === plan.id
                    ? 'Please wait…'
                    : plan.id === 'free' && user && currentPlanId && currentPlanId !== 'free'
                      ? 'Manage billing / cancel'
                      : 'Switch to this plan'}
                </button>
              ) : (
                <div className="h-[3.25rem]" aria-hidden />
              )}
            </div>
          </motion.article>
          )
        })}
      </div>
    </section>
  )
}
