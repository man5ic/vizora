import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateReportNarrative, isAiConfigured } from "@/lib/ai";
import { buildReportData } from "@/lib/queryEngine";
import { requireCollection } from "@/lib/auth";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const collectionId = body?.collectionId;
  if (typeof collectionId !== "string" || !collectionId) {
    return NextResponse.json({ error: "collectionId is required." }, { status: 400 });
  }

  const access = await requireCollection(collectionId);
  if (!access.ok) return access.response;

  const data = await buildReportData(collectionId);

  const narrative = isAiConfigured()
    ? await generateReportNarrative(data.summary).catch(() => ({
        headline: "Visual Intelligence Report",
        narrative: "",
        highlights: [],
      }))
    : { headline: "Visual Intelligence Report", narrative: "", highlights: [] };

  const summaryJson = {
    totalImages: data.totalImages,
    byStatus: data.byStatus,
    categoryCounts: data.categoryCounts,
    entityTypeCounts: data.entityTypeCounts,
    textEntitiesCount: data.textEntitiesCount,
    objectsDetected: data.objectsDetected,
    issues: data.issues.map((i) => ({
      id: i.id,
      value: i.canonicalValue,
      sources: i.sources,
    })),
    narrative,
  };

  const report = await db.report.create({
    data: {
      collectionId,
      title: narrative.headline,
      summaryJson: JSON.parse(JSON.stringify(summaryJson)),
    },
  });

  return NextResponse.json({ report });
}

export async function GET(req: NextRequest) {
  const access = await requireCollection(req.nextUrl.searchParams.get("collectionId"));
  if (!access.ok) return access.response;
  const reports = await db.report.findMany({
    where: { collectionId: access.collection.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ reports });
}
