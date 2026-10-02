"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, RefreshCcw, Trash2, Loader2, Cloud, Check } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { ImageDetailDTO } from "@/types/client";
import { CATEGORY_LABELS, STATUS_LABELS, formatEntityType } from "@/lib/labels";

export function ImageDetailModal({
  imageId,
  onClose,
  onDeleted,
  onRetried,
}: {
  imageId: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onRetried: () => void;
}) {
  const [detail, setDetail] = useState<ImageDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount for the opened image
    setLoading(true);
    api
      .getImage(imageId)
      .then((r) => !cancelled && setDetail(r.image))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)]">
          <p className="text-sm font-medium truncate pr-4">{detail?.filename ?? "Loading…"}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {detail?.status === "FAILED" && (
              <button
                onClick={async () => {
                  setRetrying(true);
                  await api.retryAnalysis(imageId).catch(() => null);
                  setRetrying(false);
                  onRetried();
                  api.getImage(imageId).then((r) => setDetail(r.image));
                }}
                disabled={retrying}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)]"
              >
                {retrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                Retry analysis
              </button>
            )}
            <button
              onClick={async () => {
                await api.deleteImage(imageId).catch(() => null);
                onDeleted(imageId);
                onClose();
              }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-[var(--color-border)] hover:border-[var(--color-issue)] hover:text-[var(--color-issue)]"
            >
              <Trash2 size={12} />
              Remove
            </button>
            <button onClick={onClose} className="p-1.5 text-[var(--color-text-faint)] hover:text-[var(--color-text)]">
              <X size={16} />
            </button>
          </div>
        </div>

        {loading || !detail ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin text-[var(--color-text-faint)]" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid md:grid-cols-2 gap-0">
            <div className="relative bg-black min-h-[260px] md:min-h-[420px]">
              <Image
                src={detail.evidenceUrl || detail.secureUrl}
                alt={detail.filename}
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            <div className="p-5 flex flex-col gap-4 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs border border-[var(--color-border)] text-[var(--color-text-muted)]">
                  {STATUS_LABELS[detail.status]}
                </span>
                {detail.category && (
                  <span className="px-2 py-0.5 rounded-full text-xs border border-[var(--color-border)] text-[var(--color-text-muted)]">
                    {CATEGORY_LABELS[detail.category]}
                  </span>
                )}
              </div>

              {detail.status === "FAILED" && detail.errorMessage && (
                <p className="text-xs text-[var(--color-issue)] bg-[var(--color-issue-soft)] rounded-md px-3 py-2">
                  {detail.errorMessage}
                </p>
              )}

              {detail.summary && <p className="text-[var(--color-text-muted)]">{detail.summary}</p>}

              <div>
                <p className="text-xs text-[var(--color-text-faint)] mb-1.5 flex items-center gap-1.5">
                  <Cloud size={12} /> Cloudinary media pipeline
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <PipelineCheck label="Uploaded" done />
                  <PipelineCheck label="AI analyzed" done={detail.status === "ANALYZED"} />
                  <PipelineCheck label="Tagged & indexed" done={detail.status === "ANALYZED"} />
                  <PipelineCheck label="Optimized delivery" done />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 text-[11px] text-[var(--color-text-faint)]">
                  {detail.format && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">
                      {detail.format.toUpperCase()}
                    </span>
                  )}
                  {detail.width && detail.height && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">
                      {detail.width} × {detail.height}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">quality: auto</span>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">format: auto</span>
                </div>
              </div>

              {detail.objectTags.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-faint)] mb-1.5">Objects detected</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.objectTags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.sceneTags.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-faint)] mb-1.5">Scene</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.sceneTags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.entitySources.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-faint)] mb-1.5">Entities found here</p>
                  <div className="flex flex-col gap-1.5">
                    {detail.entitySources.map((es) => (
                      <div key={es.id} className="flex items-center justify-between text-xs bg-[var(--color-surface-raised)] rounded-md px-2.5 py-1.5">
                        <span>
                          <span className="text-[var(--color-text-faint)]">{formatEntityType(es.entity.type)}: </span>
                          {es.entity.canonicalValue}
                        </span>
                        {typeof es.confidence === "number" && (
                          <span className="text-[var(--color-evidence)]">{Math.round(es.confidence * 100)}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.extractedContent.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--color-text-faint)] mb-1.5">Extracted text fields</p>
                  <div className="flex flex-col gap-1.5">
                    {detail.extractedContent.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs bg-[var(--color-surface-raised)] rounded-md px-2.5 py-1.5">
                        <span>
                          <span className="text-[var(--color-text-faint)]">{formatEntityType(c.type.toLowerCase())}: </span>
                          {c.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.rawText && (
                <div>
                  <p className="text-xs text-[var(--color-text-faint)] mb-1.5">All detected text</p>
                  <pre className="text-xs whitespace-pre-wrap text-[var(--color-text-muted)] bg-[var(--color-surface-raised)] rounded-md px-3 py-2 max-h-40 overflow-y-auto">
                    {detail.rawText}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md ${
        done
          ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
          : "bg-[var(--color-surface-raised)] text-[var(--color-text-faint)]"
      }`}
    >
      {done ? <Check size={11} /> : <Loader2 size={11} className="animate-spin" />}
      {label}
    </div>
  );
}
