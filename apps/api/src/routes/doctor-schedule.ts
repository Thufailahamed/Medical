// @ts-nocheck

import { Hono } from "hono";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  appointments,
  walkIns,
  doctorTimeOff,
  doctors,
  patients,
  users,
  medicalRecords,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const doctorScheduleRouter = new Hono<AppEnvironment>();

doctorScheduleRouter.use("*", authMiddleware, requireRole("doctor"));

async function getDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d;
}

// ─── Range query ──────────────────────────────────────────
// GET /doctor-schedule/range?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns a merged, sorted list of every event that touches the doctor
// in the window: appointments, walk-ins, follow-ups, time-off.
doctorScheduleRouter.get("/range", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const from = c.req.query("from") || "";
  const to = c.req.query("to") || "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return c.json({ error: "from/to must be YYYY-MM-DD" }, 400);
  }

  // ─── Appointments
  const apptRows = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      time: appointments.time,
      status: appointments.status,
      reason: appointments.reason,
      queueNumber: appointments.queueNumber,
      patientId: appointments.patientId,
      patientName: users.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(
      and(
        eq(appointments.doctorId, doctor.id),
        gte(appointments.date, from),
        lt(appointments.date, to)
      )
    );

  // ─── Walk-ins (arrived within the window)
  const walkRows = await db
    .select({
      id: walkIns.id,
      arrivedAt: walkIns.arrivedAt,
      status: walkIns.status,
      reason: walkIns.reason,
      priority: walkIns.priority,
      patientId: walkIns.patientId,
      patientName: users.name,
    })
    .from(walkIns)
    .innerJoin(patients, eq(patients.id, walkIns.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(
      and(
        eq(walkIns.doctorId, doctor.id),
        gte(walkIns.arrivedAt, `${from} 00:00:00`),
        lt(walkIns.arrivedAt, `${to} 23:59:59`)
      )
    );

  // ─── Follow-ups scheduled in the window (followUpDate)
  const followRows = await db
    .select({
      id: medicalRecords.id,
      title: medicalRecords.title,
      followUpDate: medicalRecords.followUpDate,
      status: medicalRecords.status,
      patientId: medicalRecords.patientId,
      patientName: users.name,
    })
    .from(medicalRecords)
    .innerJoin(patients, eq(patients.id, medicalRecords.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(
      and(
        eq(medicalRecords.doctorId, doctor.id),
        eq(medicalRecords.recordType, "follow_up"),
        gte(medicalRecords.followUpDate, from),
        lt(medicalRecords.followUpDate, to)
      )
    );

  // ─── Time-off
  const offRows = await db
    .select()
    .from(doctorTimeOff)
    .where(
      and(
        eq(doctorTimeOff.doctorId, doctor.id),
        gte(doctorTimeOff.date, from),
        lt(doctorTimeOff.date, to)
      )
    );

  const events: any[] = [];

  for (const a of apptRows) {
    events.push({
      id: a.id,
      kind: "appointment",
      date: a.date,
      startTime: a.time,
      endTime: null,
      status: a.status,
      patientId: a.patientId,
      patientName: a.patientName,
      title: a.reason || null,
      queueNumber: a.queueNumber,
      priority: null,
    });
  }
  for (const w of walkRows) {
    const date = w.arrivedAt.slice(0, 10);
    const time = w.arrivedAt.slice(11, 16);
    events.push({
      id: w.id,
      kind: "walkin",
      date,
      startTime: time,
      endTime: null,
      status: w.status,
      patientId: w.patientId,
      patientName: w.patientName,
      title: w.reason || null,
      queueNumber: null,
      priority: w.priority,
    });
  }
  for (const f of followRows) {
    events.push({
      id: f.id,
      kind: "followup",
      date: f.followUpDate,
      startTime: null,
      endTime: null,
      status: f.status,
      patientId: f.patientId,
      patientName: f.patientName,
      title: f.title,
      queueNumber: null,
      priority: null,
    });
  }
  for (const o of offRows) {
    events.push({
      id: o.id,
      kind: "timeoff",
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      status: null,
      patientId: null,
      patientName: null,
      title: o.reason || "Time off",
      queueNumber: null,
      priority: null,
    });
  }

  events.sort((x, y) => {
    const d = x.date.localeCompare(y.date);
    if (d !== 0) return d;
    const xt = x.startTime || "";
    const yt = y.startTime || "";
    return xt.localeCompare(yt);
  });

  return c.json({
    from,
    to,
    count: events.length,
    events,
  });
});

export default doctorScheduleRouter;
