/**
 * Calls Gemini REST from server/.env (GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY).
 * Never prints the key. Use: cd server && npm run debug:gemini
 *
 * Interpreting output:
 * - Text model 200 + candidates → key works for text; if image model fails, scope is image API/model only.
 * - 429 → quota / RPM / daily (see error.reason or message).
 * - 400/403/404 → model name, payload shape, or API enablement.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const key = (
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  ""
).trim();

if (!key) {
  console.error("No GEMINI_API_KEY, GOOGLE_GEMINI_API_KEY, or GOOGLE_API_KEY in server/.env");
  process.exit(1);
}

const BASE = "https://generativelanguage.googleapis.com/v1beta";

async function postGenerateContent(modelId, label, body) {
  const url = `${BASE}/models/${modelId}:generateContent?key=${encodeURIComponent(key)}`;
  console.log(`\n=== ${label} (model: ${modelId}) ===`);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("fetch failed:", e.message);
    return;
  }
  const text = await res.text();
  console.log("HTTP", res.status);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.log("Body (non-JSON, first 400 chars):", text.slice(0, 400));
    return;
  }

  if (json.error) {
    console.log("error.code:", json.error.code ?? json.error.status);
    console.log("error.message:", json.error.message);
    if (json.error.details) console.log("error.details:", JSON.stringify(json.error.details).slice(0, 800));
    return;
  }

  const n = json.candidates?.length ?? 0;
  console.log("candidates:", n);
  if (n > 0) {
    const parts = json.candidates[0]?.content?.parts ?? [];
    const kinds = parts.map((p) => (p.text ? "text" : p.inlineData ? "inlineData" : Object.keys(p).join(",")));
    console.log("part kinds:", kinds.join(", ") || "(none)");
  }
}

const metaRaw = process.argv.slice(2).join(" ");
const onlyImageMeta = /\bimage-only\b/i.test(metaRaw);

if (!onlyImageMeta) {
  await postGenerateContent("gemini-2.5-flash", "A) Text model smoke test (key + general quota)", {
    contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
  });
}

await postGenerateContent(
  "gemini-2.5-flash-image",
  "B) Image model — minimal text-only body (same shape as naive curl)",
  {
    contents: [{ parts: [{ text: "test" }] }],
  }
);

await postGenerateContent("gemini-2.5-flash-image", "C) Image model + responseModalities IMAGE (app-like)", {
  contents: [{ role: "user", parts: [{ text: "Generate a small solid blue square icon, simple flat design." }] }],
  generationConfig: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio: "1:1" },
  },
});

console.log("\nDone. This script does not print your API key.\n");
