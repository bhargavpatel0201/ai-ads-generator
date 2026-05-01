/**
 * Tiny localStorage-backed history of the last few LinkedIn-post generations.
 *
 * The composited PNG is delivered as a `data:image/png;base64,...` URL on the wire — those
 * are typically ~1 MB each and will blow `localStorage` quota after 2–3 entries. We always
 * collapse `imageUrl` down to the lightest HTTPS URL we have (`shareUrl` from Cloudinary,
 * else the Replicate `originalImageUrl`) before persisting. The current run on screen
 * still uses the full data URL — only the *history snapshot* is compacted.
 */

import type { LinkedInVariant } from './api'

export interface HistoryEntry {
  id: string
  createdAt: number
  topic: string
  tone: string
  keywords: string
  style: string
  post: string
  variants?: LinkedInVariant[]
  imageUrl: string
  originalImageUrl?: string
  shareUrl?: string | null
}

const KEY = 'linkedin-studio:history:v1'
const MAX_ENTRIES = 5
/** localStorage soft cap (≈ 4.5 MB). The trimmed entries shouldn't get near this anymore. */
const MAX_BYTES = 4_500_000

function safeRead(): HistoryEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
  } catch (err) {
    console.warn('[history] read failed', err)
    return []
  }
}

function safeWrite(entries: HistoryEntry[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false
  let trimmed = entries.slice(0, MAX_ENTRIES)
  for (let attempt = 0; attempt < MAX_ENTRIES + 1; attempt++) {
    try {
      const json = JSON.stringify(trimmed)
      if (json.length > MAX_BYTES && trimmed.length > 1) {
        trimmed = trimmed.slice(0, trimmed.length - 1)
        continue
      }
      window.localStorage.setItem(KEY, json)
      return true
    } catch (err) {
      if (trimmed.length <= 1) {
        console.warn('[history] write failed even with one entry — quota or serialization issue', err)
        return false
      }
      trimmed = trimmed.slice(0, trimmed.length - 1)
    }
  }
  return false
}

/** Pick the smallest viable image reference for long-term storage. */
function compactImage<T extends { imageUrl: string; originalImageUrl?: string; shareUrl?: string | null }>(entry: T): T {
  const isDataUrl = typeof entry.imageUrl === 'string' && entry.imageUrl.startsWith('data:')
  if (!isDataUrl) return entry
  const light = entry.shareUrl || entry.originalImageUrl
  if (light && /^https?:\/\//i.test(light)) {
    return { ...entry, imageUrl: light }
  }
  return entry
}

export function loadHistory(): HistoryEntry[] {
  return safeRead()
}

export function saveToHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry[] {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const compact = compactImage(entry)
  const next: HistoryEntry = { id, createdAt: Date.now(), ...compact }
  const merged = [next, ...safeRead().filter((h) => h.topic !== entry.topic || h.style !== entry.style)]
  const ok = safeWrite(merged)
  if (!ok) console.warn('[history] entry was not persisted')
  return safeRead()
}

export function removeHistory(id: string): HistoryEntry[] {
  const next = safeRead().filter((h) => h.id !== id)
  safeWrite(next)
  return next
}

export function clearHistory(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.removeItem(KEY)
}
