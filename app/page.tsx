"use client";

import { useState } from "react";

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [topic, setTopic] = useState("");
  const [useStyleSamples, setUseStyleSamples] = useState(true);
  const [excerpt, setExcerpt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExcerpt("");
    if (!inputText.trim()) {
      setError("Please enter or paste some input content.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText: inputText.trim(),
          topic: topic.trim() || null,
          useStyleSamples,
        }),
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
        Paste reference-style or raw physics content. The editor rewrites it into an excerpt that matches your <strong>pedagogy and narration style</strong>—concrete scenarios, second-person “you,” and clear conclusions.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="section">
          <label htmlFor="input">Input content</label>
          <textarea
            id="input"
            placeholder="Paste or type your source material (e.g. from another textbook or notes)..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="section">
          <label htmlFor="topic">Topic / section focus (optional)</label>
          <input
            id="topic"
            type="text"
            placeholder="e.g. Newton's third law"
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
