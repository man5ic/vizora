import type {
  CollectionDTO,
  CollectionStatsDTO,
  EntityGroupDTO,
  GroupsResponseDTO,
  ImageDetailDTO,
  ImageDTO,
  QueryResultDTO,
  ReportDTO,
} from "@/types/client";

async function unwrap<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  listCollections: () =>
    fetch("/api/collections").then((r) => unwrap<{ collections: CollectionDTO[] }>(r)),

  createCollection: (name: string) =>
    fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => unwrap<{ collection: CollectionDTO }>(r)),

  upload: (collectionId: string | null, files: File[]) => {
    const form = new FormData();
    if (collectionId) form.append("collectionId", collectionId);
    for (const f of files) form.append("files", f);
    return fetch("/api/upload", { method: "POST", body: form }).then((r) =>
      unwrap<{ collectionId: string; results: Array<{ image?: ImageDTO; filename?: string; error?: string }> }>(r)
    );
  },

  listImages: (collectionId: string, opts?: { category?: string; search?: string }) => {
    const params = new URLSearchParams({ collectionId });
    if (opts?.category) params.set("category", opts.category);
    if (opts?.search) params.set("search", opts.search);
    return fetch(`/api/images?${params}`).then((r) => unwrap<{ images: ImageDTO[] }>(r));
  },

  getImage: (id: string) =>
    fetch(`/api/images/${id}`).then((r) => unwrap<{ image: ImageDetailDTO }>(r)),

  retryAnalysis: (id: string) =>
    fetch(`/api/images/${id}/analyze`, { method: "POST" }).then((r) => unwrap<{ image: ImageDTO }>(r)),

  deleteImage: (id: string) => fetch(`/api/images/${id}`, { method: "DELETE" }).then((r) => unwrap<{ ok: true }>(r)),

  query: (collectionId: string, query: string) =>
    fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, query }),
    }).then((r) => unwrap<{ result: QueryResultDTO }>(r)),

  entities: (collectionId: string) =>
    fetch(`/api/entities?collectionId=${collectionId}`).then((r) => unwrap<{ groups: EntityGroupDTO[] }>(r)),

  stats: (collectionId: string) =>
    fetch(`/api/stats?collectionId=${collectionId}`).then((r) => unwrap<CollectionStatsDTO>(r)),

  groups: (collectionId: string) =>
    fetch(`/api/groups?collectionId=${collectionId}`).then((r) => unwrap<GroupsResponseDTO>(r)),

  generateReport: (collectionId: string) =>
    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId }),
    }).then((r) => unwrap<{ report: ReportDTO }>(r)),

  listReports: (collectionId: string) =>
    fetch(`/api/report?collectionId=${collectionId}`).then((r) => unwrap<{ reports: ReportDTO[] }>(r)),
};
