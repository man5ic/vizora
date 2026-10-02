/**
 * Turns a raw extracted string into a canonical form used for entity
 * deduplication. This is intentionally simple and rule-based (no LLM call)
 * so dedup is fast, deterministic, and reusable across every entity type.
 */

const COMPANY_SUFFIXES = [
  "inc",
  "inc.",
  "llc",
  "l.l.c.",
  "ltd",
  "ltd.",
  "limited",
  "corp",
  "corp.",
  "corporation",
  "co",
  "co.",
  "pvt",
  "private",
];

export function normalizeEntityValue(type: string, raw: string): string {
  let v = raw.normalize("NFKC").trim().toLowerCase();

  // Strip a trailing year in parentheses or brackets: "Interstellar (2014)"
  v = v.replace(/[\(\[]\s*(19|20)\d{2}\s*[\)\]]\s*$/g, "").trim();

  // Collapse whitespace/punctuation noise.
  v = v.replace(/\s+/g, " ");
  v = v.replace(/^["'`]+|["'`]+$/g, "");
  v = v.replace(/[.,;:!?]+$/g, "");

  if (type === "company") {
    const words = v.split(" ").filter(Boolean);
    while (words.length > 1) {
      const last = words[words.length - 1].replace(/\.$/, "");
      if (COMPANY_SUFFIXES.includes(last)) {
        words.pop();
      } else {
        break;
      }
    }
    v = words.join(" ");
  }

  if (type === "email") {
    v = v.replace(/\s/g, "");
  }

  if (type === "phone") {
    v = v.replace(/[^\d+]/g, "");
  }

  return v.trim();
}

/** Cheap string similarity (Dice's coefficient over bigrams), 0..1. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const bigrams = (s: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.substring(i, i + 2);
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };

  const mapA = bigrams(a);
  const mapB = bigrams(b);
  let intersection = 0;
  for (const [bg, countA] of mapA) {
    const countB = mapB.get(bg);
    if (countB) intersection += Math.min(countA, countB);
  }
  const total = [...mapA.values()].reduce((s, n) => s + n, 0) + [...mapB.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * intersection) / total;
}

/** Threshold above which two normalized values are treated as the same entity. */
export const DEDUP_SIMILARITY_THRESHOLD = 0.82;

export function isLikelyDuplicate(a: string, b: string): boolean {
  return similarity(a, b) >= DEDUP_SIMILARITY_THRESHOLD;
}
