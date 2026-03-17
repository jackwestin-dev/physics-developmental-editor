import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GAP_ANALYSIS_SYSTEM_PROMPT } from "@/lib/prompts";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

export const maxDuration = 60;

function parseJsonArray(raw: string): string[] {
  const trimmed = raw.trim();
  let toParse = trimmed;
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonMatch) toParse = jsonMatch[0];
  const parsed = JSON.parse(toParse) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "API key not configured",
          hint: "Add ANTHROPIC_API_KEY in Vercel Environment Variables (or .env.local for local dev).",
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as AnalyzeRequest;
    const jackWestinText = typeof body.jackWestinText === "string" ? body.jackWestinText.trim() : "";
    const resourceText = typeof body.resourceText === "string" ? body.resourceText.trim() : "";

    if (!jackWestinText || !resourceText) {
      return NextResponse.json(
        { error: "Both jackWestinText and resourceText are required." },
        { status: 400 }
      );
    }

    const userMessage = `## Jack Westin Book Content

${jackWestinText}

---

## External Resources

${resourceText}

---

Respond with ONLY a raw JSON array of strings: each string is one topic/concept present in the external resources but absent or insufficiently covered in the Jack Westin content. No preamble, no markdown, no explanation.`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: GAP_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format from model." },
        { status: 502 }
      );
    }

    let missingTopics: string[];
    try {
      missingTopics = parseJsonArray(block.text);
    } catch (e) {
      console.error("Gap analysis JSON parse error:", e);
      return NextResponse.json(
        {
          error: "Could not parse gap analysis response as JSON.",
          detail: e instanceof Error ? e.message : "Invalid JSON",
        },
        { status: 502 }
      );
    }

    const result: AnalyzeResponse = { missingTopics };
    return NextResponse.json(result);
  } catch (err) {
    console.error("Analyze API error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
