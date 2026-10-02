"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { ImageDTO } from "@/types/client";

export function UploadZone({
  collectionId,
  onCollectionCreated,
  onUploaded,
  compact = false,
}: {
  collectionId: string | null;
  onCollectionCreated: (id: string) => void;
  onUploaded: (images: ImageDTO[]) => void;
  compact?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        const files = Array.from(fileList);
        const { collectionId: newId, results } = await api.upload(collectionId, files);
        if (!collectionId) onCollectionCreated(newId);

        const okImages = results.map((r) => r.image).filter((i): i is ImageDTO => Boolean(i));
        const failures = results.filter((r) => r.error);
        if (okImages.length) onUploaded(okImages);
        if (failures.length) {
          setError(
            `${failures.length} file${failures.length > 1 ? "s" : ""} couldn't be uploaded: ${failures
              .map((f) => f.filename)
              .join(", ")}`
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [collectionId, onCollectionCreated, onUploaded]
  );

  if (compact) {
    return (
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:brightness-110 transition disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {busy ? "Uploading…" : "Upload images"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {error && <p className="text-xs text-[var(--color-issue)] mt-2 max-w-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-8 py-16 flex flex-col items-center text-center gap-3 transition-colors ${
          dragOver
            ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
            : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]"
        }`}
      >
        {busy ? (
          <Loader2 size={28} className="animate-spin text-[var(--color-accent)]" />
        ) : (
          <UploadCloud size={28} className="text-[var(--color-text-muted)]" />
        )}
        <div>
          <p className="text-sm font-medium">
            {busy ? "Uploading your images…" : "Drop images here, or click to browse"}
          </p>
          <p className="text-xs text-[var(--color-text-faint)] mt-1">
            Posters, screenshots, receipts, scans, photos — any mix, any batch size
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {error && <p className="text-sm text-[var(--color-issue)] mt-3">{error}</p>}
    </div>
  );
}
