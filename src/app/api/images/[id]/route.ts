import { NextResponse } from "next/server";
import { processImage } from "@/lib/processing";
import { requireImage } from "@/lib/auth";
import { db } from "@/lib/db";

export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireImage(id);
  if (!access.ok) return access.response;
  const { image } = access;

  const res = await fetch(image.secureUrl);
  if (!res.ok) {
    return NextResponse.json({ error: "Could not re-fetch source image from Cloudinary." }, { status: 502 });
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || `image/${image.format || "jpeg"}`;

  await processImage(id, buffer, mimeType);
  const updated = await db.image.findUnique({ where: { id } });
  return NextResponse.json({ image: updated });
}
