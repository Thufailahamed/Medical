// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import {
  medicalRecords,
  files,
  patients,
  users,
  doctors,
  hospitals,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { medicalRecordSchema } from "../lib/validators";
import { canAccessPatient } from "../lib/access";
import type { AppEnvironment } from "../types";

const medicalRecordsRouter = new Hono<AppEnvironment>();

// ─── Ownership helper ────────────────────────────────────
// Returns the patient row for the current patient user, or null if the
// caller is not a patient or has no patient row.
async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// Returns the doctor row for the current doctor user, or null.
async function getOwnDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d || null;
}

// ─── Get my records (with pagination) ────────────────────
// GET /medical-records/me?limit=50&offset=0&type=lab_report
medicalRecordsRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const patient = await getOwnPatient(db, userId);
  if (!patient) {
    return c.json({ error: "Patient profile not found" }, 404);
  }

  // Pagination — default 50, max 200.
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  const typeFilter = c.req.query("type");

  const whereParts: any[] = [eq(medicalRecords.patientId, patient.id)];
  if (typeFilter) whereParts.push(eq(medicalRecords.recordType, typeFilter as any));

  const records = await db
    .select()
    .from(medicalRecords)
    .where(and(...whereParts))
    .orderBy(desc(medicalRecords.date), desc(medicalRecords.createdAt))
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(medicalRecords)
    .where(and(...whereParts));
  const total = Number(totalRows[0]?.c ?? 0);

  // Attach file counts + first attachment meta + doctor/hospital names.
  const recordIds = records.map((r: any) => r.id);
  const fileCounts: Record<string, { count: number; first?: any }> = {};
  if (recordIds.length) {
    const allFiles = await db
      .select()
      .from(files)
      .where(inArray(files.recordId, recordIds));
    for (const f of allFiles as any[]) {
      if (!f.recordId) continue;
      const bucket = fileCounts[f.recordId] || { count: 0 };
      bucket.count += 1;
      if (!bucket.first) bucket.first = f;
      fileCounts[f.recordId] = bucket;
    }
  }

  const doctorIds = Array.from(
    new Set(records.map((r: any) => r.doctorId).filter(Boolean))
  ) as string[];
  const hospitalIds = Array.from(
    new Set(records.map((r: any) => r.hospitalId).filter(Boolean))
  ) as string[];

  const doctorMap: Record<string, any> = {};
  if (doctorIds.length) {
    const rows = await db
      .select({ id: doctors.id, userId: doctors.userId, specialization: doctors.specialization })
      .from(doctors)
      .where(inArray(doctors.id, doctorIds));
    const userIds = rows.map((r) => r.userId);
    const userRows = userIds.length
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));
    for (const d of rows) {
      doctorMap[d.id] = {
        id: d.id,
        name: userMap[d.userId]?.name ?? "Doctor",
        specialization: d.specialization,
      };
    }
  }

  const hospitalMap: Record<string, any> = {};
  if (hospitalIds.length) {
    const rows = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .where(inArray(hospitals.id, hospitalIds));
    for (const h of rows) hospitalMap[h.id] = { id: h.id, name: h.name };
  }

  const enriched = records.map((r: any) => ({
    ...r,
    attachments: fileCounts[r.id] || { count: 0 },
    doctor: r.doctorId ? doctorMap[r.doctorId] || null : null,
    hospital: r.hospitalId ? hospitalMap[r.hospitalId] || null : null,
  }));

  return c.json({ records: enriched, total, limit, offset });
});

// ─── Stats for filter chips ───────────────────────────────
// GET /medical-records/me/stats
medicalRecordsRouter.get("/me/stats", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ total: 0, byType: {}, lastDate: null });

  const rows = await db
    .select({
      type: medicalRecords.recordType,
      c: sql<number>`count(*)`,
    })
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patient.id))
    .groupBy(medicalRecords.recordType);

  const byType: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.c);
    byType[r.type] = n;
    total += n;
  }

  const [latest] = await db
    .select({ date: medicalRecords.date })
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patient.id))
    .orderBy(desc(medicalRecords.date))
    .limit(1);

  return c.json({
    total,
    byType,
    lastDate: latest?.date ?? null,
  });
});

// ─── Get single record (with ownership check) ────────────
medicalRecordsRouter.get("/:id", authMiddleware, async (c) => {
  const recordId = c.req.param("id");
  if (!recordId) return c.json({ error: "Missing id" }, 400);
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const [record] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);

  if (!record) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Access check: patient must own it; doctors/staff need a relationship.
  const access = await canAccessPatient(db, userId, userRole, record.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // Get attached files
  const attachedFiles = await db
    .select()
    .from(files)
    .where(eq(files.recordId, recordId));

  // Resolve doctor/hospital names for the detail view.
  let doctor: any = null;
  if (record.doctorId) {
    const [d] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, record.doctorId))
      .limit(1);
    if (d) {
      const [u] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, d.userId))
        .limit(1);
      doctor = {
        id: d.id,
        name: u?.name ?? "Doctor",
        specialization: d.specialization,
      };
    }
  }

  let hospital: any = null;
  if (record.hospitalId) {
    const [h] = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .where(eq(hospitals.id, record.hospitalId))
      .limit(1);
    if (h) hospital = { id: h.id, name: h.name };
  }

  return c.json({
    record: {
      ...record,
      files: attachedFiles,
      doctor,
      hospital,
    },
  });
});

// ─── Create record (doctor / hospital staff) ─────────────
medicalRecordsRouter.post("/", authMiddleware, requireRole("doctor", "hospital_staff", "hospital_admin"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = await c.req.json();
  const parsed = medicalRecordSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const targetPatientId: string | undefined = body.patientId;
  if (!targetPatientId) {
    return c.json({ error: "patientId is required" }, 400);
  }

  // RBAC: doctor/staff must have a relationship with the target patient.
  const access = await canAccessPatient(db, userId, userRole, targetPatientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId: targetPatientId,
      hospitalId: parsed.data.hospitalId,
      doctorId: parsed.data.doctorId,
      recordType: parsed.data.recordType,
      title: parsed.data.title,
      diagnosis: parsed.data.diagnosis,
      summary: parsed.data.summary,
      notes: parsed.data.notes,
      date: parsed.data.date,
      followUpDate: parsed.data.followUpDate,
    })
    .returning();

  return c.json({ record }, 201);
});

// ─── Update record (patient or doctor) ───────────────────
medicalRecordsRouter.patch("/:id", authMiddleware, async (c) => {
  const recordId = c.req.param("id");
  if (!recordId) return c.json({ error: "Missing id" }, 400);
  const db = c.get("db");
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const [record] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);
  if (!record) return c.json({ error: "Record not found" }, 404);

  const access = await canAccessPatient(db, userId, userRole, record.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const partial: Record<string, any> = {};
  if (typeof body.title === "string") partial.title = body.title;
  if (typeof body.diagnosis === "string") partial.diagnosis = body.diagnosis;
  if (typeof body.summary === "string") partial.summary = body.summary;
  if (typeof body.notes === "string") partial.notes = body.notes;
  if (typeof body.date === "string") partial.date = body.date;
  if (typeof body.followUpDate === "string") partial.followUpDate = body.followUpDate;
  if (typeof body.recordType === "string") partial.recordType = body.recordType;

  if (Object.keys(partial).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const [updated] = await db
    .update(medicalRecords)
    .set(partial)
    .where(eq(medicalRecords.id, recordId))
    .returning();

  return c.json({ record: updated });
});

// ─── Delete record (patient or doctor) — cascades files ─
medicalRecordsRouter.delete("/:id", authMiddleware, async (c) => {
  const recordId = c.req.param("id");
  if (!recordId) return c.json({ error: "Missing id" }, 400);
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");
  const env = c.env;

  const [record] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);

  if (!record) return c.json({ error: "Record not found" }, 404);

  // Use shared access helper
  const access = await canAccessPatient(db, userId, userRole, record.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // Delete attachments from R2 + DB
  const attachedFiles = await db
    .select()
    .from(files)
    .where(eq(files.recordId, recordId));
  for (const f of attachedFiles as any[]) {
    if (env?.R2 && f.r2Key) {
      try {
        await env.R2.delete(f.r2Key);
      } catch {
        // best-effort; carry on
      }
    }
  }
  await db.delete(files).where(eq(files.recordId, recordId));
  await db.delete(medicalRecords).where(eq(medicalRecords.id, recordId));

  return c.json({ message: "Record deleted", deletedAttachments: attachedFiles.length });
});

// ─── Timeline view (with ownership check) ────────────────
medicalRecordsRouter.get("/timeline/:patientId", authMiddleware, async (c) => {
  const patientId = c.req.param("patientId");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const records = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patientId))
    .orderBy(desc(medicalRecords.date));

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const timeline: Record<string, Record<string, typeof records>> = {};

  for (const record of records) {
    const date = new Date((record as any).date);
    const year = date.getFullYear().toString();
    const month = MONTH_NAMES[date.getMonth()];

    if (!timeline[year]) timeline[year] = {};
    if (!timeline[year][month]) timeline[year][month] = [];
    timeline[year][month].push(record);
  }

  return c.json({ timeline });
});

// ─── My prescriptions shortcut ───────────────────────────
medicalRecordsRouter.get("/me/prescriptions", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ prescriptions: [] });

  const records = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.patientId, patient.id),
        eq(medicalRecords.recordType, "prescription")
      )
    )
    .orderBy(desc(medicalRecords.date));

  return c.json({ prescriptions: records });
});

export default medicalRecordsRouter;
