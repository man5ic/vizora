"use client";

import { Loader2, ImageIcon, Tags, FileText, Shapes, Boxes, GitMerge } from "lucide-react";
import type { CollectionStatsDTO } from "@/types/client";

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof ImageIcon;
  label: string;
  value: number | string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 min-w-[120px]">
      <div className="w-7 h-7 rounded-md bg-[var(--color-accent-soft)] flex items-center justify-center shrink-0">
        <Icon size={13} className="text-[var(--color-accent)]" />
      </div>
      <div>
        <p className="font-display text-base font-semibold leading-tight">{value}</p>
        <p className="text-[10px] text-[var(--color-text-faint)] leading-tight">{label}</p>
        {detail && <p className="text-[10px] text-[var(--color-text-faint)] leading-tight">{detail}</p>}
      </div>
    </div>
  );
}

// Real stages, written to the database by processImage() as each phase begins.
const STAGES: Array<{ key: string; label: string }> = [
  { key: "queued", label: "Queued" },
  { key: "analyzing", label: "Vision + OCR" },
  { key: "extracting", label: "Extracting + merging" },
  { key: "syncing", label: "Syncing to Cloudinary" },
];

export function PipelineStatus({ stats }: { stats: CollectionStatsDTO | null }) {
  if (!stats) return null;
  const hasPending = stats.processingImages > 0;
  const merged = Math.max(0, stats.entityObservations - stats.entityCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        <StatCard icon={ImageIcon} label="Images analyzed" value={stats.analyzedImages} />
        <StatCard
          icon={GitMerge}
          label="Entity resolution"
          value={`${stats.entityObservations} → ${stats.entityCount}`}
          detail={merged > 0 ? `${merged} duplicates merged` : "observations → unique"}
        />
        <StatCard icon={Tags} label="Unique entities" value={stats.entityCount} />
        <StatCard icon={FileText} label="Text elements" value={stats.textElementCount} />
        <StatCard icon={Shapes} label="Categories" value={stats.categoryCount} />
        <StatCard icon={Boxes} label="Objects detected" value={stats.objectsDetected} />
      </div>

      {hasPending && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-2.5 text-xs text-[var(--color-text-muted)] overflow-x-auto">
          <Loader2 size={13} className="animate-spin text-[var(--color-accent)] shrink-0" />
          <span className="text-[var(--color-accent)] font-medium shrink-0">Processing pipeline</span>
          <div className="flex items-center gap-3 shrink-0">
            {STAGES.map((stage) => {
              const n = stats.stageCounts[stage.key] ?? 0;
              return (
                <span
                  key={stage.key}
                  className={`flex items-center gap-1.5 whitespace-nowrap ${n > 0 ? "text-[var(--color-text)]" : "text-[var(--color-text-faint)]"}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${n > 0 ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-faint)]"}`}
                  />
                  {stage.label}
                  <span className="font-medium">{n}</span>
                </span>
              );
            })}
            <span className="whitespace-nowrap text-[var(--color-success)]">Ready {stats.analyzedImages}</span>
          </div>
        </div>
      )}
    </div>
  );
}
