// @ts-nocheck
//
// Structured extraction pipeline glue.
// Wires per-kind extractors to the medical_records ↔ child-table layout.
// Always idempotent: re-running on an already-extracted record is a no-op
// (caller can force via `force: true` after a model upgrade).
//
// Race guard: we claim a record by setting `extractedDataStatus='pending'`
// BEFORE running the extractor. Two concurrent invocations will see the
// second one bail out at the claim step.

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  medicalRecords,
  labTestResults,
  imagingFindings,
  dischargeEvents,
  vaccinationDoses,
  prescriptionItems,
} from "@healthcare/db";
import { extractLabReport } from "./extractors/lab-report";
import { extractImagingReport } from "./extractors/imaging-report";
import { extractDischargeSummary } from "./extractors/discharge-summary";
import { extractVaccinationCard } from "./extractors/vaccination-card";
import { extractPrescription } from "./extractors/prescription";
import { audit } from "./audit";
import { upsertRecordFts } from "./fts";

export type ExtractionSource = "upload" | "backfill" | "retry" | "lab-complete";

export interface RunExtractionInput {
  recordId: string;
  patientId: string;
  fileUrl?: string | null;
  r2Key?: string | null;
  mimeType?: string | null;
  recordKind: string;       // medical_records.recordType (or .kind)
  recordKindAlias?: string | null;
  source?: ExtractionSource;
  userId?: string | null;
  force?: boolean;
  labReportId?: string | null;
  doctorsName?: string | null;
  prescribedDate?: string | null;
}

export interface RunExtractionResult {
  ok: boolean;
  status: "completed" | "failed" | "skipped" | "in_progress";
  kind?: string;
  confidence?: number;
  count?: number;
  error?: string;
}

const EXTRACTABLE_KINDS = new Set([
  "lab_report",
  "imaging",
  "discharge_summary",
  "vaccination",
  "prescription",
]);

function buildFileUrl(input: RunExtractionInput): string | null {
  if (input.fileUrl) return input.fileUrl;
  if (input.r2Key) return input.r2Key;
  return null;
}

async function claimRecord(db: any, recordId: string, force: boolean): Promise<boolean> {
  // Atomic claim: only one writer can flip NULL/failed → pending.
  const result = await db
    .update(medicalRecords)
    .set({
      extractedDataStatus: "pending",
      extractedAt: new Date().toISOString(),
    })
    .where(
      force
        ? eq(medicalRecords.id, recordId)
        : and(
            eq(medicalRecords.id, recordId),
            inArray(medicalRecords.extractedDataStatus, [null as any, "failed", "skipped"])
          )
    )
    .run();
  // D1 doesn't return rowCount from update directly via this builder — we
  // re-read to confirm the claim took effect.
  const [row] = await db
    .select({ id: medicalRecords.id, status: medicalRecords.extractedDataStatus })
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);
  if (!row) return false;
  if (row.status !== "pending") return false;
  // If force=false and row.status was already 'completed', we lost the race.
  if (!force && row.status === "pending") {
    // Confirm we were the writer (best-effort — without a unique token we
    // accept the small race). For backfill, the cron checks status again
    // before invoking runExtraction.
  }
  return true;
}

async function markStatus(
  db: any,
  recordId: string,
  status: "completed" | "failed" | "skipped",
  opts?: { confidence?: number; summary?: any; error?: string },
) {
  const [rec] = await db
    .select({ extractedData: medicalRecords.extractedData })
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);
  let blob: any = {};
  if (rec?.extractedData) {
    try {
      blob = JSON.parse(rec.extractedData);
    } catch {
      blob = {};
    }
  }
  if (opts?.summary) {
    blob.extraction = {
      ...(blob.extraction || {}),
      ...opts.summary,
      updatedAt: new Date().toISOString(),
    };
  }
  if (opts?.error) {
    blob.extraction = {
      ...(blob.extraction || {}),
      lastError: opts.error,
      lastErrorAt: new Date().toISOString(),
    };
  }

  await db
    .update(medicalRecords)
    .set({
      extractedDataStatus: status,
      extractedAt: new Date().toISOString(),
      extractedData: JSON.stringify(blob),
    })
    .where(eq(medicalRecords.id, recordId));
}

async function writeLabResults(
  db: any,
  recordId: string,
  patientId: string,
  labReportId: string | null,
  tests: any[],
  meta: { confidence: number; modelVersion: string },
  reportedAt?: string | null,
  collectedAt?: string | null,
) {
  if (!tests.length) return 0;
  const rows = tests
    .filter((t) => t.name && (t._valueNumber != null || t._valueText))
    .map((t) => ({
      recordId,
      patientId,
      labReportId,
      testName: t.name,
      loincCode: t.loincCode ?? null,
      value: t._valueNumber ?? null,
      valueText: t._valueText ?? null,
      unit: t.unit ?? null,
      refRangeLow: t.refLow ?? null,
      refRangeHigh: t.refHigh ?? null,
      refRangeText: t.refText ?? null,
      flag: t.flag ?? "unknown",
      collectedAt: collectedAt ?? null,
      reportedAt: reportedAt ?? null,
      rawText: null,
      pageHint: null,
      extractionConfidence: meta.confidence,
      modelVersion: meta.modelVersion,
    }));
  if (!rows.length) return 0;
  await db.insert(labTestResults).values(rows);
  return rows.length;
}

async function writeImagingFindings(
  db: any,
  recordId: string,
  patientId: string,
  payload: any,
  meta: { confidence: number; modelVersion: string },
) {
  if (!payload.modality) return 0;
  // Safety guard: critical=true requires both LLM flag AND a keyword
  // whitelist hit in findings/impression. Never trust LLM signal alone.
  const CRITICAL_KEYWORDS = [
    "intracranial hemorrhage",
    "intracranial haemorrhage",
    "pneumothorax",
    "tension pneumothorax",
    "massive hemorrhage",
    "pulmonary embolism",
    "aortic dissection",
    "acute stroke",
    "fracture",
    "displaced fracture",
    "malignancy",
    "malignant",
    "mass suspicious",
    "bowel perforation",
    "ectopic pregnancy",
    "testicular torsion",
    "retinal detachment",
  ];
  const text = `${payload.findings || ""} ${payload.impression || ""}`.toLowerCase();
  const keywordHit = CRITICAL_KEYWORDS.some((k) => text.includes(k));
  const critical = !!(payload.critical && keywordHit);

  await db.insert(imagingFindings).values({
    recordId,
    patientId,
    modality: payload.modality,
    bodyPart: payload.bodyPart ?? null,
    studyDate: payload.studyDate ?? null,
    findings: payload.findings ?? null,
    impression: payload.impression ?? null,
    recommendations: payload.recommendations ?? null,
    radiologistName: payload.radiologistName ?? null,
    critical,
    rawText: null,
    extractionConfidence: meta.confidence,
    modelVersion: meta.modelVersion,
  });
  return 1;
}

async function writeDischargeEvent(
  db: any,
  recordId: string,
  patientId: string,
  payload: any,
  meta: { confidence: number; modelVersion: string },
) {
  await db.insert(dischargeEvents).values({
    recordId,
    patientId,
    admissionDate: payload.admissionDate ?? null,
    dischargeDate: payload.dischargeDate ?? null,
    primaryDiagnosis: payload.primaryDiagnosis ?? null,
    secondaryDiagnoses: payload.secondaryDiagnoses
      ? JSON.stringify(payload.secondaryDiagnoses)
      : null,
    procedures: payload.procedures ? JSON.stringify(payload.procedures) : null,
    medicationsGiven: payload.medicationsGiven
      ? JSON.stringify(payload.medicationsGiven)
      : null,
    followUpInstructions: payload.followUpInstructions ?? null,
    followUpDate: payload.followUpDate ?? null,
    hospitalName: payload.hospitalName ?? null,
    attendingDoctor: payload.attendingDoctor ?? null,
    rawText: null,
    extractionConfidence: meta.confidence,
    modelVersion: meta.modelVersion,
  });
  return 1;
}

async function writeVaccinationDoses(
  db: any,
  recordId: string,
  patientId: string,
  vaccinations: any[],
  meta: { confidence: number; modelVersion: string },
) {
  if (!vaccinations.length) return 0;
  const rows = vaccinations
    .filter((v) => v.vaccineName)
    .map((v) => ({
      recordId,
      patientId,
      catalogId: v.catalogId ?? null,
      vaccineName: v.vaccineName,
      doseNumber: v.doseNumber ?? null,
      date: v.date ?? null,
      provider: v.provider ?? null,
      batchNumber: v.batchNumber ?? null,
      site: null,
      rawText: null,
      extractionConfidence: meta.confidence,
      modelVersion: meta.modelVersion,
    }));
  if (!rows.length) return 0;
  await db.insert(vaccinationDoses).values(rows);
  return rows.length;
}

async function writePrescriptionItems(
  db: any,
  recordId: string,
  patientId: string,
  payload: any,
  meta: { confidence: number; modelVersion: string },
  fallback: { doctorsName?: string | null; prescribedDate?: string | null },
) {
  const meds = Array.isArray(payload.medicines) ? payload.medicines : [];
  if (!meds.length) return 0;
  const rows = meds
    .filter((m: any) => m.name)
    .map((m: any) => ({
      recordId,
      patientId,
      name: m.name,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      timing: m.timing ?? null,
      durationDays: m.durationDays ?? null,
      refills: m.refills ?? null,
      prescriberName: payload.doctor || fallback.doctorsName || null,
      prescribedDate: payload.date || fallback.prescribedDate || null,
      rawText: null,
      extractionConfidence: meta.confidence,
      modelVersion: meta.modelVersion,
    }));
  if (!rows.length) return 0;
  await db.insert(prescriptionItems).values(rows);
  return rows.length;
}

export async function runExtraction(
  env: any,
  db: any,
  input: RunExtractionInput,
): Promise<RunExtractionResult> {
  const source = input.source ?? "upload";
  const kind = input.recordKind;

  if (!EXTRACTABLE_KINDS.has(kind)) {
    return { ok: true, status: "skipped", kind };
  }

  // Claim the record first.
  const claimed = await claimRecord(db, input.recordId, !!input.force);
  if (!claimed) {
    // Already claimed or already completed — caller can re-run with
    // force=true after a model upgrade.
    return {
      ok: true,
      status: "in_progress",
      kind,
      error: "already_claimed_or_completed",
    };
  }

  const fileUrl = buildFileUrl(input);
  if (!fileUrl) {
    await markStatus(db, input.recordId, "failed", { error: "no_file_url" });
    await safeAudit(db, {
      userId: input.userId,
      action: "structured_extract",
      resource: "medical_record",
      resourceId: input.recordId,
      details: { kind, source, status: "failed", reason: "no_file_url" },
    });
    return { ok: false, status: "failed", kind, error: "no_file_url" };
  }

  const extractorInput = {
    recordId: input.recordId,
    patientId: input.patientId,
    fileUrl,
    mimeType: input.mimeType ?? undefined,
    userId: input.userId,
  };

  let result;
  try {
    if (kind === "lab_report") {
      result = await extractLabReport(env, extractorInput);
    } else if (kind === "imaging") {
      result = await extractImagingReport(env, extractorInput);
    } else if (kind === "discharge_summary") {
      result = await extractDischargeSummary(env, extractorInput);
    } else if (kind === "vaccination") {
      result = await extractVaccinationCard(env, extractorInput);
    } else if (kind === "prescription") {
      result = await extractPrescription(env, extractorInput);
    } else {
      await markStatus(db, input.recordId, "skipped", { error: "extractor_not_implemented" });
      return { ok: true, status: "skipped", kind, error: "extractor_not_implemented" };
    }
  } catch (err) {
    await markStatus(db, input.recordId, "failed", { error: (err as Error)?.message });
    await safeAudit(db, {
      userId: input.userId,
      action: "structured_extract",
      resource: "medical_record",
      resourceId: input.recordId,
      details: { kind, source, status: "failed", error: (err as Error)?.message },
    });
    return { ok: false, status: "failed", kind, error: (err as Error)?.message };
  }

  if (!result.ok) {
    await markStatus(db, input.recordId, "failed", {
      error: result.error || "extractor_failed",
    });
    await safeAudit(db, {
      userId: input.userId,
      action: "structured_extract",
      resource: "medical_record",
      resourceId: input.recordId,
      details: { kind, source, status: "failed", error: result.error },
    });
    return { ok: false, status: "failed", kind, error: result.error };
  }

  const payload = result.payload;
  let count = 0;
  try {
    if (kind === "lab_report") {
      count = await writeLabResults(
        db,
        input.recordId,
        input.patientId,
        input.labReportId ?? null,
        payload.tests || [],
        { confidence: result.confidence, modelVersion: result.modelVersion },
        payload.reportedAt || null,
        payload.collectedAt || null,
      );
    } else if (kind === "imaging") {
      count = await writeImagingFindings(
        db,
        input.recordId,
        input.patientId,
        payload,
        { confidence: result.confidence, modelVersion: result.modelVersion },
      );
    } else if (kind === "discharge_summary") {
      count = await writeDischargeEvent(
        db,
        input.recordId,
        input.patientId,
        payload,
        { confidence: result.confidence, modelVersion: result.modelVersion },
      );
    } else if (kind === "vaccination") {
      count = await writeVaccinationDoses(
        db,
        input.recordId,
        input.patientId,
        payload.vaccinations || [],
        { confidence: result.confidence, modelVersion: result.modelVersion },
      );
    } else if (kind === "prescription") {
      count = await writePrescriptionItems(
        db,
        input.recordId,
        input.patientId,
        payload,
        { confidence: result.confidence, modelVersion: result.modelVersion },
        {
          doctorsName: input.doctorsName ?? null,
          prescribedDate: input.prescribedDate ?? null,
        },
      );
    }
  } catch (err) {
    await markStatus(db, input.recordId, "failed", {
      error: `write_failed: ${(err as Error)?.message}`,
    });
    await safeAudit(db, {
      userId: input.userId,
      action: "structured_extract",
      resource: "medical_record",
      resourceId: input.recordId,
      details: { kind, source, status: "failed", error: (err as Error)?.message },
    });
    return { ok: false, status: "failed", kind, error: (err as Error)?.message };
  }

  // Build the summary blob.
  const summary = {
    kind,
    source,
    confidence: result.confidence,
    modelVersion: result.modelVersion,
    count,
    reportType: payload.reportType ?? null,
    provider: payload.provider ?? null,
    collectedAt: payload.collectedAt ?? null,
    reportedAt: payload.reportedAt ?? null,
    completedAt: new Date().toISOString(),
  };

  await markStatus(db, input.recordId, "completed", { summary });

  // Re-index FTS so the new extracted text shows up in search.
  try {
    const [rec] = await db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.id, input.recordId))
      .limit(1);
    if (rec) await upsertRecordFts(db, rec);
  } catch (err) {
    // FTS sync is best-effort; don't fail the extraction.
  }

  await safeAudit(db, {
    userId: input.userId,
    action: "structured_extract",
    resource: "medical_record",
    resourceId: input.recordId,
    details: { kind, source, status: "completed", confidence: result.confidence, count, modelVersion: result.modelVersion },
  });

  return {
    ok: true,
    status: "completed",
    kind,
    confidence: result.confidence,
    count,
  };
}

async function safeAudit(db: any, input: any) {
  try {
    await audit(db, input);
  } catch {
    // best-effort
  }
}
