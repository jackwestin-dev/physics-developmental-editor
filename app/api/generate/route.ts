import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadPedagogy, loadStyleSamples, buildMessages } from "@/lib/pedagogy";

export const maxDuration = 60;

type SourcePayload = { text?: string; imageBase64?: string; imageMediaType?: string };

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function toAllowedMediaType(s: string | undefined): AllowedImageType {
  if (s && ALLOWED_IMAGE_TYPES.includes(s as AllowedImageType)) return s as AllowedImageType;
  return "image/png";
}

function parseSource(raw: unknown): SourcePayload {
  if (raw == null || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    text: typeof o.text === "string" ? o.text.trim() : "",
    imageBase64: typeof o.imageBase64 === "string" ? o.imageBase64 : undefined,
    imageMediaType: typeof o.imageMediaType === "string" ? o.imageMediaType : undefined,
  };
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

    const body = await request.json();
    const source1 = parseSource(body.source1);
    const source2 = parseSource(body.source2);
    const topic = typeof body.topic === "string" ? body.topic.trim() || null : null;
    const useStyleSamples = body.useStyleSamples !== false;

    const hasSource1 = (source1.text?.length ?? 0) > 0 || !!source1.imageBase64;
    const hasSource2 = (source2.text?.length ?? 0) > 0 || !!source2.imageBase64;
    if (!hasSource1 && !hasSource2) {
      return NextResponse.json(
        { error: "Provide at least one source (Source 1 or Source 2) with text or an image." },
        { status: 400 }
      );
    }

    const pedagogy = loadPedagogy();
    const styleSamples = useStyleSamples ? loadStyleSamples() : "";
    const { system, user } = buildMessages(
      pedagogy,
      { text: source1.text ?? "" },
      hasSource2 ? { text: source2.text ?? "" } : null,
      styleSamples,
      topic,
      { source1HasImage: !!source1.imageBase64, source2HasImage: !!source2.imageBase64 }
    );

    type ImageBlock = {
      type: "image";
      source: { type: "base64"; media_type: AllowedImageType; data: string };
    };
    type ContentBlock = { type: "text"; text: string } | ImageBlock;
    const content: ContentBlock[] = [{ type: "text", text: user }];
    if (source1.imageBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: toAllowedMediaType(source1.imageMediaType),
          data: source1.imageBase64,
        },
      });
    }
    if (source2.imageBase64) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: toAllowedMediaType(source2.imageMediaType),
          data: source2.imageBase64,
        },
      });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: content.length > 1 ? content : user }],
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
