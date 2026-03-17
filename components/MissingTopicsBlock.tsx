"use client";

import { useState } from "react";

type MissingTopicsBlockProps = {
  missingTopics: string[];
  noGapsMessage?: string | null;
};

export function MissingTopicsBlock({ missingTopics, noGapsMessage }: MissingTopicsBlockProps) {
  const [copied, setCopied] = useState(false);

  const displayMessage =
    noGapsMessage ??
    (missingTopics.length === 0
      ? "No significant gaps detected — the Jack Westin content appears to cover all topics in the provided resources."
      : null);
  const copyContent =
    displayMessage ?? missingTopics.map((t, i) => `${i + 1}. ${t}`).join("\n");

  async function handleCopy() {
    await navigator.clipboard.writeText(copyContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="animate-fade-in rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
        <h2 className="text-lg font-semibold text-slate-dark">
          Things Missing from Jack Westin Book
        </h2>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm text-slate-dark">
        {displayMessage ? (
          <p className="text-gray-600">{displayMessage}</p>
        ) : (
          <ul className="list-inside list-decimal space-y-1">
            {missingTopics.map((topic, i) => (
              <li key={i}>{topic}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
