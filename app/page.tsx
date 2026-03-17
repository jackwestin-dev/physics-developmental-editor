"use client";

import { useState, useRef, useCallback } from "react";
import { MissingTopicsBlock } from "@/components/MissingTopicsBlock";
import { FinalTextBlock } from "@/components/FinalTextBlock";
import { LoadingState } from "@/components/LoadingState";

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

type FlowStatus = "idle" | "analyzing" | "generating" | "done" | "error";

export default function Home() {
  const [sources, setSources] = useState<SourceState[]>([{ ...emptySource }, { ...emptySource }]);
  const [jackWestin, setJackWestin] = useState<SourceState>({ ...emptySource });
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [missingTopics, setMissingTopics] = useState<string[] | null>(null);
  const [finalText, setFinalText] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ resources?: string; jackWestin?: string }>({});
  const [pdfExtracting, setPdfExtracting] = useState(false);

  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const jwFileRef = useRef<HTMLInputElement>(null);

  const hasResourceText = sources.some((s) => s.text.trim().length > 0);
  const hasJackWestinText = jackWestin.text.trim().length > 0;
  const canRun = hasResourceText && hasJackWestinText && status !== "analyzing" && status !== "generating";

  const setSource = useCallback((index: number, update: Partial<SourceState> | ((prev: SourceState) => SourceState)) => {
    setSources((prev) => {
      const next = [...prev];
      next[index] = typeof update === "function" ? update(prev[index]) : { ...prev[index], ...update };
      return next;
    });
    if (validationErrors.resources) setValidationErrors((e) => ({ ...e, resources: undefined }));
  }, [validationErrors.resources]);

  const addSource = useCallback(() => {
    if (sources.length >= MAX_SOURCES) return;
    setSources((prev) => [...prev, { ...emptySource }]);
  }, [sources.length]);

  const removeSource = useCallback((index: number) => {
    if (sources.length <= 1) return;
    setSources((prev) => prev.filter((_, i) => i !== index));
    fileRefs.current = fileRefs.current.filter((_, i) => i !== index);
  }, [sources.length]);

  const setJW = useCallback((update: Partial<SourceState> | ((prev: SourceState) => SourceState)) => {
    setJackWestin((prev) => (typeof update === "function" ? update(prev) : { ...prev, ...update }));
    if (validationErrors.jackWestin) setValidationErrors((e) => ({ ...e, jackWestin: undefined }));
  }, [validationErrors.jackWestin]);

  async function onResourceFile(index: number, e: React.ChangeEvent<HTMLInputElement>) {
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

  async function onJWFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.type === "application/pdf") {
      setPdfExtracting(true);
      setError(null);
      try {
        const text = await extractTextFromPdf(file);
        setJW({ text, pdfName: file.name, imageBase64: null, imageName: null, imageMediaType: null });
      } catch {
        setError("Could not extract text from Jack Westin PDF.");
      } finally {
        setPdfExtracting(false);
      }
      return;
    }
    try {
      const b64 = await readFileAsBase64(file);
      setJW({ imageBase64: b64, imageName: file.name, imageMediaType: file.type || "image/png", pdfName: null });
    } catch {
      setError("Could not read the image file.");
    }
  }

  async function runFlow() {
    const resourceText = sources.map((s, i) => (s.text.trim() ? `--- Source ${i + 1} ---\n${s.text.trim()}` : "")).filter(Boolean).join("\n\n");
    const jackWestinText = jackWestin.text.trim();

    if (!resourceText) {
      setValidationErrors((e) => ({ ...e, resources: "Add at least one resource with text (or upload a PDF)." }));
      return;
    }
    if (!jackWestinText) {
      setValidationErrors((e) => ({ ...e, jackWestin: "Add Jack Westin book content (paste text or upload a PDF)." }));
      return;
    }
    setValidationErrors({});
    setError(null);
    setMissingTopics(null);
    setFinalText(null);
    setStatus("analyzing");

    try {
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jackWestinText, resourceText }),
      });
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        setStatus("error");
        setError(analyzeData.error ?? analyzeData.detail ?? "Gap analysis failed.");
        return;
      }

      const topics: string[] = Array.isArray(analyzeData.missingTopics) ? analyzeData.missingTopics : [];
      setMissingTopics(topics);
      setStatus("generating");

      const genRes = await fetch("/api/enhanced-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jackWestinText, resourceText, missingTopics: topics }),
      });

      if (!genRes.ok) {
        const errData = await genRes.json().catch(() => ({}));
        setStatus("error");
        setError(errData.error ?? "Enhanced generation failed.");
        return;
      }

      const reader = genRes.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          setFinalText(fullText);
        }
      }
      setFinalText(fullText);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Request failed.");
    }
  }

  function resetOutputs() {
    setMissingTopics(null);
    setFinalText(null);
    setStatus("idle");
    setError(null);
  }

  return (
    <main className="flow-page">
      <header className="flow-hero">
        <p className="course-title">Physics Textbook Developmental Editor</p>
        <h1>Unified flow</h1>
        <p className="subtitle">
          Add <strong>external resources</strong> (1–5: text, images, or PDFs), then the <strong>Jack Westin book</strong>. Run once to get gap analysis and the full pedagogically restructured output.
        </p>
      </header>

      <div className="flow-card">
        <h2 className="flow-card-title">1. External resources (AAMC, Khan Academy, etc.)</h2>
        <p className="input-hint">Add one to five sources. Paste text or upload screenshots, images, or PDFs.</p>
        {sources.map((source, index) => (
          <div key={index} className="flow-subsection">
            <div className="flow-label-row">
              <label htmlFor={`resource-${index}`}>Resource {index + 1}</label>
              {sources.length > 1 && (
                <button type="button" className="secondary" onClick={() => removeSource(index)} disabled={status === "analyzing" || status === "generating"} aria-label={`Remove resource ${index + 1}`}>
                  Remove
                </button>
              )}
            </div>
            <textarea
              id={`resource-${index}`}
              placeholder={`Paste or type text, or upload a PDF to extract text…`}
              value={source.text}
              onChange={(e) => setSource(index, { text: e.target.value })}
              disabled={status === "analyzing" || status === "generating"}
              className="flow-textarea"
            />
            <div className="file-row">
              <input
                ref={(el) => { fileRefs.current[index] = el; }}
                type="file"
                accept="image/*,application/pdf"
                aria-label={`Upload image or PDF for Resource ${index + 1}`}
                onChange={(e) => onResourceFile(index, e)}
                style={{ display: "none" }}
              />
              <button type="button" className="secondary" onClick={() => fileRefs.current[index]?.click()} disabled={status === "analyzing" || status === "generating" || pdfExtracting}>
                {pdfExtracting ? "Extracting PDF…" : source.pdfName ? `PDF: ${source.pdfName}` : source.imageName ? `Image: ${source.imageName}` : "Upload image or PDF"}
              </button>
              {source.imageBase64 && <button type="button" className="secondary" onClick={() => setSource(index, { imageBase64: null, imageName: null, imageMediaType: null })} disabled={status === "analyzing" || status === "generating"}>Remove image</button>}
              {source.pdfName && <button type="button" className="secondary" onClick={() => setSource(index, { text: "", pdfName: null })} disabled={status === "analyzing" || status === "generating"}>Clear PDF</button>}
            </div>
          </div>
        ))}
        {sources.length < MAX_SOURCES && (
          <div className="flow-subsection">
            <button type="button" className="secondary" onClick={addSource} disabled={status === "analyzing" || status === "generating"}>+ Add resource {sources.length + 1}</button>
          </div>
        )}
        {validationErrors.resources && <p className="validation-error">{validationErrors.resources}</p>}
      </div>

      <div className="flow-card">
        <h2 className="flow-card-title">2. Jack Westin book content</h2>
        <p className="input-hint">Paste the book text or upload a PDF. This is the foundational curriculum we compare against the resources above.</p>
        <textarea
          id="jack-westin"
          placeholder="Paste Jack Westin chapter or section text here, or upload a PDF to extract text…"
          value={jackWestin.text}
          onChange={(e) => setJW({ text: e.target.value })}
          disabled={status === "analyzing" || status === "generating"}
          className="flow-textarea flow-textarea-jw"
        />
        <div className="file-row">
          <input ref={jwFileRef} type="file" accept="image/*,application/pdf" aria-label="Upload image or PDF for Jack Westin" onChange={onJWFile} style={{ display: "none" }} />
          <button type="button" className="secondary" onClick={() => jwFileRef.current?.click()} disabled={status === "analyzing" || status === "generating" || pdfExtracting}>
            {jackWestin.pdfName ? `PDF: ${jackWestin.pdfName}` : jackWestin.imageName ? `Image: ${jackWestin.imageName}` : "Upload Jack Westin PDF or image"}
          </button>
          {jackWestin.imageBase64 && <button type="button" className="secondary" onClick={() => setJW({ imageBase64: null, imageName: null, imageMediaType: null })} disabled={status === "analyzing" || status === "generating"}>Remove image</button>}
          {jackWestin.pdfName && <button type="button" className="secondary" onClick={() => setJW({ text: "", pdfName: null })} disabled={status === "analyzing" || status === "generating"}>Clear PDF</button>}
        </div>
        {validationErrors.jackWestin && <p className="validation-error">{validationErrors.jackWestin}</p>}
      </div>

      <div className="flow-card flow-cta-card">
        <button type="button" className="cta-button" onClick={canRun ? runFlow : undefined} disabled={!canRun}>
          {status === "analyzing" ? "Identifying gaps…" : status === "generating" ? "Generating final text…" : "Analyze & generate"}
        </button>
        {(status === "done" || status === "error") && (
          <button type="button" className="secondary flow-reset-btn" onClick={resetOutputs}>
            Reset and run again
          </button>
        )}
      </div>

      {error && (
        <div className="flow-card flow-error-card message error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="dismiss-error">Dismiss</button>
        </div>
      )}

      {status === "analyzing" && (
        <div className="flow-card flow-output-card">
          <LoadingState label="Identifying gaps in Jack Westin coverage…" />
        </div>
      )}

      {missingTopics !== null && (
        <div className="flow-card flow-output-card">
          <MissingTopicsBlock
            missingTopics={missingTopics}
            noGapsMessage={missingTopics.length === 0 ? "No significant gaps detected — the Jack Westin content appears to cover all topics in the provided resources." : null}
          />
        </div>
      )}

      {status === "generating" && (
        <div className="flow-card flow-output-card">
          <LoadingState label="Generating enhanced output (pedagogy + missing topics)…" />
        </div>
      )}

      {finalText !== null && (
        <div className="flow-card flow-output-card">
          <FinalTextBlock content={finalText} />
        </div>
      )}
    </main>
  );
}
