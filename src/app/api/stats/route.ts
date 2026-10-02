import { NextRequest, NextResponse } from "next/server";
import { getCollectionStats } from "@/lib/queryEngine";
import { requireCollection } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const access = await requireCollection(req.nextUrl.searchParams.get("collectionId"));
  if (!access.ok) return access.response;
  const stats = await getCollectionStats(access.collection.id);
  return NextResponse.json(stats);
}
