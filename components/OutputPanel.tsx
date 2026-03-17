"use client";

import { MissingTopicsBlock } from "./MissingTopicsBlock";
import { FinalTextBlock } from "./FinalTextBlock";
import { LoadingState } from "./LoadingState";
import type { AgentState } from "@/lib/types";

type OutputPanelProps = {
  state: AgentState;
};

export function OutputPanel({ state }: OutputPanelProps) {
  const { status, missingTopics, finalText, error } = state;

  if (status === "analyzing") {
    return (
      <LoadingState label="Identifying gaps in Jack Westin coverage…" />
    );
  }

  if (status === "generating" && missingTopics !== null) {
    return (
      <div className="space-y-6">
        <MissingTopicsBlock
          missingTopics={missingTopics}
          noGapsMessage={missingTopics.length === 0 ? "No significant gaps detected — the Jack Westin content appears to cover all topics in the provided resources." : null}
        />
        <LoadingState label="Generating enhanced output…" />
      </div>
    );
  }

  if (status === "done" && missingTopics !== null) {
    return (
      <div className="space-y-6">
        <MissingTopicsBlock
          missingTopics={missingTopics}
          noGapsMessage={missingTopics.length === 0 ? "No significant gaps detected — the Jack Westin content appears to cover all topics in the provided resources." : null}
        />
        <FinalTextBlock content={finalText ?? ""} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="font-medium">Error</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  return null;
}
