// @ts-nocheck
//
// Phase v3: Unified kind source. Maps a registry `RecordKind` to the
// table(s) that hold it. Used by the canonical hub + portal views so
// legacy tables can stay alive for one release while new writers go
// through `medicalRecords` with `kind` set.

import { and, desc, eq } from "drizzle-orm";
import {
  medicalRecords,
  prescriptions,
  labReports,
  labOrders,
  allergies,
  vitals,
  symptoms,
  patientNotes,
  medicines,
} from "@healthcare/db";
import { type RecordKind } from "@healthcare/shared/records";

interface SourceRow {
  id: string;
  patientId: string;
  date: string | null;
  title: string;
  kind: RecordKind;
  raw: unknown;
}

/**
 * Returns up to `limit` rows of `kind` for `patientId`, sourcing from
 * the unified `medical_records` row when `kind` matches and falling
 * back to the legacy table for kinds that haven't been backfilled yet.
 */
export async function listByKind(
  db: any,
  patientId: string,
  kind: RecordKind,
  limit = 50,
): Promise<SourceRow[]> {
  // 1) unified medical_records
  const unified = await db
    .select()
    .from(medicalRecords)
    .where(and(eq(medicalRecords.patientId, patientId), eq(medicalRecords.kind, kind)))
    .orderBy(desc(medicalRecords.createdAt))
    .limit(limit);
  if (unified.length) {
    return unified.map((r: any) => ({
      id: r.id,
      patientId: r.patientId,
      date: r.date,
      title: r.title,
      kind,
      raw: r,
    }));
  }
  // 2) legacy fallbacks
  switch (kind) {
    case "prescription": {
      const rows = await db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.patientId, patientId))
        .orderBy(desc(prescriptions.date))
        .limit(limit);
      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        date: r.date,
        title: r.diagnosis ?? "Prescription",
        kind,
        raw: r,
      }));
    }
    case "lab_report": {
      const rows = await db
        .select()
        .from(labReports)
        .where(eq(labReports.patientId, patientId))
        .orderBy(desc(labReports.id))
        .limit(limit);
      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        date: r.createdAt ?? null,
        title: r.reportType ?? "Lab report",
        kind,
        raw: r,
      }));
    }
    case "lab_order": {
      const rows = await db
        .select()
        .from(labOrders)
        .where(eq(labOrders.patientId, patientId))
        .orderBy(desc(labOrders.orderedAt))
        .limit(limit);
      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        date: r.orderedAt ?? null,
        title: "Lab order",
        kind,
        raw: r,
      }));
    }
    case "allergy": {
      const rows = await db
        .select()
        .from(allergies)
        .where(eq(allergies.patientId, patientId))
        .orderBy(desc(allergies.onsetDate))
        .limit(limit);
      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        date: r.onsetDate ?? null,
        title: r.substance ?? "Allergy",
        kind,
        raw: r,
      }));
    }
    case "wearable_metric": {
      const rows = await db
        .select()
        .from(vitals)
        .where(eq(vitals.patientId, patientId))
        .orderBy(desc(vitals.recordedAt))
        .limit(limit);
      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        date: r.recordedAt ?? null,
        title: r.type ?? "Vitals reading",
        kind,
        raw: r,
      }));
    }
    case "clinical_note": {
      const rows = await db
        .select()
        .from(patientNotes)
        .where(eq(patientNotes.patientId, patientId))
        .orderBy(desc(patientNotes.createdAt))
        .limit(limit);
      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        date: r.createdAt ?? null,
        title: "Clinical note",
        kind,
        raw: r,
      }));
    }
    case "medication_order": {
      const rows = await db
        .select()
        .from(medicines)
        .where(eq(medicines.patientId, patientId))
        .orderBy(desc(medicines.startDate))
        .limit(limit);
      return rows.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        date: r.startDate ?? null,
        title: r.name ?? "Medicine",
        kind,
        raw: r,
      }));
    }
    default:
      return [];
  }
}

/**
 * Convenience: resolve by record-hash (for dedupe across sources).
 * Looks up by `emailMessageId` first, then by `id`.
 */
export async function findByHash(
  db: any,
  patientId: string,
  hash: string,
): Promise<SourceRow | null> {
  const [byHash] = await db
    .select()
    .from(medicalRecords)
    .where(and(eq(medicalRecords.patientId, patientId), eq(medicalRecords.emailMessageId, hash)))
    .limit(1);
  if (byHash) {
    return {
      id: byHash.id,
      patientId: byHash.patientId,
      date: byHash.date,
      title: byHash.title,
      kind: (byHash.kind ?? byHash.recordType) as RecordKind,
      raw: byHash,
    };
  }
  const [byId] = await db
    .select()
    .from(medicalRecords)
    .where(and(eq(medicalRecords.patientId, patientId), eq(medicalRecords.id, hash)))
    .limit(1);
  if (byId) {
    return {
      id: byId.id,
      patientId: byId.patientId,
      date: byId.date,
      title: byId.title,
      kind: (byId.kind ?? byId.recordType) as RecordKind,
      raw: byId,
    };
  }
  return null;
}