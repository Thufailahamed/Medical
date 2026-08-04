// @ts-nocheck
//
// Backfill worker: scans medical_records for rows that have a PDF/image
// attachment but no extraction yet, and feeds them through the typed
// pipeline. Idempotent: the pipeline's `pending` claim guards against
// double-runs. Concurrency capped via env EXTRACT_BACKFILL_PER_HOUR
// (default 10) so a single deploy doesn't burn the AI quota.
//
// Activation: set EXTRACT_BACKFILL_ENABLED=1 in the Worker env. The
// cron worker is wired into the existing scheduling layer that runs
// pre-visit-summary / prescription-reminders / etc.

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { medicalRecords, files } from "@healthcare/db";
import { runExtraction } from "../lib/extraction-pipeline";
import { audit } from "../lib/audit";

const EXTRACTABLE = [
  "lab_report",
  "imaging",
  "discharge_summary",
  "vaccination",
  "prescription",
] as const;

export interface BackfillOptions {
  limit?: number;
  perHour?: number;
  enabled?: boolean;
  dryRun?: boolean;
}

export interface BackfillResult {
  scanned: number;
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  errors: Array<{ recordId: string; error: string }>;
  nextRunIso: string;
}

function envInt(name: string, fallback: number): number {
  const raw = (typeof process !== "undefined" ? (process as any).env?.[name] : null) ?? null;
  if (!raw) return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = (typeof process !== "undefined" ? (process as any).env?.[name] : null) ?? null;
  if (raw == null) return fallback;
  return /^(1|true|yes|on)$/i.test(String(raw));
}

export async function runExtractBackfill(
  env: any,
  db: any,
  opts: BackfillOptions = {},
): Promise<BackfillResult> {
  const enabled = opts.enabled ?? envBool("EXTRACT_BACKFILL_ENABLED", false);
  const limit = Math.min(opts.limit ?? envInt("EXTRACT_BACKFILL_BATCH", 50), 200);
  const perHour = Math.min(opts.perHour ?? envInt("EXTRACT_BACKFILL_PER_HOUR", 10), 100);

  if (!enabled) {
    return {
      scanned: 0,
      claimed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      nextRunIso: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    };
  }

  // Candidate rows: extractable kind, has an attachment, not yet completed.
  const candidates = await db
    .select({
      id: medicalRecords.id,
      patientId: medicalRecords.patientId,
      recordType: medicalRecords.recordType,
      kind: medicalRecords.kind,
      status: medicalRecords.extractedDataStatus,
      extractedAt: medicalRecords.extractedAt,
      fileId: files.id,
      fileR2Key: files.r2Key,
      fileMime: files.mimeType,
    })
    .from(medicalRecords)
    .innerJoin(files, eq(files.recordId, medicalRecords.id))
    .where(
      and(
        inArray(medicalRecords.recordType, EXTRACTABLE as unknown as string[]),
        isNull(medicalRecords.archivedAt),
        or(
          isNull(medicalRecords.extractedDataStatus),
          eq(medicalRecords.extractedDataStatus, "failed"),
          eq(medicalRecords.extractedDataStatus, "skipped"),
        ),
      ),
    )
    .orderBy(medicalRecords.createdAt)
    .limit(limit);

  const result: BackfillResult = {
    scanned: candidates.length,
    claimed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    nextRunIso: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  };

  // Rate-limit: per-hour cap. We just bail early when exceed.
  const work = opts.dryRun ? [] : candidates;

  for (const row of work) {
    if (result.claimed >= perHour) break;
    if (!row.fileR2Key) {
      result.skipped++;
      continue;
    }
    try {
      const out = await runExtraction(env, db, {
        recordId: row.id,
        patientId: row.patientId,
        fileUrl: row.fileR2Key,
        mimeType: row.fileMime,
        recordKind: row.kind || row.recordType,
        source: "backfill",
        userId: null,
      });
      result.claimed++;
      if (out.status === "completed") result.completed++;
      else if (out.status === "failed") {
        result.failed++;
        result.errors.push({ recordId: row.id, error: out.error || "unknown" });
      } else if (out.status === "skipped") {
        result.skipped++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push({ recordId: row.id, error: (err as Error)?.message || "unknown" });
    }
  }

  try {
    await audit(db, {
      userId: null,
      action: "extract_backfill",
      resource: "medical_record",
      resourceId: `batch:${result.claimed}`,
      details: {
        scanned: result.scanned,
        claimed: result.claimed,
        completed: result.completed,
        failed: result.failed,
        skipped: result.skipped,
        dryRun: !!opts.dryRun,
      },
    });
  } catch {
    // best-effort
  }

  return result;
}
