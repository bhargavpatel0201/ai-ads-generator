import express from "express";
import axios from "axios";
import Replicate from "replicate";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { GoogleGenAI, ApiError as GeminiApiError } from "@google/genai";

import {
  IMG_W,
  IMG_H,
  FORMAT_PRESETS,
  getFormatPreset,
  buildSdxlPrompt,
  buildVariantsPrompt,
  buildAutoClassifyPrompt,
  parseAutoClassification,
  escapeXml,
  parseVariants,
  wrapTextForOverlay,
} from "../lib/post-prompts.js";
import { isCloudinaryConfigured, uploadBannerToCloudinary } from "../lib/cloudinary.js";
import { requireAuth } from "../middleware/auth.js";
import {
  assertAndConsumeCredit,
  PlanQuotaError,
  readQuotaStatus,
} from "../lib/plan-quota.js";

const router = express.Router();

/** Text-only Gemini. Override with gemini-2.0-flash if 2.5 is often UNAVAILABLE. */
const GEMINI_TEXT_MODEL = (process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash").trim();
const GEMINI_TEXT_MODEL_FALLBACK = (process.env.GEMINI_TEXT_MODEL_FALLBACK || "gemini-2.0-flash").trim();
const IS_DEV = (process.env.NODE_ENV || "development") !== "production";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isGeminiTransientError(err) {
  if (err instanceof GeminiApiError) {
    return err.status === 503 || err.status === 429;
  }
  const blob = `${err?.message || ""} ${err?.status || ""}`.toLowerCase();
  return (
    blob.includes("503") ||
    blob.includes("unavailable") ||
    blob.includes("high demand") ||
    blob.includes("overloaded") ||
    blob.includes("try again later") ||
    blob.includes("resource_exhausted")
  );
}

/** Retries on 503 / 429, then GEMINI_TEXT_MODEL_FALLBACK. Returns { post, modelUsed }. */
async function generateLinkedInPostText(ai, contents) {
  const primary = GEMINI_TEXT_MODEL;
  const fallback =
    GEMINI_TEXT_MODEL_FALLBACK && GEMINI_TEXT_MODEL_FALLBACK !== primary
      ? GEMINI_TEXT_MODEL_FALLBACK
      : null;
  const models = fallback ? [primary, fallback] : [primary];
  const maxAttempts = 4;
  const baseDelayMs = 1200;

  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const textResult = await ai.models.generateContent({ model, contents });
        const post = textResult.text?.trim() || "";
        if (post) {
          if (m > 0) console.log(`[posts/generate] used fallback text model: ${model}`);
          return { post, modelUsed: model };
        }
        lastErr = new Error("Gemini returned empty text");
      } catch (err) {
        lastErr = err;
        if (isGeminiTransientError(err) && attempt < maxAttempts) {
          const wait = baseDelayMs * 2 ** (attempt - 1);
          console.warn(
            `[posts/generate] Gemini "${model}" busy (${attempt}/${maxAttempts}), retry in ${wait}ms`
          );
          await delay(wait);
          continue;
        }
        break;
      }
    }
    if (m < models.length - 1) continue;
    throw lastErr;
  }
}

function geminiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
}

let genai = null;
function getGenai() {
  const k = geminiKey();
  if (!k) return null;
  if (!genai) genai = new GoogleGenAI({ apiKey: k });
  return genai;
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

function generationErrorMessage(err) {
  if (err == null) return "Generation failed";
  if (typeof err === "string") return err;
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  try {
    return JSON.stringify(err).slice(0, 600);
  } catch {
    return "Generation failed";
  }
}

/**
 * Distinguish "you've burned the daily free quota" from a momentary RPM blip.
 * AI Studio surfaces this with `limit: 0` + `free_tier_requests` / `RESOURCE_EXHAUSTED`
 * across the error body. Per-minute hits look the same status-code wise (429) but
 * usually describe a non-zero limit.
 */
function isGeminiFreeTierExhausted(err) {
  const blob = `${err?.message || ""} ${typeof err === "object" ? JSON.stringify(err).slice(0, 1500) : ""}`.toLowerCase();
  if (!blob.includes("gemini") && !blob.includes("generativelanguage") && !blob.includes("generate_content")) {
    return false;
  }
  return (
    blob.includes("limit: 0") ||
    blob.includes("free_tier") ||
    blob.includes("free-tier") ||
    blob.includes("resource_exhausted") ||
    blob.includes("perdayperprojectpermodel") ||
    blob.includes("exceeded your current quota")
  );
}

const GEMINI_QUOTA_HELP =
  "Gemini free-tier daily quota is exhausted (limit: 0). Three fixes: " +
  "(1) generate a new API key from another Google account at https://aistudio.google.com/app/apikey and put it in server/.env as GEMINI_API_KEY, " +
  "(2) enable billing for the existing key at https://aistudio.google.com/app/usage (paid tier costs ~$0.0001 per call), " +
  "or (3) wait until the daily reset (00:00 Pacific). Setting GEMINI_TEXT_MODEL=gemini-2.5-flash-lite in server/.env may also help if only one SKU is exhausted.";

/** Map upstream errors to HTTP status + safe client message. */
function mapGenerationError(err) {
  if (err instanceof PlanQuotaError) {
    return {
      http: 402,
      code: "PLAN_QUOTA_EXHAUSTED",
      action: "/plans",
      error: err.message,
      planTier: err.planTier,
      planLimit: err.planLimit,
      resetAt: err.resetAt instanceof Date ? err.resetAt.toISOString() : null,
    };
  }
  const raw = generationErrorMessage(err);
  if (err instanceof GeminiApiError) {
    if (err.status === 429) {
      if (isGeminiFreeTierExhausted(err)) {
        return {
          http: 429,
          code: "GEMINI_FREE_TIER_EXHAUSTED",
          action: "https://aistudio.google.com/app/apikey",
          error: GEMINI_QUOTA_HELP,
        };
      }
      return { http: 429, error: raw };
    }
    if (err.status === 503) {
      return {
        http: 503,
        error: `${raw} Wait a few minutes or set GEMINI_TEXT_MODEL=gemini-2.0-flash in server/.env (fallback after retries is GEMINI_TEXT_MODEL_FALLBACK, default gemini-2.0-flash).`,
      };
    }
    if (err.status === 404 || err.status === 400) {
      return {
        http: 502,
        error: `${raw} — check GEMINI_TEXT_MODEL in server/.env (try gemini-2.0-flash or gemini-2.5-flash).`,
      };
    }
    if (err.status === 401 || err.status === 403) {
      return { http: 502, error: "Gemini API rejected the key — verify GEMINI_API_KEY / AI Studio access." };
    }
    return { http: err.status >= 500 ? 502 : 500, error: raw };
  }
  const lower = raw.toLowerCase();
  if (lower.includes("insufficient credit") || lower.includes("402") || /\b402\b/.test(raw)) {
    return { http: 402, error: raw, code: "BILLING_REQUIRED", action: "https://replicate.com/account/billing" };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    if (isGeminiFreeTierExhausted(err)) {
      return {
        http: 429,
        code: "GEMINI_FREE_TIER_EXHAUSTED",
        action: "https://aistudio.google.com/app/apikey",
        error: GEMINI_QUOTA_HELP,
      };
    }
    return { http: 429, error: raw };
  }
  if (
    lower.includes("high demand") ||
    lower.includes("unavailable") ||
    lower.includes('"code":503')
  ) {
    return {
      http: 503,
      error: `${raw} Wait a few minutes or set GEMINI_TEXT_MODEL=gemini-2.0-flash in server/.env.`,
    };
  }
  return { http: 500, error: raw };
}

/** Branding watermark on the composited PNG. Free marketing for shared posts. */
const WATERMARK_TEXT = (process.env.IMAGE_WATERMARK_TEXT || "AI LinkedIn Studio").trim();

/** Burn topic text onto bottom band + watermark; SDXL stays text-free. Format-aware. */
async function burnTopicOnImage(imageBuffer, topic, format = "banner") {
  const preset = getFormatPreset(format);
  const W = preset.width;
  const H = preset.height;
  const sidePad = Math.round(W * 0.05);
  const wrapWidth = W - sidePad * 2;
  const marginBottom = Math.round(H * 0.022);
  const textTopPad = Math.round(H * 0.02);

  const widthRatio = W / 1200;
  let fontSize = Math.max(34, Math.round(55 * widthRatio));
  let lineStep = Math.round(fontSize * 1.18);
  const unitCharPx = Math.round(fontSize * 0.58);

  const lines = wrapTextForOverlay(topic.trim(), wrapWidth, unitCharPx, 6);
  const n = lines.length;
  const minBandTop = Math.round(H * 0.32);
  let bandTop;
  for (let attempt = 0; attempt < 16; attempt++) {
    bandTop = H - marginBottom - fontSize - textTopPad - (n - 1) * lineStep;
    if (bandTop >= minBandTop) break;
    fontSize -= 3;
    lineStep = Math.round(fontSize * 1.18);
  }
  bandTop = Math.max(minBandTop, Math.min(bandTop, H - Math.round(fontSize * 1.5)));
  const firstBaseline = bandTop + fontSize + textTopPad;
  const watermarkSize = Math.max(14, Math.round(fontSize * 0.32));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style><![CDATA[
    .title { fill: #ffffff; font-size: ${fontSize}px; font-family: Arial, Helvetica, sans-serif; font-weight: 700; }
    .wm { fill: #ffffff; fill-opacity: 0.55; font-size: ${watermarkSize}px; font-family: Arial, Helvetica, sans-serif; font-weight: 500; letter-spacing: 0.5px; }
  ]]></style>
  <rect x="0" y="${bandTop}" width="${W}" height="${H - bandTop}" fill="rgba(0,0,0,0.55)" />
  ${lines
    .map((line, i) => {
      const y = firstBaseline + i * lineStep;
      return `<text x="${sidePad}" y="${y}" class="title">${escapeXml(line)}</text>`;
    })
    .join("\n  ")}
  <text x="${W - sidePad}" y="${H - Math.round(watermarkSize * 0.6)}" class="wm" text-anchor="end">${escapeXml(WATERMARK_TEXT)}</text>
</svg>`;

  return sharp(imageBuffer)
    .resize(W, H, { fit: "cover", position: "centre" })
    .composite([{ input: Buffer.from(svg, "utf8"), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function firstReplicateImageUrl(output) {
  if (output == null) return null;
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const u = firstReplicateImageUrl(item);
      if (u) return u;
    }
    return null;
  }
  if (typeof output === "object") {
    if (typeof output.output === "string" && /^https?:\/\//i.test(output.output)) return output.output;
    if (typeof output.url === "string") return output.url;
  }
  return null;
}

/**
 * Run SDXL + Sharp overlay, optionally upload composited PNG to Cloudinary.
 * Returns { imageUrl (data URL), originalImageUrl (Replicate), shareUrl? (Cloudinary),
 *          seedUsed, promptUsed, formatUsed }.
 */
async function generateBannerImage({ topic, tone, keywords, style, format }) {
  const preset = getFormatPreset(format);
  const seedUsed = Math.floor(Math.random() * 1_000_000_000);
  const promptUsed = buildSdxlPrompt(topic, tone, keywords, style);

  const imageOutput = await replicate.run(
    "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
    {
      input: {
        prompt: promptUsed,
        negative_prompt: "text, watermark, logo, people, face, blurry, low quality",
        width: preset.sdxl.width,
        height: preset.sdxl.height,
        num_outputs: 1,
        seed: seedUsed,
      },
    }
  );

  const originalImageUrl = firstReplicateImageUrl(imageOutput);
  if (!originalImageUrl) {
    const err = new Error("Replicate returned no image URL");
    err.code = "REPLICATE_NO_URL";
    throw err;
  }

  let imageUrl = originalImageUrl;
  let shareUrl = null;
  try {
    const { data: imageBuf } = await axios.get(originalImageUrl, {
      responseType: "arraybuffer",
      timeout: 90_000,
      maxContentLength: 20_000_000,
      maxBodyLength: 20_000_000,
    });
    const outBuf = await burnTopicOnImage(Buffer.from(imageBuf), String(topic).trim(), preset.id);
    imageUrl = `data:image/png;base64,${outBuf.toString("base64")}`;
    if (isCloudinaryConfigured()) {
      shareUrl = await uploadBannerToCloudinary(outBuf, { topic });
    }
  } catch (overlayErr) {
    console.warn("[posts/image] sharp overlay failed, returning raw Replicate URL", overlayErr);
  }

  return { imageUrl, originalImageUrl, shareUrl, seedUsed, promptUsed, formatUsed: preset.id };
}

/**
 * POST /api/posts/generate
 * Body: { topic, tone?, keywords?, style? }
 *
 * Auth required. Consumes one monthly credit (free=5, pro=80, premium=240) before any
 * paid Replicate call so quota-blocked users never burn billing dollars. Returns
 * remainingCredits / planLimit / planTier / creditsResetAt so the UI can show the gauge.
 */
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { topic, tone, keywords, style, format } = req.body;
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "topic required" });
    }

    const ai = getGenai();
    if (!ai) {
      return res.status(503).json({ error: "GEMINI_API_KEY / GOOGLE_GEMINI_API_KEY missing in server/.env" });
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(503).json({ error: "REPLICATE_API_TOKEN missing in server/.env" });
    }

    // Throws PlanQuotaError (→ 402) when the user has hit their monthly cap.
    const quota = await assertAndConsumeCredit(req.db, req.dbUser);

    const { post: rawText, modelUsed } = await generateLinkedInPostText(
      ai,
      buildVariantsPrompt({ topic, tone, keywords })
    );
    if (!rawText) {
      return res.status(502).json({ error: "Gemini returned empty text" });
    }

    const variants = parseVariants(rawText, "Default").slice(0, 3);
    const post = variants[0]?.post || rawText;

    const { imageUrl, originalImageUrl, shareUrl, seedUsed, promptUsed, formatUsed } =
      await generateBannerImage({ topic, tone, keywords, style, format });

    const payload = {
      post,
      variants,
      imageUrl,
      originalImageUrl,
      shareUrl,
      success: true,
      costNote: "~$0.002/image (Replicate SDXL; check replicate.com for current pricing)",
      remainingCredits: quota.remainingCredits,
      planLimit: quota.planLimit,
      planTier: quota.planTier,
      creditsResetAt: quota.resetAt?.toISOString() ?? null,
      debug: {
        seedUsed,
        styleUsed: String(style || "Auto"),
        formatUsed,
        modelUsed,
        promptUsed: IS_DEV ? promptUsed : promptUsed.slice(0, 240),
      },
    };
    res.json(payload);
  } catch (err) {
    console.error("[posts/generate] error", err);
    const mapped = mapGenerationError(err);
    const out = { error: mapped.error };
    if (mapped.code) out.code = mapped.code;
    if (mapped.action) out.action = mapped.action;
    if (mapped.planTier) out.planTier = mapped.planTier;
    if (mapped.planLimit != null) out.planLimit = mapped.planLimit;
    if (mapped.resetAt) out.resetAt = mapped.resetAt;
    res.status(mapped.http).json(out);
  }
});

/**
 * POST /api/posts/regenerate-image
 * Body: { topic, tone?, keywords?, style? }
 *
 * Auth required. Also consumes one credit because this hits Replicate (≈ $0.002 / call) just like
 * the full /generate route — quota math should reflect real Replicate spend, not text spend.
 */
router.post("/regenerate-image", requireAuth, async (req, res) => {
  try {
    const { topic, tone, keywords, style, format } = req.body;
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "topic required" });
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      return res.status(503).json({ error: "REPLICATE_API_TOKEN missing in server/.env" });
    }

    const quota = await assertAndConsumeCredit(req.db, req.dbUser);

    const { imageUrl, originalImageUrl, shareUrl, seedUsed, promptUsed, formatUsed } =
      await generateBannerImage({ topic, tone, keywords, style, format });

    res.json({
      imageUrl,
      originalImageUrl,
      shareUrl,
      success: true,
      costNote: "~$0.002/image (Replicate SDXL only — text reused).",
      remainingCredits: quota.remainingCredits,
      planLimit: quota.planLimit,
      planTier: quota.planTier,
      creditsResetAt: quota.resetAt?.toISOString() ?? null,
      debug: {
        seedUsed,
        styleUsed: String(style || "Auto"),
        formatUsed,
        promptUsed: IS_DEV ? promptUsed : promptUsed.slice(0, 240),
      },
    });
  } catch (err) {
    console.error("[posts/regenerate-image] error", err);
    const mapped = mapGenerationError(err);
    const out = { error: mapped.error };
    if (mapped.code) out.code = mapped.code;
    if (mapped.action) out.action = mapped.action;
    if (mapped.planTier) out.planTier = mapped.planTier;
    if (mapped.planLimit != null) out.planLimit = mapped.planLimit;
    if (mapped.resetAt) out.resetAt = mapped.resetAt;
    res.status(mapped.http).json(out);
  }
});

/**
 * GET /api/posts/formats
 * Lists the aspect-ratio presets the client can pick from. Tiny helper for the UI.
 */
router.get("/formats", (_req, res) => {
  res.json({
    formats: Object.values(FORMAT_PRESETS).map((p) => ({
      id: p.id,
      label: p.label,
      width: p.width,
      height: p.height,
    })),
  });
});

/**
 * POST /api/posts/auto-classify
 * Body: { topic }
 * Returns: { tone, style, reason } — Gemini's best pick of tone + image style for the topic.
 * One small Gemini call, ~$0.0001. Falls back to professional/Auto if the model is busy.
 */
router.post("/auto-classify", requireAuth, async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "topic required" });
    }
    const ai = getGenai();
    if (!ai) {
      return res.status(503).json({ error: "GEMINI_API_KEY / GOOGLE_GEMINI_API_KEY missing in server/.env" });
    }
    const { post: rawText, modelUsed } = await generateLinkedInPostText(
      ai,
      buildAutoClassifyPrompt(topic)
    );
    const result = parseAutoClassification(rawText);
    res.json({ ...result, success: true, debug: { modelUsed } });
  } catch (err) {
    console.error("[posts/auto-classify] error", err);
    res.json({ tone: "professional", style: "Auto", reason: "Auto-pick unavailable, used defaults.", success: false });
  }
});

/**
 * POST /api/posts/export-pdf
 * Body: { topic, post, imageUrl }  (imageUrl can be a `data:` URL, an HTTPS URL, or omitted)
 * Streams a single-page A4 PDF with the banner on top and the post body below.
 */
router.post("/export-pdf", requireAuth, async (req, res) => {
  try {
    const { topic, post, imageUrl } = req.body || {};
    if (!post || typeof post !== "string") {
      return res.status(400).json({ error: "post required" });
    }

    let imageBytes = null;
    if (typeof imageUrl === "string" && imageUrl) {
      if (imageUrl.startsWith("data:")) {
        const m = imageUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
        if (m) imageBytes = Buffer.from(m[2], "base64");
      } else if (/^https?:\/\//i.test(imageUrl)) {
        try {
          const dl = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 30_000,
            maxContentLength: 20_000_000,
          });
          imageBytes = Buffer.from(dl.data);
        } catch (e) {
          console.warn("[posts/export-pdf] couldn't fetch image, continuing text-only", e.message || e);
        }
      }
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`LinkedIn Post — ${String(topic || "untitled").slice(0, 80)}`);
    pdfDoc.setCreator("AI LinkedIn Studio");
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - margin;

    if (topic && typeof topic === "string") {
      const titleSize = 18;
      const wrapped = wrapPdfLines(String(topic), fontBold, titleSize, pageWidth - margin * 2);
      for (const line of wrapped) {
        page.drawText(line, { x: margin, y: cursorY - titleSize, size: titleSize, font: fontBold, color: rgb(0.05, 0.05, 0.1) });
        cursorY -= titleSize + 4;
      }
      cursorY -= 8;
    }

    if (imageBytes) {
      try {
        const img = await embedImageAuto(pdfDoc, imageBytes);
        const drawWidth = pageWidth - margin * 2;
        const drawHeight = (img.height / img.width) * drawWidth;
        const finalHeight = Math.min(drawHeight, 320);
        const finalWidth = (img.width / img.height) * finalHeight;
        page.drawImage(img, { x: margin, y: cursorY - finalHeight, width: finalWidth, height: finalHeight });
        cursorY -= finalHeight + 16;
      } catch (e) {
        console.warn("[posts/export-pdf] embed image failed", e.message || e);
      }
    }

    const bodySize = 11;
    const bodyLeading = bodySize * 1.45;
    const bodyLines = post
      .split(/\r?\n/)
      .flatMap((para) =>
        para === "" ? [""] : wrapPdfLines(para, font, bodySize, pageWidth - margin * 2)
      );
    for (const line of bodyLines) {
      if (cursorY - bodyLeading < margin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }
      page.drawText(line || " ", { x: margin, y: cursorY - bodySize, size: bodySize, font, color: rgb(0.1, 0.1, 0.15) });
      cursorY -= bodyLeading;
    }

    const footerSize = 8;
    page.drawText("Generated with AI LinkedIn Studio · " + new Date().toISOString().slice(0, 10), {
      x: margin,
      y: 18,
      size: footerSize,
      font,
      color: rgb(0.55, 0.55, 0.6),
    });

    const bytes = await pdfDoc.save();
    const safeName = String(topic || "linkedin-post")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "linkedin-post";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.setHeader("Content-Length", bytes.length);
    res.end(Buffer.from(bytes));
  } catch (err) {
    console.error("[posts/export-pdf] error", err);
    res.status(500).json({ error: err?.message || "PDF export failed" });
  }
});

/** Hard wrap a paragraph by font width — used for PDF body text. */
function wrapPdfLines(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      out.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) out.push(line);
  return out;
}

/** PDFDocument.embedPng/Jpg are format-specific; sniff bytes so callers don't have to. */
async function embedImageAuto(pdfDoc, bytes) {
  const head = bytes.slice(0, 4);
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (isPng) return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

export default router;
