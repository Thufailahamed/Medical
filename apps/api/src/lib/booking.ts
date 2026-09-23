// @ts-nocheck
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { appointments, appointmentStatusHistory } from "@healthcare/db";
import { visitStartsAt } from "@healthcare/shared/visit-lifecycle";
import { withStatusGuard } from "./status-guard";

export const ACTIVE_STATUSES = ["scheduled", "confirmed", "in_progress"];
export const MAX_PER_SLOT = 4;

/**
 * Renumber active appointments in (doctorId, date, time) so queueNumber
 * becomes 1..N (no gaps). Called after cancel/reschedule.
 */
export async function compactQueue(
  db: any,
  doctorId: string,
  date: string,
  time: string
): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.date, date),
          eq(appointments.time, time)
        )
      );
    const active = rows
      .filter((r: any) => ACTIVE_STATUSES.includes(r.status))
      .sort((a: any, b: any) => (a.queueNumber ?? 999) - (b.queueNumber ?? 999));
    let n = 1;
    for (const r of active) {
      if ((r as any).queueNumber !== n) {
        await db
          .update(appointments)
          .set({ queueNumber: n })
          .where(eq(appointments.id, r.id));
      }
      n += 1;
    }
  } catch (err) {
    console.error("compactQueue failed:", err);
  }
}

/**
 * Returns the count of currently active (scheduled/confirmed/in_progress)
 * appointments at (doctorId, date, time).
 */
export async function slotCount(
  db: any,
  doctorId: string,
  date: string,
  time: string
): Promise<number> {
  const rows = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.date, date),
        eq(appointments.time, time)
      )
    );
  return rows.filter((r: any) => ACTIVE_STATUSES.includes(r.status)).length;
}

/**
 * Auto-expire stale active appointments to `no_show` (patient didn't
 * attend for offline, didn't join for video).
 *
 *   - scheduled/confirmed past start+15min → no_show
 *   - in_progress stuck past start+4h → no_show (doctor started the
 *     visit but never closed it; the slot must not block capacity
 *     forever and the visit must not read as "upcoming").
 *
 * Writes an appointment_status_history audit row per transition and
 * times out any live teleconsult sessions tied to the expired visit.
 * Returns the number of appointments expired.
 */
export async function autoExpireAppointments(
  db: any,
  patientId?: string,
  doctorId?: string
): Promise<number> {
  let expired = 0;
  try {
    const now = Date.now();
    const conditions = [];
    if (patientId) {
      conditions.push(eq(appointments.patientId, patientId));
    }
    if (doctorId) {
      conditions.push(eq(appointments.doctorId, doctorId));
    }

    const pendingAppts = await db
      .select()
      .from(appointments)
      .where(
        and(
          ...conditions,
          inArray(appointments.status, ["scheduled", "confirmed", "in_progress"])
        )
      );

    for (const appt of pendingAppts) {
      const apptTime = visitStartsAt(appt.date, appt.time);
      const elapsed = now - apptTime;
      const isStuckInProgress =
        appt.status === "in_progress" && elapsed > 4 * 60 * 60 * 1000;
      const isPastGrace =
        (appt.status === "scheduled" || appt.status === "confirmed") &&
        elapsed > 15 * 60 * 1000;

      // If 15 mins buffer time has passed (or 4h for stuck in_progress)
      if (isPastGrace || isStuckInProgress) {
        const fromStatuses =
          appt.status === "in_progress"
            ? ["in_progress"]
            : ["scheduled", "confirmed"];
        const { changed } = await withStatusGuard(
          db,
          appointments,
          appt.id,
          fromStatuses,
          { status: "no_show" }
        );
        if (changed) {
          expired += 1;
          await db.insert(appointmentStatusHistory).values({
            appointmentId: appt.id,
            fromStatus: appt.status,
            toStatus: "no_show",
            changedByUserId: null,
            reason: "auto_expired",
          } as any);
          await timeoutTeleconsultForAppointment(db, appt.id).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("autoExpireAppointments failed:", err);
  }
  return expired;
}

/**
 * Best-effort: close live teleconsult rooms (requested/ringing/active →
 * timeout) when their appointment expires or is closed. The DB row is
 * authoritative; the DO closes sockets on next message.
 */
export async function timeoutTeleconsultForAppointment(
  db: any,
  appointmentId: string
): Promise<void> {
  try {
    const { teleconsultSessions } = await import("@healthcare/db");
    const live = await db
      .select({ id: teleconsultSessions.id })
      .from(teleconsultSessions)
      .where(
        and(
          eq(teleconsultSessions.appointmentId, appointmentId),
          inArray(teleconsultSessions.status, ["requested", "ringing", "active"])
        )
      );
    for (const row of live as any[]) {
      await db
        .update(teleconsultSessions)
        .set({
          status: "timeout",
          endedAt: new Date().toISOString(),
          lastError: "appointment closed without attendance",
        })
        .where(eq(teleconsultSessions.id, (row as any).id));
    }
  } catch (err) {
    console.error("timeoutTeleconsultForAppointment failed:", err);
  }
}