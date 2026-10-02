"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Sidebar, type ViewKey } from "@/components/Sidebar";
import { UploadZone } from "@/components/UploadZone";
import { ImageGallery } from "@/components/ImageGallery";
import { AskVizora } from "@/components/AskVizora";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ImageDetailModal } from "@/components/ImageDetailModal";
import { SmartGroups } from "@/components/SmartGroups";
import { ExtractedData } from "@/components/ExtractedData";
import { EvidenceMode } from "@/components/EvidenceMode";
import { ReportView } from "@/components/ReportView";
import { PipelineStatus } from "@/components/PipelineStatus";
import { api } from "@/lib/apiClient";
import type { CollectionStatsDTO, ImageDTO, QueryResultDTO } from "@/types/client";

const STORAGE_KEY = "vizora.collectionId";

export function Dashboard() {
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [images, setImages] = useState<ImageDTO[]>([]);
  const [view, setView] = useState<ViewKey>("images");
  const [search, setSearch] = useState("");
  const [openImageId, setOpenImageId] = useState<string | null>(null);

  const [queryResult, setQueryResult] = useState<QueryResultDTO | null>(null);
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [stats, setStats] = useState<CollectionStatsDTO | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hydrate collection id from localStorage on mount.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
    if (stored) setCollectionId(stored);
    setHydrated(true);
  }, []);

  const refreshImages = useCallback(async () => {
    if (!collectionId) return;
    const { images: fresh } = await api.listImages(collectionId);
    setImages(fresh);
  }, [collectionId]);

  const refreshStats = useCallback(async () => {
    if (!collectionId) return;
    const fresh = await api.stats(collectionId).catch(() => null);
    if (fresh) setStats(fresh);
  }, [collectionId]);

  useEffect(() => {
    if (!collectionId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount for the active collection
    refreshImages();
    refreshStats();
  }, [collectionId, refreshImages, refreshStats]);

  // Poll while anything is still uploading/analyzing so statuses (and the
  // live pipeline stats) update without the user refreshing.
  useEffect(() => {
    const hasPending = images.some((i) => i.status === "UPLOADING" || i.status === "PROCESSING");
    if (pollRef.current) clearInterval(pollRef.current);
    if (hasPending && collectionId) {
      pollRef.current = setInterval(() => {
        refreshImages();
        refreshStats();
      }, 2500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [images, collectionId, refreshImages, refreshStats]);

  const handleCollectionCreated = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCollectionId(id);
  };

  const handleUploaded = (newImages: ImageDTO[]) => {
    setImages((prev) => [...newImages, ...prev]);
    refreshStats();
  };

  const handleAsk = async (query: string) => {
    if (!collectionId) return;
    setQueryBusy(true);
    setQueryError(null);
    try {
      const { result } = await api.query(collectionId, query);
      setQueryResult(result);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Query failed.");
    } finally {
      setQueryBusy(false);
    }
  };

  const visibleImages = search
    ? images.filter(
        (i) =>
          i.filename.toLowerCase().includes(search.toLowerCase()) ||
          i.rawText?.toLowerCase().includes(search.toLowerCase()) ||
          i.summary?.toLowerCase().includes(search.toLowerCase())
      )
    : images;

  if (!hydrated) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar active={view} onNavigate={setView} imageCount={images.length} />

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-[var(--color-border)] px-8 py-5 flex items-center justify-between gap-4 sticky top-0 bg-[var(--color-ink)]/95 backdrop-blur z-10">
          <div>
            <h1 className="font-display text-xl font-semibold">
              {view === "images" && "Collection"}
              {view === "groups" && "Smart groups"}
              {view === "extracted" && "Extracted data"}
              {view === "evidence" && "Evidence"}
              {view === "reports" && "Reports"}
            </h1>
            <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
              {images.length > 0
                ? `${images.length} image${images.length === 1 ? "" : "s"} in this collection`
                : "Ask your images anything. Get answers with evidence."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <UploadZone
              collectionId={collectionId}
              onCollectionCreated={handleCollectionCreated}
              onUploaded={handleUploaded}
              compact
            />
          </div>
        </header>

        <div className="flex-1 px-8 py-6">
          {images.length === 0 ? (
            <div className="max-w-xl mx-auto mt-12">
              <div className="text-center mb-8">
                <div className="inline-flex w-12 h-12 rounded-xl bg-[var(--color-accent-soft)] items-center justify-center mb-4">
                  <ImagePlus size={22} className="text-[var(--color-accent)]" />
                </div>
                <h2 className="font-display text-2xl font-semibold">Ask your images anything.</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-md mx-auto">
                  Upload a batch of movie posters, receipts, screenshots, product photos — anything.
                  Cloudinary ingests and delivers every asset; Vizora reads it, turns the whole
                  collection into structured knowledge, and answers questions with proof for every
                  result.
                </p>
              </div>
              <UploadZone
                collectionId={collectionId}
                onCollectionCreated={handleCollectionCreated}
                onUploaded={handleUploaded}
              />
            </div>
          ) : (
            <>
              {view === "images" && (
                <div className="flex flex-col gap-6">
                  <PipelineStatus stats={stats} />
                  <AskVizora onAsk={handleAsk} busy={queryBusy} onTextChange={setSearch} />
                  {queryError && <p className="text-sm text-[var(--color-issue)]">{queryError}</p>}
                  {queryResult && (
                    <ResultsPanel
                      result={queryResult}
                      images={images}
                      onOpenImage={setOpenImageId}
                      onClose={() => setQueryResult(null)}
                      onNavigateToExtracted={() => setView("extracted")}
                    />
                  )}
                  {search && visibleImages.length === 0 && (
                    <p className="text-xs text-[var(--color-text-faint)]">
                      No filename or text match — press Enter to ask Vizora this as a question.
                    </p>
                  )}
                  <ImageGallery images={visibleImages} onOpen={setOpenImageId} />
                </div>
              )}

              {view === "groups" && collectionId && (
                <SmartGroups collectionId={collectionId} images={images} onOpenImage={setOpenImageId} />
              )}

              {view === "extracted" && collectionId && (
                <ExtractedData collectionId={collectionId} images={images} onOpenImage={setOpenImageId} />
              )}

              {view === "evidence" && collectionId && (
                <EvidenceMode collectionId={collectionId} images={images} onOpenImage={setOpenImageId} />
              )}

              {view === "reports" && collectionId && <ReportView collectionId={collectionId} />}
            </>
          )}
        </div>
      </main>

      {openImageId && (
        <ImageDetailModal
          imageId={openImageId}
          onClose={() => setOpenImageId(null)}
          onDeleted={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
          onRetried={refreshImages}
        />
      )}
    </div>
  );
}
