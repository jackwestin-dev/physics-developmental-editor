"use client";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-slate-dark">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"
        aria-hidden
      />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
