/**
 * Pure helpers for the LinkedIn post + image generator.
 * Extracted from routes/posts.js so they can be unit-tested without spinning up Express.
 */

export const IMG_W = 1200;
export const IMG_H = 624;

/**
 * Aspect-ratio presets for the generated banner.
 * - SDXL accepts most multiples of 8 up to 1024 cleanly; we render closer to those native sizes
 *   then Sharp resizes/composites to the target output width × height.
 *
 * `id` is the value we accept from the client; `width`/`height` is the final PNG; `sdxl`
 * is the actual width/height we pass to Replicate (smaller -> faster + cheaper).
 */
export const FORMAT_PRESETS = {
  banner: { id: "banner", label: "Banner (1200×624)", width: 1200, height: 624, sdxl: { width: 1152, height: 600 } },
  square: { id: "square", label: "Square (1080×1080)", width: 1080, height: 1080, sdxl: { width: 1024, height: 1024 } },
  portrait: { id: "portrait", label: "Portrait (1080×1350)", width: 1080, height: 1350, sdxl: { width: 832, height: 1024 } },
};

export function getFormatPreset(formatId) {
  const id = String(formatId || "banner").toLowerCase();
  return FORMAT_PRESETS[id] || FORMAT_PRESETS.banner;
}

/** Escape for SVG text nodes (topic is user-controlled). */
export function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Word-wrap by estimated pixel width. Caller passes `unitCharPx` based on the font size
 * Sharp will render at; default ≈ 32px per char at ~55px Arial bold. Only breaks at spaces.
 */
export function wrapTextForOverlay(text, maxWidthPx = 1100, unitCharPx = 32, maxLines = 5) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const measure = `${testLine} `;
    if (measure.length * unitCharPx > maxWidthPx && line !== "") {
      lines.push(line.trim());
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) lines.push(line.trim());

  if (lines.length <= maxLines) return lines;

  const head = lines.slice(0, maxLines - 1);
  let tail = lines.slice(maxLines - 1).join(" ");
  while (tail.length * unitCharPx > maxWidthPx && tail.includes(" ")) {
    tail = tail.replace(/\s+\S*$/, "").trim();
  }
  if (tail.length * unitCharPx > maxWidthPx) {
    const maxChars = Math.max(6, Math.floor(maxWidthPx / unitCharPx) - 1);
    tail = tail.slice(0, maxChars);
  }
  head.push(tail ? `${tail}…` : "…");
  return head;
}

/**
 * Word-boundary match against a haystack. Bare `includes("ai")` matched "retail" / "training"
 * and misrouted ecommerce posts. Longer phrases keep `includes` semantics.
 */
function matchesAny(haystack, needles) {
  const lower = String(haystack).toLowerCase();
  for (const raw of needles) {
    const needle = raw.toLowerCase();
    if (needle.length <= 4 || /\s/.test(needle)) {
      const re = new RegExp(`(?:^|[^a-z0-9])${needle.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?:[^a-z0-9]|$)`, "i");
      if (re.test(lower)) return true;
    } else if (lower.includes(needle)) {
      return true;
    }
  }
  return false;
}

/** Topic / keyword heuristics → distinct visual domains (SDXL prompt). No in-image text; Sharp adds title. */
export function getImageStyleBase(topic, tone, keywords) {
  const haystack = `${topic} ${keywords || ""}`;
  const t = String(tone || "").toLowerCase();

  if (matchesAny(haystack, ["ecommerce", "e-commerce", "shop", "retail", "dtc"])) {
    return "modern shopping and commerce concept, floating product silhouettes, warm orange and coral gradient, minimal studio lighting, 4k, no text, no people";
  }
  if (matchesAny(haystack, ["ai", "data", "machine learning", "ml", "llm"])) {
    return "abstract neural network, glowing nodes and edges, dark blue background, subtle data visualization motif, cinematic, 4k, no text, no people";
  }
  if (matchesAny(haystack, ["startup", "founder"])) {
    return "rocket launch metaphor, upward trending abstract graph, night city skyline bokeh, inspirational blue and gold, 4k, no text, no people";
  }
  if (matchesAny(haystack, ["code", "developer", "software", "programming", "engineer"])) {
    return "glowing code brackets and abstract syntax, terminal aesthetic, matrix-inspired dark green highlights on black, 4k, no text, no people";
  }
  if (matchesAny(haystack, ["leadership", "team", "manager"])) {
    return "chess board strategy metaphor, glowing king piece, dramatic side light, executive mood, 4k, no text, no people";
  }

  if (t.includes("controversial")) {
    return "split contrast composition, fiery red and cool blue, debate and tension metaphor, high contrast, 4k, no text, no people";
  }
  if (t.includes("storytelling")) {
    return "open book with radiant light beams, warm narrative mood, soft golden hour tones, 4k, no text, no people";
  }

  return "abstract geometric shapes, corporate teal and blue gradient, modern SaaS hero aesthetic, minimal, 4k, no text, no people";
}

/** User-selected presentation layer (suffix injection). `Auto` leaves base prompt unchanged. */
export function applyImageStylePreset(base, style) {
  const s = String(style || "Auto").trim();
  if (s === "Minimal") return `${base}, flat vector poster, generous whitespace, simple shapes`;
  if (s === "Corporate") return `${base}, glass skyscraper reflections, navy and steel palette, Fortune 500 mood`;
  if (s === "Cyberpunk") return `${base}, neon soaked street haze, magenta and cyan rim light, rainy atmosphere`;
  if (s === "Isometric") return `${base}, isometric 3d illustration, tidy blocks, soft orthographic view`;
  if (s === "3D Render") return `${base}, octane style 3d render, cinematic depth of field, premium materials`;
  return base;
}

/** Keep image prompt compact; avoid special chars that rarely help SDXL. */
export function topicPromptAnchor(topic, keywords) {
  const raw = [topic, keywords].filter(Boolean).join(" — ").replace(/\s+/g, " ").trim();
  const cleaned = raw.replace(/["'`]/g, "").slice(0, 160);
  return cleaned || "general professional themes";
}

export function buildSdxlPrompt(topic, tone, keywords, style) {
  const base = getImageStyleBase(topic, tone, keywords);
  const anchor = topicPromptAnchor(topic, keywords);
  const grounded = `${base}, abstract conceptual art mood reflecting: ${anchor}`;
  return applyImageStylePreset(grounded, style).replace(/\s+/g, " ").trim();
}

/** Single-call prompt that asks Gemini for 3 distinct LinkedIn-post variants. */
export function buildVariantsPrompt({ topic, tone, keywords }) {
  return `You are a LinkedIn growth expert. Write THREE distinct viral LinkedIn post variants.

Topic: ${topic}
Tone: ${tone || "professional"}
Keywords: ${keywords || "—"}

Constraints for each variant:
1. Strong hook on the first line.
2. 3-5 short paragraphs with line breaks.
3. End with a question to drive comments.
4. Add 3 relevant hashtags at the end.
5. No emojis unless tone is casual.
6. Each variant should take a clearly different angle (e.g. story vs framework vs hot take).

Return STRICTLY this exact format and nothing else (no preface, no JSON):

--- VARIANT 1 (LABEL: <2-4 word label>) ---
<post text 1>

--- VARIANT 2 (LABEL: <2-4 word label>) ---
<post text 2>

--- VARIANT 3 (LABEL: <2-4 word label>) ---
<post text 3>`;
}

/**
 * Parse Gemini text into up to N variants by `--- VARIANT n (LABEL: foo) ---` markers.
 * Falls back to a single variant if no markers are found.
 */
export function parseVariants(rawText, fallbackLabel = "Default") {
  const text = String(rawText || "").trim();
  if (!text) return [];
  const markerRe = /---\s*VARIANT\s*(\d+)\s*(?:\(LABEL:\s*([^)]+)\))?\s*---/gi;
  const matches = [...text.matchAll(markerRe)];
  if (matches.length === 0) {
    return [{ label: fallbackLabel, post: text }];
  }
  const variants = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const label = (m[2] || `Variant ${m[1] || i + 1}`).trim().replace(/[*_`"]+/g, "").slice(0, 32);
    if (body) variants.push({ label, post: body });
  }
  return variants.length ? variants : [{ label: fallbackLabel, post: text }];
}

/**
 * Build a small JSON-mode classification prompt for "Auto-pick tone & style".
 * Forces a strict shape so we can JSON.parse the response safely.
 */
export function buildAutoClassifyPrompt(topic) {
  return `You are a social-media editor. Pick the BEST LinkedIn tone and the BEST visual style for this topic.

Topic: ${String(topic || "").trim()}

Allowed tones (use exactly one, lowercased):
- professional
- casual
- controversial
- storytelling

Allowed image styles (use exactly one, capitalized):
- Auto
- Minimal
- Corporate
- Cyberpunk
- Isometric
- 3D Render

Output STRICT JSON and nothing else, in this exact shape:
{"tone":"<one of the allowed tones>","style":"<one of the allowed styles>","reason":"<≤140 chars why>"}`;
}

const ALLOWED_TONES = new Set(["professional", "casual", "controversial", "storytelling"]);
const ALLOWED_STYLES = new Set(["Auto", "Minimal", "Corporate", "Cyberpunk", "Isometric", "3D Render"]);

/**
 * Parse Gemini's response for `buildAutoClassifyPrompt`. Tolerates ```json fences,
 * trailing prose, and case-mismatched values. Falls back to safe defaults on garbage.
 */
export function parseAutoClassification(rawText) {
  const fallback = { tone: "professional", style: "Auto", reason: "" };
  const text = String(rawText || "").trim();
  if (!text) return fallback;
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) return fallback;
  const slice = candidate.slice(firstBrace, lastBrace + 1);
  let parsed;
  try {
    parsed = JSON.parse(slice);
  } catch {
    return fallback;
  }
  const toneRaw = String(parsed?.tone || "").trim().toLowerCase();
  const styleRaw = String(parsed?.style || "").trim();
  const styleNorm =
    [...ALLOWED_STYLES].find((s) => s.toLowerCase() === styleRaw.toLowerCase()) || "Auto";
  return {
    tone: ALLOWED_TONES.has(toneRaw) ? toneRaw : "professional",
    style: styleNorm,
    reason: String(parsed?.reason || "").slice(0, 140),
  };
}

/** Pull `#word` style hashtags from anywhere in a post body. Dedup, lowercase-keyed. */
export function extractHashtags(post) {
  const text = String(post || "");
  const re = /(?:^|\s)#([A-Za-z][A-Za-z0-9_]{1,40})/g;
  const seen = new Set();
  const tags = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const key = m[1].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(`#${m[1]}`);
  }
  return tags;
}
