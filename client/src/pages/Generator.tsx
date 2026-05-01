import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import {
  CopyIcon,
  CrownIcon,
  DicesIcon,
  DownloadIcon,
  FileTextIcon,
  HashIcon,
  HistoryIcon,
  ImageIcon,
  LinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  Share2Icon,
  SparklesIcon,
  TerminalIcon,
  Trash2Icon,
  WandSparklesIcon,
  XIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  autoClassifyTopic,
  createShareLink,
  describeApiTransportError,
  exportLinkedInPostAsPdf,
  generateLinkedInPost,
  getUser,
  regenerateLinkedInImage,
  type CurrentUser,
  type LinkedInGenerateDebug,
  type LinkedInImageFormat,
  type LinkedInVariant,
  type PlanQuotaInfo,
} from '../lib/api'
import {
  clearHistory,
  loadHistory,
  removeHistory,
  saveToHistory,
  type HistoryEntry,
} from '../lib/local-history'
import { useAuth } from '../contexts/AuthContext'
import { safeNextPath } from '../lib/nav'

const REPLICATE_BILLING_URL = 'https://replicate.com/account/billing'
/** Hard LinkedIn post-body limit. Warn earlier so people leave room for hashtags. */
const LINKEDIN_LIMIT = 3000
const LINKEDIN_WARN = 2700

function apiErrorMessage(err: unknown, fallback: string): string {
  const transport = describeApiTransportError(err)
  if (transport) return transport
  if (isAxiosError(err)) {
    const data = err.response?.data
    if (data && typeof data === 'object' && data !== null && 'error' in data) {
      const e = (data as { error: unknown }).error
      if (typeof e === 'string' && e.trim()) return e
    }
    if (typeof data === 'string' && data.trim()) return data.slice(0, 400)
  }
  return err instanceof Error ? err.message : fallback
}

/**
 * "Surprise me" pool — kept varied across domains (career, AI, dev, startup, ecommerce,
 * leadership, design, freelance, productivity) so successive clicks land in different
 * visual + tonal territory. The picker also avoids returning the current topic twice in a
 * row so two presses always change something.
 */
const SURPRISE_TOPICS = [
  // Career & education
  'Why CS degrees are still worth it in 2026',
  'I got rejected 50 times before my first dev job',
  'What nobody tells you about coding bootcamps',
  'How to stand out as a junior developer in an AI era',
  'The fastest way to break into tech without a referral',
  'Why your resume keeps getting silently rejected',
  // AI & ML
  'The dark side of AI productivity tools',
  'AI will not replace developers who think in systems',
  'Why "prompt engineer" is not a real career title',
  'How small models are quietly killing GPT-class APIs',
  'Vector databases are the new full-text search',
  'The most overhyped AI feature your team is shipping',
  // Software craft
  'Stop learning frameworks, learn fundamentals',
  'Why your GitHub green squares are lying to you',
  'Tests are documentation, not insurance',
  'TypeScript saved my team more than any framework',
  'Refactor before you scale — every single time',
  'Why I stopped chasing 100% test coverage',
  // Startup & product
  'Lessons from shipping a product nobody wanted',
  'The single metric that actually predicts retention',
  'Why founders keep mistaking growth for product-market fit',
  'How we cut our AWS bill by 70% in one weekend',
  'The day I deleted half the features and revenue went up',
  // Ecommerce & marketing
  'Why your ecommerce checkout is leaking customers',
  'The unsexy SEO move that 10x’d our traffic',
  'Email is still the highest-ROI channel — change my mind',
  'What Shopify won’t tell you about conversion optimization',
  // Leadership & teams
  'Stop hiring for "10x engineers", start hiring for clarity',
  'The standup ritual that quietly kills velocity',
  'Async-first beats remote-first every time',
  'Why your best engineer is about to quit',
  // Freelance / solopreneur
  'How I tripled my freelance rate without losing clients',
  'The proposal template that wins enterprise deals',
  'Why I stopped charging hourly and never looked back',
  // Productivity & growth
  'I tracked my time for 30 days — here is what shocked me',
  'The weekly review that replaced my entire to-do app',
  'Why "deep work" is broken for parents in tech',
  // Design & UX
  'Dark mode is not a feature, it is a baseline',
  'Why animations are eating your app’s perceived performance',
  'The UX mistake every AI chat product is repeating',
]

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual (light emojis ok)' },
  { value: 'controversial', label: 'Controversial / hot take' },
  { value: 'storytelling', label: 'Storytelling' },
] as const

const IMAGE_STYLE_OPTIONS = ['Auto', 'Minimal', 'Corporate', 'Cyberpunk', 'Isometric', '3D Render'] as const

const FORMAT_OPTIONS: ReadonlyArray<{ value: LinkedInImageFormat; label: string; size: string }> = [
  { value: 'banner', label: 'Banner', size: '1200×624' },
  { value: 'square', label: 'Square', size: '1080×1080' },
  { value: 'portrait', label: 'Portrait', size: '1080×1350' },
]

type ToneValue = (typeof TONE_OPTIONS)[number]['value']
type ImageStyleValue = (typeof IMAGE_STYLE_OPTIONS)[number]

/** `#word` matches anywhere in the post body. Dedup, preserve original casing of first hit. */
function extractHashtags(post: string): string[] {
  if (!post) return []
  const re = /(?:^|\s)#([A-Za-z][A-Za-z0-9_]{1,40})/g
  const seen = new Set<string>()
  const tags: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(post)) !== null) {
    const key = m[1].toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(`#${m[1]}`)
  }
  return tags
}

export default function Generator() {
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<ToneValue>('professional')
  const [keywords, setKeywords] = useState('')
  const [imageStyle, setImageStyle] = useState<ImageStyleValue>('Auto')
  const [format, setFormat] = useState<LinkedInImageFormat>('banner')

  const [variants, setVariants] = useState<LinkedInVariant[]>([])
  const [activeVariantIdx, setActiveVariantIdx] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const [originalImageUrl, setOriginalImageUrl] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [publicShareUrl, setPublicShareUrl] = useState('')
  const [showTextOnImage, setShowTextOnImage] = useState(true)
  const [loading, setLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [creatingShareLink, setCreatingShareLink] = useState(false)
  const [costNote, setCostNote] = useState<string | null>(null)
  const [debug, setDebug] = useState<LinkedInGenerateDebug | null>(null)

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)

  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [me, setMe] = useState<CurrentUser | null>(null)

  function requireSignedIn(): boolean {
    if (authLoading) {
      toast.error('Still loading your session…')
      return false
    }
    if (!user) {
      const next = safeNextPath(`${location.pathname}${location.search}`)
      toast.error('Sign in to use this.')
      navigate(`/sign-in?next=${encodeURIComponent(next)}`)
      return false
    }
    return true
  }

  const formRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)
  const imageAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  /** Pull live credit balance from the server whenever the auth state changes. */
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
        // Quotas are best-effort UX. Don't error-toast on read failures — generation
        // will surface the real 402 if any.
        if (!cancelled) setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  /** Apply the credit fields the server returns on every successful /posts/* call. */
  function applyQuotaFromResponse(quota: PlanQuotaInfo) {
    if (
      quota.remainingCredits == null &&
      quota.planLimit == null &&
      quota.planTier == null
    ) {
      return
    }
    setMe((prev) => {
      const base: CurrentUser = prev ?? {
        id: 0,
        email: '',
        credits: 0,
        isSubscribed: false,
      }
      return {
        ...base,
        credits: quota.remainingCredits ?? base.credits,
        planLimit: quota.planLimit ?? base.planLimit,
        planTier: quota.planTier ?? base.planTier,
        creditsResetAt: quota.creditsResetAt ?? base.creditsResetAt,
      }
    })
  }

  const planTierLabel = useMemo(() => {
    const t = String(me?.planTier ?? 'free').toLowerCase()
    return t === 'pro' ? 'Pro' : t === 'premium' ? 'Premium' : 'Free'
  }, [me?.planTier])

  const creditsResetLabel = useMemo(() => {
    if (!me?.creditsResetAt) return null
    const d = new Date(me.creditsResetAt)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }, [me?.creditsResetAt])

  const outOfCredits =
    me != null && typeof me.credits === 'number' && me.credits <= 0

  const post = variants[activeVariantIdx]?.post ?? ''
  const tags = useMemo(() => extractHashtags(post), [post])
  const charCount = post.length
  const charPercent = Math.min(100, Math.round((charCount / LINKEDIN_LIMIT) * 100))
  const charColor =
    charCount > LINKEDIN_LIMIT
      ? 'text-rose-300'
      : charCount > LINKEDIN_WARN
        ? 'text-amber-200'
        : 'text-emerald-200'

  const canGenerate = topic.trim().length > 0

  function surpriseMe() {
    const current = topic.trim().toLowerCase()
    const pool = SURPRISE_TOPICS.filter((t) => t.toLowerCase() !== current)
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? SURPRISE_TOPICS[0]
    setTopic(pick)
    toast.success('Topic filled — edit or generate.')
  }

  async function handleGenerate() {
    if (!canGenerate) {
      toast.error('Add a topic for your post.')
      return
    }
    if (!requireSignedIn()) return

    const loadingId = toast.loading(
      'Writing 3 variants with Gemini, drawing with Replicate, then adding topic text on the image…'
    )
    setLoading(true)
    setVariants([])
    setActiveVariantIdx(0)
    setImageUrl('')
    setOriginalImageUrl('')
    setShareUrl('')
    setPublicShareUrl('')
    setShowTextOnImage(true)
    setCostNote(null)
    setDebug(null)
    generateAbortRef.current?.abort()
    const controller = new AbortController()
    generateAbortRef.current = controller
    try {
      const data = await generateLinkedInPost({
        topic: topic.trim(),
        tone,
        keywords: keywords.trim(),
        style: imageStyle,
        format,
        signal: controller.signal,
      })
      const nextVariants =
        data.variants && data.variants.length > 0
          ? data.variants
          : [{ label: 'Default', post: data.post }]
      setVariants(nextVariants)
      setActiveVariantIdx(0)
      setImageUrl(data.imageUrl)
      setOriginalImageUrl(data.originalImageUrl ?? '')
      setShareUrl(data.shareUrl ?? '')
      setCostNote(data.costNote ?? null)
      setDebug(data.debug ?? null)
      applyQuotaFromResponse(data)
      const remaining = data.remainingCredits
      const successMsg =
        typeof remaining === 'number'
          ? `Post and image ready. ${remaining} ${remaining === 1 ? 'post' : 'posts'} left this month.`
          : 'Post and image ready.'
      toast.success(successMsg, { id: loadingId })

      const saved = saveToHistory({
        topic: topic.trim(),
        tone,
        keywords: keywords.trim(),
        style: imageStyle,
        post: nextVariants[0].post,
        variants: nextVariants,
        imageUrl: data.imageUrl,
        originalImageUrl: data.originalImageUrl,
        shareUrl: data.shareUrl ?? null,
      })
      setHistory(saved)
    } catch (err: unknown) {
      handleApiError(err, loadingId, () => void handleGenerate())
    } finally {
      setLoading(false)
      if (generateAbortRef.current === controller) generateAbortRef.current = null
    }
  }

  function cancelGenerate() {
    if (generateAbortRef.current) {
      generateAbortRef.current.abort()
      generateAbortRef.current = null
      toast('Generation cancelled.', { icon: '✋' })
    }
    setLoading(false)
  }

  async function handleRegenerateImage() {
    if (!topic.trim()) {
      toast.error('Pick a topic first.')
      return
    }
    if (!requireSignedIn()) return
    const loadingId = toast.loading('Regenerating image only — keeping the post text…')
    setImageLoading(true)
    imageAbortRef.current?.abort()
    const controller = new AbortController()
    imageAbortRef.current = controller
    try {
      const data = await regenerateLinkedInImage({
        topic: topic.trim(),
        tone,
        keywords: keywords.trim(),
        style: imageStyle,
        format,
        signal: controller.signal,
      })
      setImageUrl(data.imageUrl)
      setOriginalImageUrl(data.originalImageUrl ?? '')
      setShareUrl(data.shareUrl ?? '')
      setPublicShareUrl('')
      setShowTextOnImage(true)
      if (data.debug) setDebug({ ...debug, ...data.debug })
      applyQuotaFromResponse(data)
      const remaining = data.remainingCredits
      const successMsg =
        typeof remaining === 'number'
          ? `New image ready. ${remaining} ${remaining === 1 ? 'post' : 'posts'} left this month.`
          : 'New image ready.'
      toast.success(successMsg, { id: loadingId })
    } catch (err: unknown) {
      handleApiError(err, loadingId, () => void handleRegenerateImage())
    } finally {
      setImageLoading(false)
      if (imageAbortRef.current === controller) imageAbortRef.current = null
    }
  }

  async function handleAutoPick() {
    if (!topic.trim()) {
      toast.error('Type or pick a topic first — autopick reads the topic.')
      return
    }
    if (!requireSignedIn()) return
    setClassifying(true)
    const loadingId = toast.loading('Asking Gemini to pick the best tone + style…')
    try {
      const result = await autoClassifyTopic(topic.trim())
      const allowedTones = TONE_OPTIONS.map((t) => t.value) as readonly string[]
      const nextTone = (allowedTones.includes(result.tone) ? result.tone : 'professional') as ToneValue
      const nextStyle = (IMAGE_STYLE_OPTIONS as readonly string[]).includes(result.style)
        ? (result.style as ImageStyleValue)
        : 'Auto'
      setTone(nextTone)
      setImageStyle(nextStyle)
      toast.success(
        result.reason ? `Picked ${nextTone} + ${nextStyle}. ${result.reason}` : `Picked ${nextTone} + ${nextStyle}.`,
        { id: loadingId, duration: 6000 }
      )
    } catch (err: unknown) {
      toast.dismiss(loadingId)
      toast.error(apiErrorMessage(err, 'Auto-pick failed; defaults kept.'))
    } finally {
      setClassifying(false)
    }
  }

  function handleApiError(err: unknown, loadingId: string, retry?: () => void) {
    const fallback = 'Generation failed'
    if (isAxiosError(err)) {
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') {
        toast.dismiss(loadingId)
        return
      }
      const body = err.response?.data as
        | {
            error?: string
            code?: string
            action?: string
            planTier?: string
            planLimit?: number
            resetAt?: string
          }
        | undefined
      const message = apiErrorMessage(err, body?.error || err.message || fallback)
      toast.dismiss(loadingId)
      const isPlanQuota = body?.code === 'PLAN_QUOTA_EXHAUSTED'
      const isReplicateBilling =
        body?.code === 'BILLING_REQUIRED' ||
        (err.response?.status === 402 && !isPlanQuota) ||
        (err.response?.status === 429 && /replicate/i.test(message))
      const isGeminiQuota = body?.code === 'GEMINI_FREE_TIER_EXHAUSTED'
      if (isPlanQuota) {
        // Refresh local credit count so the gauge shows 0 immediately.
        setMe((prev) =>
          prev
            ? {
                ...prev,
                credits: 0,
                planLimit: body?.planLimit ?? prev.planLimit,
                planTier: body?.planTier ?? prev.planTier,
                creditsResetAt: body?.resetAt ?? prev.creditsResetAt,
              }
            : prev
        )
        const tier = String(body?.planTier ?? 'free').toLowerCase()
        const limit = body?.planLimit ?? (tier === 'pro' ? 80 : tier === 'premium' ? 240 : 5)
        const resetDate = body?.resetAt ? new Date(body.resetAt) : null
        const resetLabel =
          resetDate && !Number.isNaN(resetDate.getTime())
            ? resetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : 'next month'
        toast.custom(
          (t) => (
            <div className="pointer-events-auto flex max-w-md flex-col gap-3 rounded-xl border border-purple-300/30 bg-[#1a1a24] px-4 py-3 text-left shadow-lg">
              <div>
                <p className="text-sm font-semibold text-purple-200">
                  Monthly limit reached on the {tier === 'pro' ? 'Pro' : tier === 'premium' ? 'Premium' : 'Free'} plan
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-200">
                  You've used all {limit} of your {limit === 1 ? 'post' : 'posts'} for this cycle. Credits reset on{' '}
                  <span className="font-semibold text-white">{resetLabel}</span>.
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Upgrade for more — Pro = 80 / month, Premium = 240 / month.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Dismiss
                </button>
                <a
                  href="/plans"
                  onClick={() => toast.dismiss(t.id)}
                  className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Upgrade plan
                </a>
              </div>
            </div>
          ),
          { duration: 30_000 }
        )
      } else if (isGeminiQuota) {
        toast.custom(
          (t) => (
            <div className="pointer-events-auto flex max-w-md flex-col gap-3 rounded-xl border border-amber-300/30 bg-[#1a1a24] px-4 py-3 text-left shadow-lg">
              <div>
                <p className="text-sm font-semibold text-amber-200">Gemini free-tier daily quota is empty</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-200">
                  Three quick fixes:
                </p>
                <ol className="mt-1 ml-4 list-decimal space-y-1 text-xs text-gray-200">
                  <li>
                    Generate a fresh API key from another Google account at{' '}
                    <span className="font-mono text-amber-100">aistudio.google.com/app/apikey</span> and put it in
                    <span className="font-mono"> server/.env </span> as
                    <span className="font-mono"> GEMINI_API_KEY</span>.
                  </li>
                  <li>
                    Enable billing on the current key (~$0.0001 per generation) at
                    <span className="font-mono"> aistudio.google.com/app/usage</span>.
                  </li>
                  <li>Wait for the 00:00 Pacific reset and try again tomorrow.</li>
                </ol>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  onClick={() => {
                    window.open(body?.action || 'https://aistudio.google.com/app/apikey', '_blank', 'noopener,noreferrer')
                    toast.dismiss(t.id)
                  }}
                >
                  Get a new key
                </button>
              </div>
            </div>
          ),
          { duration: 30_000 }
        )
      } else if (isReplicateBilling) {
        toast.custom(
          (t) => (
            <div className="pointer-events-auto flex max-w-sm flex-col gap-3 rounded-xl border border-white/20 bg-[#1a1a24] px-4 py-3 text-left shadow-lg">
              <p className="text-sm text-gray-100">{message}</p>
              <button
                type="button"
                className="self-end rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1.5 text-sm font-medium text-white outline-none transition hover:opacity-90"
                onClick={() => {
                  window.open(body?.action || REPLICATE_BILLING_URL, '_blank', 'noopener,noreferrer')
                  toast.dismiss(t.id)
                }}
              >
                Billing / limits
              </button>
            </div>
          ),
          { duration: 15_000 }
        )
      } else if (retry) {
        toast.custom(
          (t) => (
            <div className="pointer-events-auto flex max-w-sm flex-col gap-3 rounded-xl border border-white/20 bg-[#1a1a24] px-4 py-3 text-left shadow-lg">
              <p className="text-sm text-gray-100">{message}</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-95"
                  onClick={() => {
                    toast.dismiss(t.id)
                    retry()
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          ),
          { duration: 12_000 }
        )
      } else {
        toast.error(message)
      }
    } else {
      toast.dismiss(loadingId)
      toast.error(err instanceof Error ? err.message : fallback)
    }
  }

  function loadHistoryEntry(entry: HistoryEntry) {
    setTopic(entry.topic)
    setTone((entry.tone as ToneValue) || 'professional')
    setKeywords(entry.keywords ?? '')
    setImageStyle((entry.style as ImageStyleValue) || 'Auto')
    const restoredVariants =
      entry.variants && entry.variants.length > 0
        ? entry.variants
        : [{ label: 'Default', post: entry.post }]
    setVariants(restoredVariants)
    setActiveVariantIdx(0)
    setImageUrl(entry.imageUrl)
    setOriginalImageUrl(entry.originalImageUrl ?? '')
    setShareUrl(entry.shareUrl ?? '')
    setShowTextOnImage(true)
    setHistoryOpen(false)
    toast.success('Loaded from history.')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleRemoveHistory(id: string) {
    const next = removeHistory(id)
    setHistory(next)
  }

  function handleClearHistory() {
    clearHistory()
    setHistory([])
    toast.success('History cleared.')
  }

  /** LinkedIn truncates massive paste; never put a base64 data URL in the bundle.
   *  Prefer the Cloudinary `shareUrl` (composited image with topic text) when available, then Replicate. */
  function copyBundle() {
    const cloudinaryLink = shareUrl && /^https?:\/\//i.test(shareUrl) ? shareUrl : ''
    const replicateLink =
      originalImageUrl && /^https?:\/\//i.test(originalImageUrl) ? originalImageUrl : ''
    const httpsLink = cloudinaryLink || replicateLink
    const text = httpsLink
      ? `${post}\n\nImage: ${httpsLink}`
      : `${post}\n\n(Image: download from the app and attach to your post.)`
    void navigator.clipboard.writeText(text)
    toast.success(
      cloudinaryLink
        ? 'Copied post + Cloudinary image URL (with topic text).'
        : httpsLink
          ? 'Copied post + raw image URL (no overlay).'
          : 'Copied post — download the image separately.'
    )
  }

  function copyForLinkedIn() {
    if (!post) return
    void navigator.clipboard.writeText(post)
    window.open('https://www.linkedin.com/feed/', '_blank', 'noopener,noreferrer')
    toast.success('Post copied — LinkedIn opened. Paste your text and attach the image.')
  }

  /** LinkedIn share-offsite: prefers our `/share/:id` page (real OG card with title/description/image),
   *  then the Cloudinary image URL, then the Replicate one. */
  function shareViaLinkedIn() {
    const linkToShare = publicShareUrl || shareUrl || originalImageUrl
    if (!linkToShare) {
      toast.error('No image URL to share — generate first.')
      return
    }
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(linkToShare)}`
    window.open(url, '_blank', 'noopener,noreferrer,width=720,height=720')
    void navigator.clipboard.writeText(post)
    toast.success(
      publicShareUrl
        ? 'LinkedIn share opened with the share page (real OG card) — text copied to paste.'
        : shareUrl
          ? 'LinkedIn share opened with Cloudinary image — text copied to paste.'
          : 'LinkedIn share opened — text copied to paste.'
    )
  }

  /** Persist a public /share/:id page so LinkedIn can fetch real OG meta tags. */
  async function handleCreateShareLink() {
    if (!post || !post.trim()) {
      toast.error('Generate a post first.')
      return
    }
    if (!requireSignedIn()) return
    const stableImage = shareUrl || originalImageUrl
    if (!stableImage || !/^https?:\/\//i.test(stableImage)) {
      toast.error(
        'Need a stable HTTPS image URL — set CLOUDINARY_URL in server/.env so the composited image gets a public URL.'
      )
      return
    }
    setCreatingShareLink(true)
    const loadingId = toast.loading('Saving share page (with OG tags)…')
    try {
      const res = await createShareLink({
        topic: topic.trim() || 'Untitled post',
        post,
        imageUrl: stableImage,
        originalImageUrl,
      })
      setPublicShareUrl(res.url)
      try {
        await navigator.clipboard.writeText(res.url)
        toast.success('Share link copied — paste anywhere; LinkedIn renders a real card.', { id: loadingId })
      } catch {
        toast.success(`Share page ready: ${res.url}`, { id: loadingId, duration: 8000 })
      }
    } catch (err: unknown) {
      toast.dismiss(loadingId)
      toast.error(apiErrorMessage(err, 'Could not create share link.'))
    } finally {
      setCreatingShareLink(false)
    }
  }

  /** Server PDF (image + post text) → Blob → file download. */
  async function handleDownloadPdf() {
    if (!post) {
      toast.error('Generate a post first.')
      return
    }
    if (!requireSignedIn()) return
    setPdfDownloading(true)
    const loadingId = toast.loading('Building PDF…')
    try {
      const stableImage = shareUrl || originalImageUrl || (imageUrl.startsWith('data:') ? imageUrl : '')
      const blob = await exportLinkedInPostAsPdf({ topic: topic.trim(), post, imageUrl: stableImage })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safe =
        topic
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 80) || 'linkedin-post'
      a.href = url
      a.download = `${safe}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('PDF ready.', { id: loadingId })
    } catch (err: unknown) {
      toast.dismiss(loadingId)
      toast.error(apiErrorMessage(err, 'PDF export failed.'))
    } finally {
      setPdfDownloading(false)
    }
  }

  function copyHashtags() {
    if (tags.length === 0) {
      toast.error('No hashtags found in this post.')
      return
    }
    void navigator.clipboard.writeText(tags.join(' '))
    toast.success(`Copied ${tags.length} hashtags.`)
  }

  /** Prefer composited PNG; remote URLs use blob download. */
  async function downloadImage() {
    const href =
      showTextOnImage && imageUrl.startsWith('data:image/') ? imageUrl : originalImageUrl || imageUrl
    const safe =
      topic
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'linkedin-header'
    try {
      if (href.startsWith('data:')) {
        const a = document.createElement('a')
        a.href = href
        a.download = `${safe}.png`
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        toast.success('Download started')
        return
      }
      const res = await fetch(href)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safe}.png`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Download started')
    } catch {
      toast.error('Could not download image')
    }
  }

  function handleFormKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const isMod = e.metaKey || e.ctrlKey
    if (isMod && e.key === 'Enter' && !loading) {
      e.preventDefault()
      void handleGenerate()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-orange-700 to-pink-600 px-4 py-8 text-white md:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold md:text-4xl">AI LinkedIn Post + Image</h1>
          <div className="flex items-center gap-2">
            {me && typeof me.planLimit === 'number' ? (
              <Link
                to="/plans"
                title={
                  creditsResetLabel
                    ? `Resets on ${creditsResetLabel}. Upgrade for more.`
                    : 'Monthly post quota'
                }
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  outOfCredits
                    ? 'border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                    : me.credits <= Math.max(1, Math.floor(me.planLimit * 0.2))
                      ? 'border-amber-300/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                      : 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                }`}
              >
                <CrownIcon className="size-3.5" />
                <span>
                  {me.credits}/{me.planLimit} {planTierLabel} posts
                </span>
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-controls="generation-history-panel"
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                historyOpen
                  ? 'border-purple-300/70 bg-purple-500/30 text-white'
                  : 'border-white/20 bg-white/10 hover:bg-white/20'
              }`}
            >
              <HistoryIcon className="size-4" />
              History
              <span className="rounded-full bg-purple-500/80 px-1.5 text-xs">{history.length}</span>
            </button>
          </div>
        </div>
        <p className="mx-auto mb-6 max-w-xl text-center text-sm opacity-90 md:text-base">
          Gemini writes <strong>3 variants</strong> in one call · Replicate SDXL paints a topic-aware banner with a
          random seed · Sharp burns the title and watermark on top · Cloudinary stores the asset · Neon backs a public share page with OG meta tags.
          <br />
          <span className="opacity-80">Cmd/Ctrl+Enter generates · Auto-pick chooses tone &amp; style · Cancel mid-run is supported.</span>
        </p>

        {historyOpen ? (
          <div
            id="generation-history-panel"
            className="mb-6 rounded-xl border border-white/20 bg-black/30 p-4 backdrop-blur-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider opacity-80">Recent generations</h2>
              {history.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="flex items-center gap-1.5 text-xs text-white/70 transition hover:text-rose-300"
                >
                  <Trash2Icon className="size-3.5" />
                  Clear all
                </button>
              ) : null}
            </div>
            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-white/70">
                <HistoryIcon className="size-6 opacity-60" />
                <p>No generations yet — your last 5 runs will appear here.</p>
                <p className="text-xs opacity-70">
                  Tip: history lives in this browser only (localStorage), so it’s private and resets if you clear site data.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((h) => (
                <div
                  key={h.id}
                  className="group relative flex flex-col gap-2 rounded-lg border border-white/15 bg-black/30 p-3 text-left text-sm transition hover:border-purple-300/60"
                >
                  <button
                    type="button"
                    onClick={() => loadHistoryEntry(h)}
                    className="flex flex-col gap-2 text-left"
                  >
                    {h.imageUrl ? (
                      <img
                        src={h.imageUrl}
                        alt={h.topic}
                        className="aspect-[1200/624] w-full rounded-md border border-white/10 object-cover"
                      />
                    ) : null}
                    <div className="line-clamp-2 font-medium">{h.topic}</div>
                    <div className="flex items-center gap-1.5 text-xs opacity-70">
                      <span className="rounded bg-white/10 px-1.5 py-0.5">{h.tone}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5">{h.style}</span>
                      <span>{new Date(h.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveHistory(h.id)
                    }}
                    aria-label="Remove from history"
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="grid gap-8 md:grid-cols-2">
          <div
            ref={formRef}
            onKeyDown={handleFormKeyDown}
            className="space-y-4 rounded-xl border border-white/20 bg-black/20 p-6 backdrop-blur-md"
          >
            <div>
              <label className="mb-2 block text-sm">Topic</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Why thoughtful engineers still win in an AI-first world"
                className="mb-2 w-full rounded-lg border border-white/20 bg-white/10 p-3 text-white outline-none placeholder:text-white/50 focus:border-purple-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={surpriseMe}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/5 py-2 text-sm font-medium transition hover:bg-white/15"
                >
                  <DicesIcon className="size-4" />
                  Surprise me
                </button>
                <button
                  type="button"
                  onClick={() => void handleAutoPick()}
                  disabled={classifying || !topic.trim()}
                  title="Ask Gemini to pick the best tone + image style for your topic"
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/5 py-2 text-sm font-medium transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {classifying ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <WandSparklesIcon className="size-4" />
                  )}
                  Auto-pick tone & style
                </button>
              </div>
            </div>

            <div>
              <span className="mb-2 block text-sm" id="tone-label">
                Tone
              </span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="tone-label">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    className={`rounded-lg border p-3 text-left text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                      tone === t.value
                        ? 'border-purple-300 bg-purple-600/80 text-white shadow-lg'
                        : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm">Keywords (optional)</label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. AI, leadership, startups"
                className="w-full rounded-lg border border-white/20 bg-white/10 p-3 text-white outline-none placeholder:text-white/50 focus:border-purple-300"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm" htmlFor="image-style">
                  Image style
                </label>
                <select
                  id="image-style"
                  value={imageStyle}
                  onChange={(e) => setImageStyle(e.target.value as ImageStyleValue)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 p-3 text-white outline-none focus:border-purple-300"
                >
                  {IMAGE_STYLE_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-zinc-900 text-white">
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="mb-2 block text-sm" id="format-label">Image format</span>
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-labelledby="format-label">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFormat(f.value)}
                      title={`${f.label} — ${f.size}`}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[11px] font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                        format === f.value
                          ? 'border-purple-300 bg-purple-600/80 text-white shadow'
                          : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className="text-[10px] opacity-70">{f.size}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="-mt-1 text-xs opacity-70">
              Auto style uses topic + tone heuristics. Format swaps the SDXL aspect ratio and the Sharp overlay band proportionally.
            </p>

            {outOfCredits ? (
              <div className="flex items-start gap-3 rounded-lg border border-rose-400/40 bg-rose-500/15 p-3 text-sm text-rose-50">
                <CrownIcon className="mt-0.5 size-4 shrink-0 text-rose-200" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    You've used all {me?.planLimit ?? 5} {planTierLabel} posts this month.
                  </p>
                  <p className="mt-0.5 text-xs text-rose-100/80">
                    Resets {creditsResetLabel ? `on ${creditsResetLabel}` : 'next month'}. Upgrade for more posts immediately.
                  </p>
                </div>
                <Link
                  to="/plans"
                  className="shrink-0 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-white"
                >
                  Upgrade
                </Link>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !canGenerate || outOfCredits}
                title={
                  outOfCredits
                    ? `Free plan is capped at ${me?.planLimit ?? 5} posts/month — upgrade or wait for the reset.`
                    : undefined
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 py-3 font-bold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2Icon className="size-5 animate-spin" /> : <SparklesIcon className="size-5" />}
                {loading
                  ? 'Generating…'
                  : outOfCredits
                    ? 'Monthly limit reached'
                    : '✨ Generate post + image'}
              </button>
              {loading ? (
                <button
                  type="button"
                  onClick={cancelGenerate}
                  title="Cancel the in-flight Replicate / Gemini call"
                  className="flex items-center justify-center gap-1 rounded-lg border border-rose-300/40 bg-rose-500/20 px-3 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/30"
                >
                  <XIcon className="size-4" />
                  Cancel
                </button>
              ) : null}
            </div>

            <p className="text-xs opacity-70">
              Tip: <kbd className="rounded bg-white/10 px-1">⌘/Ctrl</kbd>+
              <kbd className="rounded bg-white/10 px-1">Enter</kbd> generates. Server keys only; ~$0.002 per run.
            </p>
          </div>

          <div className="flex min-h-[400px] flex-col rounded-xl border border-white/20 bg-black/20 p-6 backdrop-blur-md">
            {loading && variants.length === 0 && !imageUrl && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center opacity-90">
                <Loader2Icon className="size-10 animate-spin" />
                Generating with AI…
              </div>
            )}

            {post && imageUrl && (
              <p className="mb-3 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/90">
                <span className="font-semibold text-white">Cost (typical):</span> ~$0.002 per run &middot;{' '}
                <span className="text-emerald-200">Gemini text: $0</span> &middot;{' '}
                <span className="text-amber-100">Replicate image: ~$0.002</span>
                {costNote ? (
                  <>
                    <br />
                    <span className="text-white/70">{costNote}</span>
                  </>
                ) : null}
              </p>
            )}

            {imageUrl ? (
              <div className="mb-4">
                {originalImageUrl && imageUrl.startsWith('data:image/') ? (
                  <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-white/40 bg-white/10 accent-purple-500"
                      checked={showTextOnImage}
                      onChange={(e) => setShowTextOnImage(e.target.checked)}
                    />
                    <span>Show topic text on image</span>
                  </label>
                ) : null}
                <div className="relative">
                  <img
                    src={showTextOnImage ? imageUrl : originalImageUrl || imageUrl}
                    alt="Generated header"
                    className="mb-2 w-full rounded-lg border border-white/15"
                  />
                  {imageLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm">
                      <Loader2Icon className="size-8 animate-spin" />
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRegenerateImage()}
                    disabled={imageLoading || outOfCredits}
                    title={
                      outOfCredits
                        ? `Monthly limit reached on the ${planTierLabel} plan.`
                        : 'Re-runs only the SDXL image (uses 1 credit).'
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {imageLoading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                    Regenerate image
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadImage()}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-purple-500"
                  >
                    <DownloadIcon className="size-4" />
                    Download image
                  </button>
                  <a
                    href={showTextOnImage ? imageUrl : originalImageUrl || imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-white/90 underline decoration-white/40 hover:text-white"
                  >
                    <ImageIcon className="size-4" />
                    Open image
                  </a>
                </div>
              </div>
            ) : null}

            {variants.length > 1 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {variants.map((v, i) => {
                  const len = v.post?.length ?? 0
                  const ok = len > 0 && len <= LINKEDIN_LIMIT
                  const warn = len > LINKEDIN_WARN && len <= LINKEDIN_LIMIT
                  const tagColor =
                    activeVariantIdx === i
                      ? 'bg-zinc-200 text-zinc-700'
                      : len > LINKEDIN_LIMIT
                        ? 'bg-rose-500/20 text-rose-100'
                        : warn
                          ? 'bg-amber-400/20 text-amber-100'
                          : ok
                            ? 'bg-emerald-500/20 text-emerald-100'
                            : 'bg-white/10 text-white/80'
                  return (
                    <button
                      key={`${v.label}-${i}`}
                      type="button"
                      onClick={() => setActiveVariantIdx(i)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        activeVariantIdx === i
                          ? 'bg-white text-zinc-900 shadow'
                          : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      <span>
                        Variant {i + 1}: {v.label}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tagColor}`}>
                        {len.toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {post ? (
              <>
                <label htmlFor="post-body" className="sr-only">
                  Generated LinkedIn post (editable)
                </label>
                <textarea
                  id="post-body"
                  ref={textareaRef}
                  value={post}
                  aria-label="Generated LinkedIn post (editable)"
                  title="Generated LinkedIn post"
                  placeholder="Generated post will appear here…"
                  onChange={(e) => {
                    const next = [...variants]
                    if (next[activeVariantIdx]) {
                      next[activeVariantIdx] = { ...next[activeVariantIdx], post: e.target.value }
                      setVariants(next)
                    }
                  }}
                  rows={9}
                  className="mb-2 flex-1 resize-y whitespace-pre-wrap rounded-lg border border-white/15 bg-black/25 p-4 text-sm leading-relaxed text-white outline-none focus:border-purple-300"
                />
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-2 ${charColor}`}>
                    <span className="font-semibold">{charCount.toLocaleString()}</span>
                    <span className="opacity-70">/ {LINKEDIN_LIMIT.toLocaleString()} chars</span>
                    <span className="hidden sm:inline opacity-70">
                      ({charPercent}% — LinkedIn post body limit)
                    </span>
                  </span>
                  {tags.length > 0 ? (
                    <button
                      type="button"
                      onClick={copyHashtags}
                      className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-white/90 transition hover:bg-white/20"
                    >
                      <HashIcon className="size-3" />
                      Copy {tags.length} tag{tags.length === 1 ? '' : 's'}
                    </button>
                  ) : null}
                </div>
                {tags.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs text-white/90"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {post && imageUrl ? (
              <div className="mt-auto flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={copyForLinkedIn}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 text-sm font-semibold transition hover:opacity-95"
                  >
                    <CopyIcon className="size-4" />
                    Copy for LinkedIn
                  </button>
                  <button
                    type="button"
                    onClick={shareViaLinkedIn}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-2.5 text-sm font-semibold transition hover:bg-white/15"
                  >
                    <Share2Icon className="size-4" />
                    Open share dialog
                  </button>
                  <button
                    type="button"
                    onClick={copyBundle}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-2.5 text-sm font-semibold transition hover:bg-white/15"
                  >
                    <CopyIcon className="size-4" />
                    Copy bundle
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handleCreateShareLink()}
                    disabled={creatingShareLink}
                    title="Save a public /share/:id page (with OG meta tags) so LinkedIn renders a real card"
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {creatingShareLink ? <Loader2Icon className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
                    {publicShareUrl ? 'Re-create share link' : 'Get share link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadPdf()}
                    disabled={pdfDownloading}
                    title="Single-page PDF with the image + post body"
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 py-2.5 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-50"
                  >
                    {pdfDownloading ? <Loader2Icon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
                    Download PDF
                  </button>
                </div>
                {publicShareUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    <LinkIcon className="size-4 shrink-0" />
                    <a
                      href={publicShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate underline decoration-emerald-200/60 hover:text-white"
                    >
                      {publicShareUrl}
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(publicShareUrl)
                        toast.success('Share URL copied.')
                      }}
                      className="rounded border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-50 transition hover:bg-emerald-500/30"
                    >
                      Copy
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {debug && post ? (
              <div className="mt-3 rounded-lg border border-white/15 bg-black/30 text-xs text-white/80">
                <button
                  type="button"
                  onClick={() => setDebugOpen((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/5"
                >
                  <TerminalIcon className="size-3.5" />
                  <span className="font-semibold">Debug</span>
                  <span className="opacity-70">— seed, model, prompt</span>
                  <span className="ml-auto opacity-60">{debugOpen ? '−' : '+'}</span>
                </button>
                {debugOpen ? (
                  <dl className="grid gap-2 px-3 pb-3 sm:grid-cols-[100px_1fr]">
                    {debug.seedUsed != null ? (
                      <>
                        <dt className="opacity-70">seed</dt>
                        <dd className="font-mono text-white/95">{debug.seedUsed}</dd>
                      </>
                    ) : null}
                    {debug.styleUsed ? (
                      <>
                        <dt className="opacity-70">style</dt>
                        <dd className="font-mono text-white/95">{debug.styleUsed}</dd>
                      </>
                    ) : null}
                    {debug.formatUsed ? (
                      <>
                        <dt className="opacity-70">format</dt>
                        <dd className="font-mono text-white/95">{debug.formatUsed}</dd>
                      </>
                    ) : null}
                    {debug.modelUsed ? (
                      <>
                        <dt className="opacity-70">text model</dt>
                        <dd className="font-mono text-white/95">{debug.modelUsed}</dd>
                      </>
                    ) : null}
                    {debug.promptUsed ? (
                      <>
                        <dt className="opacity-70">SDXL prompt</dt>
                        <dd className="break-words text-white/85">{debug.promptUsed}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
