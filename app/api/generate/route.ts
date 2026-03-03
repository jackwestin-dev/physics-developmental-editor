import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadPedagogy, loadStyleSamples, buildMessages } from "@/lib/pedagogy";

export const maxDuration = 60;

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

    const body = await request.json();
    const inputText = typeof body.inputText === "string" ? body.inputText.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() || null : null;
    const useStyleSamples = body.useStyleSamples !== false;

    if (!inputText) {
      return NextResponse.json(
        { error: "inputText is required and must be non-empty." },
        { status: 400 }
      );
    }

    const pedagogy = loadPedagogy();
    const styleSamples = useStyleSamples ? loadStyleSamples() : "";
    const { system, user } = buildMessages(pedagogy, inputText, styleSamples, topic);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format from model." },
        { status: 502 }
      );
    }

    return NextResponse.json({ excerpt: block.text });
  } catch (err) {
    console.error("Generate API error:", err);
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
