"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

type GapSummaryBlockProps = {
  content: string;
  title?: string;
};

export function GapSummaryBlock({ content, title = "Gap Summary" }: GapSummaryBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="animate-fade-in rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <h2 className="text-lg font-semibold text-slate-dark">{title}</h2>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="prose prose-sm mt-4 max-w-none text-slate-dark prose-headings:text-slate-dark prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0 prose-table:text-sm">
        <ReactMarkdown>{content || "(No gap summary.)"}</ReactMarkdown>
      </div>
    </div>
  );
}
