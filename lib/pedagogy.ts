import fs from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();

function loadFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8").trim();
}

export function loadPedagogy(): string {
  const p = path.join(PROJECT_ROOT, "pedagogy.md");
  if (!fs.existsSync(p)) throw new Error("pedagogy.md not found");
  return loadFile(p);
}

export function loadStyleSamples(): string {
  const dir = PROJECT_ROOT;
  const names = fs.readdirSync(dir).filter((n) => n.startsWith("jw_") && n.endsWith(".md"));
  if (names.length === 0) return "";
  const parts = names.sort().map((n) => {
    const content = loadFile(path.join(dir, n));
    return `--- ${n} ---\n${content}`;
  });
  return parts.join("\n\n");
}

export type SourceInput = { text: string };

/** sources: 1–5 items. sourceHasImage: parallel array of booleans. */
export function buildMessages(
  pedagogy: string,
  sources: SourceInput[],
  styleSamples: string,
  topicHint: string | null,
  options?: { sourceHasImage?: boolean[] }
): { system: string; user: string } {
  const n = sources.length;
  const hasMultiple = n >= 2;
  const hasImage = options?.sourceHasImage ?? [];

  const multiSourceGuidance = hasMultiple
    ? `

## Multi-source synthesis

You are receiving **${n}** source inputs (Source 1 through Source ${n}). Your job is to **synthesize** them into a single, coherent excerpt in our voice—not to rewrite one and ignore the others. Use all sources to inform coverage, depth, and accuracy. Draw on the physics and pedagogical ideas from every source, then express everything in your own words with your own scenarios and examples. The result should read as one unified narrative that could have been written by a single author, not as a patchwork of the inputs.

When multiple sources cover a **formula or definition that applies in multiple situations** (e.g. work W = Fd cos θ, or force and acceleration), prefer **one extended scenario** explored across those situations: introduce the formula, then walk through case 1 (e.g. force and displacement in same direction) with a concrete example and a **Conclusion:**, then case 2 (e.g. at an angle), then case 3 (e.g. opposite direction), then case 4 (e.g. perpendicular), each with a short **Conclusion:**, and end with a **Conclusions:** bullet list. Use the same concrete numbers where possible so the reader sees one thread.

When sources cover a **definition-and-law topic** (e.g. reflection: incident ray, normal, angle of incidence, angle of reflection, law of reflection), prefer **one concrete scenario** (e.g. a single simple setup the reader can picture), then **define each term in order** in one or two sentences per term, then **state the law** ("Furthermore... you can conclude that: [rule]. This rule is known as the [law]."), then add **one short consequence or special case** ("Note that, based on the law, if [simple case], then [result]. In other words, [interpretation]."). Reference figures in the body and use full-sentence captions. It is okay to focus on one clear thread rather than packing every subtopic from every input.`
    : "";

  let system = `You are a physics textbook developmental editor. Your job is to transform raw or reference-style physics content into a fully original textbook excerpt that follows a specific pedagogy and narration style.
${multiSourceGuidance}

CRITICAL ORIGINALITY RULE: Keep the **tone and approach**; change the **examples, analogies, and framing**. Your output must be **completely original** in wording, examples, and how you introduce formulas. Do NOT copy or closely paraphrase sentences, examples, or analogies from the input or reference excerpts (e.g. do not reuse "relative density" critiques, body fat/bone or atmosphere/ocean comparisons, or the same formula sequence and lead-in as in the input). Use **real-world examples** that are your own—different objects, different numbers, different framing. If you catch yourself reusing an example or a turn of phrase from the input, replace it with an original, real-world alternative.

## Pedagogy and style guide (follow this strictly)

${pedagogy}
`;

  if (styleSamples) {
    system += `

## Reference excerpts (for STRUCTURAL and TONAL reference only — DO NOT copy language)

Study these excerpts to understand the target structure, voice, and pedagogical flow. Match the second-person style, the hook-before-definition pattern, misconception handling, and section organization. However, do NOT reproduce any sentences, phrases, scenarios, or examples from these excerpts. Your output must use entirely different wording, different objects, different settings, and different numerical values.

${styleSamples}
`;
  }

  const instruction = hasMultiple
    ? `Synthesize the following **${n} sources** into one textbook excerpt in our voice. Use all sources to inform your coverage; then write a fully **original** excerpt. Keep the **tone and approach**; use **original examples, analogies, and framing**—real-world but not copied from any source (different objects, numbers, and formula lead-ins). Do not reuse any source's examples or near-verbatim phrasing. Write as if you are a different author teaching the same topic.`
    : "Transform the following physics content into a fully **original** textbook excerpt. Keep the **tone and approach**; use **original examples, analogies, and framing**—real-world but not from the input (different objects, numbers, and how you introduce formulas). Do not reuse the input's examples or near-verbatim phrasing. Write as if you are a different author covering the same physics topic.";

  const userParts = [`## Content to transform\n\n${instruction}`, "\n---\n"];
  if (topicHint) userParts.push(`\nTopic/section focus: ${topicHint}\n`);

  sources.forEach((src, i) => {
    const idx = i + 1;
    userParts.push(`\n### Source ${idx}\n\n`);
    if (hasImage[i]) userParts.push(`(An image for Source ${idx} is attached below.)\n\n`);
    userParts.push(src.text.trim() || "(No text provided.)");
  });

  const user = userParts.join("");

  return { system, user };
}
