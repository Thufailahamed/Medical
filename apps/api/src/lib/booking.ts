// @ts-nocheck
import { and, asc, eq, gt } from "drizzle-orm";
import { appointments } from "@healthcare/db";

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