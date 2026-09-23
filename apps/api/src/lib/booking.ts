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
 * Auto-expire (mark as no_show) any scheduled/confirmed appointments
 * that have passed their start time by more than 15 minutes.
 * Writes an appointment_status_history audit row per transition.
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
          inArray(appointments.status, ["scheduled", "confirmed"])
        )
      );

    for (const appt of pendingAppts) {
      const apptTime = visitStartsAt(appt.date, appt.time);

      // If 15 mins buffer time has passed
      if (now - apptTime > 15 * 60 * 1000) {
        const { changed } = await withStatusGuard(
          db,
          appointments,
          appt.id,
          ["scheduled", "confirmed"],
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
        }
      }
    }
  } catch (err) {
    console.error("autoExpireAppointments failed:", err);
  }
  return expired;
}