import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { eq, and, lte, gte } from "drizzle-orm";
import { appointments, doctors, patients, users } from "@healthcare/db";
import { notify } from "../lib/notifications";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

/**
 * Booking reminder cron. Fires hourly (Wrangler Cron Trigger).
 * Reminds patients AND doctors about appointments in the next 24h.
 * Marks `reminderSent=1` so each appointment gets exactly one reminder.
 *
 * Manual invocation:
 *   POST /__cron/booking-reminders
 *   Header: x-cron-secret: $CRON_SECRET
 *   (No header required when running inside Workers scheduled() handler —
 *    secret check is bypassed for in-process execution.)
 */
export const bookingRemindersRouter = new Hono<AppEnvironment>();

bookingRemindersRouter.post("/__cron/booking-reminders", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";

  // Allow either explicit secret header or Workers scheduled() call.
  const provided = c.req.header("x-cron-secret");
  const cookieSecret = getCookie(c, "cron_secret");
  const ok =
    !cronSecret ||
    provided === cronSecret ||
    cookieSecret === cronSecret ||
    isDev;
  if (!ok) return c.json({ ok: false, error: "unauthorized" }, 401);

  const db = createDb(c.env.DB);
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Pull active appointments inside horizon that haven't been reminded.
  // D1 stores date + time as TEXT (YYYY-MM-DD, HH:MM). Compose ISO-ish key.
  const rows: any[] = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      date: appointments.date,
      time: appointments.time,
      patientUserId: patients.userId,
      patientName: users.name,
      doctorUserId: doctors.userId,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .leftJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(
      and(
        eq(appointments.status, "scheduled"),
        eq(appointments.reminderSent, false as any),
        // Window
        gte(appointments.date, now.toISOString().slice(0, 10)),
        lte(appointments.date, horizon.toISOString().slice(0, 10))
      )
    )
    .limit(500);

  let remindersSent = 0;
  const failures: string[] = [];

  for (const row of rows) {
    // Only remind if appointment slot is within next 24h by time-of-day too.
    if (row.date === now.toISOString().slice(0, 10) && row.time) {
      const slot = new Date(`${row.date}T${row.time}:00`);
      if (!isNaN(slot.getTime()) && slot.getTime() < now.getTime()) continue;
    }

    try {
      const whenLabel = `${row.date}${row.time ? " at " + row.time : ""}`;

      if (row.patientUserId) {
        await notify({
          db,
          userId: row.patientUserId,
          type: "appointment",
          title: "Upcoming appointment",
          body: `Your visit is on ${whenLabel}.`,
          data: { appointmentId: row.id, deepLink: `/appointment-detail?id=${row.id}` },
        });
      }

      if (row.doctorUserId) {
        await notify({
          db,
          userId: row.doctorUserId,
          type: "appointment",
          title: "Upcoming patient",
          body: `${row.patientName || "A patient"} has a visit on ${whenLabel}.`,
          data: { appointmentId: row.id, deepLink: `/portal/queue` },
        });
      }

      await db
        .update(appointments)
        .set({ reminderSent: 1 } as any)
        .where(eq(appointments.id, row.id));

      remindersSent++;
    } catch (err: any) {
      failures.push(`${row.id}: ${err?.message || "unknown"}`);
    }
  }

  return c.json({
    ok: true,
    scanned: rows.length,
    remindersSent,
    failures: failures.length,
  });
});

// GET helper for ad-hoc inspection: who is due for a reminder?
bookingRemindersRouter.get("/__cron/booking-reminders/preview", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const provided = c.req.header("x-cron-secret");
  const ok = !cronSecret || provided === cronSecret;
  if (!ok) return c.json({ ok: false }, 401);

  const db = createDb(c.env.DB);
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const rows: any[] = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      time: appointments.time,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "scheduled"),
        eq(appointments.reminderSent, false as any),
        gte(appointments.date, now.toISOString().slice(0, 10)),
        lte(appointments.date, horizon.toISOString().slice(0, 10))
      )
    )
    .limit(100);
  return c.json({ count: rows.length, now: now.toISOString(), samples: rows });
});
