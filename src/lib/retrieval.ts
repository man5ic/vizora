import { db } from "@/lib/db";
import { planRetrieval, type CollectionSummaryForQuery } from "@/lib/ai";
import { isCloudinaryConfigured, searchCollectionAssets } from "@/lib/cloudinary";
import type { RetrievalTrace } from "@/types";

const CONTENT_ROW_LIMIT = 2000;

async function loadSummary(
  collectionId: string,
  opts: { imageIds?: string[]; entityTypes?: string[]; contentTypes?: string[] }
): Promise<CollectionSummaryForQuery> {
  const imageFilter = opts.imageIds ? { id: { in: opts.imageIds } } : {};

  const [images, entities, extractedContent] = await Promise.all([
    db.image.findMany({
      where: { collectionId, status: "ANALYZED", ...imageFilter },
      select: { id: true, filename: true, category: true, sceneTags: true, objectTags: true, summary: true },
    }),
    db.entity.findMany({
      where: {
        collectionId,
        sources: { some: opts.imageIds ? { imageId: { in: opts.imageIds } } : {} },
        // Entity-type hints only narrow when provided; otherwise every entity in the candidate images is kept.
        ...(opts.entityTypes && opts.entityTypes.length ? { type: { in: opts.entityTypes } } : {}),
      },
      select: {
        id: true,
        type: true,
        canonicalValue: true,
        metadata: true,
        sources: {
          where: opts.imageIds ? { imageId: { in: opts.imageIds } } : {},
          select: { imageId: true, evidence: true, confidence: true },
        },
      },
    }),
    db.extractedContent.findMany({
      where: {
        image: { collectionId, ...(opts.imageIds ? { id: { in: opts.imageIds } } : {}) },
        ...(opts.contentTypes && opts.contentTypes.length ? { type: { in: opts.contentTypes as never[] } } : {}),
      },
      select: { imageId: true, type: true, value: true, confidence: true },
      take: CONTENT_ROW_LIMIT,
    }),
  ]);

  return { images, entities, extractedContent };
}

/**
 * Retrieval pipeline:
 *   question -> plan (tags / categories / entity types / field types)
 *     -> Cloudinary Search over Vizora-written tags + category metadata
 *     -> UNION structured Postgres lookup (images that have the relevant entity/field types)
 *     -> candidate summary for the reasoning model
 *
 * Falls back to the full collection when the question is broad, nothing
 * matched (e.g. Cloudinary's search index hasn't caught up with fresh tags),
 * or any step fails — so narrowing can improve scale but never silently
 * lose an answer that a full scan would have found.
 */
export async function retrieveContext(
  collectionId: string,
  query: string
): Promise<{ summary: CollectionSummaryForQuery; trace: RetrievalTrace }> {
  const [analyzed, entityTypeRows, tagRows] = await Promise.all([
    db.image.count({ where: { collectionId, status: "ANALYZED" } }),
    db.entity.groupBy({ by: ["type"], where: { collectionId } }),
    db.image.findMany({
      where: { collectionId, status: "ANALYZED" },
      select: { objectTags: true, sceneTags: true, category: true },
    }),
  ]);

  const full = async (note: string) => {
    const summary = await loadSummary(collectionId, {});
    return {
      summary,
      trace: {
        strategy: "full_collection" as const,
        totalImages: analyzed,
        candidateImages: summary.images.length,
        cloudinaryCandidates: 0,
        note,
      },
    };
  };

  if (analyzed === 0) return full("No analyzed images yet.");

  const normalizeTag = (t: string) => t.toLowerCase().trim().replace(/\s+/g, "-");
  const vocabulary = {
    tags: [...new Set(tagRows.flatMap((r) => [...r.objectTags, ...r.sceneTags]).map(normalizeTag))].slice(0, 200),
    entityTypes: entityTypeRows.map((e) => e.type),
    categories: [...new Set(tagRows.map((r) => r.category).filter((c): c is NonNullable<typeof c> => Boolean(c)))],
  };

  const plan = await planRetrieval(query, vocabulary);
  const hasHints =
    plan.assetTags.length + plan.categories.length + plan.entityTypes.length + plan.contentTypes.length > 0;
  if (plan.scope === "broad" || !hasHints) return full("Broad question — searched the whole collection.");

  const candidateIds = new Set<string>();

  // 1) Cloudinary Search over the tags/category metadata Vizora wrote to each asset.
  let cloudinaryCandidates = 0;
  let expression: string | undefined;
  if (isCloudinaryConfigured() && (plan.assetTags.length || plan.categories.length)) {
    try {
      const hits = await searchCollectionAssets(collectionId, {
        tags: plan.assetTags,
        categories: plan.categories,
      });
      if (hits && hits.publicIds.length) {
        expression = hits.expression;
        const matched = await db.image.findMany({
          where: { collectionId, cloudinaryPublicId: { in: hits.publicIds }, status: "ANALYZED" },
          select: { id: true },
        });
        matched.forEach((m) => candidateIds.add(m.id));
        cloudinaryCandidates = matched.length;
      }
    } catch (err) {
      console.warn("[vizora] Cloudinary search failed, continuing with structured retrieval:", err);
    }
  }

  // 2) Structured retrieval: images carrying the entity types / field types the question is about.
  if (plan.entityTypes.length) {
    const rows = await db.entitySource.findMany({
      where: { image: { collectionId }, entity: { type: { in: plan.entityTypes } } },
      select: { imageId: true },
      distinct: ["imageId"],
    });
    rows.forEach((r) => candidateIds.add(r.imageId));
  }
  if (plan.contentTypes.length) {
    const rows = await db.extractedContent.findMany({
      where: { image: { collectionId }, type: { in: plan.contentTypes as never[] } },
      select: { imageId: true },
      distinct: ["imageId"],
    });
    rows.forEach((r) => candidateIds.add(r.imageId));
  }

  // 3) Cloudinary's index lags fresh tags: if nothing matched at all, fall back to the DB's own tags.
  if (candidateIds.size === 0 && plan.assetTags.length) {
    const rows = await db.image.findMany({
      where: {
        collectionId,
        status: "ANALYZED",
        OR: [{ objectTags: { hasSome: plan.assetTags } }, { sceneTags: { hasSome: plan.assetTags } }],
      },
      select: { id: true },
    });
    rows.forEach((r) => candidateIds.add(r.id));
  }

  if (candidateIds.size === 0) return full("No candidates matched the retrieval hints — searched the whole collection.");

  const summary = await loadSummary(collectionId, {
    imageIds: [...candidateIds],
    entityTypes: plan.entityTypes,
    contentTypes: plan.contentTypes,
  });

  return {
    summary,
    trace: {
      strategy: cloudinaryCandidates > 0 ? "cloudinary_search" : "structured_only",
      totalImages: analyzed,
      candidateImages: summary.images.length,
      cloudinaryCandidates,
      cloudinaryExpression: expression,
    },
  };
}

/** Full, unfiltered collection summary (used by reports). */
export function loadCollectionSummary(collectionId: string) {
  return loadSummary(collectionId, {});
}
