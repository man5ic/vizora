import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;

export class CloudinaryConfigError extends Error {
  constructor() {
    super(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
    this.name = "CloudinaryConfigError";
  }
}

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function ensureConfigured() {
  if (!isCloudinaryConfigured()) throw new CloudinaryConfigError();
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
}

/** Upload a raw image buffer to Cloudinary, into a per-collection folder. */
export function uploadImageBuffer(
  buffer: Buffer,
  opts: { folder: string; filename: string }
): Promise<UploadApiResponse> {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: opts.folder,
        // Cloudinary slugifies/derives a public id; keep the original name
        // (minus extension) as a hint for readability in the dashboard.
        filename_override: opts.filename,
        use_filename: true,
        unique_filename: true,
        resource_type: "image",
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

/** Build a delivery URL with on-the-fly transformations (e.g. gallery thumbs). */
export function buildTransformedUrl(
  publicId: string,
  transformation: Record<string, string | number>
) {
  ensureConfigured();
  return cloudinary.url(publicId, { secure: true, ...transformation });
}

export function thumbnailUrl(publicId: string) {
  return buildTransformedUrl(publicId, {
    width: 400,
    height: 400,
    crop: "fill",
    gravity: "auto",
    quality: "auto",
    fetch_format: "auto",
  });
}

/** A larger, still-optimized delivery used for the evidence/detail view. */
export function evidenceFocusUrl(publicId: string) {
  return buildTransformedUrl(publicId, {
    width: 1400,
    crop: "limit",
    quality: "auto",
    fetch_format: "auto",
  });
}

/**
 * Writes Vizora's own analysis back into Cloudinary as tags + structured
 * contextual metadata, so Cloudinary itself becomes searchable/taggable on
 * the same intelligence Vizora extracted — not just a place the bytes sit.
 * Non-fatal: a sync failure here should never fail image processing.
 */
export async function syncAssetIntelligence(
  publicId: string,
  data: { tags: string[]; context: Record<string, string> }
) {
  ensureConfigured();
  const cleanTags = [...new Set(data.tags.map((t) => t.toLowerCase().trim().replace(/\s+/g, "-")).filter(Boolean))].slice(
    0,
    20
  );
  // Cloudinary's add_context takes a pipe-delimited "key=value|key=value"
  // string, not an object — sanitize values so they can't break that format.
  const contextString = Object.entries(data.context)
    .map(([k, v]) => `${k}=${String(v).replace(/[|=]/g, " ").slice(0, 250)}`)
    .join("|");

  await Promise.all([
    cleanTags.length
      ? cloudinary.uploader.add_tag(cleanTags.join(","), [publicId], { resource_type: "image" })
      : Promise.resolve(),
    contextString
      ? cloudinary.uploader.add_context(contextString, [publicId], { resource_type: "image" })
      : Promise.resolve(),
  ]);
}

/** Removes the asset from Cloudinary. Resolves to "ok" or "not found"; throws on real failures. */
export async function deleteImage(publicId: string): Promise<"ok" | "not found"> {
  ensureConfigured();
  const res = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  if (res.result === "ok" || res.result === "not found") return res.result;
  throw new Error(`Cloudinary destroy returned unexpected result: ${res.result}`);
}

const escapeSearchValue = (v: string) => v.replace(/["\\]/g, "").trim();

/**
 * Retrieval via Cloudinary's Search API: finds this collection's assets whose
 * Vizora-written tags or category metadata match the hints derived from the
 * user's question. Scoped by the `vizora_collection` contextual metadata key
 * written at analysis time (independent of folder mode).
 *
 * Note: Cloudinary's search index is eventually consistent, so very fresh
 * tags may not be searchable yet — callers must handle an empty result.
 */
export async function searchCollectionAssets(
  collectionId: string,
  hints: { tags: string[]; categories: string[] }
): Promise<{ publicIds: string[]; expression: string } | null> {
  ensureConfigured();
  const clauses = [
    ...hints.tags.map((t) => escapeSearchValue(t.toLowerCase().replace(/\s+/g, "-"))).filter(Boolean).map((t) => `tags="${t}"`),
    ...hints.categories.map(escapeSearchValue).filter(Boolean).map((c) => `context.vizora_category="${c}"`),
  ];
  if (clauses.length === 0) return null;

  const expression = `context.vizora_collection="${escapeSearchValue(collectionId)}" AND (${clauses.join(" OR ")})`;
  const res = await cloudinary.search.expression(expression).max_results(500).execute();
  return {
    publicIds: (res.resources as Array<{ public_id: string }>).map((r) => r.public_id),
    expression,
  };
}
