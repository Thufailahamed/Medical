// @ts-nocheck

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { appointments, doctors, patients, notifications } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { appointmentSchema } from "../lib/validators";
import type { AppEnvironment } from "../types";

const appointmentsRouter = new Hono<AppEnvironment>();

// ─── Book appointment ────────────────────────────────────
appointmentsRouter.post("/", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = appointmentSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  // Get queue number for that doctor/date
  const existingAppointments = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, parsed.data.doctorId),
        eq(appointments.date, parsed.data.date)
      )
    );

  const queueNumber = existingAppointments.length + 1;

  const [appointment] = await db
    .insert(appointments)
    .values({
      doctorId: parsed.data.doctorId,
      patientId: patient.patients.id,
      hospitalId: parsed.data.hospitalId,
      date: parsed.data.date,
      time: parsed.data.time,
      reason: parsed.data.reason,
      queueNumber,
    })
    .returning();

  // Create notification for the patient
  await db.insert(notifications).values({
    userId,
    type: "appointment",
    title: "Appointment Booked",
    body: `Your appointment is on ${parsed.data.date} at ${parsed.data.time}. Queue #${queueNumber}`,
  });

  return c.json({ appointment }, 201);
});

// ─── My appointments ─────────────────────────────────────
appointmentsRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
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

  const upcoming = await db
    .select()
    .from(appointments)
    .where(eq(appointments.patientId, patient.patients.id))
    .orderBy(appointments.date);

  return c.json({ appointments: upcoming });
});

// ─── Doctor's appointments ───────────────────────────────
appointmentsRouter.get("/doctor", authMiddleware, requireRole("doctor"), async (c) => {
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

  return c.json({ appointments: todaysAppointments });
});

// ─── Update appointment status (with ownership check) ────
appointmentsRouter.put("/:id/status", authMiddleware, requireRole("doctor", "hospital_staff"), async (c) => {
  const appointmentId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");
  const { status } = await c.req.json();

  // Ownership check: doctors can only update their own appointments
  if (userRole === "doctor") {
    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);

    if (!doctor) {
      return c.json({ error: "Doctor not found" }, 404);
    }

    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (!existing || existing.appointments.doctorId !== doctor.doctors.id) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  const [updated] = await db
    .update(appointments)
    .set({ status })
    .where(eq(appointments.id, appointmentId))
    .returning();

  return c.json({ appointment: updated });
});

// ─── Patient cancels their appointment (soft cancel) ─────
appointmentsRouter.delete("/:id", authMiddleware, requireRole("patient"), async (c) => {
  const appointmentId = c.req.param("id");
  if (!appointmentId) return c.json({ error: "Missing id" }, 400);
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const [existing] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!existing || existing.appointments.patientId !== patient.patients.id) {
    return c.json({ error: "Appointment not found or access denied" }, 404);
  }

  const status = existing.appointments.status;
  if (status === "cancelled" || status === "completed" || status === "no_show") {
    return c.json({ error: `Cannot cancel an appointment that is ${status}` }, 409);
  }

  const [updated] = await db
    .update(appointments)
    .set({ status: "cancelled" })
    .where(eq(appointments.id, appointmentId))
    .returning();

  await db.insert(notifications).values({
    userId,
    type: "appointment",
    title: "Appointment cancelled",
    body: `Your appointment on ${existing.appointments.date} at ${existing.appointments.time} was cancelled.`,
  });

  return c.json({ appointment: updated });
});

export default appointmentsRouter;
