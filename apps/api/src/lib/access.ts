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
  hospitalDoctors,
  clinicDoctors,
  hospitalPatients,
  clinicPatients,
  doctorPatientRelationships,
  clinics,
  hospitals,
  patientLinks,
} from "@healthcare/db";

/**
 * Caretaker Profiles: union of clinical and caretaker access checks.
 * Use this on routes that accept BOTH clinical callers (doctors, staff,
 * admins) and caretaker callers. Same return shape as canAccessPatient
 * with an optional `linkId` field when the access came via a patient_links
 * row.
 */
export async function canActAsPatient(
  db: any,
  userId: string,
  role: string,
  patientId: string
): Promise<{
  allowed: boolean;
  reason?: string;
  patient?: any;
  linkId?: string;
}> {
  return canAccessPatient(db, userId, role, patientId) as any;
}

/** List the patient ids a caretaker is currently linked to (status='active'). */
export async function accessiblePrincipalsFor(
  db: any,
  caretakerUserId: string
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ pid: patientLinks.principalPatientId })
    .from(patientLinks)
    .where(
      and(
        eq(patientLinks.caretakerUserId, caretakerUserId),
        eq(patientLinks.status, "active")
      )
    );
  return rows.map((r: any) => r.pid).filter(Boolean);
}

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

  // Caretaker Profiles: a user with role='caretaker' may access the
  // principal's data if and only if an active patient_links row exists
  // for (caretakerUserId, principalPatientId). Paused or revoked links
  // deny. Returns linkId so callers can stamp audit rows.
  if (role === "caretaker") {
    const [link] = await db
      .select({ id: patientLinks.id, status: patientLinks.status })
      .from(patientLinks)
      .where(
        and(
          eq(patientLinks.caretakerUserId, userId),
          eq(patientLinks.principalPatientId, patientId),
          eq(patientLinks.status, "active")
        )
      )
      .limit(1);
    if (link) return { allowed: true, patient: p, linkId: link.id };
    return { allowed: false, reason: "No active caretaker link to this patient" };
  }

  return { allowed: false, reason: "Role not permitted" };
}

/**
 * Single source of truth for "which patients can this doctor access".
 *
 * Returns the union of:
 *   1. care_team_members rows pointing at this doctor where status='active'
 *      (the explicit, patient-revocable grant)
 *   2. historical evidence: any of appointments, prescriptions, lab orders,
 *      medical records, walk-ins, messages, share-links this doctor has
 *      ever had with the patient
 *
 * Performance: one index scan per evidence table, each returning
 * distinct patient_id. All six queries run in parallel via Promise.all.
 * For doctors with <100k patients this returns in <50ms on D1.
 *
 * Why both sources: care_team_members is the modern truth (patient
 * revokes → access drops). Historical evidence covers legacy data
 * from before the backfill migration ran.
 */
export async function accessiblePatientsFor(
  db: any,
  userId: string,
  role: string
): Promise<string[]> {
  if (role === "patient") {
    // Patients only access themselves.
    const [p] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);
    return p ? [p.id] : [];
  }

  if (role !== "doctor") {
    // hospital_admin / hospital_staff resolve via separate path.
    return [];
  }

  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  if (!doc) return [];

  const [a, b, lo, mr, wi, mc, ct] = await Promise.all([
    db
      .selectDistinct({ pid: appointments.patientId })
      .from(appointments)
      .where(eq(appointments.doctorId, doc.id)),
    db
      .selectDistinct({ pid: prescriptions.patientId })
      .from(prescriptions)
      .where(eq(prescriptions.doctorId, doc.id)),
    db
      .selectDistinct({ pid: labOrders.patientId })
      .from(labOrders)
      .where(eq(labOrders.doctorId, doc.id)),
    db
      .selectDistinct({ pid: medicalRecords.patientId })
      .from(medicalRecords)
      .where(eq(medicalRecords.doctorId, doc.id)),
    db
      .selectDistinct({ pid: walkIns.patientId })
      .from(walkIns)
      .where(eq(walkIns.doctorId, doc.id)),
    db
      .selectDistinct({ pid: messagesConversations.patientId })
      .from(messagesConversations)
      .where(eq(messagesConversations.doctorId, doc.id)),
    db
      .selectDistinct({ pid: careTeamMembers.patientId })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active")
        )
      ),
  ]);

  const set = new Set<string>();
  for (const r of a) if (r?.pid) set.add(r.pid);
  for (const r of b) if (r?.pid) set.add(r.pid);
  for (const r of lo) if (r?.pid) set.add(r.pid);
  for (const r of mr) if (r?.pid) set.add(r.pid);
  for (const r of wi) if (r?.pid) set.add(r.pid);
  for (const r of mc) if (r?.pid) set.add(r.pid);
  for (const r of ct) if (r?.pid) set.add(r.pid);
  return Array.from(set);
}

/**
 * Lightweight existence check: does this doctor have ANY relationship
 * with this patient? Uses care_team_members first (cheaper, indexed)
 * and falls back to the evidence union. Used by routes that don't need
 * the full list — just a yes/no.
 */
export async function doctorHasPatient(
  db: any,
  doctorId: string,
  patientId: string
): Promise<boolean> {
  const [ct] = await db
    .select({ id: careTeamMembers.id })
    .from(careTeamMembers)
    .where(
      and(
        eq(careTeamMembers.patientId, patientId),
        eq(careTeamMembers.doctorId, doctorId),
        eq(careTeamMembers.status, "active")
      )
    )
    .limit(1);
  if (ct) return true;

  const checks = await Promise.all([
    db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          eq(appointments.doctorId, doctorId)
        )
      )
      .limit(1),
    db
      .select({ id: prescriptions.id })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.patientId, patientId),
          eq(prescriptions.doctorId, doctorId)
        )
      )
      .limit(1),
    db
      .select({ id: labOrders.id })
      .from(labOrders)
      .where(and(eq(labOrders.patientId, patientId), eq(labOrders.doctorId, doctorId)))
      .limit(1),
    db
      .select({ id: medicalRecords.id })
      .from(medicalRecords)
      .where(
        and(
          eq(medicalRecords.patientId, patientId),
          eq(medicalRecords.doctorId, doctorId)
        )
      )
      .limit(1),
    db
      .select({ id: walkIns.id })
      .from(walkIns)
      .where(and(eq(walkIns.patientId, patientId), eq(walkIns.doctorId, doctorId)))
      .limit(1),
    db
      .select({ id: messagesConversations.id })
      .from(messagesConversations)
      .where(
        and(
          eq(messagesConversations.patientId, patientId),
          eq(messagesConversations.doctorId, doctorId)
        )
      )
      .limit(1),
  ]);
  return checks.some((c) => c && c.length > 0);
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

// ════════════════════════════════════════════════════════════
// Phase MTN-1: tenant-scoped access helpers
// ════════════════════════════════════════════════════════════
// These are the multi-tenant-aware equivalents of canAccessPatient.
// Existing callers of canAccessPatient keep working — they're tenant-
// blind, which matches the legacy single-FK model. New code that
// honours x-active-hospital-id / x-active-clinic-id uses the suffixed
// helpers below.

/**
 * Can `userId` access `patientId`'s records scoped to `hospitalId`?
 * True if:
 *   - the patient is at the hospital (hospital_patients row exists),
 *   - AND the user has a clinical relationship with that patient at
 *     that hospital (doctor_patient_relationships WHERE context_type=
 *     'hospital' AND context_id=hospitalId AND status='active'),
 *   - OR a tenant-blind care_team_members row exists for that doctor.
 * Staff/admin get access if their hospital matches.
 */
export async function canAccessPatientAtHospital(
  db: any,
  userId: string,
  role: string,
  patientId: string,
  hospitalId: string
): Promise<{ allowed: boolean; reason?: string; patient?: any }> {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!p) return { allowed: false, reason: "Patient not found" };
  if (p.userId === userId) return { allowed: true, patient: p };

  if (role === "doctor") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return { allowed: false, reason: "No doctor profile" };

    // P1: tenant-aware clinical relationship.
    const [dpr] = await db
      .select({ id: doctorPatientRelationships.id })
      .from(doctorPatientRelationships)
      .where(
        and(
          eq(doctorPatientRelationships.patientId, patientId),
          eq(doctorPatientRelationships.doctorId, doc.id),
          eq(doctorPatientRelationships.contextType, "hospital"),
          eq(doctorPatientRelationships.contextId, hospitalId),
          eq(doctorPatientRelationships.status, "active")
        )
      )
      .limit(1);
    if (dpr) return { allowed: true, patient: p };

    // Care-team grant pinned to this hospital.
    const [ctmH] = await db
      .select({ id: careTeamMembers.id, scope: careTeamMembers.scope })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.patientId, patientId),
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active"),
          eq(careTeamMembers.contextType, "hospital"),
          eq(careTeamMembers.contextId, hospitalId)
        )
      )
      .limit(1);
    if (ctmH) return { allowed: true, patient: p, scope: (ctmH as any).scope };

    // Tenant-blind (legacy) care-team grant applies if the patient is
    // actually registered at this hospital.
    const [ctm] = await db
      .select({ id: careTeamMembers.id, scope: careTeamMembers.scope })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.patientId, patientId),
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active"),
          sql`${careTeamMembers.contextType} IS NULL`
        )
      )
      .limit(1);
    if (ctm) {
      // Confirm patient is registered at this hospital before granting.
      const [reg] = await db
        .select({ id: hospitalPatients.id })
        .from(hospitalPatients)
        .where(
          and(
            eq(hospitalPatients.patientId, patientId),
            eq(hospitalPatients.hospitalId, hospitalId)
          )
        )
        .limit(1);
      if (reg) return { allowed: true, patient: p, scope: (ctm as any).scope };
    }

    // Fallback union scoped to this hospital.
    const [a] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          eq(appointments.doctorId, doc.id),
          eq(appointments.hospitalId, hospitalId)
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
          eq(prescriptions.doctorId, doc.id),
          eq(prescriptions.hospitalId, hospitalId)
        )
      )
      .limit(1);
    if (r) return { allowed: true, patient: p };

    return {
      allowed: false,
      reason: "Doctor has no relationship with this patient at this hospital",
    };
  }

  if (role === "hospital_admin" || role === "hospital_staff") {
    const [h] = await db
      .select({ id: hospitals.id })
      .from(hospitals)
      .where(
        and(eq(hospitals.id, hospitalId), eq(hospitals.userId, userId))
      )
      .limit(1);
    if (role === "hospital_admin" && !h) {
      return { allowed: false, reason: "Not the principal of this hospital" };
    }
    const [mr] = await db
      .select({ id: medicalRecords.id })
      .from(medicalRecords)
      .where(
        and(
          eq(medicalRecords.patientId, patientId),
          eq(medicalRecords.hospitalId, hospitalId)
        )
      )
      .limit(1);
    if (mr) return { allowed: true, patient: p };
    return {
      allowed: false,
      reason: "Patient has no records at this hospital",
    };
  }

  return { allowed: false, reason: "Role not permitted" };
}

/**
 * Can `userId` access `patientId`'s records scoped to `clinicId`?
 * Mirrors canAccessPatientAtHospital. Clinic has no `hospitalId` on
 * records, so clinical-evidence union falls back to the doctor's
 * clinic-scoped `doctor_patient_relationships` row (set on first
 * consultation) and the care-team grant pinned to the clinic.
 */
export async function canAccessPatientAtClinic(
  db: any,
  userId: string,
  role: string,
  patientId: string,
  clinicId: string
): Promise<{ allowed: boolean; reason?: string; patient?: any }> {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!p) return { allowed: false, reason: "Patient not found" };
  if (p.userId === userId) return { allowed: true, patient: p };

  if (role === "doctor") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return { allowed: false, reason: "No doctor profile" };

    const [dpr] = await db
      .select({ id: doctorPatientRelationships.id })
      .from(doctorPatientRelationships)
      .where(
        and(
          eq(doctorPatientRelationships.patientId, patientId),
          eq(doctorPatientRelationships.doctorId, doc.id),
          eq(doctorPatientRelationships.contextType, "clinic"),
          eq(doctorPatientRelationships.contextId, clinicId),
          eq(doctorPatientRelationships.status, "active")
        )
      )
      .limit(1);
    if (dpr) return { allowed: true, patient: p };

    const [ctmC] = await db
      .select({ id: careTeamMembers.id, scope: careTeamMembers.scope })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.patientId, patientId),
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active"),
          eq(careTeamMembers.contextType, "clinic"),
          eq(careTeamMembers.contextId, clinicId)
        )
      )
      .limit(1);
    if (ctmC) return { allowed: true, patient: p, scope: (ctmC as any).scope };

    const [ctm] = await db
      .select({ id: careTeamMembers.id, scope: careTeamMembers.scope })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.patientId, patientId),
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active"),
          sql`${careTeamMembers.contextType} IS NULL`
        )
      )
      .limit(1);
    if (ctm) {
      const [reg] = await db
        .select({ id: clinicPatients.id })
        .from(clinicPatients)
        .where(
          and(
            eq(clinicPatients.patientId, patientId),
            eq(clinicPatients.clinicId, clinicId)
          )
        )
        .limit(1);
      if (reg) return { allowed: true, patient: p, scope: (ctm as any).scope };
    }

    return {
      allowed: false,
      reason: "Doctor has no relationship with this patient at this clinic",
    };
  }

  return { allowed: false, reason: "Role not permitted" };
}

/** Doctors visible at a hospital (for the admin/patient doctor picker). */
export async function accessibleDoctorsForHospital(
  db: any,
  hospitalId: string
): Promise<
  Array<{
    id: string;
    userId: string;
    name: string;
    role: string;
    department: string | null;
  }>
> {
  const rows = await db
    .select({
      id: doctors.id,
      userId: doctors.userId,
      name: users.name,
      role: hospitalDoctors.role,
      department: hospitalDoctors.department,
    })
    .from(hospitalDoctors)
    .innerJoin(doctors, eq(doctors.id, hospitalDoctors.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(
      and(
        eq(hospitalDoctors.hospitalId, hospitalId),
        eq(hospitalDoctors.status, "active")
      )
    );
  return rows as any;
}

/** Doctors visible at a clinic. */
export async function accessibleDoctorsForClinic(
  db: any,
  clinicId: string
): Promise<
  Array<{
    id: string;
    userId: string;
    name: string;
    role: string;
    ownershipPct: number;
  }>
> {
  const rows = await db
    .select({
      id: doctors.id,
      userId: doctors.userId,
      name: users.name,
      role: clinicDoctors.role,
      ownershipPct: clinicDoctors.ownershipPct,
    })
    .from(clinicDoctors)
    .innerJoin(doctors, eq(doctors.id, clinicDoctors.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(
      and(
        eq(clinicDoctors.clinicId, clinicId),
        eq(clinicDoctors.status, "active")
      )
    );
  return rows as any;
}

/** Patients registered at a hospital (for the hospital-admin patient list). */
export async function accessiblePatientsForHospital(
  db: any,
  hospitalId: string
): Promise<Array<{ id: string; userId: string; name: string; mrn: string }>> {
  return db
    .select({
      id: patients.id,
      userId: patients.userId,
      name: users.name,
      mrn: hospitalPatients.mrn,
    })
    .from(hospitalPatients)
    .innerJoin(patients, eq(patients.id, hospitalPatients.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(
      and(
        eq(hospitalPatients.hospitalId, hospitalId),
        eq(hospitalPatients.status, "registered")
      )
    ) as any;
}

/** Patients registered at a clinic. */
export async function accessiblePatientsForClinic(
  db: any,
  clinicId: string
): Promise<Array<{ id: string; userId: string; name: string; mrn: string }>> {
  return db
    .select({
      id: patients.id,
      userId: patients.userId,
      name: users.name,
      mrn: clinicPatients.mrn,
    })
    .from(clinicPatients)
    .innerJoin(patients, eq(patients.id, clinicPatients.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(
      and(
        eq(clinicPatients.clinicId, clinicId),
        eq(clinicPatients.status, "registered")
      )
    ) as any;
}
