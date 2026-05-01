import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyImageStylePreset,
  buildAutoClassifyPrompt,
  buildSdxlPrompt,
  buildVariantsPrompt,
  escapeXml,
  extractHashtags,
  FORMAT_PRESETS,
  getFormatPreset,
  getImageStyleBase,
  parseAutoClassification,
  parseVariants,
  topicPromptAnchor,
  wrapTextForOverlay,
} from "./post-prompts.js";

test("escapeXml escapes the five XML-significant characters", () => {
  const input = `Tom & Jerry "<say>" 'hi'`;
  assert.equal(
    escapeXml(input),
    "Tom &amp; Jerry &quot;&lt;say&gt;&quot; &apos;hi&apos;"
  );
});

test("wrapTextForOverlay never splits inside a word", () => {
  const lines = wrapTextForOverlay("The dark side of AI productivity tools", 1100);
  for (const line of lines) {
    assert.ok(line.length > 0, "line should not be empty");
    assert.ok(!/^\s|\s$/.test(line), `line should be trimmed: "${line}"`);
  }
  assert.equal(lines.join(" "), "The dark side of AI productivity tools");
});

test("wrapTextForOverlay caps at 5 lines and adds an ellipsis on the last line", () => {
  const long =
    "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty";
  const lines = wrapTextForOverlay(long, 200);
  assert.ok(lines.length <= 5, `expected <=5 lines, got ${lines.length}`);
  assert.ok(lines[lines.length - 1].endsWith("…"), "last line should end with ellipsis");
});

test("getImageStyleBase routes AI/data topics to the neural network domain", () => {
  const out = getImageStyleBase("Why data engineers will outearn ML researchers", "professional", "AI, data");
  assert.match(out, /neural network/i);
});

test("getImageStyleBase routes ecommerce topics to commerce visuals", () => {
  const out = getImageStyleBase("How DTC brands keep CAC down", "professional", "ecommerce, retail");
  assert.match(out, /shopping|commerce/i);
});

test("getImageStyleBase falls back on tone for non-keyword topics", () => {
  const out = getImageStyleBase("Why I quit my job", "Storytelling", "");
  assert.match(out, /open book|narrative/i);
});

test("getImageStyleBase has a sane default", () => {
  const out = getImageStyleBase("foo bar baz", "professional", "");
  assert.match(out, /abstract|geometric|gradient/i);
});

test("applyImageStylePreset appends Cyberpunk modifiers", () => {
  const out = applyImageStylePreset("base prompt", "Cyberpunk");
  assert.match(out, /neon soaked/i);
  assert.match(out, /magenta and cyan/i);
});

test("applyImageStylePreset Auto returns base unchanged", () => {
  assert.equal(applyImageStylePreset("base prompt", "Auto"), "base prompt");
  assert.equal(applyImageStylePreset("base prompt"), "base prompt");
});

test("topicPromptAnchor strips quotes and caps length", () => {
  const long = `"This is a really long sentence about AI"`.repeat(20);
  const out = topicPromptAnchor(long, "");
  assert.ok(!/["'`]/.test(out));
  assert.ok(out.length <= 160);
});

test("buildSdxlPrompt grounds the base in the topic", () => {
  const out = buildSdxlPrompt("Stop learning frameworks", "professional", "developer", "Minimal");
  assert.match(out, /flat vector poster/i);
  assert.match(out, /Stop learning frameworks/);
});

test("buildVariantsPrompt asks for exactly three labeled variants", () => {
  const out = buildVariantsPrompt({ topic: "x", tone: "professional", keywords: "" });
  assert.match(out, /VARIANT 1/);
  assert.match(out, /VARIANT 2/);
  assert.match(out, /VARIANT 3/);
  assert.match(out, /LABEL/);
});

test("parseVariants splits well-formed Gemini output", () => {
  const sample = `--- VARIANT 1 (LABEL: Hot take) ---
First post body.

--- VARIANT 2 (LABEL: Story) ---
Second post body.

--- VARIANT 3 (LABEL: Framework) ---
Third post body.`;
  const out = parseVariants(sample);
  assert.equal(out.length, 3);
  assert.equal(out[0].label, "Hot take");
  assert.match(out[0].post, /First post body/);
});

test("parseVariants falls back to a single variant when markers are missing", () => {
  const out = parseVariants("just one block of text", "Default");
  assert.equal(out.length, 1);
  assert.equal(out[0].label, "Default");
});

test("extractHashtags returns deduped, ordered tags", () => {
  const post = "Hello world #Build #InPublic and again #build at end #ai";
  const tags = extractHashtags(post);
  assert.deepEqual(tags, ["#Build", "#InPublic", "#ai"]);
});

test("getFormatPreset returns banner for unknown / falsy input", () => {
  assert.equal(getFormatPreset(undefined).id, "banner");
  assert.equal(getFormatPreset("").id, "banner");
  assert.equal(getFormatPreset("nope").id, "banner");
});

test("getFormatPreset is case-insensitive and exposes width/height for known formats", () => {
  const sq = getFormatPreset("SQUARE");
  assert.equal(sq.id, "square");
  assert.equal(sq.width, 1080);
  assert.equal(sq.height, 1080);
  const portrait = getFormatPreset("portrait");
  assert.equal(portrait.height, 1350);
  assert.ok(portrait.sdxl.width > 0 && portrait.sdxl.height > 0, "portrait should advertise SDXL dimensions");
});

test("FORMAT_PRESETS expose all three documented aspect ratios", () => {
  const ids = Object.values(FORMAT_PRESETS).map((p) => p.id).sort();
  assert.deepEqual(ids, ["banner", "portrait", "square"]);
});

test("wrapTextForOverlay honours custom unitCharPx for smaller fonts", () => {
  const tight = wrapTextForOverlay("hello world this is a test of wrapping", 200, 12, 6);
  const loose = wrapTextForOverlay("hello world this is a test of wrapping", 200, 32, 6);
  assert.ok(loose.length > tight.length, "fewer chars per line should produce more lines");
});

test("buildAutoClassifyPrompt mentions the topic and the allowed values", () => {
  const out = buildAutoClassifyPrompt("Why CS degrees still matter in 2026");
  assert.match(out, /CS degrees still matter/);
  assert.match(out, /professional/);
  assert.match(out, /controversial/);
  assert.match(out, /Cyberpunk/);
  assert.match(out, /STRICT JSON/);
});

test("parseAutoClassification accepts valid JSON inside ```json fences", () => {
  const raw = '```json\n{"tone":"controversial","style":"Cyberpunk","reason":"hot take energy"}\n```';
  const out = parseAutoClassification(raw);
  assert.equal(out.tone, "controversial");
  assert.equal(out.style, "Cyberpunk");
  assert.match(out.reason, /hot take/);
});

test("parseAutoClassification falls back to safe defaults on garbage", () => {
  const out = parseAutoClassification("Sorry, I can't comply.");
  assert.equal(out.tone, "professional");
  assert.equal(out.style, "Auto");
});

test("parseAutoClassification clamps unknown values to allowed set", () => {
  const out = parseAutoClassification('{"tone":"sarcastic","style":"steampunk","reason":""}');
  assert.equal(out.tone, "professional");
  assert.equal(out.style, "Auto");
});
