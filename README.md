# Vizora

**Ask your images anything. Get answers with evidence.**

Track: **Your Media-Savvy Startup** (Pixels to Products), with pipeline
capabilities pulled in from Track 1.

---

## 1. Problem

Everyone accumulates piles of visual information — screenshots, receipts,
posters, product photos, scans, inspection photos — and none of it is
searchable. The pixels contain the answer to a real question ("which movies
are in these posters", "what did I spend on groceries", "is anything
damaged"), but getting at it means opening every image by hand, reading it,
and writing the answer down yourself. That doesn't scale past a dozen images,
let alone hundreds.

## 2. Solution

Vizora turns an entire image collection into a queryable knowledge layer.
Cloudinary ingests, analyzes, tags, transforms and delivers every asset;
Vizora extracts entities and structured fields from each one, deduplicates
them across the whole collection, and answers plain-language questions with
results that link straight back to the exact image and evidence that
produced them.

```
Upload → Cloudinary ingest → Gemini vision/OCR → structured entities
   → deduplicated across the collection → Ask Vizora → answer + proof
```

This is not "run OCR on one image." It's "I have 500 images — find me the
information I care about, and show me where it came from."

## 3. Demo

Suggested 2–4 minute flow (mirrors what is actually built):

1. Open with the problem: *"I have 30 images and I don't know what's in them."*
   Drop in a mixed batch — posters, receipts, screenshots, products, a few
   inspection-style photos.
2. Watch the **Processing pipeline** strip: it shows how many images are
   currently in each real stage (vision + OCR → extracting/merging → syncing
   to Cloudinary), plus the **entity resolution** counter (raw observations →
   unique entities).
3. Ask *"Find everything important in these images"* → category overview
   (counts are computed from the database, not by the model).
4. Ask *"Which products cost more than ₹1,000?"* → table; every row was
   checked against that image's stored text. Click a row to open the source.
5. Ask *"Extract all movie names"* → deduplicated list; click a title to see
   every source image.
6. Open **Evidence**, ask *"Find potential damage in these photos"* → issue
   cards with *why*, model-reported confidence, and the source image.
7. Open a source image → Cloudinary asset panel (tags, metadata, optimized
   delivery). Generate a report.

## 4. Why this matters

Most "AI + images" demos stop at `image → answer`. Vizora's claim is
narrower and, we think, more useful: `image collection → structured
knowledge → question → answer → proof`. The evidence chain is not a UI
flourish — every source shown to the user has already been checked by the
server to actually exist in that collection before it's rendered (see
**Evidence architecture** below).

## 5. How it works

```
                RAW VISUAL CHAOS
                       │
                       ▼
              ┌─────────────────┐
              │    CLOUDINARY   │
              │                 │
              │ Upload          │
              │ Tagging         │
              │ Contextual      │
              │   metadata      │
              │ Transformation  │
              │ Optimized       │
              │   delivery      │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │     VIZORA      │
              │                 │
              │ Vision + OCR    │
              │ Entity extract  │
              │ Deduplication   │
              │ Query engine    │
              │ Evidence verify │
              │ Reports         │
              └────────┬────────┘
                       │
                       ▼
             ACTIONABLE KNOWLEDGE
             (with proof)
```

## 6. Cloudinary architecture

Cloudinary is not just where the bytes sit. Concretely, in this codebase:

| Capability | Where it happens | File |
|---|---|---|
| **Upload** | Every uploaded file is streamed straight to Cloudinary before anything is written to Postgres | `src/lib/cloudinary.ts` → `uploadImageBuffer`, called from `src/app/api/upload/route.ts` |
| **Asset management** | Public ID, format, bytes, dimensions are all read back from Cloudinary's own upload response and stored as the asset's record of truth | `src/app/api/upload/route.ts` |
| **AI signal written back to the asset** | Once Vizora's own vision analysis finishes, its findings (category, objects, scene, a summary) are written back onto the Cloudinary asset itself as **tags** and **structured contextual metadata** — so the asset is self-describing inside Cloudinary, not just inside our database | `src/lib/cloudinary.ts` → `syncAssetIntelligence`, called from `src/lib/processing.ts` |
| **Transformation** | Two distinct on-the-fly transformations are generated per asset: a fast, gravity-aware square **thumbnail** for the gallery, and a larger, format/quality-optimized **evidence-focus** rendition for the detail/proof view | `src/lib/cloudinary.ts` → `thumbnailUrl`, `evidenceFocusUrl` |
| **Optimization + delivery** | Every delivery URL uses `quality: "auto"` and `fetch_format: "auto"`, so each viewer gets the smallest correctly-encoded asset (AVIF/WebP/etc.) Cloudinary can produce for their browser — the CDN, not our server, serves every image byte the app shows | same as above |
| **Search / retrieval** | Ask Vizora plans retrieval hints from the question, then queries **Cloudinary's Search API** over the tags + `vizora_category` / `vizora_collection` metadata Vizora wrote to each asset. Those hits are unioned with a structured Postgres lookup, and only the candidate images are sent to the reasoning model. The retrieval strategy used is shown on every result. | `src/lib/retrieval.ts`, `src/lib/cloudinary.ts` → `searchCollectionAssets` |
| **Lifecycle** | Deleting an image removes the Cloudinary asset first, then the database row; if Cloudinary fails, nothing is deleted so no orphan is left behind | `src/app/api/images/[id]/route.ts` |
| **Config-error handling** | If Cloudinary isn't configured, `/api/upload` fails fast with a specific, actionable error rather than silently mocking storage | `src/lib/cloudinary.ts` → `isCloudinaryConfigured`, `CloudinaryConfigError` |

The Cloudinary "Asset Intelligence" panel in the image detail view (see
`src/components/ImageDetailModal.tsx`) surfaces exactly this — a live
checklist of what's happened to that asset inside Cloudinary, plus its
format/dimensions/delivery settings.

## 7. AI architecture

Deliberately simple, per the brief — no multi-agent framework, no vector
database, no custom model training:

1. **Vision/media layer** — one Gemini vision call per image (via
   `@google/genai`) returns category, scene tags, object tags, full OCR
   text, structured fields, and named entities. `src/lib/ai.ts` →
   `analyzeImageBuffer`.
2. **Extraction/persistence** — results are written to Postgres
   (`ExtractedContent` rows) and merged into collection-level entities.
   `src/lib/processing.ts`.
3. **Deduplication** — a reusable rule-based normalizer plus bigram
   similarity ("Interstellar" / "INTERSTELLAR" / "Interstellar (2014)" → one
   entity, three sources). `src/lib/normalize.ts`.
4. **Retrieval + reasoning layer** — a small planning call turns the question
   into hints (tags, categories, entity types, field types) drawn only from
   the collection's real vocabulary. Candidates come from Cloudinary Search
   plus structured Postgres lookups; broad questions, empty matches or any
   failure fall back to the full collection, so narrowing can save work but
   never silently lose an answer. A text-only Gemini call then reasons over
   the *already-extracted* candidate data (never re-runs vision per query) and
   returns one of six structured result shapes:
   entity list, table, image grid, issue list, category **overview**, or
   plain text — plus a one-sentence **explanation** of how it derived the
   answer. `src/lib/ai.ts` → `runCollectionQuery`, `src/lib/queryEngine.ts`.
5. **Response layer** — the UI renders whichever shape came back, always
   with clickable, verified source chips. `src/components/ResultsPanel.tsx`.

Model defaults to development model `gemini-2.5-flash`, overridable via `GEMINI_MODEL`.

## 8. Evidence architecture

The model only **selects**; the database supplies the proof. After the
reasoning call, `verifyResult` (`src/lib/verify.ts`) grounds every result:

| Result type | What is verified |
|---|---|
| Entity list / issue list | The entity id must exist in this collection (and be an `issue` for issue lists). Sources, evidence text and confidence are **rebuilt from `EntitySource` rows** — anything the model wrote for those fields is discarded. |
| Table | The source image must exist, and the row's values must actually appear in that image's stored text (OCR text, extracted fields, entity evidence). Rows that can't be found are dropped. |
| Image list | The image must exist and be analyzed. Whether it *matches the question* is still the model's judgement; only the asset is verified. |
| Overview | Counts are recomputed from the database; model-written numbers are ignored. |

Each result reports `verified of checked` and how many rows were removed,
and the UI shows it. What this does **not** guarantee: that the model
selected the *right* entities for the question, or that the original vision
model read the image correctly in the first place — it guarantees that
nothing displayed as evidence was invented after the fact.

**Confidence** values are the model's own self-reported scores, labelled
"AI confidence" in the UI. They are not calibrated probabilities.

## 9. Example queries

```
Extract all movie names
Find all images containing prices
Find potential damage in these photos
Find everything important in these images        (overview mode)
Find products costing more than ₹1,000
Extract all company names
Find all images containing laptops
Find screenshots containing an email address
Show me all images related to the kitchen
```

Same engine, no query-specific code path — the model chooses the result
shape per question.

## 10. Tech stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **PostgreSQL** via **Prisma**
- **Cloudinary** — upload, tagging, contextual metadata, transformation,
  optimized delivery
- **Google Gemini** (`@google/genai`) — vision analysis + query
  reasoning + report narrative

## 11. Setup

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL, Cloudinary + Gemini keys
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000, drop in a batch of images, and once they finish
analyzing, ask Vizora something.

Production: `npm run build && npm start`. Background image analysis runs as
fire-and-forget work kept alive by the running Node process — this assumes a
long-lived server (self-hosted, Docker, a VM, `next start`), not a
request-scoped serverless platform. On a strictly serverless target, swap
the fire-and-forget call in `src/app/api/upload/route.ts` for a queue; the
`processImage()` function in `src/lib/processing.ts` is already the unit of
work a worker would run unchanged.

## 12. Environment variables

```bash
DATABASE_URL=              # any Postgres connection string
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash   # optional override; defaults to gemini-2.5-flash
```

The app fails loudly and specifically if any of these are missing (see
**Error handling** below) instead of silently mocking a result.

## 13. Evaluation

We don't ship a hidden benchmark inside the app, but the methodology to
validate extraction quality against this architecture is straightforward and
worth doing before a live demo:

1. Curate ~20 images with a **known** ground truth (e.g. 6 distinct movie
   posters, 5 receipts with known line-item counts, 7 screenshots with known
   emails, 5 inspection photos with known defects).
2. Upload them into a fresh collection and let analysis finish.
3. Run the target queries and diff the returned entity/table/issue counts
   against the known answers.
4. Track three things separately, since they can fail independently:
   **extraction** (did OCR/vision find the right raw values), **entity
   resolution** (did dedup correctly merge/not-merge near-duplicates), and
   **source grounding** (does every returned source actually resolve to the
   right image — this one is enforced server-side by construction, see
   §8).

## 14. Error handling

- Missing Cloudinary config → `/api/upload` returns a clear 503 with the
  exact env vars to set, before touching any file.
- Missing Gemini config → images still upload and store in
  Cloudinary/Postgres, but land in `FAILED` status with an explicit
  message (never a silent fake result); `/api/query` and `/api/report`
  return an explicit 503 rather than fabricating an answer.
- Per-image failures (bad file type, oversized file, a single vision call
  erroring) are isolated — one bad image in a 30-image batch doesn't fail
  the batch; that image's own record carries its error and can be retried
  from its detail view.
- Cloudinary Search is eventually consistent: freshly tagged assets may not
  be searchable for a short while. Retrieval falls back to the database's own
  tags, then to the full collection, so a query is never answered from an
  incomplete candidate set without a fallback.
- Cloudinary tag/metadata sync (`syncAssetIntelligence`) is explicitly
  non-fatal — if it fails, the image still analyzes and stores correctly;
  only the extra Cloudinary-side enrichment is skipped, with a warning
  logged.

## 15. Access model

Each browser receives a random httpOnly owner cookie and every collection is
bound to the owner that created it; all collection-scoped routes check that
binding (and return the same 404 for "missing" and "not yours"). This stops
anyone who knows or guesses a collection id from reading it. It is **not**
user authentication: there are no accounts, and clearing cookies loses access
to your collections. Real auth is the obvious next step.

## 16. Roadmap / explicitly out of scope for now

Kept out deliberately so the time went into depth, not breadth:
real user authentication, payments, a mobile app, complex collaboration/permissions,
a vector database, a multi-agent architecture. If this continues past the
hackathon, the next real investments would be: duplicate/near-duplicate *image*
detection (as opposed to entity dedup, which already exists), and a proper
automated evaluation harness per §13.

## 17. Project structure

```
prisma/schema.prisma          Collection / Image / ExtractedContent / Entity / EntitySource / Query / Report

src/lib/
  db.ts                       Prisma client singleton
  cloudinary.ts               Upload, transforms, tag/metadata sync, Search API retrieval, delete
  ai.ts                       Gemini vision analysis + collection query engine + report narrative
  normalize.ts                Entity normalization + similarity-based dedup matching
  processing.ts               Per-image pipeline: analyze -> persist -> merge entities -> sync to Cloudinary
  retrieval.ts                Retrieval planning -> Cloudinary Search + structured Postgres -> candidates
  verify.ts                   Database grounding of every query result
  auth.ts                     Anonymous per-browser collection ownership
  queryEngine.ts              Ask Vizora orchestration, live stats, reports
  apiClient.ts                Typed fetch wrappers used by the UI
  labels.ts                   Category/status display labels + icons

src/app/api/
  collections/                List/create collections
  upload/                     Multi-file upload -> Cloudinary -> DB row -> background analysis
  images/                     List + filter images (polling target)
  images/[id]/                Image detail (extracted content, entity sources, evidence-focus URL)
  images/[id]/analyze/        Retry analysis for a failed image
  entities/                   All deduplicated entities, grouped by type
  groups/                     Smart-group counts (category + scene)
  stats/                      Live collection stats for the pipeline/overview bar
  query/                      Ask Vizora
  report/                     Generate + list reports

src/components/
  Dashboard.tsx                Top-level state, polling, view switching
  PipelineStatus.tsx           Collection overview stats + live intelligence pipeline strip
  UploadZone.tsx, ImageGallery.tsx, ImageCard.tsx
  AskVizora.tsx, ResultsPanel.tsx, ConfidenceBadge.tsx
  ImageDetailModal.tsx         Includes the Cloudinary "Asset Intelligence" panel
  SmartGroups.tsx, ExtractedData.tsx, EvidenceMode.tsx, ReportView.tsx
  Sidebar.tsx
```

## Before you demo: things I could not test here

- **Cloudinary Search expressions** (`context.vizora_collection="…"`, `tags="…"`)
  follow Cloudinary's documented syntax but were not run against a real
  account. If a search returns nothing, retrieval falls back safely — check the
  strategy line on the result to see which path ran, and the server log for
  the expression.
- After changing the schema, run `npx prisma db push` (adds `ownerId` and
  `stage`).

## A note on this environment

This was built and reviewed in a sandboxed container without access to
Prisma's binary-engine host, so `prisma generate` (and therefore a full
`next build`) could not be executed here. The frontend (all of
`src/components`, `src/lib/apiClient.ts`, `src/types`) is fully type-checked
and lint-clean. The Prisma-touching backend files were written and then
manually cross-checked line-by-line against `prisma/schema.prisma` for field
names and query shapes, but run `npm run build` yourself after
`npx prisma generate` as a final check before deploying or recording the
demo.
