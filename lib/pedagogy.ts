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

export function buildMessages(
  pedagogy: string,
  source1: SourceInput,
  source2: SourceInput | null,
  styleSamples: string,
  topicHint: string | null,
  options?: { source1HasImage?: boolean; source2HasImage?: boolean }
): { system: string; user: string } {
  const hasTwoSources = source2 != null && source2.text.length > 0;
  const img1 = options?.source1HasImage;
  const img2 = options?.source2HasImage;
  const twoSourceGuidance = hasTwoSources
    ? `

## Two-source synthesis

You are receiving **two** source inputs (e.g. two textbook excerpts or two reference materials on the same topic). Your job is to **synthesize** them into a single, coherent excerpt in our voice—not to rewrite one and ignore the other. Use both sources to inform coverage, depth, and accuracy. Draw on the physics and pedagogical ideas from both, then express everything in your own words with your own scenarios and examples. The result should read as one unified narrative that could have been written by a single author, not as a patchwork of the two inputs.

When both sources cover a **formula or definition that applies in multiple situations** (e.g. work W = Fd cos θ, or force and acceleration), prefer **one extended scenario** explored across those situations: introduce the formula, then walk through case 1 (e.g. force and displacement in same direction) with a concrete example and a **Conclusion:**, then case 2 (e.g. at an angle), then case 3 (e.g. opposite direction), then case 4 (e.g. perpendicular), each with a short **Conclusion:**, and end with a **Conclusions:** bullet list. Use the same concrete numbers where possible so the reader sees one thread.

When both sources cover a **definition-and-law topic** (e.g. reflection: incident ray, normal, angle of incidence, angle of reflection, law of reflection), prefer **one concrete scenario** (e.g. a single simple setup the reader can picture), then **define each term in order** in one or two sentences per term, then **state the law** ("Furthermore... you can conclude that: [rule]. This rule is known as the [law]."), then add **one short consequence or special case** ("Note that, based on the law, if [simple case], then [result]. In other words, [interpretation]."). Reference figures in the body and use full-sentence captions. It is okay to focus on one clear thread rather than packing every subtopic from both inputs.`
    : "";

  let system = `You are a physics textbook developmental editor. Your job is to transform raw or reference-style physics content into a fully original textbook excerpt that follows a specific pedagogy and narration style.
${twoSourceGuidance}

CRITICAL ORIGINALITY RULE: Your output must be **completely original prose**. You must NOT copy, closely paraphrase, or echo sentences from the input content or from the reference excerpts. Absorb the physics and the structural patterns, then write everything from scratch in your own words. Invent new scenarios, new everyday objects, and new numerical values. If you catch yourself writing a sentence that resembles the input, stop and rewrite it.

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

  const instruction =
    hasTwoSources
      ? "Synthesize the following **two sources** into one textbook excerpt in our voice. Use both sources to inform your coverage; then write a fully **original** excerpt. Follow the pedagogy guide's structure and voice. Use different opening scenarios, different everyday objects, and different numerical values than in either source. Do not copy or closely paraphrase either source—write as if you are a different author teaching the same topic."
      : "Transform the following physics content into a fully **original** textbook excerpt. Follow the pedagogy guide's structure and voice, but express all ideas in completely new language. Use different opening scenarios, different everyday objects, different analogies, and different numerical values than those found in the input. Do not closely paraphrase or echo the input's wording — write as if you are a different author covering the same physics topic.";

  const userParts = [`## Content to transform\n\n${instruction}`, "---\n"];

  userParts.push("### Source 1\n\n");
  if (img1) userParts.push("(An image for Source 1 is attached below.)\n\n");
  userParts.push(source1.text.trim() || "(No text provided.)");
  if (hasTwoSources) {
    userParts.push("\n\n### Source 2\n\n");
    if (img2) userParts.push("(An image for Source 2 is attached below.)\n\n");
    userParts.push(source2!.text.trim());
  }
  if (topicHint) userParts.splice(2, 0, `\nTopic/section focus: ${topicHint}\n`);
  const user = userParts.join("");

  return { system, user };
}
