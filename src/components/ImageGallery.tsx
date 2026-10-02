"use client";

import type { ImageDTO } from "@/types/client";
import { ImageCard } from "@/components/ImageCard";
import { ImageOff } from "lucide-react";

export function ImageGallery({
  images,
  onOpen,
}: {
  images: ImageDTO[];
  onOpen: (id: string) => void;
}) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--color-text-faint)]">
        <ImageOff size={28} className="mb-3" />
        <p className="text-sm">No images match this view yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {images.map((img) => (
        <ImageCard key={img.id} image={img} onOpen={onOpen} />
      ))}
    </div>
  );
}
