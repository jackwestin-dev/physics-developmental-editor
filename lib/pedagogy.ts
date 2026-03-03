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

export function buildMessages(
  pedagogy: string,
  inputText: string,
  styleSamples: string,
  topicHint: string | null
): { system: string; user: string } {
  let system = `You are a physics textbook developmental editor. Your job is to rewrite raw or reference-style physics content into a textbook excerpt that matches a specific pedagogy and narration style.

## Pedagogy and style guide (follow this strictly)

${pedagogy}
`;

  if (styleSamples) {
    system += `

## Reference excerpts (match this tone and structure)

Use these as concrete examples of the target style. Match second-person "you," concrete opening scenarios, misconception handling, and section structure.

${styleSamples}
`;
  }

  const userParts = [
    "## Input content to transform\n\nRewrite the following content into a single textbook excerpt that follows the pedagogy guide and matches the reference style.",
    "---\n",
    inputText,
  ];
  if (topicHint) userParts.splice(1, 0, `\nTopic/section focus: ${topicHint}\n`);
  const user = userParts.join("\n");

  return { system, user };
}
