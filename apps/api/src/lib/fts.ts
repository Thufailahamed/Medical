// @ts-nocheck
// Phase 2.1: D1 FTS5 sync. Single source of truth for `medical_records_fts`.
// Every write path (insert/update/delete on `medical_records`) funnels through
// `upsertRecordFts` / `removeRecordFts`. No DB triggers in PR-1.
//
// The FTS virtual table lives in `apps/api/migrations/0006_auto_classification.sql`
// with `unicode61 remove_diacritics 2` — handles Sinhala, Tamil, and Latin
// word boundaries transparently.

import { sql } from "drizzle-orm";

export interface FtsRecord {
  id: string;
  title: string | null;
  diagnosis: string | null;
  summary: string | null;
  notes: string | null;
  extractedData: string | null; // raw JSON string
}

/**
 * Build the searchable text from `extractedData`. Walks the JSON to pull
 * every string leaf into one big string. Mirrors the mobile-side
 * `flattenOCR` so the FTS index matches what the user sees in client search.
 */
export function flattenExtractedData(json: string | null): string {
  if (!json) return "";
  try {
    const parsed = JSON.parse(json);
    return flattenOCR(parsed);
  } catch {
    return "";
  }
}

function flattenOCR(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenOCR).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.values(value).map(flattenOCR).filter(Boolean).join(" ");
  }
  return "";
}

/**
 * Upsert a record into the FTS index. Removes any prior row first to
 * avoid stale tokens if the record was previously indexed with different
 * text. Idempotent.
 */
export async function upsertRecordFts(db: any, record: FtsRecord): Promise<void> {
  const extracted = flattenExtractedData(record.extractedData);
  await removeRecordFts(db, record.id);
  try {
    await db.run(sql`
      INSERT INTO medical_records_fts (recordId, title, diagnosis, summary, notes, extracted_text)
      VALUES (
        ${record.id},
        ${record.title ?? ""},
        ${record.diagnosis ?? ""},
        ${record.summary ?? ""},
        ${record.notes ?? ""},
        ${extracted}
      )
    `);
  } catch (err) {
    // Don't fail the parent write if FTS sync fails — log + continue.
    console.error("[fts] upsert failed", record.id, err);
  }
}

export async function removeRecordFts(db: any, recordId: string): Promise<void> {
  try {
    await db.run(sql`DELETE FROM medical_records_fts WHERE recordId = ${recordId}`);
  } catch (err) {
    console.error("[fts] remove failed", recordId, err);
  }
}

/**
 * Trilingual search. Returns matching record IDs in BM25-ranked order.
 * Caller joins back to `medical_records` for full rows.
 *
 * Query string is sanitised: we strip FTS5 operators (`"`, `*`, `(`, `)`,
 * `^`, `NEAR`, `AND`, `OR`, `NOT`) and turn the rest into a prefix-match
 * expression. Keeps users from getting syntax errors on common typos.
 */
export async function searchRecordsFts(
  db: any,
  query: string,
  limit: number = 50
): Promise<string[]> {
  const safe = sanitiseFtsQuery(query);
  if (!safe) return [];
  try {
    const result = await db.all(sql`
      SELECT recordId
      FROM medical_records_fts
      WHERE medical_records_fts MATCH ${safe}
      ORDER BY rank
      LIMIT ${limit}
    `);
    return result.map((r: any) => r.recordId).filter(Boolean);
  } catch (err) {
    console.error("[fts] search failed", safe, err);
    return [];
  }
}

function sanitiseFtsQuery(q: string): string {
  // Trim, lower-case, strip FTS5 operators that ordinary users would type
  // by accident. Keep Unicode word chars intact (Sinhala/Tamil/Latin).
  const stripped = q
    .trim()
    .toLowerCase()
    .replace(/["*^()]/g, " ")
    .replace(/\b(?:and|or|near|not)\b/g, " ")
    .trim();
  if (!stripped) return "";
  // Prefix-match each token with `*`. Single-token inputs skip the quotes
  // — FTS5 treats `"tok"*` and `tok*` identically for one-word inputs, but
  // SQLite's parser has historically rejected `"tok"*` in older builds.
  // For multi-word inputs we AND the prefix terms so all must hit.
  return stripped
    .split(/\s+/)
    .filter((tok) => tok.length >= 1)
    .map((tok) => `${tok.replace(/"/g, "")}*`)
    .join(" ");
}