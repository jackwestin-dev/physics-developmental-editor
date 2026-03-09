#!/usr/bin/env node
/**
 * Uses Claude to generate pedagogy.md from the jw_*.md style samples.
 * Requires ANTHROPIC_API_KEY in .env.local or environment.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Load .env.local (any KEY=value line; skip comments and empty lines)
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  });
}

const samples = [
  "jw_energy_excerpt.md",
  "jw_reflection_excerpt.md",
  "jw_third_law_excerpt.md",
];

function load(name) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf-8").trim();
}

const prompt = `You are an expert in physics education and textbook design. Below are three full textbook excerpts that share a consistent pedagogy and narration style. Your task is to produce a single, comprehensive **pedagogy document** (in markdown) that future authors and an AI editor can use to write new physics content in the same style.

Analyze the samples for:
- Voice and audience (person, tone, level of formality)
- How each excerpt opens (hooks, scenarios, questions)
- How laws/concepts are stated and then unpacked
- How equations are introduced and explained
- How misconceptions are anticipated and corrected
- Use of figures and captions
- Section structure and headings
- How conclusions or takeaways are phrased
- Any recurring phrases or patterns
- What to avoid (e.g. implying cause-and-effect where there is none)

Output a single markdown document titled something like "Pedagogy & Narration Style Guide" or "Physics Textbook Pedagogy (Derived from Samples)". The document should be detailed enough that someone (or an AI) could rewrite a raw physics passage to match these samples. Include short quoted examples from the samples where they illustrate a rule. Do not include the full sample texts in the output—only the pedagogy guide with illustrative snippets.

Samples:

--- jw_energy_excerpt.md ---
${load("jw_energy_excerpt.md")}

--- jw_reflection_excerpt.md ---
${load("jw_reflection_excerpt.md")}

--- jw_third_law_excerpt.md ---
${load("jw_third_law_excerpt.md")}
`;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set. Add it to .env.local (get a key from https://console.anthropic.com).");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  console.log("Calling Claude to generate pedagogy from samples...");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    console.error("Unexpected response type:", block.type);
    process.exit(1);
  }

  const outPath = path.join(root, "pedagogy.md");
  fs.writeFileSync(outPath, block.text, "utf-8");
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
