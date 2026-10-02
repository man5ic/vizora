"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { EntityGroupDTO, ImageDTO } from "@/types/client";
import { formatEntityType } from "@/lib/labels";

export function ExtractedData({
  collectionId,
  images,
  onOpenImage,
}: {
  collectionId: string;
  images: ImageDTO[];
  onOpenImage: (id: string) => void;
}) {
  const [groups, setGroups] = useState<EntityGroupDTO[] | null>(null);
  const imageMap = new Map(images.map((i) => [i.id, i]));

  useEffect(() => {
    api.entities(collectionId).then((r) => setGroups(r.groups));
  }, [collectionId, images.length]);

  if (!groups) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[var(--color-text-faint)]" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-faint)] py-8 text-center">
        No structured entities extracted yet — upload images and ask Vizora a question, or wait for analysis to finish.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <div key={group.type}>
          <h3 className="font-display font-semibold text-sm text-[var(--color-text-muted)] mb-3">
            {formatEntityType(group.type)}s
            <span className="ml-2 text-[var(--color-text-faint)] font-normal">{group.entities.length} unique</span>
          </h3>
          <ul className="flex flex-col divide-y divide-[var(--color-border-soft)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            {group.entities.map((entity) => (
              <li key={entity.id} className="flex flex-wrap items-center gap-2.5 px-4 py-3 bg-[var(--color-surface)]">
                <span className="text-sm font-medium min-w-[160px]">{entity.canonicalValue}</span>
                <div className="flex flex-wrap gap-1.5">
                  {entity.sources.map((s) => {
                    const img = imageMap.get(s.imageId);
                    return (
                      <button
                        key={s.id}
                        onClick={() => onOpenImage(s.imageId)}
                        title={s.evidence}
                        className="text-[11px] px-2 py-1 rounded-full bg-[var(--color-evidence-soft)] text-[var(--color-evidence)] border border-[var(--color-evidence)]/30 hover:border-[var(--color-evidence)] transition truncate max-w-[140px]"
                      >
                        {img?.filename ?? s.imageId}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
