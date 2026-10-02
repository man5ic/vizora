import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteImage, evidenceFocusUrl, isCloudinaryConfigured } from "@/lib/cloudinary";
import { requireImage } from "@/lib/auth";
import { removeEmptyEntities } from "@/lib/processing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireImage(id);
  if (!access.ok) return access.response;

  const image = await db.image.findUnique({
    where: { id },
    include: {
      extractedContent: { orderBy: { type: "asc" } },
      entitySources: {
        include: { entity: { select: { id: true, type: true, canonicalValue: true } } },
      },
    },
  });
  if (!image) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const evidenceUrl = isCloudinaryConfigured() ? evidenceFocusUrl(image.cloudinaryPublicId) : null;
  return NextResponse.json({ image: { ...image, evidenceUrl } });
}

/**
 * Delete order matters: Cloudinary first, then Postgres. If Cloudinary fails
 * we keep the DB row and report the error so the user can retry, rather than
 * orphaning a paid-for asset that nothing references any more.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireImage(id);
  if (!access.ok) return access.response;
  const { image } = access;

  if (isCloudinaryConfigured()) {
    try {
      await deleteImage(image.cloudinaryPublicId);
    } catch (err) {
      console.error(`[vizora] Cloudinary delete failed for ${image.id}:`, err);
      return NextResponse.json(
        { error: "Could not remove the asset from Cloudinary, so nothing was deleted. Please try again." },
        { status: 502 }
      );
    }
  }

  await db.image.delete({ where: { id } });
  // EntitySource rows cascade away with the image; drop entities left with no evidence.
  await removeEmptyEntities(image.collectionId);
  return NextResponse.json({ ok: true });
}
