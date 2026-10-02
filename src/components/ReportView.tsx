"use client";

import { useEffect, useState } from "react";
import { Loader2, FileBarChart2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { ReportDTO } from "@/types/client";
import { CATEGORY_LABELS, formatEntityType } from "@/lib/labels";

export function ReportView({ collectionId }: { collectionId: string }) {
  const [reports, setReports] = useState<ReportDTO[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listReports(collectionId).then((r) => setReports(r.reports));
  }, [collectionId]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { report } = await api.generateReport(collectionId);
      setReports((prev) => [report, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={generate}
        disabled={generating}
        className="self-start flex items-center gap-2 px-4 py-2.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-60"
      >
        {generating ? <Loader2 size={15} className="animate-spin" /> : <FileBarChart2 size={15} />}
        Generate visual intelligence report
      </button>
      {error && <p className="text-sm text-[var(--color-issue)]">{error}</p>}

      {reports === null ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[var(--color-text-faint)]" />
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-[var(--color-text-faint)]">No reports yet. Generate one above.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {reports.map((report) => {
            const s = report.summaryJson;
            return (
              <div key={report.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <p className="text-xs text-[var(--color-text-faint)]">
                  {new Date(report.createdAt).toLocaleString()}
                </p>
                <h3 className="font-display font-semibold text-lg mt-1">{s.narrative?.headline || report.title}</h3>
                {s.narrative?.narrative && (
                  <p className="text-sm text-[var(--color-text-muted)] mt-2 leading-relaxed">{s.narrative.narrative}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <Stat label="Images analyzed" value={s.totalImages} />
                  <Stat label="Text entities" value={s.textEntitiesCount} />
                  <Stat label="Objects detected" value={s.objectsDetected} />
                  <Stat label="Potential issues" value={s.issues.length} accent={s.issues.length > 0} />
                </div>

                {Object.keys(s.categoryCounts).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-[var(--color-text-faint)] mb-1.5">Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(s.categoryCounts).map(([cat, count]) => (
                        <span key={cat} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">
                          {CATEGORY_LABELS[cat] ?? cat} · {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {s.narrative?.highlights?.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-1.5">
                    {s.narrative.highlights.map((h, i) => (
                      <li key={i} className="text-sm text-[var(--color-text-muted)] flex gap-2">
                        <span className="text-[var(--color-accent)]">•</span> {h}
                      </li>
                    ))}
                  </ul>
                )}

                {s.issues.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-[var(--color-text-faint)] mb-1.5 flex items-center gap-1">
                      <AlertTriangle size={11} className="text-[var(--color-issue)]" /> Potential issues
                    </p>
                    <ul className="flex flex-col gap-1">
                      {s.issues.map((issue) => (
                        <li key={issue.id} className="text-sm text-[var(--color-text)]">
                          {issue.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Object.keys(s.entityTypeCounts).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-[var(--color-text-faint)] mb-1.5">Entities by type</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(s.entityTypeCounts).map(([type, count]) => (
                        <span key={type} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">
                          {formatEntityType(type)} · {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] px-3 py-2.5">
      <p className={`font-display text-xl font-semibold ${accent ? "text-[var(--color-issue)]" : ""}`}>{value}</p>
      <p className="text-[11px] text-[var(--color-text-faint)] mt-0.5">{label}</p>
    </div>
  );
}
