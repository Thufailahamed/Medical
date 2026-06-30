// @ts-nocheck
// Phase 1.4: per-attachment pipeline. Called from inbound.ts after parsing.
// Phase 2.1: when OCR joins, this is the seam where a queue producer goes.

import { eq } from "drizzle-orm";
import { files, medicalRecords } from "@healthcare/db";
import {
  extFromMime,
  r2KeyForEmail,
  sniffFileType,
  uploadBuffer,
} from "../lib/storage";
import { classify, persistClassification } from "../lib/classifier";
import { upsertRecordFts } from "../lib/fts";

// CF imposes a 25MB hard limit per inbound email. Anything beyond is
// dropped pre-parse; we still cap defensively for raw streams.
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type Source = "email-alias" | "email-from" | "email-subject-nic";

export interface ProcessResult {
  received: number;
  skipped: number;
  skippedNames: string[];
}

interface Attach {
  filename?: string;
  mimeType?: string;
  content?: ArrayBuffer | Uint8Array;
  disposition?: string;
}

interface RecipientUser {
  userId: string;
  email: string | null;
  patientId: string;
}

/**
 * Idempotency: SF-style. If `emailMessageId` already produced a record,
 * we skip and return the existing one. The unique index on
 * `medical_records.email_message_id` is the last line of defence —
 * even concurrent dupes from CF retries won't double-insert.
 */
async function recordExists(db: any, emailMessageId: string) {
  const [row] = await db
    .select({ id: medicalRecords.id })
    .from(medicalRecords)
    .where(eq(medicalRecords.emailMessageId, emailMessageId))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Process a single inbound email → patient. Each attachment becomes one
 * medical_record row + one files row. The whole email shares a single
 * `emailMessageId` so retries collapse cleanly.
 *
 * Returns counts the caller uses to compose an ack email.
 */
export async function processInboundEmail(
  env: {
    R2: R2Bucket;
    DB: any;
    AI: any;
    EMAIL_ALIAS_DOMAIN: string;
    CLASSIFY_THRESHOLD?: string;
  },
  user: RecipientUser,
  source: Source,
  emailMessageId: string,
  subject: string,
  attachments: Attach[],
  ctx?: { waitUntil?: (p: Promise<unknown>) => void }
): Promise<ProcessResult> {
  const db = env.DB;
  let received = 0;
  let skipped = 0;
  const skippedNames: string[] = [];

  // Idempotency: a prior invocation of the same event already created
  // a record. Skip silently. CF retries the same message on transient
  // 5xx, so this is the common case for re-runs.
  const existingId = await recordExists(db, emailMessageId);
  if (existingId) {
    return { received: 0, skipped: 0, skippedNames: [] };
  }

  for (const att of attachments) {
    const bytes = att.content;
    if (!bytes || (bytes as ArrayBuffer).byteLength === 0) {
      continue;
    }
    const size = (bytes as ArrayBuffer).byteLength ?? (bytes as Uint8Array).byteLength;
    if (size > MAX_ATTACHMENT_BYTES) {
      skipped++;
      skippedNames.push(att.filename || "attachment");
      continue;
    }

    const mime = att.mimeType || "application/octet-stream";
    const fileType = sniffFileType(mime);
    const ext = extFromMime(mime);
    const fileName = att.filename?.slice(0, 200) || `email-${Date.now()}.${ext}`;
    const r2Key = r2KeyForEmail(user.patientId, ext);

    // 1. Store the binary in R2.
    await uploadBuffer(env.R2, r2Key, bytes as ArrayBuffer, mime);

    // 2. Create the medical_records row. recordType='other' — Phase 2.1
    //    will OCR + classify and upgrade it; user can also manually
    //    classify in the app.
    let record;
    try {
      const [inserted] = await db
        .insert(medicalRecords)
        .values({
          patientId: user.patientId,
          recordType: "other",
          title: subject?.slice(0, 200) || fileName,
          date: new Date().toISOString().slice(0, 10),
          source,
          emailMessageId: `${emailMessageId}:${received}`,
        })
        .returning();
      record = inserted;
      // Phase 2.1: FTS5 sync — inbound email attachments join the search
      // index the moment they hit the medical_records table. The
      // classification waitUntil below re-indexes again when extractedData
      // is upgraded from the initial empty value.
      await upsertRecordFts(db, inserted);
    } catch (err: any) {
      // Unique-index violation on email_message_id means a sibling
      // attachment of the same email was already inserted. Skip this
      // attachment; the sibling succeeded.
      if (typeof err?.message === "string" && err.message.includes("UNIQUE")) {
        await env.R2.delete(r2Key).catch(() => {});
        continue;
      }
      // Anything else: roll back the R2 upload, rethrow.
      await env.R2.delete(r2Key).catch(() => {});
      throw err;
    }

    // 3. Link the file to the new record.
    await db.insert(files).values({
      recordId: record.id,
      url: r2Key,
      r2Key,
      type: fileType,
      fileName,
      fileSize: size,
      mimeType: mime,
    });

    // Phase 2.1: auto-classify text-extractable PDFs (D12 — skip binary
    // images, vision model arrives in 2.2). Fire-and-forget so the ack
    // reply isn't blocked on AI inference. CF Email Workers expose a
    // `ctx.waitUntil` — when present, use it; otherwise rely on the
    // handler's Promise to keep the isolate alive.
    if (mime === "application/pdf") {
      const classifyPromise = (async () => {
        try {
          const threshold = parseFloat(env.CLASSIFY_THRESHOLD || "0.6");
          const result = await classify(
            { AI: env.AI, R2: env.R2, DB: env.DB },
            {
              fileUrl: r2Key,
              recordId: record.id,
              source: "email-import",
              userId: user.userId,
              threshold,
            }
          );
          await persistClassification(env.DB, record.id, result, threshold);
        } catch (err) {
          console.error("[email.process] classify failed:", err);
        }
      })();
      if (ctx?.waitUntil) {
        ctx.waitUntil(classifyPromise);
      }
    }

    received++;
  }

  return { received, skipped, skippedNames };
}
