"use client";

import Image from "next/image";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import type { ImageDTO } from "@/types/client";
import { CATEGORY_ICONS, CATEGORY_LABELS, STATUS_LABELS } from "@/lib/labels";

export function ImageCard({ image, onOpen }: { image: ImageDTO; onOpen: (id: string) => void }) {
  const Icon = image.category ? CATEGORY_ICONS[image.category] : null;

  return (
    <button
      onClick={() => onOpen(image.id)}
      className="group relative aspect-square rounded-lg overflow-hidden bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-left"
    >
      {image.thumbnailUrl ? (
        <Image
          src={image.thumbnailUrl}
          alt={image.filename}
          fill
          sizes="220px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-faint)] text-xs">
          {image.filename}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      {(image.status === "PROCESSING" || image.status === "UPLOADING") && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] processing-pulse">
            <Loader2 size={11} className="animate-spin" />
            {STATUS_LABELS[image.status]}
          </div>
        </div>
      )}

      {image.status === "FAILED" && (
        <div className="absolute inset-0 bg-[var(--color-issue-soft)] flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-issue)] text-white text-[11px]">
            <AlertTriangle size={11} />
            Failed
          </div>
        </div>
      )}

      {image.status === "ANALYZED" && image.category && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-[10px] text-white">
          {Icon && <Icon size={10} />}
          {CATEGORY_LABELS[image.category]}
        </div>
      )}

      {image.status === "ANALYZED" && !image.category && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 text-[10px] text-white">
          <Clock size={10} />
          queued
        </div>
      )}
    </button>
  );
}
