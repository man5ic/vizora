export type ImageCategory =
  | "MOVIE_POSTER"
  | "BOOK"
  | "PRODUCT"
  | "RECEIPT"
  | "DOCUMENT"
  | "SCREENSHOT"
  | "EVENT_FLYER"
  | "BUSINESS_CARD"
  | "PHOTO"
  | "OTHER";

export type ExtractedContentType =
  | "TITLE"
  | "NAME"
  | "PRICE"
  | "DATE"
  | "PHONE"
  | "EMAIL"
  | "ADDRESS"
  | "COMPANY"
  | "URL"
  | "ID"
  | "LABEL"
  | "RAW_TEXT"
  | "OBJECT"
  | "SCENE"
  | "ISSUE";

/** Raw shape returned by the vision/analysis model for a single image. */
export interface ImageAnalysisResult {
  category: ImageCategory;
  sceneTags: string[];
  objectTags: string[];
  summary: string;
  rawText: string;
  extractedContent: Array<{
    type: ExtractedContentType;
    value: string;
    confidence: number;
  }>;
  entities: Array<{
    type: string; // "movie" | "product" | "company" | "person" | "book" | "event" | "issue" | ...
    value: string;
    confidence: number;
    /** Literal text seen (for text entities) or a one-sentence visual justification (for issues). */
    evidence?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export type QueryResultType =
  | "entity_list"
  | "table"
  | "image_list"
  | "issue_list"
  | "overview"
  | "text";

export interface QueryResultSource {
  imageId: string;
  evidence: string;
  confidence?: number;
}

export interface QueryResultItem {
  id?: string;
  label?: string;
  cells?: string[];
  imageId?: string;
  confidence?: number;
  evidence?: string;
  entityType?: string;
  verified?: boolean;
  sources?: QueryResultSource[];
}

export interface RetrievalTrace {
  strategy: "cloudinary_search" | "structured_only" | "full_collection";
  totalImages: number;
  candidateImages: number;
  cloudinaryCandidates: number;
  cloudinaryExpression?: string;
  note?: string;
}

export interface VerificationSummary {
  checked: number;
  verified: number;
  dropped: number;
}

export interface QueryResult {
  resultType: QueryResultType;
  retrieval?: RetrievalTrace;
  verification?: VerificationSummary;
  title: string;
  summary: string;
  explanation?: string;
  columns?: string[];
  answer?: string;
  items: QueryResultItem[];
}
