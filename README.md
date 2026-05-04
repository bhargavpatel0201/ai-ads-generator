# AI LinkedIn Studio

Generate a publish-ready LinkedIn post **and** a 1200×624 header image from a single topic. Topic-aware prompts, three post variants per run, and a Sharp text overlay so the title is always legible.

> **TL;DR pipeline:** **Gemini** writes the post → **Replicate SDXL** paints a topic-aware banner → **Sharp** burns the title onto the image → JSON returned to the React UI.

---

## Demo

- **Live:** https://aiadsbypatel.online/
- **Loom walkthrough:** _add link_

![App screenshot — Generator](docs/screenshot.png)

> _If you don’t have `docs/screenshot.png` yet, take one of `/create` after a successful run and drop it there._

---

## Features

- **Topic → 3-variant post** in one Gemini call (`Hot take`, `Story`, `Framework`, etc.) with **per-variant char counts** in the tabs.
- **Auto-pick tone & style** — one button asks Gemini to choose the best tone + image style for the topic.
- **Topic-aware SDXL prompts** — semantic mapping for AI/data, ecommerce, startup, dev, leadership, plus tone fallbacks.
- **Aspect-ratio picker**: `banner` (1200×624) · `square` (1080×1080) · `portrait` (1080×1350). SDXL gets native dimensions; Sharp recomputes the title band + font size.
- **Optional Image style** suffix: `Auto`, `Minimal`, `Corporate`, `Cyberpunk`, `Isometric`, `3D Render`.
- **Random `seed`** per run — never the same image twice.
- **Sharp SVG overlay** that burns your topic + a faint app watermark onto the image (SDXL stays text-free).
- **Editable post body** with a live **/3000-char** counter and parsed **hashtag chips**.
- **Image-only regeneration** — keep the copy, retry the visual at half the cost.
- **Cancel button** (AbortController) for in-flight calls; **Retry button** in error toasts.
- **localStorage history** of the last 5 runs (restore + remove + clear).
- **Public share page** at `/share/:id` (Neon-backed) with full OG / Twitter meta tags so LinkedIn and friends render real preview cards.
- **PDF export** — single-page A4 with image + post body via `pdf-lib`.
- **Optional Cloudinary upload** of the composited PNG → stable HTTPS `shareUrl` for LinkedIn / anywhere else.
- **Debug strip** — server returns `seed`, `style`, `format`, `text model`, and `SDXL prompt` so you can show how it works.
- **Error handling** — Gemini 503/429 retries, automatic **fallback model**, Replicate 402 → billing toast.
- **Server-side keys** (`server/.env`), **rate-limited** at 10 req/min/IP via `express-rate-limit`.
- **Tests**: `npm test` runs `node --test` (23 cases) against prompt mapping, variant parsing, format presets, and auto-classify parsing.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Vite + Tailwind, deployed via Nginx |
| Backend | Node.js + Express + PM2 |
| AI text | Google Gemini (`@google/genai`, default `gemini-2.5-flash`, fallback `gemini-2.0-flash`) |
| AI image | Replicate **stability-ai/sdxl** at 1200×624 |
| Image overlay | **Sharp** (SVG composite) |
| Auth (optional) | Supabase |
| Database (optional) | Neon Serverless Postgres + drizzle-orm |
| Billing (optional) | Stripe |
| Errors | Sentry |

The LinkedIn-post route does **not** require sign-in. Auth, billing, and history persistence are present for stretch use.

---

## Quick start (local)

```bash
git clone <your-repo>
cd AI_Ads_Generator
```

### Server

```bash
cd server
cp .env.example .env   # if you have one — otherwise create .env (see below)
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

Open the URL Vite prints (default <http://localhost:5173>) and visit **`/create`**.

### Required environment

Add at minimum to `server/.env`:

```env
PORT=5000

# Gemini text model (any one of these works; the server reads them in this order)
GEMINI_API_KEY=...
# or GOOGLE_GEMINI_API_KEY=...
# or GOOGLE_API_KEY=...

# Replicate image model
REPLICATE_API_TOKEN=...

# Optional — see "Tier 3" below
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_TEXT_MODEL_FALLBACK=gemini-2.0-flash
POSTS_RATE_LIMIT_PER_MIN=10

# Optional — Cloudinary, for a stable HTTPS shareUrl on every generation.
# Either the single-string form…
# CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
# …or the split form:
# CLOUDINARY_CLOUD_NAME=...
# CLOUDINARY_API_KEY=...
# CLOUDINARY_API_SECRET=...

# Optional — Neon Postgres (already used for the rest of the app).
# Required for /api/share and /share/:id (public OG share pages).
DATABASE_URL=postgresql://...

# Optional — when serving on a real domain, set this so /share/:id absolute URLs
# in the OG meta tags match what crawlers see. Defaults to req.host.
# PUBLIC_SHARE_BASE_URL=https://yoursite.com

# Optional — change the watermark text rendered in the bottom-right of every image.
# IMAGE_WATERMARK_TEXT=AI LinkedIn Studio
```

`client/.env` (optional, only when the API moves off port 5000):

```env
VITE_DEV_API_PORT=5001
```

If port 5000 is busy:

```powershell
# Windows PowerShell
Get-NetTCPConnection -LocalPort 5000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

## API

`POST /api/posts/generate`

```jsonc
// Request
{
  "topic": "Why CS degrees still matter in 2026",
  "tone": "controversial",                // professional | casual | controversial | storytelling
  "keywords": "AI, education",            // optional
  "style": "Cyberpunk"                    // Auto | Minimal | Corporate | Cyberpunk | Isometric | 3D Render
}
```

```jsonc
// Response (200)
{
  "post": "string — variant 1 body",
  "variants": [
    { "label": "Hot take", "post": "..." },
    { "label": "Story",    "post": "..." },
    { "label": "Framework", "post": "..." }
  ],
  "imageUrl": "data:image/png;base64,iVBORw0KGgo...",  // composited PNG
  "originalImageUrl": "https://replicate.delivery/...png", // pre-overlay
  "shareUrl": "https://res.cloudinary.com/<cloud>/image/upload/...png", // composited, stable; null if Cloudinary isn't configured
  "debug": { "seedUsed": 482991133, "styleUsed": "Cyberpunk", "formatUsed": "banner", "modelUsed": "gemini-2.5-flash", "promptUsed": "…" },
  "success": true,
  "costNote": "~$0.002/image (Replicate SDXL …)",
  "debug": { "seedUsed": 482991133, "styleUsed": "Cyberpunk", "modelUsed": "gemini-2.5-flash", "promptUsed": "…" }
}
```

`POST /api/posts/regenerate-image` — same body, returns only `imageUrl`/`originalImageUrl`/`debug`. Cheap iteration.

`POST /api/posts/auto-classify` — body `{ topic }`, returns `{ tone, style, reason }`. Used by the Auto-pick button.

`POST /api/posts/export-pdf` — body `{ topic, post, imageUrl? }`, streams `application/pdf` (Content-Disposition attachment).

`GET /api/posts/formats` — lists available aspect-ratio presets so the UI doesn't have to hard-code dimensions.

`POST /api/share` — body `{ topic, post, imageUrl, originalImageUrl? }`. Inserts into `linkedin_shares` (created via `CREATE TABLE IF NOT EXISTS` on first call) and returns `{ id, url }`. Requires `DATABASE_URL` and a public HTTPS `imageUrl` (Cloudinary recommended).

`GET /share/:id` — public **HTML** page with OG / Twitter meta tags pointing at the saved post + image. This is the URL to paste into LinkedIn / Slack / Twitter for a real preview card. View-counted.

All `/api/posts` endpoints are **rate-limited** (10 req/min/IP, configurable via `POSTS_RATE_LIMIT_PER_MIN`).

`GET /api/health` — liveness probe.

---

## Tests

```bash
cd server
npm test
```

Runs `node --test` against `server/src/lib/post-prompts.test.js` (15 cases). Covers `escapeXml`, `wrapTextForOverlay`, `getImageStyleBase` (word-boundary keyword matching), `applyImageStylePreset`, `topicPromptAnchor`, `buildSdxlPrompt`, `buildVariantsPrompt`, `parseVariants`, and `extractHashtags`.

These tests caught a real bug: `lower.includes("ai")` was matching `ret`**`ai`**`l`, sending ecommerce posts to the neural-network style. Fixed with a word-boundary regex (`matchesAny()`).

---

## Tier 3 — system design notes

See [`TECHSTACK.md`](TECHSTACK.md) for the longer write-up. Highlights:

1. **Provider separation.** Gemini’s native image SKU was unreliable on the free tier. Images use **Replicate SDXL**; text uses **Gemini**. Same product surface, two providers tuned for what they do best.
2. **Semantic prompt mapping.** Topic + keyword → distinct visual domain (AI/data, ecommerce, startup, dev, leadership) plus tone fallbacks. Random integer **seed** per request makes the same topic look different across runs.
3. **Composition layer.** SDXL doesn’t render legible type, so **Sharp + SVG** burns the title onto a bottom band post-generation. Word-wrap is pixel-aware and only breaks at spaces.
4. **3-variant generation.** Single Gemini call returns three labeled variants via a marker format the client parses; falls back to one variant if Gemini ignores the spec.
5. **Resilience.** Retries on Gemini 503/429 with exponential backoff, then fallback model. Replicate 402 → billing toast in the UI.

---

## Deploy notes

- Build the client (`npm run build`) and serve `client/dist` via **Nginx**.
- Run the server on PM2 (`npm start`) and `proxy_pass /api` to it.
- Use HTTPS in production (Let’s Encrypt or your provider’s certificate).
- Set `NODE_ENV=production` so Sentry initializes and only short-form `promptUsed` is returned to clients.

```nginx
server {
  listen 443 ssl http2;
  server_name yourdomain.com;
  # … ssl config …

  root /var/www/ai-linkedin-studio/dist;
  index index.html;
  location / {
    try_files $uri /index.html;
  }
  location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

---

## License

MIT (or whatever you ship with). Replace this line with your real choice.
