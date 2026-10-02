import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai";
import { runQueryForCollection } from "@/lib/queryEngine";
import { requireCollection } from "@/lib/auth";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI provider is not configured on the server. Set ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const collectionId = body?.collectionId;
  const query = body?.query;

  if (typeof collectionId !== "string" || !collectionId) {
    return NextResponse.json({ error: "collectionId is required." }, { status: 400 });
  }
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query cannot be empty." }, { status: 400 });
  }

  const access = await requireCollection(collectionId);
  if (!access.ok) return access.response;

  try {
    const result = await runQueryForCollection(collectionId, query);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[vizora] query failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Query failed. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const access = await requireCollection(req.nextUrl.searchParams.get("collectionId"));
  if (!access.ok) return access.response;
  const queries = await db.query.findMany({
    where: { collectionId: access.collection.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ queries });
}
