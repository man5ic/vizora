import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCollection } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const access = await requireCollection(req.nextUrl.searchParams.get("collectionId"));
  if (!access.ok) return access.response;
  const collectionId = access.collection.id;

  const category = req.nextUrl.searchParams.get("category");
  const search = req.nextUrl.searchParams.get("search")?.trim();

  const images = await db.image.findMany({
    where: {
      collectionId,
      ...(category ? { category: category as never } : {}),
      ...(search
        ? {
            OR: [
              { filename: { contains: search, mode: "insensitive" } },
              { rawText: { contains: search, mode: "insensitive" } },
              { summary: { contains: search, mode: "insensitive" } },
              { objectTags: { has: search.toLowerCase() } },
              { sceneTags: { has: search.toLowerCase() } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ images });
}
