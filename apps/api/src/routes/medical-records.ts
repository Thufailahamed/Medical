// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { medicalRecords, files, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { medicalRecordSchema } from "../lib/validators";
import type { AppEnvironment } from "../types";

const medicalRecordsRouter = new Hono<AppEnvironment>();

// ─── Get my records ──────────────────────────────────────
medicalRecordsRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const records = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patient.id))
    .orderBy(desc(medicalRecords.date));

  // Attach file count + first attachment meta per record so the list view
  // can show "1 attachment" without N+1 queries.
  const recordIds = records.map((r: any) => r.id);
  const fileCounts: Record<string, { count: number; first?: any }> = {};
  if (recordIds.length) {
    const allFiles = await db
      .select()
      .from(files)
      .where(eq(files.recordId, recordIds[0]));
    // Drizzle `inArray` would be cleaner — iterate manually to avoid extra import
    for (const f of allFiles as any[]) {
      const bucket = fileCounts[f.recordId] || { count: 0 };
      bucket.count += 1;
      if (!bucket.first) bucket.first = f;
      fileCounts[f.recordId] = bucket;
    }
  }
  const enriched = records.map((r: any) => ({
    ...r,
    attachments: fileCounts[r.id] || { count: 0 },
  }));

  return c.json({ records: enriched });
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

  // Ownership check: patients can only see their own records
  if (userRole === "patient") {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient || patient.id !== record.patientId) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  // Get attached files
  const attachedFiles = await db
    .select()
    .from(files)
    .where(eq(files.recordId, recordId));

  return c.json({ record: { ...record, files: attachedFiles } });
});

// ─── Create record (doctor / hospital staff) ─────────────
medicalRecordsRouter.post("/", authMiddleware, requireRole("doctor", "hospital_staff", "hospital_admin"), async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = medicalRecordSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId: body.patientId,
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

  // Ownership check for patients
  if (userRole === "patient") {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);
    if (!patient || patient.id !== record.patientId) {
      return c.json({ error: "Access denied" }, 403);
    }
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

  if (userRole === "patient") {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient || patient.id !== patientId) {
      return c.json({ error: "Access denied" }, 403);
    }
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

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
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

