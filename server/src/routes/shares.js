/**
 * Public share pages — `/api/share` (JSON, write/read) and `/share/:id` (SSR HTML with OG tags).
 *
 * Why an SSR HTML page instead of just redirecting to a Cloudinary image URL?
 *   LinkedIn / Twitter / Slack scrape <head> for OG meta tags to render link previews.
 *   A direct image URL gives them no title or description, so the card is plain.
 *   We build a tiny static page whose <head> has og:title / og:description / og:image,
 *   which gets you a beautiful preview anywhere a link is pasted.
 *
 * The DB table is created on first use via `CREATE TABLE IF NOT EXISTS` so users don't
 * have to run drizzle migrations to enable shares.
 */

import express from "express";
import { customAlphabet } from "nanoid";
import { neon } from "@neondatabase/serverless";

const router = express.Router();

/** URL-safe alphabet (no look-alike chars). 10 chars ≈ 1e19 keyspace. */
const newShareId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 10);

let sqlClient = null;
let bootstrapped = false;

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

async function ensureTable(sql) {
  if (bootstrapped) return;
  await sql`
    CREATE TABLE IF NOT EXISTS linkedin_shares (
      id VARCHAR(24) PRIMARY KEY,
      topic VARCHAR(255) NOT NULL,
      post TEXT NOT NULL,
      image_url TEXT NOT NULL,
      original_image_url TEXT,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  bootstrapped = true;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip hashtags off the end and collapse whitespace for og:description. */
function postExcerpt(post, max = 250) {
  const cleaned = String(post || "")
    .replace(/(?:^|\s)#[A-Za-z0-9_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

function publicBaseUrl(req) {
  const envBase = String(process.env.PUBLIC_SHARE_BASE_URL || "").trim().replace(/\/$/, "");
  if (envBase) return envBase;
  const host = req.get("host") || "localhost:5000";
  const proto = req.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * POST /api/share
 * Body: { topic, post, imageUrl, originalImageUrl? }
 * Inserts a row and returns { id, url } for clients to share.
 */
router.post("/", async (req, res) => {
  try {
    const sql = getSql();
    if (!sql) {
      return res.status(503).json({ error: "DATABASE_URL not configured — cannot create share links." });
    }
    const { topic, post, imageUrl, originalImageUrl } = req.body || {};
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "topic required" });
    }
    if (!post || typeof post !== "string") {
      return res.status(400).json({ error: "post required" });
    }
    if (!imageUrl || typeof imageUrl !== "string" || !/^https?:\/\//i.test(imageUrl)) {
      return res.status(400).json({
        error: "imageUrl must be a public HTTPS URL. Configure CLOUDINARY_URL in server/.env so generated images get a stable share URL.",
      });
    }

    await ensureTable(sql);
    const id = newShareId();
    const safeTopic = topic.slice(0, 255);
    const safePost = post.slice(0, 4000);
    await sql`
      INSERT INTO linkedin_shares (id, topic, post, image_url, original_image_url)
      VALUES (${id}, ${safeTopic}, ${safePost}, ${imageUrl}, ${originalImageUrl || null})
    `;

    const base = publicBaseUrl(req);
    res.json({ id, url: `${base}/share/${id}`, success: true });
  } catch (err) {
    console.error("[shares] create failed", err);
    res.status(500).json({ error: err?.message || "Could not create share link" });
  }
});

/**
 * GET /share/:id
 * Renders a tiny HTML page whose <head> has og:title / og:description / og:image so
 * pasting the URL into LinkedIn (or any OG-aware surface) renders a real card.
 * Mounted at the app root, NOT under /api/, so the URL itself looks shareable.
 */
router.get("/:id", async (req, res) => {
  try {
    const sql = getSql();
    if (!sql) {
      res.status(503).type("html").send(notConfiguredHtml());
      return;
    }
    await ensureTable(sql);
    const id = String(req.params.id || "").trim();
    if (!/^[A-Za-z0-9]{6,24}$/.test(id)) {
      res.status(404).type("html").send(notFoundHtml(id));
      return;
    }
    const rows = await sql`
      SELECT id, topic, post, image_url, original_image_url, view_count, created_at
      FROM linkedin_shares WHERE id = ${id} LIMIT 1
    `;
    if (!rows.length) {
      res.status(404).type("html").send(notFoundHtml(id));
      return;
    }
    sql`UPDATE linkedin_shares SET view_count = view_count + 1 WHERE id = ${id}`.catch(() => {});

    const row = rows[0];
    const url = `${publicBaseUrl(req)}/share/${id}`;
    const description = postExcerpt(row.post);

    res
      .status(200)
      .set("Cache-Control", "public, max-age=60")
      .type("html")
      .send(renderShareHtml({
        url,
        topic: row.topic,
        post: row.post,
        imageUrl: row.image_url,
        description,
      }));
  } catch (err) {
    console.error("[shares] read failed", err);
    res.status(500).type("html").send(genericErrorHtml());
  }
});

function renderShareHtml({ url, topic, post, imageUrl, description }) {
  const titleSafe = escapeHtml(topic);
  const descSafe = escapeHtml(description);
  const urlSafe = escapeHtml(url);
  const imageSafe = escapeHtml(imageUrl);
  const postHtml = escapeHtml(post)
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${line}</p>` : "<p>&nbsp;</p>"))
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${titleSafe} · AI LinkedIn Studio</title>
  <meta name="description" content="${descSafe}" />

  <meta property="og:type" content="article" />
  <meta property="og:title" content="${titleSafe}" />
  <meta property="og:description" content="${descSafe}" />
  <meta property="og:image" content="${imageSafe}" />
  <meta property="og:image:alt" content="${titleSafe}" />
  <meta property="og:url" content="${urlSafe}" />
  <meta property="og:site_name" content="AI LinkedIn Studio" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${titleSafe}" />
  <meta name="twitter:description" content="${descSafe}" />
  <meta name="twitter:image" content="${imageSafe}" />

  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; line-height: 1.55; background: #0e0c1a; color: #f5f3ff; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 32px 20px 80px; }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; opacity: 0.85; font-size: 14px; }
    header a { color: inherit; text-decoration: none; }
    h1 { font-size: 28px; line-height: 1.2; margin: 0 0 16px; }
    .banner { width: 100%; max-width: 760px; height: auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); display: block; margin: 0 auto 28px; }
    article p { white-space: pre-wrap; word-break: break-word; margin: 0 0 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 28px 0 0; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); color: #fff; text-decoration: none; font-size: 14px; }
    .btn:hover { background: rgba(255,255,255,0.12); }
    footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; opacity: 0.65; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <a href="/">← AI LinkedIn Studio</a>
    </header>
    <h1>${titleSafe}</h1>
    <img class="banner" src="${imageSafe}" alt="${titleSafe}" />
    <article>
${postHtml}
    </article>
    <div class="actions">
      <a class="btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Share on LinkedIn</a>
      <a class="btn" href="${imageSafe}" download target="_blank" rel="noopener">Download image</a>
    </div>
    <footer>Generated with <a href="/" style="color:inherit">AI LinkedIn Studio</a>.</footer>
  </div>
</body>
</html>`;
}

function notFoundHtml(id) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title></head>
  <body style="font-family:system-ui;background:#0e0c1a;color:#fff;padding:40px;">
    <h1>This share link doesn’t exist.</h1>
    <p>${escapeHtml(id) ? `<code>${escapeHtml(id)}</code> isn’t a known share id.` : ""}</p>
    <p><a href="/" style="color:#fff">← Back to AI LinkedIn Studio</a></p>
  </body></html>`;
}

function notConfiguredHtml() {
  return `<!doctype html><html><body style="font-family:system-ui;padding:40px;">
    <h1>Share is not configured.</h1>
    <p>Set <code>DATABASE_URL</code> in <code>server/.env</code> to enable shareable links.</p>
  </body></html>`;
}

function genericErrorHtml() {
  return `<!doctype html><html><body style="font-family:system-ui;padding:40px;">
    <h1>Something went wrong.</h1>
    <p>Try again in a moment.</p>
  </body></html>`;
}

export default router;
