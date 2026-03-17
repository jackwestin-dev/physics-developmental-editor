import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getEnhancedOutputSystemPrompt, buildEnhancedUserPrompt } from "@/lib/prompts";
import type { GenerateRequest } from "@/lib/types";

export const maxDuration = 120;

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

    const body = (await request.json()) as GenerateRequest;
    const jackWestinText = typeof body.jackWestinText === "string" ? body.jackWestinText.trim() : "";
    const resourceText = typeof body.resourceText === "string" ? body.resourceText.trim() : "";
    const missingTopics = Array.isArray(body.missingTopics) ? body.missingTopics : [];

    if (!jackWestinText) {
      return NextResponse.json(
        { error: "jackWestinText is required." },
        { status: 400 }
      );
    }

    const systemPrompt = getEnhancedOutputSystemPrompt();
    const userMessage = buildEnhancedUserPrompt(jackWestinText, resourceText, missingTopics);

    const client = new Anthropic({ apiKey });
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const readable = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        stream.on("text", (textDelta: string) => {
          controller.enqueue(encoder.encode(textDelta));
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
        stream.on("end", () => controller.close());
        stream.finalMessage().then(() => controller.close()).catch((err) => controller.error(err));
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Enhanced generate API error:", err);
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
