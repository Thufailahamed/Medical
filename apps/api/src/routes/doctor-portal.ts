// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, asc, or, like, gte, lt, isNull } from "drizzle-orm";
import {
  doctors,
  patients,
  users,
  medicalRecords,
  appointments,
  medicines,
  prescriptions,
  labs,
  labReports,
  vitals,
  notifications,
  doctorAvailability,
  labOrders,
  hospitals,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  clinicalNoteSchema,
  labOrderSchema,
  followUpSchema,
  appointmentStatusSchema,
  availabilitySchema,
} from "@healthcare/shared";
import type { AppEnvironment } from "../types";

const doctorPortalRouter = new Hono<AppEnvironment>();

doctorPortalRouter.use("*", authMiddleware, requireRole("doctor"));

// ─── helpers ─────────────────────────────────────────────
async function getDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d;
}

// ─── Today's queue ───────────────────────────────────────
// GET /doctor-portal/queue?date=YYYY-MM-DD
doctorPortalRouter.get("/queue", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const date =
    c.req.query("date") || new Date().toISOString().split("T")[0];

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const rows = await db
    .select({
      appointmentId: appointments.id,
      patientId: patients.id,
      patientName: users.name,
      patientPhoto: users.photo,
      patientPhone: users.phone,
      nic: users.nic,
      bloodGroup: patients.bloodGroup,
      gender: patients.gender,
      date: appointments.date,
      time: appointments.time,
      status: appointments.status,
      queueNumber: appointments.queueNumber,
      reason: appointments.reason,
      notes: appointments.notes,
      hospitalId: appointments.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .leftJoin(hospitals, eq(appointments.hospitalId, hospitals.id))
    .where(
      and(eq(appointments.doctorId, doctor.id), eq(appointments.date, date))
    )
    .orderBy(asc(appointments.queueNumber), asc(appointments.time));

  return c.json({ date, count: rows.length, queue: rows });
});

// ─── Patient summary (doctor view) ───────────────────────
// GET /doctor-portal/patients/:id/summary
doctorPortalRouter.get("/patients/:id/summary", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patientId = c.req.param("id");
  if (!patientId) return c.json({ error: "Missing patient id" }, 400);

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  // Patient profile + linked user
  const [patientRow] = await db
    .select({
      patient: patients,
      user: users,
    })
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patientRow) return c.json({ error: "Patient not found" }, 404);

  // Records (recent 50)
  const records = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patientId))
    .orderBy(desc(medicalRecords.date))
    .limit(50);

  // Active medicines
  const activeMeds = await db
    .select()
    .from(medicines)
    .where(and(eq(medicines.patientId, patientId), eq(medicines.active, true)))
    .orderBy(desc(medicines.createdAt));

  // Prescriptions
  const rxRows = await db
    .select()
    .from(prescriptions)
    .where(eq(prescriptions.patientId, patientId))
    .orderBy(desc(prescriptions.date))
    .limit(30);

  // Lab reports (recent 30)
  const labsRows = await db
    .select()
    .from(labReports)
    .where(eq(labReports.patientId, patientId))
    .orderBy(desc(labReports.createdAt))
    .limit(30);

  // Lab orders (this doctor's)
  const orderRows = await db
    .select()
    .from(labOrders)
    .where(
      and(
        eq(labOrders.patientId, patientId),
        eq(labOrders.doctorId, doctor.id)
      )
    )
    .orderBy(desc(labOrders.orderedAt))
    .limit(30);

  // Vitals (recent 50)
  const vitalRows = await db
    .select()
    .from(vitals)
    .where(eq(vitals.patientId, patientId))
    .orderBy(desc(vitals.recordedAt))
    .limit(50);

  // Past appointments with this doctor
  const pastAppts = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.patientId, patientId),
        eq(appointments.doctorId, doctor.id)
      )
    )
    .orderBy(desc(appointments.date))
    .limit(20);

  return c.json({
    patient: patientRow.patient,
    user: patientRow.user,
    records,
    activeMedicines: activeMeds,
    prescriptions: rxRows,
    labReports: labsRows,
    labOrders: orderRows,
    vitals: vitalRows,
    pastAppointments: pastAppts,
  });
});

// ─── Clinical note ───────────────────────────────────────
// POST /doctor-portal/clinical-notes
doctorPortalRouter.post("/clinical-notes", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = clinicalNoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [row] = await db
    .insert(medicalRecords)
    .values({
      patientId: parsed.data.patientId,
      hospitalId: parsed.data.hospitalId || doctor.hospitalId || null,
      doctorId: doctor.id,
      recordType: "clinical_note",
      title: parsed.data.title,
      diagnosis: parsed.data.diagnosis || null,
      notes: parsed.data.notes,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();

  return c.json({ record: row?.medical_records || row }, 201);
});

// GET /doctor-portal/clinical-notes?limit=50&q=
// Cross-patient list of clinical notes authored by the current doctor.
doctorPortalRouter.get("/clinical-notes", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "50", 10) || 50));
  const q = (c.req.query("q") || "").trim().toLowerCase();

  const rows = await db
    .select({
      id: medicalRecords.id,
      patientId: medicalRecords.patientId,
      title: medicalRecords.title,
      diagnosis: medicalRecords.diagnosis,
      notes: medicalRecords.notes,
      date: medicalRecords.date,
      createdAt: medicalRecords.createdAt,
    })
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.doctorId, doctor.id),
        eq(medicalRecords.recordType, "clinical_note")
      )
    )
    .orderBy(desc(medicalRecords.createdAt))
    .limit(limit);

  // Enrich with patient names in one join.
  const patientIds = [...new Set(rows.map((r) => r.patientId).filter(Boolean))];
  let patientMap = new Map<string, { id: string; name: string }>();
  if (patientIds.length) {
    const pRows = await db
      .select({
        id: patients.id,
        name: users.name,
      })
      .from(patients)
      .innerJoin(users, eq(users.id, patients.userId))
      .where(
        or(...patientIds.map((id) => eq(patients.id, id))) as any
      );
    for (const r of pRows) patientMap.set(r.id, { id: r.id, name: r.name });
  }

  let enriched = rows.map((r) => ({
    ...r,
    patient: patientMap.get(r.patientId) || null,
  }));

  if (q) {
    enriched = enriched.filter((r: any) => {
      const hay = [r.title, r.diagnosis, r.notes, r.patient?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return c.json({ notes: enriched, count: enriched.length });
});

// ─── Follow-ups ──────────────────────────────────────────
// POST /doctor-portal/follow-ups
doctorPortalRouter.post("/follow-ups", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = followUpSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [row] = await db
    .insert(medicalRecords)
    .values({
      patientId: parsed.data.patientId,
      hospitalId: parsed.data.hospitalId || doctor.hospitalId || null,
      doctorId: doctor.id,
      recordType: "follow_up",
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      followUpDate: parsed.data.followUpDate,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();

  // Notify patient
  const [patientRow] = await db
    .select({ userId: patients.userId })
    .from(patients)
    .where(eq(patients.id, parsed.data.patientId))
    .limit(1);

  if (patientRow) {
    await db.insert(notifications).values({
      userId: patientRow.userId,
      type: "appointment",
      title: "Follow-up scheduled",
      body: `Follow-up on ${parsed.data.followUpDate}: ${parsed.data.title}`,
      data: JSON.stringify({ recordId: row?.medical_records?.id || row?.id }),
    });
  }

  return c.json({ record: row?.medical_records || row }, 201);
});

// GET /doctor-portal/follow-ups?upcoming=true
doctorPortalRouter.get("/follow-ups", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const upcoming = c.req.query("upcoming") === "true";
  const today = new Date().toISOString().split("T")[0];

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const conditions: any[] = [
    eq(medicalRecords.doctorId, doctor.id),
    eq(medicalRecords.recordType, "follow_up"),
  ];
  if (upcoming) {
    conditions.push(gte(medicalRecords.followUpDate, today));
  }

  const rows = await db
    .select()
    .from(medicalRecords)
    .where(and(...conditions))
    .orderBy(asc(medicalRecords.followUpDate));

  return c.json({ followUps: rows });
});

// PATCH /doctor-portal/follow-ups/:id/status
// Mark a follow-up as completed or cancelled (or back to pending).
doctorPortalRouter.patch("/follow-ups/:id/status", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const allowed = ["pending", "completed", "cancelled"];
  if (!body.status || !allowed.includes(body.status)) {
    return c.json(
      { error: `status must be one of: ${allowed.join(", ")}` },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [own] = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.id, id),
        eq(medicalRecords.doctorId, doctor.id),
        eq(medicalRecords.recordType, "follow_up")
      )
    )
    .limit(1);
  if (!own) return c.json({ error: "Follow-up not found" }, 404);

  const [updated] = await db
    .update(medicalRecords)
    .set({ status: body.status })
    .where(eq(medicalRecords.id, id))
    .returning();

  // Notify the patient that a follow-up changed status (except pending,
  // which is the default and would just be noise).
  if (body.status === "completed" || body.status === "cancelled") {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, own.patientId))
      .limit(1);
    const patientUserId =
      (patient as any)?.patients?.userId ?? (patient as any)?.userId;
    if (patientUserId) {
      await db.insert(notifications).values({
        userId: patientUserId,
        type: "general",
        title:
          body.status === "completed"
            ? "Follow-up completed"
            : "Follow-up cancelled",
        body:
          body.status === "completed"
            ? `Your follow-up "${own.title}" has been marked completed.`
            : `Your follow-up "${own.title}" was cancelled.`,
        data: JSON.stringify({
          followUpId: id,
          status: body.status,
        }),
      });
    }
  }

  return c.json({ record: updated?.medical_records || updated });
});

// ─── Lab orders ──────────────────────────────────────────
// POST /doctor-portal/lab-orders
doctorPortalRouter.post("/lab-orders", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = labOrderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [order] = await db
    .insert(labOrders)
    .values({
      doctorId: doctor.id,
      patientId: parsed.data.patientId,
      hospitalId: parsed.data.hospitalId || doctor.hospitalId || null,
      tests: JSON.stringify(parsed.data.tests),
      priority: parsed.data.priority,
      status: "ordered",
      notes: parsed.data.notes || null,
    })
    .returning();

  // Also create a medical_records entry of type lab_order so the patient's
  // timeline reflects it.
  await db.insert(medicalRecords).values({
    patientId: parsed.data.patientId,
    hospitalId: parsed.data.hospitalId || doctor.hospitalId || null,
    doctorId: doctor.id,
    recordType: "lab_order",
    title: `Lab order — ${parsed.data.tests.join(", ")}`,
    notes: parsed.data.notes || null,
    date: new Date().toISOString().split("T")[0],
  });

  // Notify lab staff (any user with role 'laboratory') — fan-out is small
  // for v2, no fine-grained hospital routing yet.
  const labUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "laboratory"));

  for (const u of labUsers) {
    await db.insert(notifications).values({
      userId: u.id,
      type: "lab_ready",
      title: `New ${parsed.data.priority} lab order`,
      body: `${parsed.data.tests.length} test(s) ordered`,
      data: JSON.stringify({
        orderId: order?.lab_orders?.id || order?.id,
        patientId: parsed.data.patientId,
      }),
    });
  }

  return c.json({ order: order?.lab_orders || order }, 201);
});

// GET /doctor-portal/lab-orders?status=ordered
doctorPortalRouter.get("/lab-orders", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const status = c.req.query("status");

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const conditions: any[] = [eq(labOrders.doctorId, doctor.id)];
  if (status) {
    conditions.push(eq(labOrders.status, status));
  }

  const rows = await db
    .select()
    .from(labOrders)
    .where(and(...conditions))
    .orderBy(desc(labOrders.orderedAt));

  return c.json({ orders: rows });
});

// PUT /doctor-portal/lab-orders/:id
doctorPortalRouter.put("/lab-orders/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json();

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const allowed = [
    "ordered",
    "sample_collected",
    "in_progress",
    "completed",
    "cancelled",
  ];
  if (body.status && !allowed.includes(body.status)) {
    return c.json(
      { error: `status must be one of: ${allowed.join(", ")}` },
      400
    );
  }

  // Ensure ownership
  const [own] = await db
    .select()
    .from(labOrders)
    .where(and(eq(labOrders.id, id), eq(labOrders.doctorId, doctor.id)))
    .limit(1);
  if (!own) return c.json({ error: "Order not found" }, 404);

  const update: any = {};
  if (body.status) update.status = body.status;
  if (body.resultSummary !== undefined) update.resultSummary = body.resultSummary;
  if (body.resultUrl !== undefined) update.resultUrl = body.resultUrl;
  if (body.status === "completed") update.completedAt = new Date().toISOString();

  const [row] = await db
    .update(labOrders)
    .set(update)
    .where(eq(labOrders.id, id))
    .returning();

  // When results come back, ping the patient so they see it in their
  // records and notifications.
  if (body.status === "completed" && own.patientId) {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, own.patientId))
      .limit(1);
    const patientUserId =
      (patient as any)?.patients?.userId ?? (patient as any)?.userId;
    if (patientUserId) {
      await db.insert(notifications).values({
        userId: patientUserId,
        type: "lab_ready",
        title: "Lab results ready",
        body: `Your lab report is ready. Open HealthHub to view it.`,
        data: JSON.stringify({
          orderId: row?.lab_orders?.id || row?.id,
        }),
      });
    }
  }

  return c.json({ order: row?.lab_orders || row });
});

// ─── Availability ────────────────────────────────────────
// GET /doctor-portal/availability
doctorPortalRouter.get("/availability", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const rows = await db
    .select()
    .from(doctorAvailability)
    .where(eq(doctorAvailability.doctorId, doctor.id))
    .orderBy(asc(doctorAvailability.dayOfWeek), asc(doctorAvailability.startTime));

  return c.json({ availability: rows });
});

// PUT /doctor-portal/availability
// Replaces the doctor's weekly schedule wholesale.
doctorPortalRouter.put("/availability", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = availabilitySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  // Replace all rows
  await db
    .delete(doctorAvailability)
    .where(eq(doctorAvailability.doctorId, doctor.id));

  if (parsed.data.schedule.length > 0) {
    await db.insert(doctorAvailability).values(
      parsed.data.schedule.map((s) => ({
        doctorId: doctor.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotMinutes: s.slotMinutes,
        active: s.active,
      }))
    );
  }

  const rows = await db
    .select()
    .from(doctorAvailability)
    .where(eq(doctorAvailability.doctorId, doctor.id));

  return c.json({ availability: rows });
});

// ─── Appointment status ──────────────────────────────────
// POST /doctor-portal/appointments/:id/status
doctorPortalRouter.post("/appointments/:id/status", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = appointmentStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [own] = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.doctorId, doctor.id)))
    .limit(1);
  if (!own) return c.json({ error: "Appointment not found" }, 404);

  const [row] = await db
    .update(appointments)
    .set({ status: parsed.data.status, notes: parsed.data.notes ?? own.notes })
    .where(eq(appointments.id, id))
    .returning();

  // Notify patient of status change — including cancelled so the patient
  // is never left wondering why the slot disappeared.
  const status = parsed.data.status;
  const [patientRow] = await db
    .select({ userId: patients.userId, name: users.name })
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.id, own.patientId))
    .limit(1);

  if (patientRow) {
    const friendly: Record<string, string> = {
      scheduled: "Scheduled",
      confirmed: "Confirmed",
      in_progress: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
      no_show: "Marked as no-show",
    };
    await db.insert(notifications).values({
      userId: patientRow.userId,
      type: "appointment",
      title: `Appointment ${friendly[status] || status}`,
      body:
        status === "cancelled"
          ? `Your appointment on ${own.date} at ${own.time} was cancelled by the doctor.`
          : `Your appointment is now ${friendly[status] || status}.`,
      data: JSON.stringify({ appointmentId: id, status }),
    });
  }

  return c.json({ appointment: row?.appointments || row });
});

// ─── Doctors: search (re-export of /doctor/search) ───────
// Helper for the patient-detail picker: list doctors at the same hospital.
// GET /doctor-portal/colleagues
// Removed (unused): use /doctor/search?hospitalId=... instead.

export default doctorPortalRouter;