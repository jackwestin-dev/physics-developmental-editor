import fs from "fs";
import path from "path";

export const GAP_ANALYSIS_SYSTEM_PROMPT = `You are a curriculum gap analyst. You will receive two inputs:
1. The content of a physics/science study book (Jack Westin).
2. One or more external educational resources (e.g. AAMC content lists, Khan Academy outlines).

Your task:
- Read both carefully.
- Identify every topic, concept, sub-topic, or named physical quantity that appears in the external resources but is ABSENT or insufficiently covered in the Jack Westin book content.
- Do NOT include topics that are already present in the Jack Westin book, even if they are described differently.
- Do NOT include topics that are outside the scope of the subject matter entirely.

Respond ONLY with a raw JSON array of strings. Each string is one missing topic or concept, written as a short phrase with a brief clarifying note if needed. Example format:
["Poiseuille's Law — quantitative derivation absent", "Torricelli's Theorem", "Bernoulli applications to venturi meters"]

No preamble. No markdown. No explanation. Just the JSON array.`;

const INTEGRATING_MISSING_TOPICS_SECTION = `
---

## Integrating Missing Topics

You will also receive a list of topics that were identified as MISSING from the Jack Westin source material but present in authoritative external resources. You MUST incorporate these missing topics into your output. Follow these rules:

1. **Place each missing topic in the most logically appropriate location** within the restructured content — do not dump them at the end.
2. **Apply the full Six-Step Framework** to each missing topic exactly as you would for any other concept. Do not abbreviate.
3. **If a missing topic is a sub-concept of an existing section**, integrate it within that section rather than creating a new standalone section.
4. **If a missing topic is a standalone concept**, create a full new section for it using the same H1/H2/H3 formatting conventions.
5. The student should not be able to tell which topics were "added" — the output must read as one seamless, unified document.
`;

export function getEnhancedOutputSystemPrompt(): string {
  const projectRoot = process.cwd();
  const pedagogyPath = path.join(projectRoot, "physics_pedagogy.md");
  let pedagogyContent: string;
  try {
    pedagogyContent = fs.readFileSync(pedagogyPath, "utf-8").trim();
  } catch {
    pedagogyContent = "(Pedagogy file not found; apply the Six-Step Framework and standard physics pedagogy.)";
  }
  return pedagogyContent + INTEGRATING_MISSING_TOPICS_SECTION;
}

export function buildEnhancedUserPrompt(
  jackWestinText: string,
  resourceText: string,
  missingTopics: string[]
): string {
  return `## Jack Westin Book Content

${jackWestinText}

---

## External Resources (for context)

${resourceText}

---

## Topics Missing from Jack Westin Book (Must Be Integrated)

The following topics were identified as absent from the Jack Westin content above but are required by authoritative resources. Integrate each one fully using the Six-Step Framework at the appropriate location in the output:

${missingTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")}

---

Now produce the full enhanced output document.`;
}
