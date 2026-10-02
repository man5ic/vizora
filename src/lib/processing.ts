import { db } from "@/lib/db";
import { analyzeImageBuffer, isAiConfigured } from "@/lib/ai";
import { isLikelyDuplicate, normalizeEntityValue } from "@/lib/normalize";
import { syncAssetIntelligence } from "@/lib/cloudinary";
import type { ExtractedContentType, ImageCategory } from "@/types";

/**
 * Finds an existing collection-level Entity that this new observation is
 * "the same real-world thing" as (exact normalized match, or fuzzy match
 * above the similarity threshold), or creates a new one. Either way, records
 * an EntitySource pointing back to the originating image + evidence text —
 * this is the provenance chain the whole product's trust model depends on.
 */
async function mergeEntity(params: {
  collectionId: string;
  imageId: string;
  type: string;
  value: string;
  confidence: number;
  evidence: string;
  metadata?: Record<string, unknown>;
}) {
  const normalizedValue = normalizeEntityValue(params.type, params.value);
  if (!normalizedValue) return;

  const candidates = await db.entity.findMany({
    where: { collectionId: params.collectionId, type: params.type },
    select: { id: true, normalizedValue: true, canonicalValue: true },
  });

  const existing =
    candidates.find((c) => c.normalizedValue === normalizedValue) ??
    candidates.find((c) => isLikelyDuplicate(c.normalizedValue, normalizedValue));

  let entityId: string;
  if (existing) {
    entityId = existing.id;
  } else {
    const created = await db.entity.create({
      data: {
        collectionId: params.collectionId,
        type: params.type,
        canonicalValue: params.value,
        normalizedValue,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });
    entityId = created.id;
  }

  // Avoid a duplicate source row if this exact image already contributed
  // this exact evidence to this entity (e.g. re-analysis / retry).
  const dupeSource = await db.entitySource.findFirst({
    where: { entityId, imageId: params.imageId, evidence: params.evidence },
  });
  if (!dupeSource) {
    await db.entitySource.create({
      data: {
        entityId,
        imageId: params.imageId,
        evidence: params.evidence,
        confidence: params.confidence,
      },
    });
  }
}

// Object/scene tags are already stored as arrays on Image; skip re-storing
// them as ExtractedContent rows to keep that table focused on text fields.
const CONTENT_TYPES_TO_PERSIST = new Set<ExtractedContentType>([
  "TITLE",
  "NAME",
  "PRICE",
  "DATE",
  "PHONE",
  "EMAIL",
  "ADDRESS",
  "COMPANY",
  "URL",
  "ID",
  "LABEL",
]);

/** Drops entities that no longer have any supporting evidence (e.g. after an image is deleted or re-analyzed). */
export async function removeEmptyEntities(collectionId: string) {
  await db.entity.deleteMany({ where: { collectionId, sources: { none: {} } } });
}

const setStage = (imageId: string, stage: string) =>
  db.image.update({ where: { id: imageId }, data: { stage } });

export async function processImage(imageId: string, buffer: Buffer, mimeType: string) {
  await db.image.update({ where: { id: imageId }, data: { status: "PROCESSING", stage: "analyzing", errorMessage: null } });

  if (!isAiConfigured()) {
    await db.image.update({
      where: { id: imageId },
      data: {
        status: "FAILED",
        stage: null,
        errorMessage:
          "AI provider is not configured on the server (missing GEMINI_API_KEY). Image was uploaded but not analyzed.",
      },
    });
    return;
  }

  try {
    const result = await analyzeImageBuffer(buffer, mimeType);
    const image = await db.image.findUniqueOrThrow({ where: { id: imageId } });
    await setStage(imageId, "extracting");

    // Re-analysis (retry) must replace, not append to, whatever this image produced before.
    await db.extractedContent.deleteMany({ where: { imageId } });
    await db.entitySource.deleteMany({ where: { imageId } });

    await db.image.update({
      where: { id: imageId },
      data: {
        category: result.category as ImageCategory,
        sceneTags: result.sceneTags,
        objectTags: result.objectTags,
        rawText: result.rawText || null,
        summary: result.summary || null,
        aiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      },
    });

    if (result.extractedContent.length > 0) {
      await db.extractedContent.createMany({
        data: result.extractedContent
          .filter((c) => CONTENT_TYPES_TO_PERSIST.has(c.type))
          .map((c) => ({
            imageId,
            type: c.type,
            value: c.value,
            normalizedValue: normalizeEntityValue(c.type.toLowerCase(), c.value),
            confidence: c.confidence,
          })),
      });
    }

    for (const entity of result.entities) {
      await mergeEntity({
        collectionId: image.collectionId,
        imageId,
        type: entity.type,
        value: entity.value,
        confidence: entity.confidence,
        evidence: entity.evidence ?? entity.value,
        metadata: entity.metadata,
      });
    }

    await removeEmptyEntities(image.collectionId);

    // Push Vizora's findings back into Cloudinary as real tags + contextual
    // metadata; Ask Vizora later retrieves assets through Cloudinary Search
    // using exactly these tags and this collection key.
    await setStage(imageId, "syncing");
    try {
      await syncAssetIntelligence(image.cloudinaryPublicId, {
        tags: [result.category, ...result.objectTags, ...result.sceneTags],
        context: {
          vizora_collection: image.collectionId,
          vizora_category: result.category,
          vizora_summary: (result.summary || "").slice(0, 255),
          vizora_entity_count: String(result.entities.length),
        },
      });
    } catch (syncErr) {
      console.warn(`[vizora] Cloudinary intelligence sync failed for ${imageId} (non-fatal):`, syncErr);
    }

    await db.image.update({
      where: { id: imageId },
      data: { status: "ANALYZED", stage: "ready", analyzedAt: new Date() },
    });
  } catch (err) {
    console.error(`[vizora] analysis failed for image ${imageId}:`, err);
    await db.image.update({
      where: { id: imageId },
      data: {
        status: "FAILED",
        stage: null,
        errorMessage: err instanceof Error ? err.message : "Unknown analysis error",
      },
    });
  }
}
