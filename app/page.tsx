"use client";

import { useState, useRef, useCallback } from "react";

const MAX_SOURCES = 5;

type SourceState = { text: string; imageBase64: string | null; imageName: string | null; imageMediaType: string | null };

const emptySource: SourceState = { text: "", imageBase64: null, imageName: null, imageMediaType: null };

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
  const [sources, setSources] = useState<SourceState[]>([{ ...emptySource }, { ...emptySource }]);
  const [topic, setTopic] = useState("");
  const [useStyleSamples, setUseStyleSamples] = useState(true);
  const [excerpt, setExcerpt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const hasAnySource = sources.some(
    (s) => s.text.trim().length > 0 || s.imageBase64 != null
  );

  const setSource = useCallback((index: number, update: Partial<SourceState> | ((prev: SourceState) => SourceState)) => {
    setSources((prev) => {
      const next = [...prev];
      next[index] = typeof update === "function" ? update(prev[index]) : { ...prev[index], ...update };
      return next;
    });
  }, []);

  const addSource = useCallback(() => {
    if (sources.length >= MAX_SOURCES) return;
    setSources((prev) => [...prev, { ...emptySource }]);
  }, [sources.length]);

  const removeSource = useCallback((index: number) => {
    if (sources.length <= 1) return;
    setSources((prev) => prev.filter((_, i) => i !== index));
    fileRefs.current = fileRefs.current.filter((_, i) => i !== index);
  }, [sources.length]);

  async function onFile(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const b64 = await readFileAsBase64(file);
      setSource(index, { imageBase64: b64, imageName: file.name, imageMediaType: file.type || "image/png" });
    } catch {
      setError("Could not read the image file.");
    }
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExcerpt("");
    if (!hasAnySource) {
      setError("Add at least one source: paste text or upload a screenshot in any source.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        sources: sources.map((s) => ({
          text: s.text.trim(),
          ...(s.imageBase64 && {
            imageBase64: s.imageBase64,
            imageMediaType: s.imageMediaType || "image/png",
          }),
        })),
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

  return (
    <main>
      <p className="course-title">Physics Textbook Developmental Editor</p>
      <h1>Transform content into your voice</h1>
      <p className="subtitle">
        Add one to five sources (text and/or screenshots). The editor synthesizes them into a single excerpt in{" "}
        <strong>your pedagogy and narration style</strong>—concrete scenarios, second-person “you,” and clear conclusions.
      </p>

      <form onSubmit={handleSubmit}>
        {sources.map((source, index) => (
          <div key={index} className="section">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <label htmlFor={`source-${index}`}>Source {index + 1}</label>
              {sources.length > 1 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => removeSource(index)}
                  disabled={loading}
                  aria-label={`Remove source ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
            <p className="input-hint">
              {index === 0 ? "Paste text and/or upload a screenshot (e.g. textbook page)" : "Optional (text and/or screenshot)"}
            </p>
            <textarea
              id={`source-${index}`}
              placeholder={`Paste or type text for source ${index + 1}...`}
              value={source.text}
              onChange={(e) => setSource(index, { text: e.target.value })}
              disabled={loading}
            />
            <div className="file-row">
              <input
                ref={(el) => { fileRefs.current[index] = el; }}
                type="file"
                accept="image/*"
                aria-label={`Upload image for Source ${index + 1}`}
                onChange={(e) => onFile(index, e)}
                style={{ display: "none" }}
              />
              <button
                type="button"
                className="secondary"
                onClick={() => fileRefs.current[index]?.click()}
                disabled={loading}
              >
                {source.imageName ? `Image: ${source.imageName}` : "Upload screenshot / image"}
              </button>
              {source.imageBase64 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSource(index, { imageBase64: null, imageName: null, imageMediaType: null })}
                  disabled={loading}
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
        ))}

        {sources.length < MAX_SOURCES && (
          <div className="section">
            <button
              type="button"
              className="secondary"
              onClick={addSource}
              disabled={loading}
            >
              + Add source {sources.length + 1}
            </button>
          </div>
        )}

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
