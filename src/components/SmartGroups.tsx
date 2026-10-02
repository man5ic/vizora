"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import type { GroupsResponseDTO, ImageDTO } from "@/types/client";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/labels";
import { ImageGallery } from "@/components/ImageGallery";
import { Loader2 } from "lucide-react";

export function SmartGroups({
  collectionId,
  images,
  onOpenImage,
}: {
  collectionId: string;
  images: ImageDTO[];
  onOpenImage: (id: string) => void;
}) {
  const [data, setData] = useState<GroupsResponseDTO | null>(null);
  const [selected, setSelected] = useState<{ kind: "category" | "scene"; value: string } | null>(null);

  useEffect(() => {
    api.groups(collectionId).then(setData);
  }, [collectionId, images.length]);

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[var(--color-text-faint)]" />
      </div>
    );
  }

  const filtered = selected
    ? images.filter((img) =>
        selected.kind === "category" ? img.category === selected.value : img.sceneTags.includes(selected.value)
      )
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="font-display font-semibold text-sm text-[var(--color-text-muted)] mb-3">By category</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {data.categories.map(({ category, count }) => {
            const Icon = CATEGORY_ICONS[category];
            const isActive = selected?.kind === "category" && selected.value === category;
            return (
              <button
                key={category}
                onClick={() => setSelected(isActive ? null : { kind: "category", value: category })}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition ${
                  isActive
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]"
                }`}
              >
                <div className="w-8 h-8 rounded-md bg-[var(--color-surface-raised)] flex items-center justify-center shrink-0">
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-sm font-medium">{CATEGORY_LABELS[category]}</p>
                  <p className="text-xs text-[var(--color-text-faint)]">{count} image{count === 1 ? "" : "s"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {data.scenes.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-sm text-[var(--color-text-muted)] mb-3">By scene</h3>
          <div className="flex flex-wrap gap-2">
            {data.scenes.map(({ scene, count }) => {
              const isActive = selected?.kind === "scene" && selected.value === scene;
              return (
                <button
                  key={scene}
                  onClick={() => setSelected(isActive ? null : { kind: "scene", value: scene })}
                  className={`text-sm px-3 py-1.5 rounded-full border transition capitalize ${
                    isActive
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-faint)]"
                  }`}
                >
                  {scene} <span className="text-[var(--color-text-faint)]">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {filtered && (
        <div>
          <h3 className="font-display font-semibold text-sm text-[var(--color-text-muted)] mb-3">
            {selected?.value} — {filtered.length} image{filtered.length === 1 ? "" : "s"}
          </h3>
          <ImageGallery images={filtered} onOpen={onOpenImage} />
        </div>
      )}
    </div>
  );
}
