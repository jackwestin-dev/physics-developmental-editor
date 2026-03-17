import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  PLAGIARISM_PREVENTION_SYSTEM_PROMPT,
  buildPlagiarismCheckUserMessage,
} from "@/lib/plagiarism-prompt";

export const maxDuration = 120;

const END_REVISED = "--- END REVISED OUTPUT ---";
const AUDIT_REPORT = "--- AUDIT REPORT ---";

/**
 * Strip [REVISED] tags from text for publication-ready output. Preserves markdown and paragraphs.
 */
function stripRevisedTags(text: string): string {
  return text.replace(/\s*\[REVISED\]\s*/g, " ").trim();
}

/**
 * Parse agent output into revised output and audit report.
 */
function parsePlagiarismOutput(raw: string): {
  revisedOutput: string;
  auditReport: string;
} {
  const trimmed = raw.trim();
  const endIdx = trimmed.indexOf(END_REVISED);
  const auditIdx = trimmed.indexOf(AUDIT_REPORT);

  if (endIdx >= 0 && auditIdx > endIdx) {
    const revisedOutput = trimmed.slice(0, endIdx).trim();
    const auditReport = trimmed.slice(auditIdx + AUDIT_REPORT.length).trim();
    return { revisedOutput, auditReport };
  }

  // Fallback: look for "AUDIT REPORT" or "Overall Verdict" to split
  const verdictMatch = trimmed.match(/\n\s*\*\*Overall Verdict\*\*|\n#+\s*AUDIT REPORT|\n##\s*AUDIT REPORT/im);
  if (verdictMatch && verdictMatch.index !== undefined && verdictMatch.index > 0) {
    const revisedOutput = trimmed.slice(0, verdictMatch.index).trim();
    const auditReport = trimmed.slice(verdictMatch.index).trim();
    return { revisedOutput, auditReport };
  }

  return { revisedOutput: trimmed, auditReport: "" };
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

    const body = (await request.json()) as {
      sourceText?: string;
      outputText?: string;
    };
    const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
    const outputText = typeof body.outputText === "string" ? body.outputText.trim() : "";

    if (!sourceText || !outputText) {
      return NextResponse.json(
        {
          error: "Both sourceText (input sources) and outputText (generated document to check) are required.",
        },
        { status: 400 }
      );
    }

    const userMessage = buildPlagiarismCheckUserMessage(sourceText, outputText);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: PLAGIARISM_PREVENTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format from model." },
        { status: 502 }
      );
    }

    const { revisedOutput, auditReport } = parsePlagiarismOutput(block.text);
    const revisedDocument = stripRevisedTags(revisedOutput);
    const hadRevisions = block.text.includes("[REVISED]") || auditReport.toLowerCase().includes("revised");

    return NextResponse.json({
      revisedDocument,
      auditReport,
      hadRevisions,
    });
  } catch (err) {
    console.error("Plagiarism-check API error:", err);
    const message = err instanceof Error ? err.message : "Plagiarism check failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
