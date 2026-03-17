"use client";

const MAX_CHARS = 200_000;

type InputPanelProps = {
  jackWestinText: string;
  resourceText: string;
  onJackWestinChange: (value: string) => void;
  onResourceChange: (value: string) => void;
  disabled?: boolean;
  errors?: { jackWestin?: string; resource?: string };
};

export function InputPanel({
  jackWestinText,
  resourceText,
  onJackWestinChange,
  onResourceChange,
  disabled = false,
  errors = {},
}: InputPanelProps) {
  return (
    <section className="w-full">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="jack-westin" className="text-sm font-medium text-slate-dark">
            Jack Westin Book Content
          </label>
          <textarea
            id="jack-westin"
            className="min-h-[400px] w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-slate-dark placeholder:text-gray-400 focus:border-amber-cta focus:outline-none focus:ring-1 focus:ring-amber-cta disabled:opacity-60"
            placeholder="Paste Jack Westin chapter text here. You can omit any images."
            value={jackWestinText}
            onChange={(e) => onJackWestinChange(e.target.value.slice(0, MAX_CHARS))}
            disabled={disabled}
            maxLength={MAX_CHARS}
          />
          <div className="flex justify-between text-xs">
            <span className="text-red-600">{errors.jackWestin ?? ""}</span>
            <span className="text-gray-500">{jackWestinText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="resources" className="text-sm font-medium text-slate-dark">
            External Resources
          </label>
          <textarea
            id="resources"
            className="min-h-[400px] w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-slate-dark placeholder:text-gray-400 focus:border-amber-cta focus:outline-none focus:ring-1 focus:ring-amber-cta disabled:opacity-60"
            placeholder="Paste external resource content here (AAMC lists, Khan Academy outlines, etc.)."
            value={resourceText}
            onChange={(e) => onResourceChange(e.target.value.slice(0, MAX_CHARS))}
            disabled={disabled}
            maxLength={MAX_CHARS}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span className="text-red-600">{errors.resource ?? ""}</span>
            <span>{resourceText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
