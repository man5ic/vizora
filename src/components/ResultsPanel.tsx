"use client";

import Image from "next/image";
import { X, ImageIcon, ShieldCheck, Search } from "lucide-react";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import type { ImageDTO, QueryResultDTO } from "@/types/client";

function SourceChip({
  imageId,
  evidence,
  confidence,
  images,
  onOpen,
}: {
  imageId: string;
  evidence?: string;
  confidence?: number | null;
  images: Map<string, ImageDTO>;
  onOpen: (id: string) => void;
}) {
  const img = images.get(imageId);
  return (
    <button
      onClick={() => onOpen(imageId)}
      title={evidence ? `${evidence} — matched to stored evidence` : "Matched to stored evidence"}
      className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-[var(--color-evidence-soft)] border border-[var(--color-evidence)]/40 hover:border-[var(--color-evidence)] transition text-[11px] text-[var(--color-evidence)]"
    >
      {img?.thumbnailUrl ? (
        <span className="relative w-4 h-4 rounded-full overflow-hidden shrink-0">
          <Image src={img.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
        </span>
      ) : (
        <ImageIcon size={12} />
      )}
      <span className="truncate max-w-[110px]">{img?.filename ?? imageId}</span>
      {typeof confidence === "number" && <span className="opacity-70">{Math.round(confidence * 100)}%</span>}
      <ShieldCheck size={11} className="opacity-70 shrink-0" />
    </button>
  );
}

export function ResultsPanel({
  result,
  images,
  onOpenImage,
  onClose,
  onNavigateToExtracted,
}: {
  result: QueryResultDTO;
  images: ImageDTO[];
  onOpenImage: (id: string) => void;
  onClose: () => void;
  onNavigateToExtracted?: () => void;
}) {
  const imageMap = new Map(images.map((i) => [i.id, i]));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
        <div>
          <h3 className="font-display font-semibold text-base">{result.title}</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{result.summary}</p>
          {(result.verification || result.retrieval) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[var(--color-text-faint)]">
              {result.verification && result.resultType !== "text" && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-[var(--color-success)]" />
                  {result.verification.verified} of {result.verification.checked} results verified against the database
                  {result.verification.dropped > 0 && ` · ${result.verification.dropped} removed`}
                </span>
              )}
              {result.retrieval && (
                <span className="flex items-center gap-1.5" title={result.retrieval.cloudinaryExpression ?? result.retrieval.note}>
                  <Search size={12} className="text-[var(--color-accent)]" />
                  {result.retrieval.strategy === "cloudinary_search" &&
                    `Cloudinary Search + structured lookup: ${result.retrieval.candidateImages} of ${result.retrieval.totalImages} images considered`}
                  {result.retrieval.strategy === "structured_only" &&
                    `Structured lookup: ${result.retrieval.candidateImages} of ${result.retrieval.totalImages} images considered`}
                  {result.retrieval.strategy === "full_collection" &&
                    `Full collection searched (${result.retrieval.totalImages} images)`}
                </span>
              )}
            </div>
          )}
          {result.explanation && (
            <p className="text-xs text-[var(--color-text-faint)] mt-1.5 flex items-start gap-1.5 max-w-xl">
              <ShieldCheck size={13} className="text-[var(--color-evidence)] mt-0.5 shrink-0" />
              {result.explanation}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
          <X size={16} />
        </button>
      </div>

      <div className="p-5 max-h-[420px] overflow-y-auto">
        {result.resultType === "text" && (
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{result.answer}</p>
        )}

        {result.resultType === "overview" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {result.items.map((item, i) => (
              <button
                key={i}
                onClick={() => onNavigateToExtracted?.()}
                className="text-left rounded-lg border border-[var(--color-border)] px-3.5 py-3 hover:border-[var(--color-accent)] transition"
              >
                <p className="font-display text-xl font-semibold">{item.cells?.[0] ?? ""}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{item.label}</p>
              </button>
            ))}
          </div>
        )}

        {result.resultType === "entity_list" && (
          <ul className="flex flex-col divide-y divide-[var(--color-border-soft)]">
            {result.items.map((item, i) => (
              <li key={item.id ?? i} className="py-3 flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-medium min-w-[160px]">{item.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {item.sources?.map((s, si) => (
                    <SourceChip key={si} {...s} images={imageMap} onOpen={onOpenImage} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {result.resultType === "table" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--color-text-faint)] text-xs uppercase tracking-wide">
                  {(result.columns ?? []).map((c) => (
                    <th key={c} className="pb-2 pr-4 font-medium">
                      {c}
                    </th>
                  ))}
                  <th className="pb-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-soft)]">
                {result.items.map((item, i) => (
                  <tr key={i}>
                    {(item.cells ?? []).map((cell, ci) => (
                      <td key={ci} className="py-2 pr-4">
                        {cell}
                      </td>
                    ))}
                    <td className="py-2">
                      {item.imageId && (
                        <SourceChip
                          imageId={item.imageId}
                          confidence={item.confidence}
                          images={imageMap}
                          onOpen={onOpenImage}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result.resultType === "image_list" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {result.items.map((item, i) => {
              const img = item.imageId ? imageMap.get(item.imageId) : undefined;
              return (
                <button
                  key={i}
                  onClick={() => item.imageId && onOpenImage(item.imageId)}
                  className="text-left"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                    {img?.thumbnailUrl && (
                      <Image src={img.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1 line-clamp-2">{item.label}</p>
                </button>
              );
            })}
          </div>
        )}

        {result.resultType === "issue_list" && (
          <ul className="flex flex-col gap-2.5">
            {result.items.map((item, i) => (
              <li
                key={item.id ?? i}
                className="rounded-lg border border-[var(--color-issue)]/30 bg-[var(--color-issue-soft)] px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--color-text)]">{item.label}</p>
                  <ConfidenceBadge confidence={item.confidence} showLabel />
                </div>
                {item.evidence && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                    <span className="text-[var(--color-text-faint)]">Why: </span>
                    {item.evidence}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(item.sources ?? (item.imageId ? [{ imageId: item.imageId, evidence: item.evidence ?? "" }] : [])).map(
                    (s, si) => (
                      <SourceChip key={si} imageId={s.imageId} evidence={s.evidence} images={imageMap} onOpen={onOpenImage} />
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {result.items.length === 0 && result.resultType !== "text" && result.resultType !== "overview" && (
          <p className="text-sm text-[var(--color-text-faint)]">No matching results found.</p>
        )}
      </div>
    </div>
  );
}
