import Anthropic from "@anthropic-ai/sdk";
import type {
  ExtractedContentType,
  ImageAnalysisResult,
  ImageCategory,
  QueryResult,
} from "@/types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export class AiConfigError extends Error {
  constructor() {
    super("AI provider is not configured. Set ANTHROPIC_API_KEY.");
    this.name = "AiConfigError";
  }
}

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!isAiConfigured()) throw new AiConfigError();
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Strips markdown code fences / stray prose so we can JSON.parse reliably. */
function parseJsonLoose<T>(text: string): T {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");
  const firstBrace = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned) as T;
}

const VALID_CATEGORIES: ImageCategory[] = [
  "MOVIE_POSTER",
  "BOOK",
  "PRODUCT",
  "RECEIPT",
  "DOCUMENT",
  "SCREENSHOT",
  "EVENT_FLYER",
  "BUSINESS_CARD",
  "PHOTO",
  "OTHER",
];

const VALID_CONTENT_TYPES: ExtractedContentType[] = [
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
  "RAW_TEXT",
  "OBJECT",
  "SCENE",
  "ISSUE",
];

const ANALYSIS_SYSTEM_PROMPT = `You are the visual-understanding engine inside Vizora, a product that turns \
collections of images into structured, queryable knowledge. You will be shown ONE image. \
Analyze it thoroughly and return ONLY a single JSON object (no markdown fences, no prose \
before or after) with this exact shape:

{
  "category": one of ${JSON.stringify(VALID_CATEGORIES)},
  "sceneTags": string[] (e.g. "kitchen", "office", "street" — omit if not a real-world scene),
  "objectTags": string[] (concrete physical objects visible, e.g. "laptop", "car", "chair"),
  "summary": string (one sentence describing the image),
  "rawText": string (ALL legible text in the image, transcribed as faithfully as possible, \
newline separated; empty string if none),
  "extractedContent": [
    { "type": one of ${JSON.stringify(VALID_CONTENT_TYPES)}, "value": string, "confidence": number 0-1 }
  ],
  "entities": [
    { "type": string (lowercase, e.g. "movie", "product", "company", "person", "book", \
"event", "issue"), "value": string (the entity's name/title as it appears), "confidence": number 0-1, \
"evidence": string (for text entities: the exact text as it appears in the image; for issues: ONE \
sentence describing what is visibly wrong and where), \
"metadata": object (optional extra structured fields relevant to this entity type, e.g. \
{"year": 2014, "director": "Christopher Nolan"} for a movie, or {"price": "60", "currency": "INR"} \
for a receipt line item) }
  ]
}

Rules:
- Only include an entity if it is clearly a named, identifiable thing (a movie title, a product \
name, a company name, a book title, an event name, a person's name on a business card, a visible \
defect/damage/issue). Do not invent entities that aren't visibly present.
- If the image shows damage, defects, or safety issues (cracks, broken items, stains, wear), \
extract each as an entity of type "issue" with a short descriptive value (e.g. "wall crack", \
"broken tile") and include severity/location in metadata if apparent.
- "extractedContent" should capture ALL structured text fields (prices, dates, phone numbers, \
emails, addresses, company names, URLs, IDs, labels) even if they don't rise to full "entities".
- Never fabricate text or values that are not actually visible in the image.
- Return valid JSON only.`;

export async function analyzeImageBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<ImageAnalysisResult> {
  const anthropic = getClient();
  const base64 = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Analyze this image and return the JSON object described in your instructions.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI response contained no text content");
  }

  const parsed = parseJsonLoose<Partial<ImageAnalysisResult>>(textBlock.text);

  const category: ImageCategory = VALID_CATEGORIES.includes(parsed.category as ImageCategory)
    ? (parsed.category as ImageCategory)
    : "OTHER";

  const extractedContent = Array.isArray(parsed.extractedContent)
    ? parsed.extractedContent
        .filter((c) => c && typeof c.value === "string" && c.value.trim().length > 0)
        .map((c) => ({
          type: VALID_CONTENT_TYPES.includes(c.type as ExtractedContentType)
            ? (c.type as ExtractedContentType)
            : ("LABEL" as ExtractedContentType),
          value: String(c.value).trim(),
          confidence: typeof c.confidence === "number" ? c.confidence : 0.7,
        }))
    : [];

  const entities = Array.isArray(parsed.entities)
    ? parsed.entities
        .filter((e) => e && typeof e.value === "string" && e.value.trim().length > 0)
        .map((e) => ({
          type: String(e.type || "other").toLowerCase().trim(),
          value: String(e.value).trim(),
          confidence: typeof e.confidence === "number" ? e.confidence : 0.7,
          evidence: typeof e.evidence === "string" && e.evidence.trim() ? e.evidence.trim() : undefined,
          metadata: e.metadata && typeof e.metadata === "object" ? e.metadata : undefined,
        }))
    : [];

  return {
    category,
    sceneTags: Array.isArray(parsed.sceneTags) ? parsed.sceneTags.filter(Boolean).map(String) : [],
    objectTags: Array.isArray(parsed.objectTags) ? parsed.objectTags.filter(Boolean).map(String) : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    rawText: typeof parsed.rawText === "string" ? parsed.rawText : "",
    extractedContent,
    entities,
  };
}

// ---------------------------------------------------------------------------
// Query engine: reasons over ALREADY-STORED collection intelligence. Never
// re-sends images to the vision model — this is pure text reasoning over the
// structured data we extracted at upload time.
// ---------------------------------------------------------------------------

export interface CollectionSummaryForQuery {
  images: Array<{
    id: string;
    filename: string;
    category: string | null;
    sceneTags: string[];
    objectTags: string[];
    summary: string | null;
  }>;
  entities: Array<{
    id: string;
    type: string;
    canonicalValue: string;
    metadata: unknown;
    sources: Array<{ imageId: string; evidence: string; confidence: number | null }>;
  }>;
  extractedContent: Array<{
    imageId: string;
    type: string;
    value: string;
    confidence: number | null;
  }>;
}

const QUERY_SYSTEM_PROMPT = `You are the query-reasoning layer inside Vizora. You are given a JSON \
summary of an already-analyzed image collection (images, deduplicated entities with their source \
images/evidence, and raw extracted content fields like prices/emails/dates), plus a user's \
natural-language question about that collection. You do NOT have access to the images themselves — \
reason only from the structured data provided.

Return ONLY a single JSON object (no markdown fences, no prose outside the JSON) with this shape:

{
  "resultType": one of "entity_list" | "table" | "image_list" | "issue_list" | "overview" | "text",
  "title": string (short title for the result, e.g. "Movies Found"),
  "summary": string (one short sentence, e.g. "6 unique movies found"),
  "explanation": string (1-2 sentences explaining HOW you derived the answer, e.g. "I found 7 \
product entities and filtered them using their extracted prices." — this is shown to the user to \
build trust; be concrete about counts and method, never vague),
  "columns": string[] (ONLY for resultType "table", e.g. ["Item", "Price"]),
  "answer": string (ONLY for resultType "text" — a direct prose answer),
  "items": [
    // for "entity_list": { "id": entityId (REQUIRED, copied exactly from the data), "label": string }
    // for "table": { "cells": string[] matching columns order, "imageId": string, "confidence": number }
    // for "image_list": { "imageId": string, "label": reason string, "confidence": number }
    // for "issue_list": { "id": entityId (REQUIRED, an entity of type "issue"), "label": issue description }
    // for "overview": { "label": string (e.g. "🎬 Movies"), "cells": [countAsString], "entityType": string }
  ]
}

Rules:
- Choose "entity_list" when the query asks to extract/list named things that already exist as \
entities (movies, products, companies, books, events, people).
- Choose "table" for structured line-item data like receipts/prices/contact fields. Every cell must be \
copied VERBATIM from the provided data (exact item names, prices and dates as they appear); never \
compute, convert, reformat or add values, because the server drops any row containing a cell it \
cannot find in that image's stored text.
- Choose "image_list" when the query asks to find/show images matching a description (e.g. \
"images with laptops", "photos from the kitchen").
- Choose "issue_list" for damage/defect/problem-finding queries (entity type "issue").
- For "entity_list" and "issue_list", ONLY return entities by their exact id; the server rebuilds \
sources, evidence and confidence from the database, so do not write them yourself.
- Choose "overview" for broad, open-ended requests ("find everything important", "what's in these \
images", "summarize this collection") — return one item per entity/content type present, each with \
an emoji + label and its count, sorted by count descending.
- Choose "text" only when none of the structured shapes fit.
- ONLY reference imageId and entityId values that literally appear in the provided data. Never \
invent an id, filename, or evidence string that isn't present in the input.
- Deduplicate: if the same real-world thing is represented by near-duplicate entities the caller \
did not already merge, merge them yourself in the response and combine their sources.
- If truly nothing in the collection matches the query, return resultType "text" with an honest \
answer explaining nothing matched.
- Return valid JSON only.`;

export async function runCollectionQuery(
  collectionSummary: CollectionSummaryForQuery,
  userQuery: string
): Promise<QueryResult> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: QUERY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `COLLECTION DATA:\n${JSON.stringify(collectionSummary)}\n\nUSER QUERY: ${userQuery}\n\nReturn the JSON result object now.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI response contained no text content");
  }

  const parsed = parseJsonLoose<Partial<QueryResult>>(textBlock.text);

  const validTypes = ["entity_list", "table", "image_list", "issue_list", "overview", "text"];
  const resultType = validTypes.includes(parsed.resultType as string)
    ? (parsed.resultType as QueryResult["resultType"])
    : "text";

  return {
    resultType,
    title: typeof parsed.title === "string" ? parsed.title : "Result",
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : undefined,
    columns: Array.isArray(parsed.columns) ? parsed.columns.map(String) : undefined,
    answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  };
}

const REPORT_SYSTEM_PROMPT = `You write short, concrete "visual intelligence" report summaries for \
Vizora from structured collection data. Return ONLY a JSON object: \
{ "headline": string, "narrative": string (2-4 sentences), "highlights": string[] (3-6 short bullet facts) }. \
Base every statement strictly on the provided data — never invent counts or findings.`;

export async function generateReportNarrative(collectionSummary: CollectionSummaryForQuery): Promise<{
  headline: string;
  narrative: string;
  highlights: string[];
}> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: REPORT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `COLLECTION DATA:\n${JSON.stringify(collectionSummary)}\n\nReturn the JSON object now.`,
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { headline: "Visual Intelligence Report", narrative: "", highlights: [] };
  }
  try {
    const parsed = parseJsonLoose<{ headline: string; narrative: string; highlights: string[] }>(
      textBlock.text
    );
    return {
      headline: parsed.headline || "Visual Intelligence Report",
      narrative: parsed.narrative || "",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
    };
  } catch {
    return { headline: "Visual Intelligence Report", narrative: "", highlights: [] };
  }
}

// ---------------------------------------------------------------------------
// Retrieval planning: turns the question into search hints so we can narrow
// the collection (via Cloudinary Search + structured Postgres lookups) BEFORE
// asking the reasoning model, instead of sending everything every time.
// ---------------------------------------------------------------------------

export interface RetrievalPlan {
  scope: "targeted" | "broad";
  assetTags: string[];
  categories: ImageCategory[];
  entityTypes: string[];
  contentTypes: ExtractedContentType[];
}

const PLAN_SYSTEM_PROMPT = `You plan retrieval for Vizora, a system that answers questions over a \\
collection of analyzed images. Given a user question and the VOCABULARY that actually exists in the \\
collection, return ONLY a JSON object:
{
  "scope": "targeted" | "broad",
  "assetTags": string[] (visual tags — objects/scenes — chosen ONLY from the vocabulary's tags that \\
images relevant to the question would carry),
  "categories": string[] (image categories from ${JSON.stringify(VALID_CATEGORIES)} whose images could be relevant),
  "entityTypes": string[] (entity types from the vocabulary that the question is about),
  "contentTypes": string[] (extracted field types from ${JSON.stringify(VALID_CONTENT_TYPES)} the question is about, e.g. PRICE for price questions)
}
Use "broad" for open-ended questions ("everything important", "summarize") or when unsure. Prefer \\
recall over precision: include every plausibly relevant tag/type. Never invent tags or entity types \\
that are not in the vocabulary.`;

export async function planRetrieval(
  query: string,
  vocabulary: { tags: string[]; entityTypes: string[]; categories: string[] }
): Promise<RetrievalPlan> {
  const broad: RetrievalPlan = { scope: "broad", assetTags: [], categories: [], entityTypes: [], contentTypes: [] };
  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: PLAN_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `VOCABULARY:\n${JSON.stringify(vocabulary)}\n\nQUESTION: ${query}\n\nReturn the JSON now.` },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return broad;
    const p = parseJsonLoose<Partial<RetrievalPlan>>(block.text);
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    const tagSet = new Set(vocabulary.tags);
    const typeSet = new Set(vocabulary.entityTypes);
    return {
      scope: p.scope === "targeted" ? "targeted" : "broad",
      // Only keep hints that really exist — guards against invented vocabulary.
      assetTags: arr(p.assetTags).filter((t) => tagSet.has(t)),
      categories: arr(p.categories).filter((c): c is ImageCategory => VALID_CATEGORIES.includes(c as ImageCategory)),
      entityTypes: arr(p.entityTypes).filter((t) => typeSet.has(t)),
      contentTypes: arr(p.contentTypes).filter((c): c is ExtractedContentType =>
        VALID_CONTENT_TYPES.includes(c as ExtractedContentType)
      ),
    };
  } catch (err) {
    console.warn("[vizora] retrieval planning failed, falling back to full collection:", err);
    return broad;
  }
}
