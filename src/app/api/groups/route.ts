import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCollection } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const access = await requireCollection(req.nextUrl.searchParams.get("collectionId"));
  if (!access.ok) return access.response;
  const collectionId = access.collection.id;

  const images = await db.image.findMany({
    where: { collectionId, status: "ANALYZED" },
    select: { id: true, category: true, sceneTags: true },
  });

  const byCategory = new Map<string, number>();
  const byScene = new Map<string, number>();

  for (const img of images) {
    const cat = img.category ?? "OTHER";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    for (const tag of img.sceneTags) {
      byScene.set(tag, (byScene.get(tag) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    categories: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
    scenes: [...byScene.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([scene, count]) => ({ scene, count })),
  });
}
