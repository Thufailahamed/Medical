// @ts-nocheck

import { Hono } from "hono";
import { eq, or, like, desc, and } from "drizzle-orm";
import { doctors, patients, users, medicalRecords, appointments, medicines, prescriptions, hospitals, doctorAvailability } from "@healthcare/db";
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
    .select({
      id: medicalRecords.id,
      patientId: medicalRecords.patientId,
      doctorId: medicalRecords.doctorId,
      title: medicalRecords.title,
      diagnosis: medicalRecords.diagnosis,
      summary: medicalRecords.summary,
      notes: medicalRecords.notes,
      date: medicalRecords.date,
      followUpDate: medicalRecords.followUpDate,
      createdAt: medicalRecords.createdAt,
    })
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.doctorId, doctor.doctors.id),
        eq(medicalRecords.recordType, "prescription")
      )
    )
    .orderBy(desc(medicalRecords.date));

  // Enrich with patient name + medicine count in one pass.
  const patientIds = [...new Set(records.map((r) => r.patientId).filter(Boolean))];
  const rxIds = records.map((r) => r.id);

  let patientMap = new Map<string, { id: string; name: string }>();
  if (patientIds.length) {
    const rows = await db
      .select({
        id: patients.id,
        patientId: patients.userId,
        name: users.name,
      })
      .from(patients)
      .innerJoin(users, eq(users.id, patients.userId))
      .where(
        or(...patientIds.map((id) => eq(patients.id, id))) as any
      );
    for (const r of rows) {
      patientMap.set(r.id, { id: r.id, name: r.name });
    }
  }

  let medCountMap = new Map<string, number>();
  if (rxIds.length) {
    const medRows = await db
      .select({ prescriptionId: medicines.prescriptionId })
      .from(medicines);
    for (const m of medRows) {
      if (!m.prescriptionId) continue;
      medCountMap.set(m.prescriptionId, (medCountMap.get(m.prescriptionId) ?? 0) + 1);
    }
  }

  const enriched = records.map((r) => ({
    ...r,
    patient: patientMap.get(r.patientId) || null,
    medicineCount: medCountMap.get(r.id) ?? 0,
  }));

  return c.json({ prescriptions: enriched, count: enriched.length });
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

// ─── Search doctors (public to logged-in users) ──────────
// Used by the patient booking flow to find a doctor by name / specialization.
doctorRouter.get("/search", authMiddleware, async (c) => {
  const db = c.get("db");
  const query = (c.req.query("query") || "").trim();
  const specialization = (c.req.query("specialization") || "").trim();
  const hospitalId = (c.req.query("hospitalId") || "").trim();

  const conditions: any[] = [];
  if (query) {
    const safe = query.replace(/[%_]/g, "\\$&");
    conditions.push(like(users.name, `%${safe}%`));
  }
  if (specialization) {
    conditions.push(eq(doctors.specialization, specialization));
  }
  if (hospitalId) {
    conditions.push(eq(doctors.hospitalId, hospitalId));
  }

  const baseQuery = db
    .select({
      doctorId: doctors.id,
      userId: doctors.userId,
      name: users.name,
      specialization: doctors.specialization,
      qualification: doctors.qualification,
      experience: doctors.experience,
      consultationFee: doctors.consultationFee,
      rating: doctors.rating,
      photo: users.photo,
      hospitalId: doctors.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(hospitals, eq(doctors.hospitalId, hospitals.id));

  const rows = conditions.length
    ? await baseQuery.where(and(...conditions)).limit(50)
    : await baseQuery.limit(50);

  return c.json({ doctors: rows });
});

// ─── List all distinct specializations ───────────────────
doctorRouter.get("/specialties", authMiddleware, async (c) => {
  const db = c.get("db");
  const rows = await db
    .selectDistinct({ specialization: doctors.specialization })
    .from(doctors);
  const specialties = rows
    .map((r: any) => r.specialization)
    .filter((s: string | null | undefined): s is string => !!s && s.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
  return c.json({ specialties });
});

// ─── Doctor detail ───────────────────────────────────────
doctorRouter.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);
  const db = c.get("db");

  const [row] = await db
    .select({
      doctorId: doctors.id,
      userId: doctors.userId,
      name: users.name,
      photo: users.photo,
      phone: users.phone,
      specialization: doctors.specialization,
      qualification: doctors.qualification,
      registrationNumber: doctors.registrationNumber,
      experience: doctors.experience,
      consultationFee: doctors.consultationFee,
      rating: doctors.rating,
      hospitalId: doctors.hospitalId,
      hospitalName: hospitals.name,
      hospitalAddress: hospitals.address,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .leftJoin(hospitals, eq(doctors.hospitalId, hospitals.id))
    .where(eq(doctors.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Doctor not found" }, 404);
  return c.json({ doctor: row });
});

// ─── Doctor availability for a date ──────────────────────
// Reads doctorAvailability rows and counts appointments already booked that
// day, returning a slot list the booking UI can show.
doctorRouter.get("/:id/availability", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const date = c.req.query("date") || new Date().toISOString().split("T")[0];
  const db = c.get("db");
  if (!id) return c.json({ error: "Missing id" }, 400);

  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, id))
    .limit(1);
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);

  const day = new Date(date + "T00:00:00");
  if (Number.isNaN(day.getTime())) {
    return c.json({ error: "Invalid date" }, 400);
  }
  const dow = day.getDay();

  // Doctor's working hours for that weekday, if set
  const hours = await db
    .select()
    .from(doctorAvailability)
    .where(
      and(
        eq(doctorAvailability.doctorId, id),
        eq(doctorAvailability.dayOfWeek, dow),
        eq(doctorAvailability.active, true)
      )
    );

  // Existing booked appointments that day
  const booked = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, id),
        eq(appointments.date, date)
      )
    );

  const bookedTimes = new Set(
    booked
      .filter((b: any) => b.status !== "cancelled" && b.status !== "no_show")
      .map((b: any) => b.time)
  );

  // Build candidate slots from working hours or default 09:00-17:00
  const slots: { time: string; available: boolean; queueNumber?: number }[] = [];
  const MAX_PER_SLOT = 4; // 4 patients per 30-min slot by default

  const ranges =
    hours.length > 0
      ? hours.map((h: any) => ({ start: h.startTime, end: h.endTime }))
      : [{ start: "09:00", end: "17:00" }];

  const queueCountFor = (t: string) =>
    booked.filter(
      (b: any) =>
        b.time === t &&
        b.status !== "cancelled" &&
        b.status !== "no_show"
    ).length;

  for (const r of ranges) {
    const [sh, sm] = r.start.split(":").map(Number);
    const [eh, em] = r.end.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + 30 <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, "0");
      const mm = String(cur % 60).padStart(2, "0");
      const t = `${hh}:${mm}`;
      const count = queueCountFor(t);
      slots.push({
        time: t,
        available: count < MAX_PER_SLOT,
        queueNumber: count + 1,
      });
      cur += 30;
    }
  }

  return c.json({ date, slots, bookedTimes: Array.from(bookedTimes) });
});

export default doctorRouter;
