// @ts-nocheck

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { appointments, doctors, patients, notifications } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { appointmentSchema } from "../lib/validators";
import type { AppEnvironment } from "../types";

const appointmentsRouter = new Hono<AppEnvironment>();

// Keep in sync with /doctor/:id/availability — slots cap per (date, time).
const MAX_PER_SLOT = 4;

// Active statuses count toward the per-slot cap and queue number.
const ACTIVE_STATUSES = ["scheduled", "confirmed", "in_progress"];

// ─── Book appointment ────────────────────────────────────
// Atomic: validates → checks slot capacity → inserts in one transaction.
// Returns 409 if the slot is full or has just been taken.
appointmentsRouter.post("/", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const body = await c.req.json().catch(() => ({}));
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const data = parsed.data;

  // 1. Reject past dates. Today is allowed.
  const today = new Date().toISOString().slice(0, 10);
  if (data.date < today) {
    return c.json({ error: "Cannot book a past date" }, 400);
  }

  // 2. Patient lookup.
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);
  const patientId = (patient as any).patients?.id ?? patient.id;

  // 3. Doctor lookup + hospital match.
  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, data.doctorId))
    .limit(1);
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);

  const doctorHospitalId = (doctor as any).hospitalId;
  if (doctorHospitalId && doctorHospitalId !== data.hospitalId) {
    return c.json(
      { error: "Doctor is not affiliated with the selected hospital" },
      400
    );
  }
  // Fall back to the doctor's hospital if the patient omitted one.
  const effectiveHospitalId = doctorHospitalId ?? data.hospitalId;
  const doctorUserId = (doctor as any).userId;

  // 4. Atomic count + insert.
  let inserted: any = null;
  let queueNumber = 0;
  try {
    const txResult = await db.transaction(async (tx) => {
      const sameSlot = await tx
        .select({ status: appointments.status })
        .from(appointments)
        .where(
          and(
            eq(appointments.doctorId, data.doctorId),
            eq(appointments.date, data.date),
            eq(appointments.time, data.time)
          )
        );
      const activeCount = sameSlot.filter((r: any) =>
        ACTIVE_STATUSES.includes(r.status)
      ).length;
      if (activeCount >= MAX_PER_SLOT) {
        return { error: "This slot is fully booked" as const };
      }
      queueNumber = activeCount + 1;

      const [row] = await tx
        .insert(appointments)
        .values({
          doctorId: data.doctorId,
          patientId,
          hospitalId: effectiveHospitalId,
          date: data.date,
          time: data.time,
          reason: data.reason ?? null,
          queueNumber,
          status: "scheduled",
        } as any)
        .returning();
      return { row };
    });

    if ("error" in txResult) {
      return c.json({ error: txResult.error }, 409);
    }
    inserted = txResult.row;
  } catch (err: any) {
    return c.json(
      { error: "Could not book — slot may have just been taken" },
      409
    );
  }

  // 5. Notifications (after commit so we don't notify on rollback).
  await db.insert(notifications).values({
    userId,
    type: "appointment",
    title: "Appointment Booked",
    body: `Your appointment is on ${data.date} at ${data.time}. Queue #${queueNumber}`,
  });

  if (doctorUserId && doctorUserId !== userId) {
    await db.insert(notifications).values({
      userId: doctorUserId,
      type: "appointment",
      title: "New appointment booked",
      body: `Queue #${queueNumber} on ${data.date} at ${data.time}${
        data.reason ? ` · ${data.reason}` : ""
      }`,
      data: JSON.stringify({
        appointmentId: inserted?.id ?? null,
        patientId,
        date: data.date,
        time: data.time,
      }),
    });
  }

  return c.json(
    { appointment: inserted?.appointments || inserted, queueNumber },
    201
  );
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
    .where(eq(appointments.patientId, (patient.patients?.id ?? patient.id)))
    .orderBy(appointments.date);

  return c.json({ appointments: upcoming });
});

// ─── Doctor's appointments (today only) — covered by /doctor-portal/queue ──
// Removed: use /doctor-portal/queue?date=YYYY-MM-DD instead.

// ─── Update appointment status (with ownership check) ────
// Doctor-only — fixed RBAC hole (was accepting hospital_staff with no scoping).
appointmentsRouter.put(
  "/:id/status",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const appointmentId = c.req.param("id");
    const userId = c.get("userId");
    const db = c.get("db");
    const body = await c.req.json().catch(() => ({}));
    const status = body?.status;

    const allowed = [
      "scheduled",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
    ];
    if (!status || !allowed.includes(status)) {
      return c.json(
        { error: `status must be one of: ${allowed.join(", ")}` },
        400
      );
    }

    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) return c.json({ error: "Doctor not found" }, 404);

    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (!existing || existing.doctorId !== doctor.doctors.id) {
      return c.json({ error: "Appointment not found or access denied" }, 404);
    }

    const [updated] = await db
      .update(appointments)
      .set({ status })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return c.json({ appointment: updated });
  }
);

// ─── Patient cancels their appointment (soft cancel) ─────
appointmentsRouter.delete(
  "/:id",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
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

    if (
      !existing ||
      existing.patientId !== (patient.patients?.id ?? patient.id)
    ) {
      return c.json({ error: "Appointment not found or access denied" }, 404);
    }

    if (
      existing.status === "cancelled" ||
      existing.status === "completed" ||
      existing.status === "no_show"
    ) {
      return c.json(
        { error: `Cannot cancel an appointment that is ${existing.status}` },
        409
      );
    }

    const [updated] = await db
      .update(appointments)
      .set({ status: "cancelled" })
      .where(eq(appointments.id, appointmentId))
      .returning();

    // Notify the patient (confirmation).
    await db.insert(notifications).values({
      userId,
      type: "appointment",
      title: "Appointment cancelled",
      body: `Your appointment on ${existing.date} at ${existing.time} was cancelled.`,
    });

    // Notify the doctor — they need to know a slot freed up.
    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, existing.doctorId))
      .limit(1);
    const doctorUserId = (doctor as any)?.userId;
    if (doctorUserId && doctorUserId !== userId) {
      await db.insert(notifications).values({
        userId: doctorUserId,
        type: "appointment",
        title: "Patient cancelled",
        body: `The ${existing.time} slot on ${existing.date} is now free.`,
        data: JSON.stringify({ appointmentId, date: existing.date, time: existing.time }),
      });
    }

    return c.json({ appointment: updated });
  }
);

export default appointmentsRouter;