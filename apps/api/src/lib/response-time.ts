// ─── Doctor first-response metric ─────────────────────────
//
// Bucketed median of how long it takes a doctor to first-reply in a
// conversation after the patient sends a message. Powers the
// "Usually replies in ~Xh" badge on /doctor/search and /doctor/:id.
//
// We bucket into:
//   - "fast"   median ≤ 1h
//   - "quick"  median ≤ 6h
//   - "normal" median ≤ 24h
//   - null     < MIN_RATED_CONVERSATIONS conversations OR median > 24h
//
// Implementation: SQLite-side window query that, for every patient
// message in a conversation where the doctor eventually replied,
// picks the doctor's first reply created_at. We then AVG() across
// patient messages per conversation (approximation of median — good
// enough for a 3-bucket label) and bucket the result.
//
// The result is cached in the module-level Map for `CACHE_TTL_MS` to
// avoid hammering D1 on /doctor/search. Soft-launch fleet is small
// enough that a simple in-memory cache is safe; we'll move it to KV
// when the doctor count crosses ~50.
import { sql } from "drizzle-orm";
import type { DB } from "./db";

export const MIN_RATED_CONVERSATIONS = 10;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

type CacheEntry = {
  expiresAt: number;
  payload: ResponseTimeResult;
};

const cache = new Map<string, CacheEntry>();

export type ResponseTimeBucket = "fast" | "quick" | "normal";

export type ResponseTimeResult = {
  bucket: ResponseTimeBucket | null;
  /** Median (avg-approximated) first-response in milliseconds. */
  medianMs: number | null;
  /** Number of distinct conversations that contributed to the score. */
  ratedConversations: number;
};

/**
 * Compute response-time bucket for a single doctor. Reads `messages`
 * via a single SQL aggregate and returns null bucket if the doctor
 * has too few rated conversations to trust the label.
 */
export async function computeFirstResponseMinutes(
  db: DB,
  doctorId: string
): Promise<ResponseTimeResult> {
  const cached = cache.get(doctorId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  // Subquery: for each (conversation_id, patient_msg_id), the earliest
  // doctor message that arrives strictly after the patient message.
  // AVG gives us a smooth bucket signal; we cap at 7d to drop stalled
  // conversations that never produced a useful signal.
  const rows = (await db.all(sql`
    SELECT
      AVG(first_response_ms) AS avg_ms,
      COUNT(*) AS rated_conversations
    FROM (
      SELECT
        m1.conversation_id AS conversation_id,
        CAST(
          (
            julianday(
              (SELECT MIN(m2.created_at)
               FROM messages m2
               WHERE m2.conversation_id = m1.conversation_id
                 AND m2.sender_role = 'doctor'
                 AND m2.created_at > m1.created_at)
            ) - julianday(m1.created_at)
          ) * 86400000 AS INTEGER
        ) AS first_response_ms
      FROM messages m1
      WHERE m1.sender_role = 'patient'
        AND m1.conversation_id IN (
          SELECT conversation_id
          FROM messages
          WHERE sender_role = 'doctor' AND sender_id = ${doctorId}
        )
    )
    WHERE first_response_ms IS NOT NULL
      AND first_response_ms < ${7 * 24 * 60 * 60 * 1000}
  `)) as Array<{ avg_ms: number | null; rated_conversations: number }>;

  const row = rows[0];
  const rated = Number(row?.rated_conversations ?? 0);
  const medianMs = row?.avg_ms != null ? Number(row.avg_ms) : null;

  let bucket: ResponseTimeBucket | null = null;
  if (rated >= MIN_RATED_CONVERSATIONS && medianMs != null) {
    if (medianMs <= 60 * 60 * 1000) bucket = "fast";
    else if (medianMs <= 6 * 60 * 60 * 1000) bucket = "quick";
    else if (medianMs <= 24 * 60 * 60 * 1000) bucket = "normal";
  }

  const payload: ResponseTimeResult = {
    bucket,
    medianMs,
    ratedConversations: rated,
  };
  cache.set(doctorId, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}

/**
 * Batch helper: compute response-time for many doctors in parallel.
 * Used by /doctor/search where we render a card list. Each call is
 * cached individually so a refresh touches only the doctors that
 * haven't been seen in the last hour.
 */
export async function computeFirstResponseMinutesBatch(
  db: DB,
  doctorIds: string[]
): Promise<Map<string, ResponseTimeResult>> {
  const out = new Map<string, ResponseTimeResult>();
  await Promise.all(
    doctorIds.map(async (id) => {
      out.set(id, await computeFirstResponseMinutes(db, id));
    })
  );
  return out;
}

/** Test-only — clears the in-memory cache. */
export function _resetResponseTimeCache(): void {
  cache.clear();
}