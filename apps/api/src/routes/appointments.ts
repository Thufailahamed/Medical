// @ts-nocheck

import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { appointments, doctors, patients, users, notifications, medicalRecords, appointmentStatusHistory, appointmentRatings, teleconsultSessions } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { resolvePatientContext } from "../lib/caretaker";
import { appointmentSchema } from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { ACTIVE_STATUSES, MAX_PER_SLOT, compactQueue, autoExpireAppointments } from "../lib/booking";
import { upsertActiveCareTeam } from "../lib/status-guard";
import { computeCancellationEstimate } from "../lib/cancellation";
import { appointmentPayments } from "@healthcare/db";
import type { AppEnvironment } from "../types";

const appointmentsRouter = new Hono<AppEnvironment>();

// ACTIVE_STATUSES / MAX_PER_SLOT imported from lib/booking — single source of truth.

// ─── Book appointment ────────────────────────────────────
// Atomic: validates → checks slot capacity → inserts in one transaction.
// Returns 409 if the slot is full or has just been taken.
appointmentsRouter.post("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const body = await c.req.json().catch(() => ({}));
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const data = parsed.data;

  // Phase MTN-1: tenant guard. If x-active-hospital-id is set, the
  // appointment MUST be at that hospital. Patients can't book across
  // hospitals mid-session.
  const activeHospitalId = c.get("activeHospitalId") || null;
  const activeClinicId = c.get("activeClinicId") || null;
  if (activeHospitalId && data.hospitalId && data.hospitalId !== activeHospitalId) {
    return c.json(
      {
        error: "hospitalId in body does not match active tenant header",
        reason: "tenant_mismatch",
      },
      400
    );
  }
  if (activeClinicId && data.hospitalId && data.hospitalId !== activeClinicId) {
    return c.json(
      {
        error: "clinicId in body does not match active tenant header",
        reason: "tenant_mismatch",
      },
      400
    );
  }

  // 1. Reject past dates. Today is allowed.
  const today = new Date().toISOString().slice(0, 10);
  if (data.date < today) {
    return c.json({ error: "Cannot book a past date" }, 400);
  }
  if (data.date === today) {
    const [hh, mm] = (data.time || "00:00").split(":").map(Number);
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (hh * 60 + mm <= nowMin) {
      return c.json({ error: "Cannot book a time in the past" }, 400);
    }
  }

  // 2. Patient lookup. For caretakers, caretaker-context middleware
  //    resolves us to the active principal; for patients we fall back to
  //    the user's own row.
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient profile not found" }, 404);
  const patientId = patient.id;

  // 3. Doctor lookup + hospital match.
  const [doctor] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, data.doctorId))
    .limit(1);
  if (!doctor) return c.json({ error: "Doctor not found" }, 404);

  // Doctor Booking (Round 6): gate video-mode bookings on the doctor's
  // telemedicine opt-in flag. Patients can still request video in the
  // mobile UI, but the server is the source of truth — a doctor who
  // hasn't enabled video gets no `mode=video` bookings.
  if (data.mode === "video" && !(doctor as any).telemedicineEnabled) {
    return c.json(
      {
        error: "This doctor does not offer video consultations",
        reason: "telemedicine_unavailable",
      },
      409
    );
  }

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
    const txResult = await (async (tx) => {
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
          // Round 5: patient-requested mode. Schema defaults to "in_person"
          // if omitted, but we spread the explicit value to preserve intent
          // and surface it on the doctor's queue + the patient's CTA.
          mode: (data.mode ?? "in_person") as "in_person" | "video",
        } as any)
        .returning();
      return { row };
    })(db);

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
  //    Caretaker Profiles: when a caretaker books on behalf of the
  //    principal, route the confirmation to the principal's user row —
  //    not the caretaker.
  const dbUser = c.get("dbUser");
  const recipientUserId =
    dbUser?.role === "caretaker" ? (patient as any).userId : userId;
  await notify({
    db,
    userId: recipientUserId,
    type: "appointment",
    title: "Appointment Booked",
    body: `Your appointment is on ${data.date} at ${data.time}. Queue #${queueNumber}`,
    data: { appointmentId: inserted?.id, status: "scheduled" },
  });

  // 6. Phase 1: backfill care_team_members so the patient appears on
  // the doctor's accessible list immediately. Idempotent on partial
  // UNIQUE — patient revoke + re-book will skip cleanly.
  await upsertActiveCareTeam(db, {
    patientId,
    doctorId: data.doctorId,
    role: "primary_care",
    invitedByUserId: userId,
  });

  if (doctorUserId && doctorUserId !== userId) {
    await notify({
      db,
      userId: doctorUserId,
      type: "appointment",
      title: "New appointment booked",
      body: `Queue #${queueNumber} on ${data.date} at ${data.time}${
        data.reason ? ` · ${data.reason}` : ""
      }`,
      data: {
        appointmentId: inserted?.id ?? null,
        patientId,
        date: data.date,
        time: data.time,
      },
    });
  }

  return c.json(
    { appointment: inserted?.appointments || inserted, queueNumber },
    201
  );
});

// ─── Reschedule appointment (patient) ─────────────────────
// PATCH /appointments/:id/reschedule
//   Body: { date, time }
appointmentsRouter.patch(
  "/:id/reschedule",
  authMiddleware,
  async (c) => {
    const appointmentId = c.req.param("id");
    const userId = c.get("userId");
    const db = c.get("db");
    const body = await c.req.json().catch(() => ({}));
    const date = String(body?.date || "").trim();
    const time = String(body?.time || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return c.json({ error: "date (YYYY-MM-DD) and time (HH:MM) required" }, 400);
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return c.json({ error: "Cannot reschedule to a past date" }, 400);
    }
    if (date === today) {
      const [hh, mm] = time.split(":").map(Number);
      const now = new Date();
      if (hh * 60 + mm <= now.getHours() * 60 + now.getMinutes()) {
        return c.json({ error: "Cannot reschedule to a time in the past" }, 400);
      }
    }

    // Caretaker Profiles: resolve via context so caretakers can
    // reschedule the principal's appointments.
    const patient = await resolvePatientContext(c);
    if (!patient) return c.json({ error: "Patient not found" }, 404);
    const patientId = patient.id;

    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!existing || existing.patientId !== patientId) {
      return c.json({ error: "Appointment not found" }, 404);
    }
    if (["cancelled", "completed", "no_show"].includes(existing.status)) {
      return c.json(
        { error: `Cannot reschedule an appointment that is ${existing.status}` },
        409
      );
    }
    if (existing.date === date && existing.time === time) {
      return c.json({ appointment: existing, queueNumber: existing.queueNumber });
    }

    // Atomic slot recheck
    let inserted: any = null;
    let queueNumber = existing.queueNumber ?? 0;
    try {
      const tx = await (async (t) => {
        const sameSlot = await t
          .select({ status: appointments.status })
          .from(appointments)
          .where(
            and(
              eq(appointments.doctorId, existing.doctorId),
              eq(appointments.date, date),
              eq(appointments.time, time)
            )
          );
        const active = sameSlot.filter((r: any) =>
          ACTIVE_STATUSES.includes(r.status)
        ).length;
        if (active >= 4) {
          return { error: "This slot is fully booked" as const };
        }
        const [row] = await t
          .update(appointments)
          .set({ date, time, queueNumber: active + 1 } as any)
          .where(eq(appointments.id, appointmentId))
          .returning();
        return { row };
      })(db);
      if ("error" in tx) {
        return c.json({ error: tx.error }, 409);
      }
      inserted = tx.row;
      queueNumber = inserted?.queueNumber ?? queueNumber;
    } catch {
      return c.json({ error: "Could not reschedule" }, 409);
    }

    // Compact old slot (no longer has this patient) + audit + notify.
    await compactQueue(db, existing.doctorId, existing.date, existing.time);
    await audit(db, {
      userId,
      action: "appointment.reschedule",
      resource: "appointment",
      resourceId: appointmentId,
      details: {
        fromDate: existing.date,
        fromTime: existing.time,
        toDate: date,
        toTime: time,
      },
    });

    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, existing.doctorId))
      .limit(1);
    const doctorUserId = (doctor as any)?.userId;
    if (doctorUserId && doctorUserId !== userId) {
      await notify({
        db,
        userId: doctorUserId,
        type: "appointment",
        title: "Appointment rescheduled",
        body: `Patient moved their visit from ${existing.date} ${existing.time} → ${date} ${time}.`,
        data: {
          appointmentId,
          fromDate: existing.date,
          fromTime: existing.time,
          toDate: date,
          toTime: time,
        },
      });
    }

    return c.json({ appointment: inserted?.appointments || inserted, queueNumber });
  }
);

// ─── My appointments ─────────────────────────────────────
appointmentsRouter.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  // Caretaker Profiles: caretakers see their active principal's
  // appointments via the x-active-principal-patient-id header (already
  // resolved by caretaker-context middleware + resolvePatientContext).
  const patient = await resolvePatientContext(c);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  // Auto-expire passed appointments first
  await autoExpireAppointments(db, patient.id);

  const upcoming = await db
    .select()
    .from(appointments)
    .where(eq(appointments.patientId, patient.id))
    .orderBy(appointments.date);

  // Annotate each row with recordCount (records tied to that appointment).
  const enriched = upcoming.map((a: any) => ({ ...a, recordCount: 0 }));

  return c.json({ appointments: enriched });
});

// ─── Doctor's appointments (today only) — covered by /doctor-portal/queue ──
// Removed: use /doctor-portal/queue?date=YYYY-MM-DD instead.

// ─── Update appointment status (with ownership check) ────
// Doctor-only — fixed RBAC hole (was accepting hospital_staff with no scoping).
// DEPRECATED: prefer POST /doctor-portal/appointments/:id/status which also
// notifies the patient, writes audit, and compacts queue numbers.
// This shim is kept for backwards compatibility and silently routes the
// status change through the canonical endpoint.
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

    if (!existing || existing.doctorId !== doctor.id) {
      return c.json({ error: "Appointment not found or access denied" }, 404);
    }

    const [updated] = await db
      .update(appointments)
      .set({ status })
      .where(eq(appointments.id, appointmentId))
      .returning();

    // Audit + history (no patient notification here — handled by the
    // canonical endpoint). Still records the change for the audit log.
    await audit(db, {
      userId,
      action: "appointment.status_change",
      resource: "appointment",
      resourceId: appointmentId,
      details: { from: existing.status, to: status, via: "deprecated_endpoint" },
    });
    await db.insert(appointmentStatusHistory).values({
      appointmentId,
      fromStatus: existing.status,
      toStatus: status,
      changedByUserId: userId,
    } as any);

    return c.json({ appointment: updated });
  }
);

// ─── Records tied to an appointment ──────────────────────
// GET /appointments/:id/records — patient OR doctor (ownership-aware)
appointmentsRouter.get("/:id/records", authMiddleware, async (c) => {
  const appointmentId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = (c.get("dbUser") as any)?.role;
  const db = c.get("db");

  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  if (!appt) return c.json({ error: "Appointment not found" }, 404);

  // Ownership: patient can view their own, caretaker can view via the
  // active-principal link, doctor can view theirs.
  if (userRole === "patient") {
    const [p] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);
    const pid = (p as any)?.patients?.id ?? (p as any)?.id;
    if (!pid || appt.patientId !== pid) {
      return c.json({ error: "Access denied" }, 403);
    }
  } else if (userRole === "caretaker") {
    // resolvePatientContext enforces the active-principal link; the
    // appointment must belong to that principal.
    const p = await resolvePatientContext(c);
    if (!p || appt.patientId !== p.id) {
      return c.json({ error: "Access denied" }, 403);
    }
  } else if (userRole === "doctor") {
    const [d] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    const did = (d as any)?.doctors?.id ?? (d as any)?.id;
    if (!did || appt.doctorId !== did) {
      return c.json({ error: "Access denied" }, 403);
    }
  } else {
    return c.json({ error: "Access denied" }, 403);
  }

  const records: any[] = [];

  // Round 2 P0: surface doctor SLMC verification + name on appointment
  // detail so the mobile VerifiedBadge can render. Cheap single-row join.
  const [doctor] = await db
    .select({
      id: doctors.id,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      specialization: doctors.specialization,
      slmcRegistrationNo: doctors.slmcRegistrationNo,
      slmcVerifiedAt: doctors.slmcVerifiedAt,
    })
    .from(doctors)
    .leftJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, appt.doctorId))
    .limit(1);

  // Round 3 P1: include the patient's own rating (if any) so the
  // detail screen can either show the existing rating or prompt for
  // a new one. NULL when unrated.
  const [rating] = await db
    .select()
    .from(appointmentRatings)
    .where(eq(appointmentRatings.appointmentId, appointmentId))
    .limit(1);

  // Video consult: embed the live teleconsult session (status in
  // requested/ringing/active) so the appointment-detail screen can
  // render the "Join video visit" CTA in one round-trip instead of
  // composing `useActiveTeleconsultSession` + a `/appointments/me/active`
  // poll. NULL when no live session (e.g. before doctor opens room,
  // or after the call ends/fails/times out).
  const [activeSession] = await db
    .select()
    .from(teleconsultSessions)
    .where(
      and(
        eq(teleconsultSessions.appointmentId, appointmentId),
        inArray(teleconsultSessions.status, ["requested", "ringing", "active"])
      )
    )
    .limit(1);

  return c.json({
    appointment: appt,
    records,
    doctor: doctor || null,
    rating: rating
      ? {
          stars: rating.stars,
          comment: rating.comment,
          createdAt: rating.createdAt,
        }
      : null,
    activeSession: activeSession || null,
  });
});

// ─── Patient cancels their appointment (soft cancel) ─────
appointmentsRouter.delete(
  "/:id",
  authMiddleware,
  async (c) => {
    const appointmentId = c.req.param("id");
    if (!appointmentId) return c.json({ error: "Missing id" }, 400);
    const userId = c.get("userId");
    const db = c.get("db");

    // Caretaker Profiles: caretakers can cancel their principal's
    // appointments via resolvePatientContext.
    const patient = await resolvePatientContext(c);
    if (!patient) return c.json({ error: "Patient not found" }, 404);

    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (
      !existing ||
      existing.patientId !== patient.id
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

    // Phase 5: compute refund estimate BEFORE mutation so the UI can
    // confirm with the patient. Also expose as a separate GET endpoint
    // for the appointment-detail screen.
    const estimate = computeCancellationEstimate(
      existing.date,
      existing.time,
      existing.paymentAmount ?? 0
    );

    const [updated] = await db
      .update(appointments)
      .set({ status: "cancelled" })
      .where(eq(appointments.id, appointmentId))
      .returning();

    // If the patient had paid, mark the latest payment record per the
    // estimate. Actual refund disbursement is still manual in MVP — the
    // row carries the owed amount for finance to act on.
    if ((existing.paymentStatus as any) === "paid" && estimate.refundLkr > 0) {
      await db
        .update(appointmentPayments)
        .set({
          status: "refunded",
          refundedAmountLkr: estimate.refundLkr,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(appointmentPayments.appointmentId, appointmentId));
    } else if ((existing.paymentStatus as any) === "paid" && estimate.refundLkr === 0) {
      await db
        .update(appointmentPayments)
        .set({
          status: "refunded",
          refundedAmountLkr: 0,
          failureReason: estimate.rule,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(appointmentPayments.appointmentId, appointmentId));
    }

    // Notify the principal (confirmation). Caretaker Profiles: route to
    // principal's user row when a caretaker cancels on their behalf.
    const dbUser = c.get("dbUser");
    const recipientUserId =
      dbUser?.role === "caretaker" ? (patient as any).userId : userId;
    await notify({
      db,
      userId: recipientUserId,
      type: "appointment",
      title: "Appointment cancelled",
      body: `Your appointment on ${existing.date} at ${existing.time} was cancelled.`,
      data: { appointmentId, status: "cancelled" },
    });

    // Notify the doctor — they need to know a slot freed up.
    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, existing.doctorId))
      .limit(1);
    const doctorUserId = (doctor as any)?.userId;
    if (doctorUserId && doctorUserId !== userId) {
      await notify({
        db,
        userId: doctorUserId,
        type: "appointment",
        title: "Patient cancelled",
        body: `The ${existing.time} slot on ${existing.date} is now free.`,
        data: { appointmentId, date: existing.date, time: existing.time },
      });
    }

    // Audit + queue compaction (old slot may now have gaps).
    await audit(db, {
      userId,
      action: "appointment.cancel",
      resource: "appointment",
      resourceId: appointmentId,
      details: { from: existing.status, to: "cancelled" },
    });
    await compactQueue(db, existing.doctorId, existing.date, existing.time);

    return c.json({
      appointment: updated,
      refund: {
        bucket: estimate.bucket,
        refundPct: estimate.refundPct,
        refundLkr: estimate.refundLkr,
        rule: estimate.rule,
      },
    });
  }
);

/**
 * GET /appointments/:id/cancellation-estimate
 * Preview the refund the patient would receive if they cancelled now.
 * UI uses this to display the policy before the patient confirms.
 */
appointmentsRouter.get(
  "/:id/cancellation-estimate",
  authMiddleware,
  async (c) => {
    const appointmentId = c.req.param("id");
    const db = c.get("db");

    // Caretaker Profiles: caretakers can preview the refund for the
    // principal's appointments.
    const patient = await resolvePatientContext(c);
    if (!patient) return c.json({ error: "Patient not found" }, 404);

    const [existing] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (
      !existing ||
      existing.patientId !== patient.id
    ) {
      return c.json({ error: "Appointment not found or access denied" }, 404);
    }

    if (existing.status === "cancelled") {
      return c.json({ error: "Already cancelled" }, 409);
    }

    const estimate = computeCancellationEstimate(
      existing.date,
      existing.time,
      existing.paymentAmount ?? 0
    );
    return c.json({
      appointmentId,
      date: existing.date,
      time: existing.time,
      amountPaidLkr: existing.paymentAmount ?? 0,
      ...estimate,
    });
  }
);

export default appointmentsRouter;