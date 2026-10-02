export type ImageStatus = "UPLOADING" | "PROCESSING" | "ANALYZED" | "FAILED";

export interface ImageDTO {
  id: string;
  collectionId: string;
  cloudinaryPublicId: string;
  secureUrl: string;
  thumbnailUrl: string | null;
  filename: string;
  width: number | null;
  height: number | null;
  format: string | null;
  status: ImageStatus;
  errorMessage: string | null;
  category: string | null;
  sceneTags: string[];
  objectTags: string[];
  rawText: string | null;
  summary: string | null;
  createdAt: string;
  analyzedAt: string | null;
}

export interface ExtractedContentDTO {
  id: string;
  imageId: string;
  type: string;
  value: string;
  normalizedValue: string | null;
  confidence: number | null;
}

export interface ImageDetailDTO extends ImageDTO {
  evidenceUrl: string | null;
  extractedContent: ExtractedContentDTO[];
  entitySources: Array<{
    id: string;
    evidence: string;
    confidence: number | null;
    entity: { id: string; type: string; canonicalValue: string };
  }>;
}

export interface CollectionDTO {
  id: string;
  name: string;
  createdAt: string;
  imageCount: number;
}

export interface QueryResultSourceDTO {
  imageId: string;
  evidence: string;
  confidence?: number | null;
}

export interface QueryResultItemDTO {
  id?: string;
  label?: string;
  cells?: string[];
  imageId?: string;
  confidence?: number | null;
  evidence?: string;
  entityType?: string;
  verified?: boolean;
  sources?: QueryResultSourceDTO[];
}

export interface RetrievalTraceDTO {
  strategy: "cloudinary_search" | "structured_only" | "full_collection";
  totalImages: number;
  candidateImages: number;
  cloudinaryCandidates: number;
  cloudinaryExpression?: string;
  note?: string;
}

export interface QueryResultDTO {
  retrieval?: RetrievalTraceDTO;
  verification?: { checked: number; verified: number; dropped: number };
  resultType: "entity_list" | "table" | "image_list" | "issue_list" | "overview" | "text";
  title: string;
  summary: string;
  explanation?: string;
  columns?: string[];
  answer?: string;
  items: QueryResultItemDTO[];
}

export interface CollectionStatsDTO {
  totalImages: number;
  analyzedImages: number;
  processingImages: number;
  failedImages: number;
  entityCount: number;
  entityObservations: number;
  stageCounts: Record<string, number>;
  textElementCount: number;
  categoryCount: number;
  objectsDetected: number;
}

export interface GroupsResponseDTO {
  categories: Array<{ category: string; count: number }>;
  scenes: Array<{ scene: string; count: number }>;
}

export interface EntityDTO {
  id: string;
  type: string;
  canonicalValue: string;
  metadata: unknown;
  sources: Array<{ id: string; imageId: string; evidence: string; confidence: number | null }>;
}

export interface EntityGroupDTO {
  type: string;
  entities: EntityDTO[];
}

export interface ReportDTO {
  id: string;
  title: string;
  createdAt: string;
  summaryJson: {
    totalImages: number;
    byStatus: Array<{ status: string; _count: { _all: number } }>;
    categoryCounts: Record<string, number>;
    entityTypeCounts: Record<string, number>;
    textEntitiesCount: number;
    objectsDetected: number;
    issues: Array<{ id: string; value: string; sources: unknown[] }>;
    narrative: { headline: string; narrative: string; highlights: string[] };
  };
}
