// ─── Appointment ratings (Round 3 P1) ────────────────────
//
// Patient-owned 1-tap rating of a completed visit, surfaced back on
// /doctor/:id as a star aggregate.
//
// POST /appointments/:id/rating
//   body { stars: 1..5, comment? } — auth + patient role
//   upserts into appointment_ratings; refreshes doctors.rating
//
// GET  /appointments/:id/rating
//   returns the caller's rating for that appointment (if any) +
//   aggregate stars for the doctor on that visit. Used by the mobile
//   rate screen to pre-fill when the user re-opens it.

import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import {
  appointments,
  appointmentRatings,
  doctors,
  patients,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const ratingsRouter = new Hono<AppEnvironment>();

async function ownPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

ratingsRouter.post(
  "/:id/rating",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const appointmentId = c.req.param("id");
    if (!appointmentId) return c.json({ error: "Missing id" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const stars = Number(body?.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return c.json({ error: "stars must be an integer 1..5" }, 400);
    }
    const comment =
      typeof body?.comment === "string" && body.comment.trim()
        ? body.comment.trim().slice(0, 500)
        : null;

    const patient = await ownPatient(db, userId);
    if (!patient) return c.json({ error: "Patient profile not found" }, 404);

    const [appt] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appt) return c.json({ error: "Appointment not found" }, 404);
    if (appt.patientId !== patient.id) {
      return c.json({ error: "Not your appointment" }, 403);
    }
    if (appt.status !== "completed") {
      return c.json(
        { error: "Appointment is not yet completed", status: appt.status },
        409
      );
    }

    // UPSERT keyed on appointment_id (UNIQUE in the table). We rely on
    // SQLite's `ON CONFLICT ... DO UPDATE` to keep this idempotent
    // when the patient re-submits.
    const id = crypto.randomUUID();
    await db.run(sql`
      INSERT INTO appointment_ratings
        (id, appointment_id, patient_id, doctor_id, stars, comment, created_at)
      VALUES
        (${id}, ${appointmentId}, ${patient.id}, ${appt.doctorId}, ${stars}, ${comment}, CURRENT_TIMESTAMP)
      ON CONFLICT(appointment_id) DO UPDATE SET
        stars = excluded.stars,
        comment = excluded.comment,
        created_at = CURRENT_TIMESTAMP
    `);

    // Recompute doctor aggregate. Cheap on D1 — soft-launch fleet has
    // <50 doctors and ratings accumulate slowly.
    const aggRows = (await db.all(sql`
      SELECT
        AVG(stars) AS avg_stars,
        COUNT(*) AS rating_count
      FROM appointment_ratings
      WHERE doctor_id = ${appt.doctorId}
    `)) as Array<{ avg_stars: number | null; rating_count: number }>;
    const agg = aggRows[0];
    const avg = Number(agg?.avg_stars ?? 0);
    const count = Number(agg?.rating_count ?? 0);
    await db
      .update(doctors)
      .set({ rating: avg } as any)
      .where(eq(doctors.id, appt.doctorId));

    await audit(db, {
      userId,
      action: "appointment.rated",
      resource: "appointment",
      resourceId: appointmentId,
      details: { stars, doctorId: appt.doctorId, doctorRatingCount: count },
    });

    return c.json({
      ok: true,
      rating: { stars, comment },
      doctor: { id: appt.doctorId, avgStars: avg, ratingCount: count },
    });
  }
);

ratingsRouter.get(
  "/:id/rating",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const appointmentId = c.req.param("id");
    if (!appointmentId) return c.json({ error: "Missing id" }, 400);

    const patient = await ownPatient(db, userId);
    if (!patient) return c.json({ rating: null });

    const [appt] = await db
      .select({ id: appointments.id, doctorId: appointments.doctorId })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    if (!appt || appt.id !== appointmentId) {
      return c.json({ rating: null });
    }

    const [mine] = await db
      .select()
      .from(appointmentRatings)
      .where(
        and(
          eq(appointmentRatings.appointmentId, appointmentId),
          eq(appointmentRatings.patientId, patient.id)
        )
      )
      .limit(1);

    return c.json({
      rating: mine
        ? {
            stars: mine.stars,
            comment: mine.comment,
            createdAt: mine.createdAt,
          }
        : null,
    });
  }
);

export default ratingsRouter;