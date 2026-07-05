// @ts-nocheck
// ─── Phase v3: DSAR (Data Subject Access Request) helpers ─────────────
// Three verbs: export, erasure, rectification.
// `export` is self-service; `erasure` requires admin approval (and 7-day
// grace); `rectification` writes a request that staff must action.
//
// Each verb creates a `dsar_requests` row, transitions through states,
// and writes audit rows. The route handler at `routes/dsar.ts` is the
// public entry; this module is the data layer.

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  dsarRequests,
  patients,
  users,
  medicalRecords,
  familyMembers,
  allergies,
  vitals,
  symptoms,
  patientNotes,
  appointments,
  prescriptions,
  insurance,
  shareLinks,
  shareLinkViews,
  consentGrants,
  auditLogs,
  qrAccessTokens,
  files,
  medicines,
  labReports,
  labOrders,
  recordRevisions,
  fileDownloadTokens,
  careTeamMembers,
  hospitalPatients,
  clinicPatients,
  hospitalStaff,
  documentDicomMetadata,
} from "@healthcare/db";

function genId(): string {
  const c = crypto as unknown as { randomUUID?: () => string };
  return c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

export type DsarPurpose = "export" | "erasure" | "rectification";
export type DsarStatus =
  | "queued"
  | "approved"
  | "processing"
  | "completed"
  | "cancelled"
  | "failed";

// ─── request creation ─────────────────────────────────────────

export interface CreateDsarInput {
  userId: string;
  purpose: DsarPurpose;
  notes?: string;
  fields?: Array<{ recordId: string; field: string; proposedValue: string }>;
  db: any;
}

export async function createDsarRequest(input: CreateDsarInput) {
  const id = genId();
  const status: DsarStatus = input.purpose === "export" ? "approved" : "queued";
  await input.db.insert(dsarRequests).values({
    id,
    userId: input.userId,
    purpose: input.purpose,
    status,
    notes: input.notes ?? null,
    requestedAt: nowIso(),
    approvedAt: input.purpose === "export" ? nowIso() : null,
  });
  return { id, status };
}

// ─── export ────────────────────────────────────────────────────

/**
 * Bundle every piece of data we hold about `userId` into a JSON
 * document. Caller is responsible for serialising + uploading to R2 +
 * returning a signed URL.
 */
export async function exportPatient(db: any, userId: string) {
  const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  const patientId = patient?.id;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const family = patientId
    ? await db.select().from(familyMembers).where(eq(familyMembers.patientId, patientId))
    : [];

  const allergies_ = patientId
    ? await db.select().from(allergies).where(eq(allergies.patientId, patientId))
    : [];
  const vitals_ = patientId
    ? await db.select().from(vitals).where(eq(vitals.patientId, patientId))
    : [];
  const symptoms_ = patientId
    ? await db.select().from(symptoms).where(eq(symptoms.patientId, patientId))
    : [];
  const notes_ = patientId
    ? await db.select().from(patientNotes).where(eq(patientNotes.patientId, patientId))
    : [];
  const records = patientId
    ? await db.select().from(medicalRecords).where(eq(medicalRecords.patientId, patientId))
    : [];
  const appts = patientId
    ? await db.select().from(appointments).where(eq(appointments.patientId, patientId))
    : [];
  const rx = patientId
    ? await db.select().from(prescriptions).where(eq(prescriptions.patientId, patientId))
    : [];
  const ins = patientId
    ? await db.select().from(insurance).where(eq(insurance.patientId, patientId))
    : [];
  const meds = patientId
    ? await db.select().from(medicines).where(eq(medicines.patientId, patientId))
    : [];
  const labs = patientId
    ? await db.select().from(labReports).where(eq(labReports.patientId, patientId))
    : [];
  const orders = patientId
    ? await db.select().from(labOrders).where(eq(labOrders.patientId, patientId))
    : [];
  const vaccs = records.filter((r: any) => r.kind === "vaccination" || r.recordType === "vaccination");
  const consents = patientId
    ? await db.select().from(consentGrants).where(eq(consentGrants.patientId, patientId))
    : [];
  const qrs = patientId
    ? await db.select().from(qrAccessTokens).where(eq(qrAccessTokens.patientId, patientId))
    : [];
  const care = patientId
    ? await db.select().from(careTeamMembers).where(eq(careTeamMembers.patientId, patientId))
    : [];
  const hospitalLinks = patientId
    ? await db.select().from(hospitalPatients).where(eq(hospitalPatients.patientId, patientId))
    : [];
  const clinicLinks = patientId
    ? await db.select().from(clinicPatients).where(eq(clinicPatients.patientId, patientId))
    : [];
  const fileRows = records.length
    ? await db.select().from(files).where(inArray(files.recordId, records.map((r: any) => r.id)))
    : [];
  const emergency_ = patient?.emergencyContacts ? JSON.parse(patient.emergencyContacts) : [];
  const shares = patientId
    ? await db.select().from(shareLinks).where(eq(shareLinks.patientId, patientId))
    : [];
  const shareViews = shares.length
    ? await db
        .select()
        .from(shareLinkViews)
        .where(inArray(shareLinkViews.linkId, shares.map((s: any) => s.id)))
    : [];
  const audit = userId
    ? await db.select().from(auditLogs).where(eq(auditLogs.userId, userId))
    : [];
  const revisions = records.length
    ? await db
        .select()
        .from(recordRevisions)
        .where(inArray(recordRevisions.recordId, records.map((r: any) => r.id)))
    : [];

  return {
    schemaVersion: "healthhub.export.v3",
    requestedAt: nowIso(),
    user: scrubUserForExport(user),
    patient: scrubPatientForExport(patient),
    familyMembers: family,
    allergies: allergies_,
    vitals: vitals_,
    symptoms: symptoms_,
    patientNotes: notes_,
    medicalRecords: records,
    recordRevisions: revisions,
    files: fileRows,
    appointments: appts,
    prescriptions: rx,
    insurance: ins,
    medicines: meds,
    labReports: labs,
    labOrders: orders,
    vaccinations: vaccs,
    emergencyContacts: emergency_,
    shareLinks: shares,
    shareLinkViews: shareViews,
    consentGrants: consents,
    qrAccessTokens: qrs,
    careTeam: care,
    hospitalLinks,
    clinicLinks,
    auditLog: audit,
  };
}

function scrubUserForExport(u: any) {
  if (!u) return null;
  const { passwordHash: _ph, otpHash: _oh, otpSecret: _os, otpAttempts: _oa, ...safe } = u;
  return safe;
}

function scrubPatientForExport(p: any) {
  if (!p) return null;
  // Tombstone-able columns are returned as-is in the export so the
  // user can verify the data we held about them.
  return p;
}

// ─── erasure ────────────────────────────────────────────────────

export interface ErasureResult {
  patientId: string;
  tombstonedAt: string;
  tombstonedFields: string[];
  familyPreserved: number;
  recordsPreserved: number;
}

export async function anonymisePatient(db: any, userId: string): Promise<ErasureResult> {
  const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  if (!patient) throw new Error("Patient not found");
  const ts = nowIso();

  await db
    .update(patients)
    .set({
      fullName: "[erased]",
      phone: null,
      nic: null,
      dateOfBirth: null,
      bloodGroup: null,
      allergies: null,
      medicalConditions: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
    })
    .where(eq(patients.id, patient.id));

  await db
    .update(users)
    .set({ email: null, phone: null, fullName: "[erased]" })
    .where(eq(users.id, userId));

  // Family members, records, and shared-by links are preserved as
  // tombstones so referential integrity remains. Records keep their
  // encrypted_payload + envelope so existing recipients retain read
  // access (they consented against this identifier).
  const familyCount = (
    await db.select().from(familyMembers).where(eq(familyMembers.patientId, patient.id))
  ).length;
  const recordCount = (
    await db.select().from(medicalRecords).where(eq(medicalRecords.patientId, patient.id))
  ).length;

  return {
    patientId: patient.id,
    tombstonedAt: ts,
    tombstonedFields: ["fullName", "phone", "nic", "dateOfBirth", "bloodGroup", "allergies", "medicalConditions"],
    familyPreserved: familyCount,
    recordsPreserved: recordCount,
  };
}

// ─── rectification ─────────────────────────────────────────────

export interface RectifyInput {
  userId: string;
  fields: Array<{ recordId: string; field: string; proposedValue: string }>;
  notes?: string;
}

export async function requestRectification(db: any, input: RectifyInput) {
  // For now: writes a `patientNotes` row with a structured marker that
  // staff will pick up via the in-app inbox. Real approval workflow is
  // post-v3.
  const id = genId();
  await db.insert(patientNotes).values({
    id,
    patientId: input.userId,
    note: `RECTIFICATION REQUEST: ${JSON.stringify(input.fields)}${
      input.notes ? "\n\nNotes: " + input.notes : ""
    }`,
    createdAt: nowIso(),
  });
  return { id };
}

// ─── rate-limit guard ─────────────────────────────────────────

/**
 * Returns true if `userId` has filed fewer than 5 DSAR requests in the
 * last hour. Rate-limit is applied at the route layer.
 */
export async function underRateLimit(db: any, userId: string, maxPerHour = 5) {
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  const rows = await db
    .select({ id: dsarRequests.id })
    .from(dsarRequests)
    .where(and(eq(dsarRequests.userId, userId), sql`${dsarRequests.requestedAt} > ${cutoff}`));
  return rows.length < maxPerHour;
}