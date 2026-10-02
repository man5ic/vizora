import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CloudinaryConfigError, isCloudinaryConfigured, thumbnailUrl, uploadImageBuffer } from "@/lib/cloudinary";
import { processImage } from "@/lib/processing";
import { getOwnerId, requireCollection } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const MAX_BYTES = 20 * 1024 * 1024; // 20MB per image

export async function POST(req: NextRequest) {
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured on the server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  let collectionId = form.get("collectionId");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }

  // Auto-create a collection (owned by this browser) if none was supplied;
  // otherwise verify the caller actually owns the one they named.
  if (typeof collectionId !== "string" || !collectionId) {
    const ownerId = await getOwnerId();
    const created = await db.collection.create({ data: { name: "My Collection", ownerId } });
    collectionId = created.id;
  } else {
    const access = await requireCollection(collectionId);
    if (!access.ok) return access.response;
  }

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        if (!ACCEPTED_TYPES.has(file.type)) {
          return { filename: file.name, error: `Unsupported file type: ${file.type || "unknown"}` };
        }
        if (file.size > MAX_BYTES) {
          return { filename: file.name, error: "File exceeds 20MB limit." };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploaded = await uploadImageBuffer(buffer, {
          folder: `vizora/${collectionId}`,
          filename: file.name,
        });

        const image = await db.image.create({
          data: {
            collectionId: collectionId as string,
            cloudinaryPublicId: uploaded.public_id,
            secureUrl: uploaded.secure_url,
            thumbnailUrl: thumbnailUrl(uploaded.public_id),
            filename: file.name,
            width: uploaded.width,
            height: uploaded.height,
            bytes: uploaded.bytes,
            format: uploaded.format,
            status: "PROCESSING",
          },
        });

        // Fire-and-forget: analysis runs in the background so the upload
        // request returns quickly and the UI can show progressive status via
        // polling instead of blocking on every image being analyzed.
        void processImage(image.id, buffer, file.type).catch((err) => {
          console.error(`[vizora] background processing failed for ${image.id}:`, err);
        });

        return { image };
      } catch (err) {
        console.error("[vizora] upload failed for", file.name, err);
        return {
          filename: file.name,
          error:
            err instanceof CloudinaryConfigError
              ? err.message
              : "Upload failed. Please try again.",
        };
      }
    })
  );

  return NextResponse.json({ collectionId, results });
}
