import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { GAP_FILLING_SYSTEM_PROMPT, buildGapFillUserMessage } from "@/lib/gap-filling-prompt";

export const maxDuration = 120;

/**
 * Split the model output into Part 1 (Gap Summary) and Part 2 (Complete Edited Document).
 * The agent is instructed to output "### Part 1 — Gap Summary" then "### Part 2 — The Complete Edited Document".
 */
function parseGapFillOutput(raw: string): { gapSummary: string; fullDocument: string } {
  const trimmed = raw.trim();
  const part2Markers = [
    /^###\s*Part\s*2\s*[—\-]/im,
    /^##\s*Part\s*2\s*[—\-]/im,
    /Part\s*2\s*[—\-]\s*The\s*Complete\s*Edited\s*Document/im,
    /The\s*Complete\s*Edited\s*Document/im,
  ];
  let part2Index = -1;
  for (const re of part2Markers) {
    const match = trimmed.match(re);
    if (match && match.index !== undefined) {
      part2Index = match.index;
      break;
    }
  }
  if (part2Index >= 0) {
    const gapSummary = trimmed.slice(0, part2Index).trim();
    const fullDocument = trimmed.slice(part2Index).replace(/^(?:###?|Part\s*2\s*[—\-]\s*The\s*Complete\s*Edited\s*Document)\s*/im, "").trim();
    return { gapSummary, fullDocument };
  }
  return { gapSummary: "", fullDocument: trimmed };
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

    const body = (await request.json()) as { jackWestinText?: string; resourceText?: string };
    const baseDocument = typeof body.jackWestinText === "string" ? body.jackWestinText.trim() : "";
    const referenceText = typeof body.resourceText === "string" ? body.resourceText.trim() : "";

    if (!baseDocument || !referenceText) {
      return NextResponse.json(
        { error: "Both jackWestinText (base document) and resourceText (reference documents) are required." },
        { status: 400 }
      );
    }

    const userMessage = buildGapFillUserMessage(baseDocument, referenceText);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: GAP_FILLING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format from model." },
        { status: 502 }
      );
    }

    const { gapSummary, fullDocument } = parseGapFillOutput(block.text);

    return NextResponse.json({
      gapSummary,
      fullDocument,
    });
  } catch (err) {
    console.error("Gap-fill API error:", err);
    const message = err instanceof Error ? err.message : "Gap-fill failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
