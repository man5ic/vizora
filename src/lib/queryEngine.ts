import { db } from "@/lib/db";
import { runCollectionQuery } from "@/lib/ai";
import { loadCollectionSummary, retrieveContext } from "@/lib/retrieval";
import { verifyResult } from "@/lib/verify";
import type { QueryResult } from "@/types";

/**
 * Ask Vizora, end to end:
 *   plan -> retrieve candidates (Cloudinary Search + structured Postgres)
 *        -> reason over candidates (LLM selects)
 *        -> verify against the database (sources/evidence rebuilt or checked)
 *        -> persist + return
 */
export async function runQueryForCollection(collectionId: string, query: string): Promise<QueryResult> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error("Query cannot be empty.");

  const { summary, trace } = await retrieveContext(collectionId, trimmed);

  if (summary.images.length === 0) {
    const empty: QueryResult = {
      resultType: "text",
      title: "No analyzed images yet",
      summary: "Nothing to search yet.",
      answer:
        "Your collection doesn't have any fully analyzed images yet. Upload some images and wait for them to finish processing, then ask again.",
      items: [],
      retrieval: trace,
    };
    await db.query.create({
      data: { collectionId, query: trimmed, resultType: empty.resultType, resultJson: JSON.parse(JSON.stringify(empty)) },
    });
    return empty;
  }

  const raw = await runCollectionQuery(summary, trimmed);
  const result: QueryResult = { ...(await verifyResult(collectionId, raw)), retrieval: trace };

  await db.query.create({
    data: {
      collectionId,
      query: trimmed,
      resultType: result.resultType,
      resultJson: JSON.parse(JSON.stringify(result)),
    },
  });
  return result;
}

export async function getCollectionStats(collectionId: string) {
  const [byStatus, byStage, entityCount, entityObservations, textElementCount, categoryGroups, objectImages] =
    await Promise.all([
      db.image.groupBy({ by: ["status"], where: { collectionId }, _count: { _all: true } }),
      db.image.groupBy({
        by: ["stage"],
        where: { collectionId, status: { in: ["PROCESSING", "UPLOADING"] } },
        _count: { _all: true },
      }),
      db.entity.count({ where: { collectionId, sources: { some: {} } } }),
      db.entitySource.count({ where: { image: { collectionId } } }),
      db.extractedContent.count({ where: { image: { collectionId } } }),
      db.image.groupBy({
        by: ["category"],
        where: { collectionId, status: "ANALYZED", category: { not: null } },
        _count: { _all: true },
      }),
      db.image.findMany({ where: { collectionId }, select: { objectTags: true } }),
    ]);

  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const stageCounts: Record<string, number> = {};
  for (const g of byStage) stageCounts[g.stage ?? "queued"] = g._count._all;

  return {
    totalImages: byStatus.reduce((sum, b) => sum + b._count._all, 0),
    analyzedImages: statusCount("ANALYZED"),
    processingImages: statusCount("PROCESSING") + statusCount("UPLOADING"),
    failedImages: statusCount("FAILED"),
    entityCount,
    entityObservations,
    stageCounts,
    textElementCount,
    categoryCount: categoryGroups.length,
    objectsDetected: new Set(objectImages.flatMap((i) => i.objectTags)).size,
  };
}

export async function buildReportData(collectionId: string) {
  const [summary, stats] = await Promise.all([loadCollectionSummary(collectionId), getCollectionStats(collectionId)]);

  const categoryCounts: Record<string, number> = {};
  for (const img of summary.images) {
    const key = img.category ?? "OTHER";
    categoryCounts[key] = (categoryCounts[key] ?? 0) + 1;
  }
  const entityTypeCounts: Record<string, number> = {};
  for (const e of summary.entities) entityTypeCounts[e.type] = (entityTypeCounts[e.type] ?? 0) + 1;

  return {
    totalImages: stats.totalImages,
    byStatus: await db.image.groupBy({ by: ["status"], where: { collectionId }, _count: { _all: true } }),
    categoryCounts,
    entityTypeCounts,
    textEntitiesCount: stats.textElementCount,
    objectsDetected: stats.objectsDetected,
    issues: summary.entities.filter((e) => e.type === "issue"),
    summary,
  };
}
