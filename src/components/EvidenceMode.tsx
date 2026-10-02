"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShieldCheck, AlertTriangle, Loader2, Sparkles, ArrowUp } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { EntityGroupDTO, ImageDTO, QueryResultDTO } from "@/types/client";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ResultsPanel } from "@/components/ResultsPanel";

const EVIDENCE_EXAMPLES = [
  "Find potential damage in these photos",
  "Find safety issues",
  "Find defects or wear",
];

export function EvidenceMode({
  collectionId,
  images,
  onOpenImage,
}: {
  collectionId: string;
  images: ImageDTO[];
  onOpenImage: (id: string) => void;
}) {
  const [groups, setGroups] = useState<EntityGroupDTO[] | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResultDTO | null>(null);

  const imageMap = new Map(images.map((i) => [i.id, i]));

  useEffect(() => {
    api.entities(collectionId).then((r) => setGroups(r.groups));
  }, [collectionId, images.length]);

  const issues = groups?.find((g) => g.type.toLowerCase() === "issue")?.entities ?? [];

  const ask = async (query: string) => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { result } = await api.query(collectionId, query);
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <ShieldCheck size={17} className="text-[var(--color-evidence)] mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Every finding here comes straight from stored records: the entity, its source image and the
          evidence text Vizora saved when it analyzed that image. Query results are re-checked against
          those records before they are shown.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-center gap-2 px-2 pb-2 text-[var(--color-text-faint)] text-xs">
          <Sparkles size={13} className="text-[var(--color-evidence)]" />
          Ask for evidence
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(value);
              }
            }}
            rows={1}
            placeholder="Find potential damage, defects, or issues…"
            className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:text-[var(--color-text-faint)] px-2 py-2"
          />
          <button
            onClick={() => ask(value)}
            disabled={busy || !value.trim()}
            className="shrink-0 w-9 h-9 rounded-lg bg-[var(--color-evidence)] text-black flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 px-2 pt-2">
          {EVIDENCE_EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => ask(ex)}
              disabled={busy}
              className="text-[11px] px-2 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-evidence)] hover:text-[var(--color-text)] transition disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-issue)]">{error}</p>}

      {result && (
        <ResultsPanel result={result} images={images} onOpenImage={onOpenImage} onClose={() => setResult(null)} />
      )}

      <div>
        <h3 className="font-display font-semibold text-sm text-[var(--color-text-muted)] mb-3">
          Known issues in this collection
          {issues.length > 0 && <span className="ml-2 text-[var(--color-text-faint)] font-normal">{issues.length}</span>}
        </h3>

        {groups === null ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[var(--color-text-faint)]" />
          </div>
        ) : issues.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">
            No issues found yet. Ask above, or upload inspection-style photos and Vizora will flag
            visible damage automatically during analysis.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {issues.map((issue) => {
              const primarySource = issue.sources[0];
              const img = primarySource ? imageMap.get(primarySource.imageId) : undefined;
              return (
                <button
                  key={issue.id}
                  onClick={() => primarySource && onOpenImage(primarySource.imageId)}
                  className="text-left flex gap-3 rounded-xl border border-[var(--color-issue)]/30 bg-[var(--color-issue-soft)] p-3.5 hover:border-[var(--color-issue)] transition"
                >
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[var(--color-surface-raised)]">
                    {img?.thumbnailUrl && (
                      <Image src={img.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <AlertTriangle size={13} className="text-[var(--color-issue)] shrink-0" />
                      {issue.canonicalValue}
                    </p>
                    {primarySource?.evidence && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-3">
                        <span className="text-[var(--color-text-faint)]">Why: </span>
                        {primarySource.evidence}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <ConfidenceBadge confidence={primarySource?.confidence} showLabel />
                      {issue.sources.length > 1 && (
                        <span className="text-[10px] text-[var(--color-text-faint)]">
                          +{issue.sources.length - 1} more source{issue.sources.length > 2 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
