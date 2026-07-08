// @ts-nocheck
// HOS-5: IPD / Admissions routes. Mounted at /hospital-portal/admissions.

import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  admissions,
  admissionNotes,
  bedAssignments,
  beds,
  wards,
  patients,
  users,
  medicalRecords,
  followUps,
  notifications,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  admissionSchema,
  admissionPatchSchema,
  admissionTransferSchema,
  dischargeSchema,
  admissionNoteSchema,
} from "@healthcare/shared";
import type { AppEnvironment } from "../types";
import { notify } from "../lib/notifications";
import { flattenTranslated } from "../lib/validation-error";
import { writeAudit } from "../lib/audit";

const admissionsRouter = new Hono<AppEnvironment>();

admissionsRouter.use(
  "*",
  authMiddleware,
  requireRole("hospital_admin", "hospital_staff", "doctor", "super_admin")
);

async function resolveScopeId(c: any): Promise<string | null> {
  const db = c.get("db");
  const userId = c.get("userId");
  const headerId = c.req.header("x-active-hospital-id") || null;
  const middlewareId = c.get("activeHospitalId") || null;

  const id = headerId || middlewareId;
  if (id) return id;

  // Fallback: any hospital the caller has access to.
  if (c.get("userRole") === "super_admin") {
    const [h] = await db.select().from((await import("@healthcare/db")).hospitals).limit(1);
    return h?.id ?? null;
  }
  const { hospitals } = await import("@healthcare/db");
  const [h] = await db.select().from(hospitals).where(eq(hospitals.userId, userId)).limit(1);
  return h?.id ?? null;
}

// GET /hospital-portal/admissions
admissionsRouter.get("/", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ admissions: [] });

  const status = c.req.query("status") || null;
  const patientId = c.req.query("patientId") || null;

  const whereParts: any[] = [eq(admissions.hospitalId, scopeId)];
  if (status) whereParts.push(eq(admissions.status, status));
  if (patientId) whereParts.push(eq(admissions.patientId, patientId));

  const rows = await db
    .select({
      id: admissions.id,
      patientId: admissions.patientId,
      patientName: users.name,
      wardId: admissions.wardId,
      wardName: wards.name,
      bedId: admissions.bedId,
      bedNumber: beds.bedNumber,
      admissionType: admissions.admissionType,
      status: admissions.status,
      reason: admissions.reason,
      diagnosisAtAdmission: admissions.diagnosisAtAdmission,
      admittedAt: admissions.admittedAt,
      dischargedAt: admissions.dischargedAt,
    })
    .from(admissions)
    .innerJoin(patients, eq(patients.id, admissions.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .leftJoin(wards, eq(wards.id, admissions.wardId))
    .leftJoin(beds, eq(beds.id, admissions.bedId))
    .where(and(...whereParts))
    .orderBy(desc(admissions.admittedAt));

  return c.json({ admissions: rows });
});

// GET /hospital-portal/admissions/:id
admissionsRouter.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(admissions)
    .where(eq(admissions.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Admission not found" }, 404);

  const [patient] = await db
    .select({ id: patients.id, name: users.name, phone: users.phone })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, row.patientId))
    .limit(1);

  const notes = await db
    .select()
    .from(admissionNotes)
    .where(eq(admissionNotes.admissionId, id))
    .orderBy(desc(admissionNotes.recordedAt));

  return c.json({ admission: row, patient, notes });
});

// POST /hospital-portal/admissions
admissionsRouter.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = admissionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ error: "No active hospital" }, 400);

  const [created] = await db
    .insert(admissions)
    .values({
      hospitalId: scopeId,
      patientId: parsed.data.patientId,
      admittedByUserId: userId,
      admittingDoctorId: parsed.data.admittingDoctorId ?? null,
      admissionType: parsed.data.admissionType ?? "planned",
      wardId: parsed.data.wardId ?? null,
      bedId: parsed.data.bedId ?? null,
      reason: parsed.data.reason ?? null,
      diagnosisAtAdmission: parsed.data.diagnosisAtAdmission ?? null,
      status: "admitted",
    })
    .returning();

  // Mark bed occupied if assigned.
  if (parsed.data.bedId) {
    await db.update(beds).set({ status: "occupied" }).where(eq(beds.id, parsed.data.bedId));
    await db.insert(bedAssignments).values({
      bedId: parsed.data.bedId,
      patientId: parsed.data.patientId,
      assignedByUserId: userId,
    });
  }

  // Auto-emit a medical_record row so the mobile app sees the visit.
  await db.insert(medicalRecords).values({
    patientId: parsed.data.patientId,
    authorUserId: userId,
    recordType: "hospital_visit",
    title: `Admitted to ${parsed.data.reason ?? "inpatient"}`,
    body: parsed.data.diagnosisAtAdmission ?? null,
    date: new Date().toISOString(),
    hospitalId: scopeId,
  });

  await notify(db, parsed.data.patientId, "admission_created", {
    admissionId: created.id,
    reason: parsed.data.reason ?? "Admitted",
  });
  await writeAudit(db, userId, "admission.create", { id: created.id });

  return c.json({ admission: created }, 201);
});

// PATCH /hospital-portal/admissions/:id
admissionsRouter.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = admissionPatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  await db
    .update(admissions)
    .set({
      admittingDoctorId: parsed.data.admittingDoctorId ?? null,
      wardId: parsed.data.wardId ?? null,
      bedId: parsed.data.bedId ?? null,
      diagnosisAtAdmission: parsed.data.diagnosisAtAdmission ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(admissions.id, id));
  return c.json({ ok: true });
});

// POST /hospital-portal/admissions/:id/transfer
admissionsRouter.post("/:id/transfer", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = admissionTransferSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  const [row] = await db.select().from(admissions).where(eq(admissions.id, id)).limit(1);
  if (!row) return c.json({ error: "Admission not found" }, 404);

  // Close prior assignment + free prior bed.
  if (row.bedId) {
    await db.update(bedAssignments).set({ dischargedAt: new Date().toISOString() }).where(and(eq(bedAssignments.bedId, row.bedId), isNull(bedAssignments.dischargedAt)));
    await db.update(beds).set({ status: "cleaning" }).where(eq(beds.id, row.bedId));
  }

  if (parsed.data.bedId) {
    await db.update(beds).set({ status: "occupied" }).where(eq(beds.id, parsed.data.bedId));
    await db.insert(bedAssignments).values({
      bedId: parsed.data.bedId,
      patientId: row.patientId,
      assignedByUserId: userId,
    });
  }

  await db
    .update(admissions)
    .set({
      wardId: parsed.data.wardId ?? null,
      bedId: parsed.data.bedId ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(admissions.id, id));

  await writeAudit(db, userId, "admission.transfer", { id, to: parsed.data.bedId });
  return c.json({ ok: true });
});

// POST /hospital-portal/admissions/:id/discharge
admissionsRouter.post("/:id/discharge", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = dischargeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  const [row] = await db.select().from(admissions).where(eq(admissions.id, id)).limit(1);
  if (!row) return c.json({ error: "Admission not found" }, 404);

  const now = new Date().toISOString();
  await db
    .update(admissions)
    .set({
      status: "discharged",
      dischargedAt: now,
      dischargedByUserId: userId,
      dischargeDiagnosis: parsed.data.dischargeDiagnosis ?? null,
      dischargeCondition: parsed.data.dischargeCondition ?? null,
      dischargeInstructions: parsed.data.dischargeInstructions ?? null,
      followUpDate: parsed.data.followUpDate ?? null,
      updatedAt: now,
    })
    .where(eq(admissions.id, id));

  // Free the bed.
  if (row.bedId) {
    await db.update(bedAssignments).set({ dischargedAt: now }).where(and(eq(bedAssignments.bedId, row.bedId), isNull(bedAssignments.dischargedAt)));
    await db.update(beds).set({ status: "cleaning" }).where(eq(beds.id, row.bedId));
  }

  // Discharge summary as a medical_record.
  await db.insert(medicalRecords).values({
    patientId: row.patientId,
    authorUserId: userId,
    recordType: "discharge_summary",
    title: "Discharge summary",
    body: parsed.data.dischargeInstructions ?? parsed.data.dischargeDiagnosis ?? null,
    date: now,
    hospitalId: row.hospitalId,
  });

  if (parsed.data.followUpDate) {
    await db.insert(followUps).values({
      patientId: row.patientId,
      doctorId: row.admittingDoctorId,
      date: parsed.data.followUpDate,
      reason: "Post-discharge follow-up",
      status: "scheduled",
    });
  }

  await notify(db, row.patientId, "admission_discharged", { admissionId: id });
  await writeAudit(db, userId, "admission.discharge", { id });

  return c.json({ ok: true });
});

// POST /hospital-portal/admissions/:id/notes
admissionsRouter.post("/:id/notes", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = admissionNoteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  const [created] = await db
    .insert(admissionNotes)
    .values({
      admissionId: id,
      authorUserId: userId,
      kind: parsed.data.kind,
      body: parsed.data.body,
    })
    .returning();
  return c.json({ note: created }, 201);
});

export default admissionsRouter;