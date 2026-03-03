import { NextResponse } from "next/server";
import OpenAI from "openai";
import { loadPedagogy, loadStyleSamples, buildMessages } from "@/lib/pedagogy";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "API key not configured",
          hint: "Add OPENAI_API_KEY in Vercel Environment Variables (or .env.local for local dev).",
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

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 8192,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "Unexpected response format from model." },
        { status: 502 }
      );
    }

    return NextResponse.json({ excerpt: content });
  } catch (err) {
    console.error("Generate API error:", err);
    const message = err instanceof Error ? err.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
