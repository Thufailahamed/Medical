// @ts-nocheck

import { Hono } from "hono";
import { eq, or, like, desc, and } from "drizzle-orm";
import { doctors, patients, users, medicalRecords, appointments, medicines, prescriptions } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const doctorRouter = new Hono<AppEnvironment>();

// ─── Doctor dashboard ────────────────────────────────────
doctorRouter.get("/dashboard", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor profile not found" }, 404);
  }

  const today = new Date().toISOString().split("T")[0];

  const todaysAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctor.doctors.id),
        eq(appointments.date, today)
      )
    )
    .orderBy(appointments.queueNumber);

  const totalPatients = await db
    .select()
    .from(patients)
    .innerJoin(medicalRecords, eq(patients.id, medicalRecords.patientId))
    .where(eq(medicalRecords.doctorId, doctor.doctors.id));

  const uniquePatients = new Set(totalPatients.map((r) => r.patients.id));

  return c.json({
    doctor: doctor.doctors,
    stats: {
      todayAppointments: todaysAppointments.length,
      totalPatients: uniquePatients.size,
    },
    todaysAppointments,
  });
});

// ─── Search patients ─────────────────────────────────────
doctorRouter.get("/search-patients", authMiddleware, requireRole("doctor"), async (c) => {
  const query = c.req.query("q");
  const db = c.get("db");

  if (!query || query.length < 2) {
    return c.json({ patients: [] });
  }

  // Sanitize query to prevent injection
  const safeQuery = query.replace(/[%_]/g, "\\$&");

  const results = await db
    .select()
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(
      or(
        like(users.name, `%${safeQuery}%`),
        like(users.nic, `%${safeQuery}%`),
        like(users.phone, `%${safeQuery}%`)
      )
    )
    .limit(20);

  return c.json({ patients: results });
});

// ─── View patient timeline (doctor must have treated patient) ──
doctorRouter.get("/patient/:patientId/timeline", authMiddleware, requireRole("doctor"), async (c) => {
  const patientId = c.req.param("patientId");
  const userId = c.get("userId");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  // Verify doctor has treated this patient
  const [treated] = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.patientId, patientId),
        eq(medicalRecords.doctorId, doctor.doctors.id)
      )
    )
    .limit(1);

  if (!treated) {
    return c.json({ error: "Access denied: no treatment history" }, 403);
  }

  const records = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patientId))
    .orderBy(desc(medicalRecords.date));

  return c.json({ records });
});

// ─── Create prescription ─────────────────────────────────
doctorRouter.post("/prescriptions", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  // Create prescription record in prescriptions table
  const [prescription] = await db
    .insert(prescriptions)
    .values({
      doctorId: doctor.doctors.id,
      patientId: body.patientId,
      hospitalId: body.hospitalId,
      diagnosis: body.diagnosis,
      notes: body.notes,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();

  // Create medical record (prescription type) linked to the patient
  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId: body.patientId,
      hospitalId: body.hospitalId,
      doctorId: doctor.doctors.id,
      recordType: "prescription",
      title: `Prescription - ${body.diagnosis || "General"}`,
      diagnosis: body.diagnosis,
      notes: body.notes,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();

  // Create medicines linked to the prescription
  if (body.medicines?.length > 0) {
    await db.insert(medicines).values(
      body.medicines.map((med: any) => ({
        patientId: body.patientId,
        prescriptionId: prescription.prescriptions.id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        timing: med.timing,
        startDate: med.startDate || new Date().toISOString().split("T")[0],
        endDate: med.endDate,
      }))
    );
  }

  return c.json({ prescription: prescription.prescriptions }, 201);
});

// ─── Get doctor's prescriptions ──────────────────────────
doctorRouter.get("/prescriptions", authMiddleware, requireRole("doctor"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  const records = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.doctorId, doctor.doctors.id),
        eq(medicalRecords.recordType, "prescription")
      )
    )
    .orderBy(desc(medicalRecords.date));

  return c.json({ prescriptions: records });
});

// ─── Doctor profile ──────────────────────────────────────
doctorRouter.get("/me", authMiddleware, requireRole("doctor"), async (c) => {
  const dbUser = c.get("dbUser");
  const db = c.get("db");

  const [doctor] = await db
    .select()
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.userId, dbUser.id))
    .limit(1);

  if (!doctor) {
    return c.json({ error: "Doctor not found" }, 404);
  }

  return c.json({ doctor });
});

export default doctorRouter;
