# Tier 3 — Course submission package

**Student project:** AI LinkedIn Studio (topic → LinkedIn post text + banner image)  
**Live site:** https://aiadsbypatel.online/

Use this document for the **documentation** portion of Tier 3 (tech manifest, AI explanation, checklist for your screenshot). Copy the **LinkedIn** section into a post or Project.

---

## Tier 1 note (Vercel + Render vs VPS rubric)

Your assignment’s Tier 1 describes a **self-managed VPS** (UFW, Nginx on your box, Let’s Encrypt on the server). This project **can** be deployed entirely on **Vercel (frontend) + Render (Node API)** with HTTPS and a **custom domain on Vercel** (`aiadsbypatel.online`). That is a valid, professional production pattern.

**If your instructor requires every Tier 1 bullet on a single VPS,** confirm with them whether a split deploy still counts, or whether you need to move the static build + reverse proxy onto your own server while keeping the API elsewhere. The content below describes the **Vercel + Render** setup truthfully.

---

## Tech stack manifest

| Layer | Technology | Role |
|--------|------------|------|
| **Live URL / DNS** | Custom domain `aiadsbypatel.online` | Public entry point (typically apex → Vercel) |
| **Frontend hosting** | [Vercel](https://vercel.com) | HTTPS, CDN, SPA rewrites for React Router |
| **Frontend stack** | React 19, Vite 7, Tailwind 4, TypeScript | UI at `/create` and related routes |
| **API hosting** | [Render](https://render.com) Web Service (`server/` root) | Node.js process, `GET /api/health` for health checks |
| **Backend** | Node.js, Express | REST API under `/api/*` |
| **AI — text** | Google Gemini (`@google/genai`, env on Render only) | Multi-variant LinkedIn copy, auto tone/style |
| **AI — image** | Replicate (SDXL) | Topic-aware banners; keys only on Render |
| **Post-processing** | Sharp (SVG/title overlay) | Legible topic text on images |
| **Optional** | Cloudinary | Stable `https://` image URLs for sharing |
| **Auth / DB (if enabled)** | Supabase Auth; Neon Postgres | Users, quotas, `/api/share`, `/share/:id` OG pages |
| **Payments (optional)** | Stripe | Checkout webhooks on API |
| **Observability (optional)** | Sentry | Server error capture |

**Request path (production):** Browser → `https://aiadsbypatel.online` (Vercel static app) → XHR/fetch to **`VITE_API_URL`** (your Render service base ending in `/api`) → Express → Gemini / Replicate → JSON back to the browser. **API keys never ship to the client.**

---

## Vercel + Render wiring (how the pieces connect)

1. **Render (API)**  
   - Deploy from this repo with **root directory** `server` (see `render.yaml` blueprint).  
   - Set **all secrets** from your local `server/.env`: `GEMINI_API_KEY` or `GOOGLE_GEMINI_API_KEY`, `REPLICATE_API_TOKEN`, `DATABASE_URL`, `SUPABASE_*`, `STRIPE_*`, etc.  
   - **`CLIENT_URL`** must include your real frontend origin(s), comma-separated if you have more than one, for example:  
     `https://aiadsbypatel.online`  
     (Add `http://localhost:5173` for local dev, or keep a second comma-separated value.)  
   - If you use **Vercel preview URLs** (`*.vercel.app`), set `CORS_ALLOW_VERCEL=1` on Render or list each preview origin in `CLIENT_URL`.  
   - For **share/OG links** that should show your marketing domain, set `PUBLIC_SHARE_BASE_URL=https://aiadsbypatel.online` (and ensure `DATABASE_URL` is set if you use share pages).

2. **Vercel (frontend)**  
   - Monorepo build: root `vercel.json` installs/builds under `client/` and publishes `client/dist`.  
   - **`VITE_API_URL`** = your Render API base **with `/api` at the end**, e.g.  
     `https://ai-ads-api.onrender.com/api`  
     (Replace with your actual Render service URL.) Redeploy after changing env vars.

3. **Custom domain**  
   - Attach **`aiadsbypatel.online`** in Vercel → Domains; point DNS per Vercel’s instructions (usually A/ALIAS/CNAME). Vercel provisions **TLS** (padlock) automatically.

---

## AI feature — written explanation (course rubric)

**Purpose:** The site is **not a generic chatbot**. It is a **LinkedIn content generator**: from a **topic** (and optional tone, keywords, image style, aspect ratio), the backend produces **ready-to-post copy** and a **matching banner image** suitable for LinkedIn headers and feed cards.

**Server-side integration:** All model calls run on the **Render-hosted Express** app. The browser only calls your own **`/api`** routes (proxied to Render via `VITE_API_URL`). **Gemini** and **Replicate** credentials live in **Render environment variables** only.

**Custom prompts:** Post text uses a **structured, tuned prompt** (see `server/src/lib/post-prompts.js`) so Gemini returns **several distinct variants** (e.g. hot take / story / framework) in one round trip. Image generation uses **semantic mapping** from topic and keywords so SDXL prompts match the subject (e.g. startup vs ecommerce vs developer narrative), plus optional **style presets** and a **random seed** for variety. A separate **auto-classify** endpoint suggests tone and image style from the topic alone.

**Error handling:** The API returns **clear HTTP errors and JSON messages** (e.g. **503** when API keys are missing, **502** when the model returns unusable output, **429** when rate limits apply). The auto-classify route **falls back** to safe defaults with an explanatory message instead of breaking the UI when the model path fails.

Keywords and “smarts” are **server-side** (prompt building, parsing, image pipeline), not stored in the browser except as part of normal form state.

---

## Screenshot checklist (Tier 3 documentation)

Capture **one** full-window image showing:

1. **`https://aiadsbypatel.online`** in the address bar with the **TLS padlock**.  
2. A **successful generation**: topic visible, **generated post text**, and **banner image** (or variant tabs).  
3. Save as e.g. `docs/screenshot-tier3.png` and attach to your submission **and** LinkedIn.

---

## LinkedIn portfolio artifact (copy/paste)

**Suggested skills / tags:** Linux · Nginx · SSL/TLS · WebOps · AI · API Integration · Prompt Engineering · **Node.js** · **Express** · **React** · **Vite** · **PostgreSQL** · **Supabase** · **Vercel** · **Render**

**Sample post:**

> I built **AI LinkedIn Studio** — turn a **topic** into **LinkedIn-ready post copy** plus a **topic-aware banner** in one flow.  
>  
> **Stack:** **React + Vite** on **Vercel** (`https://aiadsbypatel.online`), **Node + Express** API on **Render**, **Google Gemini** for multi-variant text and tone/style hints, **Replicate (SDXL)** + **Sharp** for images. API keys stay on the server; the app only talks to my **`/api`** routes.  
>  
> **Live:** https://aiadsbypatel.online/  
>  
> #WebOps #AI #PromptEngineering #NodeJS #React #APIIntegration

Add your **screenshot** as the post image. For a **LinkedIn Project**, paste the same URL, description, and skills.

---

## Quick pre-submit checklist

- [ ] Open https://aiadsbypatel.online/ in a private window — confirm load, HTTPS, and one full generate.  
- [ ] `VITE_API_URL` on Vercel matches Render `/api` base; `CLIENT_URL` on Render includes `https://aiadsbypatel.online`.  
- [ ] PDF / screenshot + this manifest submitted where the course requires.  
- [ ] LinkedIn post or Project published with link + tags.
