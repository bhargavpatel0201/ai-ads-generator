# AI LinkedIn Studio

## Architecture

- **Frontend:** React + Vite + Tailwind, deployed via Nginx (static) with `/api` proxied to Node.
- **Backend:** Node.js + Express + PM2.
- **AI pipeline:** Google Gemini (`GEMINI_TEXT_MODEL` in `server/.env`, often `gemini-2.5-flash`) for post text → Replicate SDXL for a base image at the **selected format** (1200×624 banner / 1080×1080 square / 1080×1350 portrait) with **semantic prompt mapping**, optional **style** suffix, and a **random seed** per run → **Sharp** SVG overlay for the topic title + a faint app watermark (SDXL does not render legible type) → optional **Cloudinary** upload of the composited PNG → optional **Neon-backed `/share/:id` page** with full OG/Twitter meta tags for real link-preview cards.
- **Infra (production):** DigitalOcean VPS Ubuntu 22.04 + Let’s Encrypt SSL (or equivalent).

## Tier 2: Server-side API security

`GEMINI_API_KEY` / `GOOGLE_GEMINI_API_KEY` / `GOOGLE_API_KEY` and `REPLICATE_API_TOKEN` live in **`server/.env`**. All AI calls go through **`POST /api/posts/generate`** and **`POST /api/posts/regenerate-image`**. The client receives only generated content (post text + image URL or data URL). Typical **cost per generation: ~$0.002** (Replicate SDXL image).

Both endpoints are protected by **`express-rate-limit`** at **10 requests per minute per IP** (configurable via `POSTS_RATE_LIMIT_PER_MIN`) so a hot demo URL can’t burn the Replicate budget.

## Tier 3: Multi-modal implementation

Three-stage pipeline: **LLM text generation**, **diffusion image generation**, and **programmatic composition** (Sharp). Provider separation: Gemini image SKUs were unreliable on free tier (quota/limit issues), so **images use Replicate SDXL** and **text uses Gemini**.

### Intelligent image pipeline

#### Problem

A **static SDXL prompt** tends to converge on similar compositions (e.g. repeated “neon tech room” looks), especially when the prompt is generic. Without **`seed`**, successive runs can still feel same-y in practice.

#### Solution

1. **Semantic prompt mapping** — `getImageStyleBase()` uses **topic + keyword** heuristics (AI/data, ecommerce, startup, dev, leadership, etc.) and **tone** fallbacks (controversial, storytelling) to map to **distinct visual domains** before calling SDXL. Reduces “one purple room for every topic” behavior based on manual review of outputs.

2. **Stochastic variation** — Each request passes a **random integer `seed`** into Replicate so latent paths differ run-to-run.

3. **User-directed style** — Optional **Image style** (`Auto`, `Minimal`, `Corporate`, …) applies **suffix injection** on top of the mapped base prompt: separation of **content** (topic/tone/keywords) vs **presentation** (style preset).

4. **Image-only regeneration** — `POST /api/posts/regenerate-image` re-runs only the SDXL + Sharp pipeline so users keep good copy and iterate on the visual. Halves the cost of iteration.

5. **Stable share URL via Cloudinary** — When `CLOUDINARY_URL` (or split `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`) is configured, the **composited PNG (with the topic burned in)** is streamed to Cloudinary and the response includes `shareUrl`. Replicate URLs are signed and short-lived and won't reliably crawl from LinkedIn / Twitter; Cloudinary serves a long-lived public `image/png` URL so **`copyBundle`** and **`shareViaLinkedIn`** point at a real, persistent asset. If Cloudinary isn't configured the route degrades gracefully — the response still ships the `data:` PNG plus the Replicate URL.

6. **Public share page with OG meta tags (`/share/:id`)** — `POST /api/share` writes a row to a self-bootstrapping `linkedin_shares` table on Neon and returns `{ id, url }`. `GET /share/:id` is **server-rendered HTML** (no React; just an Express route) whose `<head>` contains `og:title` / `og:description` / `og:image` / `twitter:summary_large_image`. The body has the rendered post + image. When you paste the URL into LinkedIn, Slack, Twitter, iMessage, etc., the crawler parses the OG tags and renders a real preview card — something a raw image URL cannot do. Anonymous (no auth) and view-counted.

7. **Auto-pick tone & style** — A small Gemini call (`POST /api/posts/auto-classify`) returns `{ tone, style, reason }` for any topic, so users get a one-click best-guess instead of fiddling with dropdowns. JSON-mode prompt with strict whitelisting on the server (`parseAutoClassification`) so an off-spec response never poisons the UI.

8. **Aspect-ratio picker** — `format = banner | square | portrait` is forwarded to `generateBannerImage`. SDXL is asked for the closest native multiple-of-8 dimensions; Sharp resizes/composites to the final output and recomputes the title-band height + font scale proportionally.

9. **PDF export** — `POST /api/posts/export-pdf` builds an A4 PDF (image + post body) with `pdf-lib`. Pure-text body falls back when no image bytes are available. Uses standard fonts so output is deterministic across deploys.

10. **AbortController-driven cancel + Retry toasts** — Generation is wrapped in `AbortController` so a user can cancel a slow Replicate run mid-flight (the Cancel button shows only while loading). Non-cancel errors render a `toast.custom` with a Dismiss/Retry pair so the user can re-fire the exact same call without reopening the form.

#### Trade-offs

Heuristics are keyword-based (not CLIP scoring); the Cloudinary upload adds one HTTP round-trip per generation but is fire-and-forget and falls back to the data URL if it errors. **Future work:** embedding similarity to rank image–text relevance; optional `prompt_strength` tuning per style; eager Cloudinary transformations (e.g. WebP variants).

### Three-variant generation

The **`/generate`** endpoint asks Gemini for **three distinct LinkedIn-post variants** in a single call (story, framework, hot-take, etc.) using a labeled marker format. The client renders them as **Variant tabs**; if Gemini ignores the format, `parseVariants()` falls back to one variant. Same Gemini cost, three angles to choose from.

### Polished UX details

- **Editable post body** with a live **/3000-char counter** (LinkedIn limit) that warns at 2700.
- **Hashtag chips** parsed from the post body (`#word`, deduped, ordered) with **Copy tags** action.
- **localStorage history** of the last 5 generations — restore prior runs without hitting the API again.
- **Debug strip** — server returns `seedUsed`, `styleUsed`, `modelUsed`, `promptUsed` for the demo (full prompt only in development).
- **Keyboard shortcut** (⌘/Ctrl + Enter), **Open share dialog** (LinkedIn share-offsite), **Copy for LinkedIn**, **Download image**, **Regenerate image**.

## Tests

`cd server && npm test` runs **`node --test`** against pure helpers in `server/src/lib/post-prompts.js` (23 cases):

- `escapeXml`, `wrapTextForOverlay` (default + custom `unitCharPx`), `getImageStyleBase`, `applyImageStylePreset`, `topicPromptAnchor`, `buildSdxlPrompt`, `buildVariantsPrompt`, `parseVariants`, `extractHashtags`, `getFormatPreset`, `FORMAT_PRESETS`, `buildAutoClassifyPrompt`, `parseAutoClassification` (valid JSON, fenced JSON, garbage, out-of-spec values).

These tests caught a real bug: `lower.includes("ai")` was matching **`ret`ai`l`** and routing ecommerce posts to the neural-network style. The fix uses word-boundary regex for short keywords.

## Trade-offs

SDXL does not render crisp, predictable text in-image. **Sharp + SVG** burns the topic onto the banner after generation. Extra latency vs text-only (~composite + download). Justified for headers that read clearly on LinkedIn.

## Local development

```bash
cd server && npm install && npm run dev
```

```bash
cd client && npm install && npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). API default port **5000**; Vite proxy uses **`VITE_DEV_API_PORT`** if the API runs on another port (see `client/vite.config.js`). If **`EADDRINUSE`** on 5000, stop the old Node process or set `PORT=5001` in `server/.env` and matching `VITE_DEV_API_PORT` under `client/`.

## Deploy notes

Build the client, serve `dist` via Nginx, and **`proxy_pass /api`** to the Node process (PM2). Use HTTPS in production.
