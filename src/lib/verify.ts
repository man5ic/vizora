import { db } from "@/lib/db";
import type { QueryResult, QueryResultItem, QueryResultSource } from "@/types";

/**
 * Grounds a model-produced result in the database. The model only gets to
 * SELECT things (entity ids, image ids, table rows); everything the user sees
 * as proof is rebuilt from, or checked against, stored records:
 *
 *  - entity_list / issue_list: the entity must exist in this collection; its
 *    sources, evidence text and confidence are rebuilt from EntitySource rows
 *    (anything the model wrote for those fields is discarded).
 *  - table: the source image must exist and the row's values (every
 *    non-empty cell) must actually appear in that image's stored text (OCR text, extracted fields, entity
 *    evidence). Rows that can't be found there are dropped.
 *  - image_list: the image must exist and be analyzed. (Whether an image
 *    "matches" the question is still the model's judgement — we verify the
 *    asset, not the reasoning.)
 *  - overview: counts are recomputed from the database; model numbers are ignored.
 */

/**
 * Normalizes text for whole-token comparison: lowercases, drops thousands
 * separators ("80,000" -> "80000"), and turns every other run of punctuation,
 * currency symbols and whitespace into a single space. Cells are then matched
 * as whole-token phrases, so "1" can't be "found" inside "2018" or "10".
 */
const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const containsPhrase = (corpus: string, cell: string) => ` ${corpus} `.includes(` ${cell} `);

const OVERVIEW_LABELS: Record<string, string> = {
  movie: "🎬 Movies",
  product: "🛍 Products",
  company: "🏢 Companies",
  person: "👤 People",
  book: "📚 Books",
  event: "🎟 Events",
  issue: "⚠ Issues",
  PRICE: "💰 Prices",
  DATE: "📅 Dates",
  EMAIL: "📧 Email addresses",
  PHONE: "📞 Phone numbers",
  URL: "🔗 URLs",
  ADDRESS: "📍 Addresses",
};

async function verifyEntityItems(
  collectionId: string,
  items: QueryResultItem[],
  requireType?: string
): Promise<QueryResultItem[]> {
  const ids = [...new Set(items.map((i) => i.id).filter((id): id is string => typeof id === "string"))];
  if (ids.length === 0) return [];

  const entities = await db.entity.findMany({
    where: { id: { in: ids }, collectionId, ...(requireType ? { type: requireType } : {}) },
    select: {
      id: true,
      type: true,
      canonicalValue: true,
      sources: { select: { imageId: true, evidence: true, confidence: true } },
    },
  });
  const byId = new Map(entities.map((e) => [e.id, e]));

  const seen = new Set<string>();
  const out: QueryResultItem[] = [];
  for (const item of items) {
    const entity = item.id ? byId.get(item.id) : undefined;
    if (!entity || entity.sources.length === 0 || seen.has(entity.id)) continue;
    seen.add(entity.id);

    const sources: QueryResultSource[] = entity.sources.map((s) => ({
      imageId: s.imageId,
      evidence: s.evidence,
      confidence: s.confidence ?? undefined,
    }));
    const best = [...sources].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

    out.push({
      id: entity.id,
      label: entity.canonicalValue,
      entityType: entity.type,
      sources,
      imageId: best.imageId,
      evidence: best.evidence,
      confidence: best.confidence,
      verified: true,
    });
  }
  return out;
}

async function verifyTableItems(collectionId: string, items: QueryResultItem[]): Promise<QueryResultItem[]> {
  const imageIds = [...new Set(items.map((i) => i.imageId).filter((id): id is string => Boolean(id)))];
  if (imageIds.length === 0) return [];

  const images = await db.image.findMany({
    where: { id: { in: imageIds }, collectionId, status: "ANALYZED" },
    select: {
      id: true,
      rawText: true,
      extractedContent: { select: { value: true } },
      entitySources: { select: { evidence: true, entity: { select: { canonicalValue: true } } } },
    },
  });

  const corpus = new Map<string, string>();
  for (const img of images) {
    corpus.set(
      img.id,
      tokens(
        [
          img.rawText ?? "",
          ...img.extractedContent.map((c) => c.value),
          ...img.entitySources.flatMap((e) => [e.evidence, e.entity.canonicalValue]),
        ].join(" ")
      )
    );
  }

  // Fail closed: EVERY non-empty cell in a row must appear in that image's stored
  // text. A row with even one ungrounded cell (e.g. a value the model computed or
  // invented) is dropped rather than shown as evidence. The query prompt tells the
  // model to copy cell values verbatim, so legitimate rows pass; rows that reformat
  // or derive a value (say, a date rewritten as ISO) are dropped too — deliberately
  // strict, because a missing row is recoverable and a fabricated one is not.
  return items
    .filter((item) => {
      const text = item.imageId ? corpus.get(item.imageId) : undefined;
      if (text === undefined) return false;
      const cells = (item.cells ?? []).map(tokens).filter((c) => c.length > 0);
      if (cells.length === 0) return false;
      return cells.every((c) => containsPhrase(text, c));
    })
    .map((item) => ({ ...item, verified: true }));
}

async function verifyImageItems(collectionId: string, items: QueryResultItem[]): Promise<QueryResultItem[]> {
  const ids = [...new Set(items.map((i) => i.imageId).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  const valid = new Set(
    (
      await db.image.findMany({
        where: { id: { in: ids }, collectionId, status: "ANALYZED" },
        select: { id: true },
      })
    ).map((i) => i.id)
  );
  const seen = new Set<string>();
  return items
    .filter((i) => {
      if (!i.imageId || !valid.has(i.imageId) || seen.has(i.imageId)) return false;
      seen.add(i.imageId);
      return true;
    })
    .map((i) => ({ ...i, verified: true }));
}

async function buildOverviewItems(collectionId: string): Promise<QueryResultItem[]> {
  const [entityGroups, contentGroups] = await Promise.all([
    db.entity.groupBy({
      by: ["type"],
      where: { collectionId, sources: { some: {} } },
      _count: { _all: true },
    }),
    db.extractedContent.groupBy({
      by: ["type"],
      where: { image: { collectionId } },
      _count: { _all: true },
    }),
  ]);

  const rows: Array<{ key: string; count: number; label: string }> = [];
  for (const g of entityGroups) {
    rows.push({ key: g.type, count: g._count._all, label: OVERVIEW_LABELS[g.type] ?? `${g.type} entities` });
  }
  for (const g of contentGroups) {
    if (!OVERVIEW_LABELS[g.type]) continue; // only surface field types users care about
    rows.push({ key: g.type, count: g._count._all, label: OVERVIEW_LABELS[g.type] });
  }
  return rows
    .sort((a, b) => b.count - a.count)
    .map((r) => ({ label: r.label, cells: [String(r.count)], entityType: r.key, verified: true }));
}

export async function verifyResult(collectionId: string, raw: QueryResult): Promise<QueryResult> {
  const checked = raw.resultType === "overview" ? 0 : raw.items.length;
  let items: QueryResultItem[] = [];

  switch (raw.resultType) {
    case "entity_list":
      items = await verifyEntityItems(collectionId, raw.items);
      break;
    case "issue_list":
      items = await verifyEntityItems(collectionId, raw.items, "issue");
      break;
    case "table":
      items = await verifyTableItems(collectionId, raw.items);
      break;
    case "image_list":
      items = await verifyImageItems(collectionId, raw.items);
      break;
    case "overview":
      items = await buildOverviewItems(collectionId);
      break;
    case "text":
      items = [];
      break;
  }

  const verified = items.length;
  const dropped = Math.max(0, checked - verified);
  return {
    ...raw,
    items,
    // The model's own headline count can't be trusted once rows are dropped.
    summary:
      dropped > 0
        ? `${verified} verified result${verified === 1 ? "" : "s"}; ${dropped} removed because they couldn't be matched to stored evidence.`
        : raw.summary,
    verification: { checked: raw.resultType === "overview" ? verified : checked, verified, dropped },
  };
}
