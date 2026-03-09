"use client";

import { useState, useRef } from "react";

type SourceState = { text: string; imageBase64: string | null; imageName: string | null; imageMediaType: string | null };

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [source1, setSource1] = useState<SourceState>({ text: "", imageBase64: null, imageName: null, imageMediaType: null });
  const [source2, setSource2] = useState<SourceState>({ text: "", imageBase64: null, imageName: null, imageMediaType: null });
  const [topic, setTopic] = useState("");
  const [useStyleSamples, setUseStyleSamples] = useState(true);
  const [excerpt, setExcerpt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);

  const hasSource1 = source1.text.trim().length > 0 || source1.imageBase64 != null;
  const hasSource2 = source2.text.trim().length > 0 || source2.imageBase64 != null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExcerpt("");
    if (!hasSource1 && !hasSource2) {
      setError("Add at least one source: paste text or upload a screenshot in Source 1 or Source 2.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        source1: {
          text: source1.text.trim(),
          ...(source1.imageBase64 && {
            imageBase64: source1.imageBase64,
            imageMediaType: source1.imageMediaType || "image/png",
          }),
        },
        source2: {
          text: source2.text.trim(),
          ...(source2.imageBase64 && {
            imageBase64: source2.imageBase64,
            imageMediaType: source2.imageMediaType || "image/png",
          }),
        },
        topic: topic.trim() || null,
        useStyleSamples,
      };
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.hint || "Generation failed.");
        return;
      }
      setExcerpt(data.excerpt ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onFile1(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await readFileAsBase64(file);
      setSource1((s) => ({ ...s, imageBase64: b64, imageName: file.name, imageMediaType: file.type || "image/png" }));
    } catch {
      setError("Could not read the image file.");
    }
    e.target.value = "";
  }
  async function onFile2(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await readFileAsBase64(file);
      setSource2((s) => ({ ...s, imageBase64: b64, imageName: file.name, imageMediaType: file.type || "image/png" }));
    } catch {
      setError("Could not read the image file.");
    }
    e.target.value = "";
  }

  return (
    <main>
      <p className="course-title">Physics Textbook Developmental Editor</p>
      <h1>Transform content into your voice</h1>
      <p className="subtitle">
        Add one or two sources (text and/or screenshots). The editor synthesizes them into a single excerpt in{" "}
        <strong>your pedagogy and narration style</strong>—concrete scenarios, second-person “you,” and clear conclusions.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="section">
          <label htmlFor="source1">Source 1</label>
          <p className="input-hint">Paste text and/or upload a screenshot (e.g. textbook page)</p>
          <textarea
            id="source1"
            placeholder="Paste or type text from your first source..."
            value={source1.text}
            onChange={(e) => setSource1((s) => ({ ...s, text: e.target.value }))}
            disabled={loading}
          />
          <div className="file-row">
            <input
              ref={file1Ref}
              type="file"
              accept="image/*"
              aria-label="Upload image for Source 1"
              onChange={onFile1}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => file1Ref.current?.click()}
              disabled={loading}
            >
              {source1.imageName ? `Image: ${source1.imageName}` : "Upload screenshot / image"}
            </button>
            {source1.imageBase64 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setSource1((s) => ({ ...s, imageBase64: null, imageName: null, imageMediaType: null }))}
                disabled={loading}
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        <div className="section">
          <label htmlFor="source2">Source 2</label>
          <p className="input-hint">Optional second source (text and/or screenshot)</p>
          <textarea
            id="source2"
            placeholder="Paste or type text from your second source..."
            value={source2.text}
            onChange={(e) => setSource2((s) => ({ ...s, text: e.target.value }))}
            disabled={loading}
          />
          <div className="file-row">
            <input
              ref={file2Ref}
              type="file"
              accept="image/*"
              aria-label="Upload image for Source 2"
              onChange={onFile2}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => file2Ref.current?.click()}
              disabled={loading}
            >
              {source2.imageName ? `Image: ${source2.imageName}` : "Upload screenshot / image"}
            </button>
            {source2.imageBase64 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setSource2((s) => ({ ...s, imageBase64: null, imageName: null, imageMediaType: null }))}
                disabled={loading}
              >
                Remove image
              </button>
            )}
          </div>
        </div>

        <div className="section">
          <label htmlFor="topic">Topic / section focus (optional)</label>
          <input
            id="topic"
            type="text"
            placeholder="e.g. Newton's second law"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="section">
          <div className="checkbox-row">
            <input
              id="style"
              type="checkbox"
              checked={useStyleSamples}
              onChange={(e) => setUseStyleSamples(e.target.checked)}
              disabled={loading}
            />
            <span>Use style samples (jw_*.md) as reference</span>
          </div>
        </div>

        <div className="cta-row">
          <button type="submit" disabled={loading}>
            {loading ? "Generating…" : "Generate excerpt"}
            {!loading && (
              <span aria-hidden style={{ fontSize: "0.85em" }}>→</span>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="message error output-wrap" style={{ marginTop: "1.5rem" }}>
          {error}
          {error.includes("API key") && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
              For local dev, add <code style={{ background: "var(--surface)", padding: "0.2em 0.4em", borderRadius: 4 }}>.env.local</code> with <code style={{ background: "var(--surface)", padding: "0.2em 0.4em", borderRadius: 4 }}>ANTHROPIC_API_KEY=your-key</code>. On Vercel, set the same variable in Project → Settings → Environment Variables.
            </div>
          )}
        </div>
      )}

      {excerpt && (
        <div className="output-wrap">
          <label>Generated excerpt</label>
          <div className="output-box">{excerpt}</div>
        </div>
      )}
    </main>
  );
}
