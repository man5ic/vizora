import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCollection } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const access = await requireCollection(req.nextUrl.searchParams.get("collectionId"));
  if (!access.ok) return access.response;
  const collectionId = access.collection.id;

  const entities = await db.entity.findMany({
    where: { collectionId, sources: { some: {} } },
    orderBy: [{ type: "asc" }, { canonicalValue: "asc" }],
    include: {
      sources: {
        select: { id: true, imageId: true, evidence: true, confidence: true },
      },
    },
  });

  const grouped = new Map<string, typeof entities>();
  for (const e of entities) {
    if (!grouped.has(e.type)) grouped.set(e.type, []);
    grouped.get(e.type)!.push(e);
  }

  return NextResponse.json({
    groups: [...grouped.entries()].map(([type, items]) => ({ type, entities: items })),
  });
}
