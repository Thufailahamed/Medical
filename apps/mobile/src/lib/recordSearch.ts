// Tiny client-side search helpers for the medical-records hub.
// We don't pull in fuse.js — the record volume per patient is small
// (<=200 server-paginated) and the server already pre-filters by
// type/archived/scope. The job here is: (a) flatten OCR JSON into
// searchable text, (b) score + rank by relevance, (c) tolerate
// small typos via token-prefix overlap.

// ─── flattenOCR ──────────────────────────────────────────
// Walks a JSON value and concatenates every string leaf. The OCR
// pipeline stores extractedData as a JSON-stringified object like
// `{ medicines: [{ name: "Paracetamol", dosage: "500mg" }] }`, so
// naive substring search against the raw JSON would miss matches
// that span quotes/braces. We flatten first to get clean text.
export function flattenOCR(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    // Could be the JSON string itself if the caller hasn't parsed it.
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return flattenOCR(JSON.parse(trimmed));
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(flattenOCR).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(flattenOCR)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

// ─── scoreMatch ──────────────────────────────────────────
// Returns a relevance score in [0, ∞). 0 = no match. Higher = better.
//
// Scoring:
//  +100 per substring hit of the full needle in the haystack
//   +25 per token of needle that has a prefix hit in any haystack token
//   +5  per token of needle that exactly matches a haystack token
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function scoreMatch(needleRaw: string, haystackRaw: string): number {
  const needle = needleRaw.trim().toLowerCase();
  if (!needle) return 0;
  const haystack = haystackRaw.toLowerCase();
  if (!haystack) return 0;

  // Exact substring hit — strong signal.
  if (haystack.includes(needle)) return 100;

  const needleTokens = tokenize(needle);
  const hayTokens = tokenize(haystack);
  if (needleTokens.length === 0 || hayTokens.length === 0) return 0;

  let score = 0;
  for (const nt of needleTokens) {
    if (hayTokens.includes(nt)) {
      score += 25;
      continue;
    }
    // Prefix / typo tolerance: at least one haystack token starts with nt,
    // or shares the first two characters (1-edit typo case for short tokens).
    const hit = hayTokens.some(
      (ht) => ht.startsWith(nt) || (nt.length >= 3 && ht.startsWith(nt.slice(0, 3)))
    );
    if (hit) score += 5;
  }
  return score;
}

// ─── searchRecords ───────────────────────────────────────
// Returns records ranked by relevance when q is non-empty.
// Preserves the existing records[] when q is empty.
export function searchRecords<T extends Record<string, any>>(
  records: T[],
  q: string,
  fields: Array<keyof T | ((r: T) => string | undefined)>
): T[] {
  const needle = q.trim();
  if (!needle) return records;

  const scored = records
    .map((rec) => {
      const blob = fields
        .map((f) =>
          typeof f === "function"
            ? (f as (r: T) => string | undefined)(rec) || ""
            : flattenOCR(rec[f])
        )
        .join(" ");
      return { rec, score: scoreMatch(needle, blob) };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.rec);
}