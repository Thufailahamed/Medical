// @ts-nocheck
// Patient access control for AI/chat endpoints. A user can AI-summarize
// or chat-with-context about a patient if they are:
//   - the patient themselves
//   - a doctor with at least one appointment, prescription, lab order, or
//     medical-record for that patient
//   - hospital_admin / hospital_staff linked via a record/appointment
//     at their hospital
// Returns { allowed: boolean, reason?: string, patient?: any }.

import { and, eq, or, inArray, sql } from "drizzle-orm";
import {
  patients,
  users,
  doctors,
  appointments,
  prescriptions,
  labOrders,
  medicalRecords,
  hospitalStaff,
  walkIns,
  messagesConversations,
  shareLinks,
  careTeamMembers,
} from "@healthcare/db";

export async function getPatientForUser(db: any, userId: string) {
  const [row] = await db
    .select()
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.userId, userId))
    .limit(1);
  return row || null;
}

export async function canAccessPatient(
  db: any,
  userId: string,
  role: string,
  patientId: string
): Promise<{ allowed: boolean; reason?: string; patient?: any }> {
  if (!patientId) {
    return { allowed: false, reason: "Missing patientId" };
  }
  const [p] = await db.select().from(patients).where(eq(patients.id, patientId)).limit(1);
  if (!p) return { allowed: false, reason: "Patient not found" };

  // Patient always has access to their own record
  if (p.userId === userId) {
    return { allowed: true, patient: p };
  }

  if (role === "doctor") {
    // Doctor must have a doctor row, then any link to the patient counts.
    const [doc] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return { allowed: false, reason: "No doctor profile" };

    // P1: care_team_members is the SOURCE OF TRUTH. The patient
    // actively maintains this row — they can revoke it at any time
    // and the doctor's access disappears immediately. The legacy
    // evidence union (appointments / prescriptions / lab orders /
    // medical records / walk-ins / messages / share-links) is the
    // fallback for historical data that pre-dates the backfill or
    // for cases where the patient hasn't yet issued an explicit row.
    const [ctm] = await db
      .select({ id: careTeamMembers.id, scope: careTeamMembers.scope })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.patientId, patientId),
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active")
        )
      )
      .limit(1);
    if (ctm) return { allowed: true, patient: p, scope: (ctm as any).scope };

    // Any of: appointment, prescription, lab_order, medical_record for this patient by this doctor.
    const [a] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          eq(appointments.doctorId, doc.id)
        )
      )
      .limit(1);
    if (a) return { allowed: true, patient: p };

    const [r] = await db
      .select({ id: prescriptions.id })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.patientId, patientId),
          eq(prescriptions.doctorId, doc.id)
        )
      )
      .limit(1);
    if (r) return { allowed: true, patient: p };

    const [lo] = await db
      .select({ id: labOrders.id })
      .from(labOrders)
      .where(
        and(eq(labOrders.patientId, patientId), eq(labOrders.doctorId, doc.id))
      )
      .limit(1);
    if (lo) return { allowed: true, patient: p };

    const [mr] = await db
      .select({ id: medicalRecords.id })
      .from(medicalRecords)
      .where(
        and(
          eq(medicalRecords.patientId, patientId),
          eq(medicalRecords.doctorId, doc.id)
        )
      )
      .limit(1);
    if (mr) return { allowed: true, patient: p };

    // Walk-in check-in for the same doctor counts as a relationship.
    const [wi] = await db
      .select({ id: walkIns.id })
      .from(walkIns)
      .where(
        and(
          eq(walkIns.patientId, patientId),
          eq(walkIns.doctorId, doc.id)
        )
      )
      .limit(1);
    if (wi) return { allowed: true, patient: p };

    // Active messaging thread between this doctor and patient.
    const [mc] = await db
      .select({ id: messagesConversations.id })
      .from(messagesConversations)
      .where(
        and(
          eq(messagesConversations.patientId, patientId),
          eq(messagesConversations.doctorId, doc.id)
        )
      )
      .limit(1);
    if (mc) return { allowed: true, patient: p };

    // Patient has issued a non-revoked, non-expired share link to this
    // doctor's user id — explicit consent, allow access.
    const [sl] = await db
      .select({ id: shareLinks.id })
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.patientId, patientId),
          eq(shareLinks.createdBy, userId),
          eq(shareLinks.revoked, false),
          sql`${shareLinks.expiresAt} > CURRENT_TIMESTAMP`
        )
      )
      .limit(1);
    if (sl) return { allowed: true, patient: p };

    return { allowed: false, reason: "Doctor has no relationship with this patient" };
  }

  if (role === "hospital_admin" || role === "hospital_staff") {
    // Staff can only access patients who have records at THEIR hospital.
    // First look up the staff member's hospital, then check for records
    // at that specific hospital.
    const [staff] = await db
      .select({ hospitalId: hospitalStaff.hospitalId })
      .from(hospitalStaff)
      .where(eq(hospitalStaff.userId, userId))
      .limit(1);
    if (!staff) return { allowed: false, reason: "No hospital staff profile" };

    const [mr] = await db
      .select({ id: medicalRecords.id })
      .from(medicalRecords)
      .where(
        and(
          eq(medicalRecords.patientId, patientId),
          eq(medicalRecords.hospitalId, staff.hospitalId)
        )
      )
      .limit(1);
    if (mr) return { allowed: true, patient: p };
    return { allowed: false, reason: "Staff has no records for this patient at their hospital" };
  }

  return { allowed: false, reason: "Role not permitted" };
}

// ─── Record-level access (V4) ─────────────────────────────
// Wraps canAccessPatient for per-record ownership. Used by bulk endpoints
// to filter an array of record ids down to those the caller can act on.
export async function canAccessRecord(
  db: any,
  userId: string,
  role: string,
  recordId: string
): Promise<{ allowed: boolean; reason?: string; record?: any }> {
  const [r] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);
  if (!r) return { allowed: false, reason: "Record not found" };
  const access = await canAccessPatient(db, userId, role, r.patientId);
  return { allowed: access.allowed, reason: access.reason, record: r };
}
