"use client";

import { useState, useRef, useCallback } from "react";

const MAX_SOURCES = 5;

type SourceState = {
  text: string;
  imageBase64: string | null;
  imageName: string | null;
  imageMediaType: string | null;
  pdfName: string | null;
};

const emptySource: SourceState = { text: "", imageBase64: null, imageName: null, imageMediaType: null, pdfName: null };

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

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerVersion = (pdfjs as { version?: string }).version || "4.10.38";
  if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${workerVersion}/build/pdf.worker.min.mjs`;
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = (content.items as { str: string }[]).map((item) => item.str);
    parts.push(strings.join(" "));
  }
  return parts.join("\n\n");
}

export default function EditorPage() {
  const [sources, setSources] = useState<SourceState[]>([{ ...emptySource }, { ...emptySource }]);
  const [topic, setTopic] = useState("");
  const [useStyleSamples, setUseStyleSamples] = useState(true);
  const [excerpt, setExcerpt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pdfExtracting, setPdfExtracting] = useState(false);

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
    e.target.value = "";
    if (file.type === "application/pdf") {
      setPdfExtracting(true);
      setError(null);
      try {
        const text = await extractTextFromPdf(file);
        setSource(index, { text, pdfName: file.name, imageBase64: null, imageName: null, imageMediaType: null });
      } catch {
        setError("Could not extract text from PDF. The file may be scanned/image-based or corrupted.");
      } finally {
        setPdfExtracting(false);
      }
      return;
    }
    try {
      const b64 = await readFileAsBase64(file);
      setSource(index, { imageBase64: b64, imageName: file.name, imageMediaType: file.type || "image/png", pdfName: null });
    } catch {
      setError("Could not read the image file.");
    }
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
          ...(s.imageBase64 && { imageBase64: s.imageBase64, imageMediaType: s.imageMediaType || "image/png" }),
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
        Add one to five sources (paste text, or upload screenshots, images, or PDFs). The editor synthesizes them into a single excerpt in{" "}
        <strong>your pedagogy and narration style</strong>—concrete scenarios, second-person "you," and clear conclusions.
      </p>

      <form onSubmit={handleSubmit}>
        {sources.map((source, index) => (
          <div key={index} className="section">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <label htmlFor={`source-${index}`}>Source {index + 1}</label>
              {sources.length > 1 && (
                <button type="button" className="secondary" onClick={() => removeSource(index)} disabled={loading} aria-label={`Remove source ${index + 1}`}>
                  Remove
                </button>
              )}
            </div>
            <p className="input-hint">{index === 0 ? "Paste text, or upload a screenshot, image, or PDF" : "Optional: text, screenshot, image, or PDF"}</p>
            <textarea
              id={`source-${index}`}
              placeholder={`Paste or type text for source ${index + 1}...`}
              value={source.text}
              onChange={(e) => setSource(index, { text: e.target.value })}
              disabled={loading}
            />
            <div className="file-row">
              <input ref={(el) => { fileRefs.current[index] = el; }} type="file" accept="image/*,application/pdf" aria-label={`Upload image or PDF for Source ${index + 1}`} onChange={(e) => onFile(index, e)} style={{ display: "none" }} />
              <button type="button" className="secondary" onClick={() => fileRefs.current[index]?.click()} disabled={loading || pdfExtracting}>
                {pdfExtracting ? "Extracting PDF…" : source.pdfName ? `PDF: ${source.pdfName}` : source.imageName ? `Image: ${source.imageName}` : "Upload screenshot, image, or PDF"}
              </button>
              {source.imageBase64 && (
                <button type="button" className="secondary" onClick={() => setSource(index, { imageBase64: null, imageName: null, imageMediaType: null })} disabled={loading}>Remove image</button>
              )}
              {source.pdfName && (
                <button type="button" className="secondary" onClick={() => setSource(index, { text: "", pdfName: null })} disabled={loading}>Clear PDF</button>
              )}
            </div>
          </div>
        ))}

        {sources.length < MAX_SOURCES && (
          <div className="section">
            <button type="button" className="secondary" onClick={addSource} disabled={loading}>+ Add source {sources.length + 1}</button>
          </div>
        )}

        <div className="section">
          <label htmlFor="topic">Topic / section focus (optional)</label>
          <input id="topic" type="text" placeholder="e.g. Newton's second law" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={loading} />
        </div>

        <div className="section">
          <div className="checkbox-row">
            <input id="style" type="checkbox" checked={useStyleSamples} onChange={(e) => setUseStyleSamples(e.target.checked)} disabled={loading} />
            <span>Use style samples (jw_*.md) as reference</span>
          </div>
        </div>

        <div className="cta-row">
          <button type="submit" disabled={loading}>{loading ? "Generating…" : "Generate excerpt"}{!loading && <span aria-hidden style={{ fontSize: "0.85em" }}>→</span>}</button>
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
