import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getOwnerId } from "@/lib/auth";

export async function GET() {
  const ownerId = await getOwnerId();
  const collections = await db.collection.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { images: true } } },
  });
  return NextResponse.json({
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      imageCount: c._count.images,
    })),
  });
}

export async function POST(req: NextRequest) {
  const ownerId = await getOwnerId();
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Collection";
  const collection = await db.collection.create({ data: { name, ownerId } });
  return NextResponse.json({ collection }, { status: 201 });
}
