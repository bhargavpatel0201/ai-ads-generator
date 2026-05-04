import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Paths in this file are like `/posts/generate`; the server mounts them at `/api/posts/...`.
 * So baseURL must end with `/api`. If `VITE_API_URL` is only the origin (e.g.
 * `https://ai-ads-api.onrender.com`), we append `/api` — otherwise POST hits
 * `/posts/...` and Express returns "Cannot POST /posts/...".
 */
export function normalizeViteApiBaseUrl(raw: string | undefined): string {
  const fallback = '/api'
  if (!raw?.trim()) return fallback
  const s = raw.trim()
  if (s.startsWith('/')) {
    const p = s.replace(/\/$/, '') || '/api'
    return p
  }
  try {
    const u = new URL(s)
    const path = (u.pathname || '/').replace(/\/$/, '') || '/'
    if (path === '/' || path === '') {
      return `${u.origin}/api`
    }
    if (path.endsWith('/api')) {
      return `${u.origin}${path}`
    }
    return s.replace(/\/$/, '')
  } catch {
    return fallback
  }
}

const API_URL = normalizeViteApiBaseUrl(import.meta.env.VITE_API_URL)

const api = axios.create({
  baseURL: API_URL,
})

/** Human hint when the browser hits the wrong host (e.g. Vercel static + relative /api). */
export function describeApiTransportError(err: unknown): string | undefined {
  if (!isAxiosError(err)) return undefined
  const status = err.response?.status
  if (status === 405 || status === 404) {
    const raw = import.meta.env.VITE_API_URL?.trim()
    const usingRelative = !raw || raw.startsWith('/')
    if (usingRelative && typeof window !== 'undefined' && !window.location.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
      return `No API server on this domain (${status}). In Vercel → Environment Variables set VITE_API_URL to your Node backend base URL (must end with /api, e.g. https://your-api.onrender.com/api), then redeploy.`
    }
  }
  if (status === 405) {
    return 'Server returned 405 Method Not Allowed for this API route. Confirm your backend is the Express app and POST /api/posts/auto-classify is exposed.'
  }
  return undefined
}

/** Prefer access token; refresh the session if the access token is missing (e.g. just expired). */
async function getValidAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data: s1 } = await supabase.auth.getSession()
  if (s1.session?.access_token) return s1.session.access_token
  const { data: s2, error } = await supabase.auth.refreshSession()
  if (error) return null
  return s2.session?.access_token ?? null
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (isSupabaseConfigured) {
    const token = await getValidAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export interface LinkedInVariant {
  label: string
  post: string
}

export interface LinkedInGenerateDebug {
  seedUsed?: number
  styleUsed?: string
  formatUsed?: string
  modelUsed?: string
  promptUsed?: string
}

/** Plan-quota fields the server adds to every successful /posts/* response. */
export interface PlanQuotaInfo {
  /** Generations left in the current monthly cycle, after this call. */
  remainingCredits?: number
  /** Total generations the user gets per cycle on their plan (free=5, pro=80, premium=240). */
  planLimit?: number
  /** Plan tier from Neon. Stripe webhooks update this. */
  planTier?: 'free' | 'pro' | 'premium' | string
  /** ISO timestamp when credits will reset (1st of next month UTC). */
  creditsResetAt?: string | null
}

export interface LinkedInGenerateResponse extends PlanQuotaInfo {
  post: string
  /** 1-3 distinct post variants. The first matches `post` for backwards compat. */
  variants?: LinkedInVariant[]
  /** Data URL (PNG) with topic text burned in, or HTTPS URL if overlay failed. */
  imageUrl: string
  /** Raw Replicate image URL before Sharp text overlay. */
  originalImageUrl?: string
  /** Stable Cloudinary HTTPS URL of the composited PNG (with topic text). Present when CLOUDINARY_* envs are set. */
  shareUrl?: string | null
  success: boolean
  costNote?: string
  debug?: LinkedInGenerateDebug
}

export interface LinkedInRegenerateImageResponse extends PlanQuotaInfo {
  imageUrl: string
  originalImageUrl?: string
  shareUrl?: string | null
  success: boolean
  costNote?: string
  debug?: LinkedInGenerateDebug
}

export type LinkedInImageFormat = 'banner' | 'square' | 'portrait'

export interface GenerateLinkedInArgs {
  topic: string
  tone?: string
  keywords?: string
  /** Auto | Minimal | Corporate | … — prompt suffix on server */
  style?: string
  /** banner (1200×624) | square (1080×1080) | portrait (1080×1350). Default banner. */
  format?: LinkedInImageFormat
  /** Optional AbortSignal so the UI can cancel a slow generation. */
  signal?: AbortSignal
}

/** LinkedIn copy (Gemini) + header image (Replicate SDXL). Long timeout — SDXL can be slow. */
export async function generateLinkedInPost(args: GenerateLinkedInArgs): Promise<LinkedInGenerateResponse> {
  const { signal, ...body } = args
  const res = await api.post<LinkedInGenerateResponse>('/posts/generate', body, {
    timeout: 420_000,
    signal,
  })
  return res.data
}

/** Re-runs only SDXL + Sharp. Cheap iteration when post text is good but image isn't. */
export async function regenerateLinkedInImage(
  args: GenerateLinkedInArgs
): Promise<LinkedInRegenerateImageResponse> {
  const { signal, ...body } = args
  const res = await api.post<LinkedInRegenerateImageResponse>('/posts/regenerate-image', body, {
    timeout: 300_000,
    signal,
  })
  return res.data
}

export interface AutoClassifyResponse {
  tone: 'professional' | 'casual' | 'controversial' | 'storytelling' | string
  style: string
  reason?: string
  success: boolean
}

/** Ask Gemini to pick the best tone + image style for a topic. ~$0.0001 per call. */
export async function autoClassifyTopic(topic: string): Promise<AutoClassifyResponse> {
  const res = await api.post<AutoClassifyResponse>(
    '/posts/auto-classify',
    { topic },
    { timeout: 30_000 }
  )
  return res.data
}

/** Build a single-page PDF (image + post text) for download. Returns a Blob. */
export async function exportLinkedInPostAsPdf(data: {
  topic: string
  post: string
  imageUrl?: string
}): Promise<Blob> {
  const res = await api.post<Blob>('/posts/export-pdf', data, {
    responseType: 'blob',
    timeout: 60_000,
  })
  return res.data
}

export interface CreateShareArgs {
  topic: string
  post: string
  imageUrl: string
  originalImageUrl?: string
}

export interface CreateShareResponse {
  id: string
  url: string
  success: boolean
}

/** Persist a public `/share/:id` page. Requires `DATABASE_URL` set on the server. */
export async function createShareLink(args: CreateShareArgs): Promise<CreateShareResponse> {
  const res = await api.post<CreateShareResponse>('/share', args, { timeout: 20_000 })
  return res.data
}

export interface CurrentUser {
  id: number
  email: string
  name?: string | null
  imageUrl?: string | null
  /** Posts left in the current monthly cycle. */
  credits: number
  /** Total posts the plan allows per month (free=5, pro=80, premium=240). */
  planLimit?: number
  isSubscribed: boolean
  /** 'free' | 'pro' | 'premium' — from Neon, updated by Stripe webhooks */
  planTier?: string | null
  /** ISO timestamp the next reset happens at (1st of next month UTC). */
  creditsResetAt?: string | null
  createdAt?: string
}

export async function getUser(): Promise<CurrentUser> {
  const res = await api.get<CurrentUser>('/users/me')
  return res.data
}

export interface DeleteAccountResponse {
  ok: boolean
  stripeCanceled?: boolean
  /** Requires `SUPABASE_SERVICE_ROLE_KEY` on the API server. */
  authRemoved?: boolean
}

/** Remove Neon profile, cancel Stripe sub when configured, optionally delete Supabase Auth user (service role). */
export async function deleteAccount(): Promise<DeleteAccountResponse> {
  const res = await api.delete<DeleteAccountResponse>('/users/me')
  return res.data
}

export async function createCheckoutSession(
  plan: 'pro' | 'premium'
): Promise<{ url: string }> {
  const res = await api.post<{ url: string }>('/stripe/checkout', { plan })
  return res.data
}

export async function createBillingPortalSession(): Promise<{ url: string }> {
  const res = await api.post<{ url: string }>('/stripe/portal', {})
  return res.data
}

export interface StripeInvoice {
  id: string
  number: string | null
  status: string | null
  /** Amount actually paid, in the smallest currency unit (cents for USD/EUR). */
  amountPaid: number
  amountDue: number
  /** Uppercase ISO 4217 (e.g. 'USD'). */
  currency: string
  /** ISO timestamp the invoice was created. */
  created: string | null
  periodStart: string | null
  periodEnd: string | null
  /** Stripe-hosted page (renders the invoice in a browser, with download buttons). */
  hostedInvoiceUrl: string | null
  /** Direct link to the rendered PDF. */
  invoicePdf: string | null
  description: string | null
}

export interface ListInvoicesResponse {
  invoices: StripeInvoice[]
  /** False when the user has never had a Stripe customer record (e.g. always-free). */
  hasCustomer: boolean
}

/**
 * Fetch the current user's recent Stripe invoices. Returns an empty list for users
 * who have never subscribed — never throws on free users.
 */
export async function listInvoices(): Promise<ListInvoicesResponse> {
  const res = await api.get<ListInvoicesResponse>('/stripe/invoices')
  return res.data
}

/** Call after ?checkout=success&session_id=... so the DB updates without Stripe webhooks (e.g. local dev). */
export async function syncCheckoutSession(sessionId: string): Promise<{ plan: string }> {
  const maxAttempts = 4
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * attempt))
    }
    try {
      const res = await api.post<{ ok: boolean; plan: string }>('/stripe/sync-checkout', { sessionId })
      return { plan: res.data.plan ?? 'pro' }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      const msg = err.response?.data?.error
      const isNotReady =
        typeof msg === 'string' && msg.toLowerCase().includes('not complete')
      if (isNotReady && attempt < maxAttempts - 1) continue
      throw e
    }
  }
  throw new Error('sync-checkout failed after retries')
}
