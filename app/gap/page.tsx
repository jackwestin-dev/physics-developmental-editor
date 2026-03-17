"use client";

import { useState, useCallback } from "react";
import { InputPanel } from "@/components/InputPanel";
import { OutputPanel } from "@/components/OutputPanel";
import type { AgentState } from "@/lib/types";

const initialState: AgentState = {
  jackWestinText: "",
  resourceText: "",
  missingTopics: null,
  finalText: null,
  status: "idle",
  error: null,
};

export default function GapPage() {
  const [state, setState] = useState<AgentState>(initialState);
  const [validationErrors, setValidationErrors] = useState<{ jackWestin?: string; resource?: string }>({});

  const runAnalysis = useCallback(async () => {
    const jackWestinText = state.jackWestinText.trim();
    const resourceText = state.resourceText.trim();

    if (!jackWestinText) {
      setValidationErrors((e) => ({ ...e, jackWestin: "Jack Westin content is required." }));
      return;
    }
    if (!resourceText) {
      setValidationErrors((e) => ({ ...e, resource: "External resources are required." }));
      return;
    }
    setValidationErrors({});
    setState((s) => ({
      ...s,
      missingTopics: null,
      finalText: null,
      status: "analyzing",
      error: null,
    }));

    try {
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jackWestinText, resourceText }),
      });
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        setState((s) => ({
          ...s,
          status: "error",
          error: analyzeData.error ?? analyzeData.detail ?? "Gap analysis failed.",
        }));
        return;
      }

      const missingTopics: string[] = Array.isArray(analyzeData.missingTopics) ? analyzeData.missingTopics : [];
      setState((s) => ({
        ...s,
        missingTopics,
        status: "generating",
      }));

      const genRes = await fetch("/api/enhanced-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jackWestinText,
          resourceText,
          missingTopics,
        }),
      });

      if (!genRes.ok) {
        const errData = await genRes.json().catch(() => ({}));
        setState((s) => ({
          ...s,
          status: "error",
          error: errData.error ?? "Enhanced generation failed.",
        }));
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
          setState((s) => ({ ...s, finalText: fullText }));
        }
      }
      setState((s) => ({
        ...s,
        finalText: fullText,
        status: "done",
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Request failed.",
      }));
    }
  }, [state.jackWestinText, state.resourceText]);

  const handleJackWestinChange = useCallback((value: string) => {
    setState((s) => ({ ...s, jackWestinText: value }));
    if (validationErrors.jackWestin) setValidationErrors((e) => ({ ...e, jackWestin: undefined }));
  }, [validationErrors.jackWestin]);

  const handleResourceChange = useCallback((value: string) => {
    setState((s) => ({ ...s, resourceText: value }));
    if (validationErrors.resource) setValidationErrors((e) => ({ ...e, resource: undefined }));
  }, [validationErrors.resource]);

  const handleReset = useCallback(() => {
    setState((s) => ({
      ...s,
      missingTopics: null,
      finalText: null,
      status: "idle",
      error: null,
    }));
  }, []);

  const canSubmit =
    state.jackWestinText.trim().length > 0 &&
    state.resourceText.trim().length > 0 &&
    state.status !== "analyzing" &&
    state.status !== "generating";

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">Gap Analysis & Enhanced Pedagogy</h1>
        <p className="mb-8 text-gray-600">
          Paste Jack Westin book content and external resources. The agent identifies missing topics and produces a single enhanced document with gaps integrated.
        </p>

        <section className="mb-8">
          <InputPanel
            jackWestinText={state.jackWestinText}
            resourceText={state.resourceText}
            onJackWestinChange={handleJackWestinChange}
            onResourceChange={handleResourceChange}
            disabled={state.status === "analyzing" || state.status === "generating"}
            errors={validationErrors}
          />
          <div className="mt-4">
            <button
              type="button"
              onClick={canSubmit ? runAnalysis : undefined}
              disabled={!canSubmit}
              className="w-full rounded-lg bg-amber-500 py-3 font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Analyze & Generate
            </button>
            {(state.status === "done" || state.status === "error") && (
              <button
                type="button"
                onClick={handleReset}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-slate-dark hover:bg-gray-50"
              >
                Reset and run again
              </button>
            )}
          </div>
        </section>

        {(state.status !== "idle" || state.error) && (
          <section className="mb-8">
            {state.error && (
              <div
                className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                role="alert"
              >
                <p>{state.error}</p>
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, error: null }))}
                  className="shrink-0 text-sm underline"
                >
                  Dismiss
                </button>
              </div>
            )}
            <OutputPanel state={state} />
          </section>
        )}
      </div>
    </div>
  );
}
