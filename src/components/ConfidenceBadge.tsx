"use client";

/**
 * Shows the model-reported confidence. This is the model's own self-assessed
 * score, not a calibrated probability, so it's labelled accordingly.
 */
export function ConfidenceBadge({
  confidence,
  showLabel = false,
}: {
  confidence?: number | null;
  showLabel?: boolean;
}) {
  if (typeof confidence !== "number") return null;
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 85 ? "var(--color-success)" : pct >= 60 ? "var(--color-evidence)" : "var(--color-issue)";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium"
      style={{ color }}
      title={`AI confidence: ${pct}% (model-reported, not a calibrated probability)`}
    >
      {showLabel && <span className="text-[var(--color-text-faint)] font-normal">AI confidence</span>}
      <span className="relative w-8 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
      {pct}%
    </span>
  );
}
