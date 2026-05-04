# Practical course submission — AI LinkedIn Studio

**Project:** A full-stack web app that turns a **topic** (plus optional tone, keywords, image style, and aspect ratio) into **LinkedIn-ready post copy** and a **matching banner image** in one workflow.  
**Live demo:** https://aiadsbypatel.online/

---

## What I built

**AI LinkedIn Studio** is a production-oriented content tool, not a generic chatbot. Users enter a topic; the backend calls **Google Gemini** once to produce **three distinct post variants** (for example hot take, story, framework), maps the topic into a **semantic image prompt**, and calls **Replicate (SDXL)** for an on-brand visual. **Sharp** composites an SVG title band so headlines stay readable (diffusion models rarely render crisp text). Optional pieces include **Cloudinary** for stable share URLs, **Neon Postgres** for public **`/share/:id`** pages with Open Graph meta tags, **Supabase** auth, **Stripe** billing, and **PDF export**.

The **frontend** is a React + Vite SPA; the **backend** is Node + Express. All model API keys stay **server-side**; the browser only talks to first-party **`/api`** routes, with **rate limiting** on generation endpoints.

---

## Tools and technologies

| Area | Technology |
|------|------------|
| UI | React 19, Vite 7, Tailwind 4, TypeScript |
| API | Node.js, Express |
| Text generation | Google Gemini (`@google/genai`) |
| Image generation | Replicate — Stability SDXL |
| Image processing | Sharp (SVG overlay, resize, format) |
| PDF export | pdf-lib (server) |
| Optional auth | Supabase |
| Optional database | Neon (PostgreSQL) + Drizzle ORM |
| Optional payments | Stripe |
| Optional media CDN | Cloudinary |
| Errors / monitoring | Sentry (optional) |
| Hosting (this deploy) | Vercel (frontend), Render (API) — see `vercel.json`, `render.yaml` |
| Tests | Node built-in test runner — `cd server && npm test` |

Longer architecture and pipeline notes: [`TECHSTACK.md`](TECHSTACK.md). Tier-3 write-up, deploy wiring, and LinkedIn artifact text: [`docs/TIER3-COURSE-SUBMISSION.md`](docs/TIER3-COURSE-SUBMISSION.md).

---

## Submission package — labeled components

Use this map when grading or archiving the repo. **Do not commit real secrets** — copy from `.env.example` files into local `server/.env` and `client/.env`.

| Component | Location | Purpose |
|-----------|----------|---------|
| **Root README** | [`README.md`](README.md) | Full feature list, quick start, API summary, deploy notes |
| **Architecture deep-dive** | [`TECHSTACK.md`](TECHSTACK.md) | Pipeline design, security, tests, trade-offs |
| **Course / Tier 3 docs** | [`docs/TIER3-COURSE-SUBMISSION.md`](docs/TIER3-COURSE-SUBMISSION.md) | Tech manifest, AI explanation, screenshot checklist, sample LinkedIn post |
| **Course doc (Word)** | [`docs/TIER3-COURSE-SUBMISSION.docx`](docs/TIER3-COURSE-SUBMISSION.docx) | Same material in document form if required |
| **This submission overview** | [`PRACTICAL_SUBMISSION_README.md`](PRACTICAL_SUBMISSION_README.md) | Short narrative + labeled file map for the practical submission |
| **Frontend app** | [`client/`](client/) | React SPA — pages, components, API client, styles |
| **Frontend env template** | [`client/.env.example`](client/.env.example) | `VITE_*` variables (Supabase, Sentry, API port, site URL) |
| **Frontend deploy** | [`client/vercel.json`](client/vercel.json) | Vercel settings for the client subtree if used |
| **Backend API** | [`server/`](server/) | Express app, routes, libs, DB schema |
| **Backend env template** | [`server/.env.example`](server/.env.example) | Ports, Gemini, Replicate, DB, Stripe, Cloudinary, CORS |
| **API entry** | [`server/src/index.js`](server/src/index.js) | Server bootstrap, middleware, route mounting |
| **Post generation routes** | [`server/src/routes/posts.js`](server/src/routes/posts.js) | Generate, regenerate image, auto-classify, export PDF, formats |
| **Share / OG routes** | [`server/src/routes/shares.js`](server/src/routes/shares.js) | Persist share rows; public HTML for crawlers |
| **Prompts & parsing** | [`server/src/lib/post-prompts.js`](server/src/lib/post-prompts.js) | Gemini prompts, variant parsing, SDXL prompt mapping, hashtags |
| **Tests (prompts)** | [`server/src/lib/post-prompts.test.js`](server/src/lib/post-prompts.test.js) | `node --test` unit tests for prompt helpers |
| **Stripe integration** | [`server/src/routes/stripe.js`](server/src/routes/stripe.js), [`server/src/lib/stripe*.js`](server/src/lib/) | Checkout / webhooks (if enabled) |
| **DB schema** | [`server/src/db/schema.js`](server/src/db/schema.js) | Drizzle definitions |
| **Render blueprint** | [`render.yaml`](render.yaml) | Web service definition for API hosting |
| **Root Vercel config** | [`vercel.json`](vercel.json) | Monorepo build: install/build `client`, output `client/dist` |
| **Workspace env notes** | [`.env.example`](.env.example) | High-level env documentation (many vars also in `server/`) |
| **Screenshot (add before upload)** | `docs/screenshot.png` or `docs/screenshot-tier3.png` | Full-window capture: HTTPS URL, topic, generated text + image (see Tier 3 checklist) |

---

## Challenges encountered

1. **Separating text and image providers** — Gemini’s image APIs were unreliable on the free tier (quotas and quality). The design uses **Gemini for copy** and **Replicate SDXL for images**, which stabilized cost and behavior while keeping one product experience.

2. **Legible text on images** — SDXL does not reliably render crisp typography. The fix is a **post-process step**: Sharp draws an SVG title bar so every export has readable branding.

3. **Prompt diversity** — A single generic SDXL prompt produced repetitive “same room” visuals. **Semantic mapping** from topic/keywords/tone, plus **random seeds** and optional **style presets**, improved variety without a second ML model.

4. **Subtle string-matching bug** — Early heuristics used `includes("ai")`, which false-matched substrings like in **retail**. **Word-boundary checks** fixed mis-routed image styles; this is covered by **`server npm test`**.

5. **Share previews on social platforms** — Short-lived Replicate URLs and raw image links don’t preview well everywhere. **Cloudinary** (stable HTTPS PNG) and a **server-rendered `/share/:id`** page with **og:image** meta tags addressed LinkedIn/slack-style crawlers.

6. **Split deploy** — The production setup uses **Vercel + Render** with **`VITE_API_URL`** and **`CLIENT_URL`**/CORS alignment; misconfigured env vars were the main source of “works locally, fails in prod” issues.

---

## How to run locally (evaluator quick start)

```bash
cd server && npm install && cp .env.example .env  # then add GEMINI_API_KEY and REPLICATE_API_TOKEN
npm run dev
```

```bash
cd client && npm install && npm run dev
```

Open the Vite URL (typically http://localhost:5173) and use the generator flow (e.g. `/create`). See [`README.md`](README.md) for optional services and ports.

---

## Academic honesty note

If your course requires an explicit statement: this repository is submitted as **my own project work**; AI-assisted tooling may have been used during development per course policy — **all deployment configuration, integration code, and submitted documentation should reflect my understanding** and be ready to explain in a demo or viva.
