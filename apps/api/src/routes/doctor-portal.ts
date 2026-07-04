// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, asc, or, like, gte, lt, isNull, sql } from "drizzle-orm";
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
  followUps,
  vitals,
  notifications,
  doctorAvailability,
  doctorTimeOff,
  labOrders,
  hospitals,
  hospitalStaff,
  appointmentStatusHistory,
  walkIns,
  files,
  hospitalDoctors,
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
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { recordRevenueEvent } from "../lib/revenue";
import { compactQueue } from "../lib/booking";
import { canAccessPatient } from "../lib/access";
import {
  redactLockedRecords,
  lockedFmIdsForPrincipal,
} from "../lib/family-lock";
import { flattenTranslated } from "../lib/validation-error";
import { txWrite, UniqueViolation } from "../lib/tx";
import {
  withStatusGuard,
  atomicIncrement,
  upsertActiveCareTeam,
} from "../lib/status-guard";
import { upsertRecordFts } from "../lib/fts";
import { topSeverity } from "../lib/safety-engine";
import { runSafetyCheck } from "../lib/safety-runner";
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

// Phase MTN-1: tenant resolver for doctor-portal create handlers.
// Priority chain:
//   1. x-active-hospital-id / x-active-clinic-id header (per-request)
//   2. c.get("activeHospitalId") / c.get("activeClinicId") (tenant middleware)
//   3. doctor.hospital_id (legacy single-FK)
async function resolveActiveTenant(
  db: any,
  c: any,
  doctor: any
): Promise<{
  hospitalId: string | null;
  clinicId: string | null;
  isActive: boolean;
}> {
  const hospitalHeader = c.req.header("x-active-hospital-id") || null;
  const clinicHeader = c.req.header("x-active-clinic-id") || null;
  const hospitalMw = c.get("activeHospitalId") || null;
  const clinicMw = c.get("activeClinicId") || null;

  // Header + middleware must agree when both are set (mutex).
  // Header wins, but we verify membership exists.
  if (hospitalHeader) {
    const [hd] = await db
      .select({ id: hospitalDoctors.id })
      .from(hospitalDoctors)
      .where(
        and(
          eq(hospitalDoctors.hospitalId, hospitalHeader),
          eq(hospitalDoctors.doctorId, doctor.id),
          eq(hospitalDoctors.status, "active")
        )
      )
      .limit(1);
    if (hd) return { hospitalId: hospitalHeader, clinicId: null, isActive: true };
  }
  if (clinicHeader) {
    return { hospitalId: null, clinicId: clinicHeader, isActive: true };
  }
  if (hospitalMw) {
    return { hospitalId: hospitalMw, clinicId: null, isActive: true };
  }
  if (clinicMw) {
    return { hospitalId: null, clinicId: clinicMw, isActive: true };
  }
  // Legacy fallback
  return {
    hospitalId:
        c.get("activeHospitalId") || doctor.hospitalId || null,
    clinicId: null,
    isActive: false,
  };
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

  const appts = await db
    .select({
      kind: sql<string>`'appointment'`.as("kind"),
      appointmentId: appointments.id,
      walkInId: sql<string | null>`null`.as("walk_in_id"),
      patientId: patients.id,
      patientName: users.name,
      patientPhoto: users.photo,
      patientPhone: users.phone,
      nic: users.nic,
      bloodGroup: patients.bloodGroup,
      gender: patients.gender,
      date: appointments.date,
      time: appointments.time,
      priority: sql<string | null>`null`.as("priority"),
      status: appointments.status,
      queueNumber: appointments.queueNumber,
      reason: appointments.reason,
      notes: appointments.notes,
      arrivedAt: sql<string | null>`null`.as("arrived_at"),
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

  // Walk-ins that arrived today for this doctor
  const wi = await db
    .select({
      kind: sql<string>`'walkin'`.as("kind"),
      walkInId: walkIns.id,
      patientId: patients.id,
      patientName: users.name,
      patientPhoto: users.photo,
      patientPhone: users.phone,
      nic: users.nic,
      bloodGroup: patients.bloodGroup,
      gender: patients.gender,
      date: sql<string>`substr(${walkIns.arrivedAt}, 1, 10)`.as("date"),
      time: sql<string>`substr(${walkIns.arrivedAt}, 12, 5)`.as("time"),
      priority: walkIns.priority,
      status: walkIns.status,
      queueNumber: sql<number | null>`null`.as("queue_number"),
      reason: walkIns.reason,
      notes: walkIns.notes,
      arrivedAt: walkIns.arrivedAt,
      hospitalId: walkIns.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(walkIns)
    .innerJoin(patients, eq(walkIns.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .leftJoin(hospitals, eq(walkIns.hospitalId, hospitals.id))
    .where(
      and(
        eq(walkIns.doctorId, doctor.id),
        gte(walkIns.arrivedAt, `${date} 00:00:00`),
        lt(walkIns.arrivedAt, `${date} 23:59:59`)
      )
    );

  const rows = [...appts, ...wi].sort((a: any, b: any) => {
    // walk-ins first (most recent), then appointments by queue number
    if (a.kind !== b.kind) return a.kind === "walkin" ? -1 : 1;
    const aSort = `${a.time || ""}-${(a.queueNumber ?? 9999)}`;
    const bSort = `${b.time || ""}-${(b.queueNumber ?? 9999)}`;
    return aSort.localeCompare(bSort);
  });

  return c.json({ date, count: rows.length, queue: rows });
});

// ─── Patient summary (doctor view) ───────────────────────
// GET /doctor-portal/patients/:id/summary
//
// P0 audit fix: previously this endpoint read any patient's records by
// id without a relationship gate — any doctor with a profile could
// fetch the full PHI bundle. Now:
//   1. canAccessPatient() enforces the doctor↔patient relationship
//      (appointment / prescription / lab order / medical record /
//      walk-in / messages conversation / patient-issued share link).
//   2. Family-member privacy lock is honoured via redactLockedRecords,
//      so a locked FM's diagnoses/notes are scrubbed even though the
//      record still appears in the timeline.
doctorPortalRouter.get("/patients/:id/summary", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patientId = c.req.param("id");
  if (!patientId) return c.json({ error: "Missing patient id" }, 400);

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const access = await canAccessPatient(db, userId, "doctor", patientId);
  if (!access.allowed) {
    return c.json(
      { error: access.reason || "Forbidden", code: "no_relationship" },
      403
    );
  }

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
  const rawRecords = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patientId))
    .orderBy(desc(medicalRecords.date))
    .limit(50);

  // P0: family privacy lock — doctor sees record slots for locked FMs
  // but PHI is scrubbed. Doctors still see the record exists so they
  // can ask the patient to unlock if a consult requires it.
  const lockedFmIds = await lockedFmIdsForPrincipal(db, patientId);
  const records = redactLockedRecords(rawRecords, lockedFmIds);

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
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [row] = await db
    .insert(medicalRecords)
    .values({
      patientId: parsed.data.patientId,
      hospitalId:
        parsed.data.hospitalId ||
        c.get("activeHospitalId") ||
        doctor.hospitalId ||
        null,
      doctorId: doctor.id,
      recordType: "clinical_note",
      title: parsed.data.title,
      diagnosis: parsed.data.diagnosis || null,
      notes: parsed.data.notes,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();

  // Phase 2.1: FTS5 sync.
  if (row) await upsertRecordFts(db, row);

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
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const [row] = await db
    .insert(medicalRecords)
    .values({
      patientId: parsed.data.patientId,
      hospitalId:
        parsed.data.hospitalId ||
        c.get("activeHospitalId") ||
        doctor.hospitalId ||
        null,
      doctorId: doctor.id,
      recordType: "follow_up",
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      followUpDate: parsed.data.followUpDate,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();

  // Phase 2.1: FTS5 sync.
  if (row) await upsertRecordFts(db, row);

  // Notify patient
  const [patientRow] = await db
    .select({ userId: patients.userId })
    .from(patients)
    .where(eq(patients.id, parsed.data.patientId))
    .limit(1);

  if (patientRow) {
    await notify({
      db,
      userId: patientRow.userId,
      type: "appointment",
      title: "Follow-up scheduled",
      body: `Follow-up on ${parsed.data.followUpDate}: ${parsed.data.title}`,
      data: { recordId: row?.medical_records?.id || row?.id, kind: "follow_up" },
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
      await notify({
        db,
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
        data: { followUpId: id, status: body.status },
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
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
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
      hospitalId:
        parsed.data.hospitalId ||
        c.get("activeHospitalId") ||
        doctor.hospitalId ||
        null,
      tests: JSON.stringify(parsed.data.tests),
      priority: parsed.data.priority,
      status: "ordered",
      notes: parsed.data.notes || null,
    })
    .returning();

  // Also create a medical_records entry of type lab_order so the patient's
  // timeline reflects it.
  const [labMirror] = await db
    .insert(medicalRecords)
    .values({
      patientId: parsed.data.patientId,
      hospitalId:
        parsed.data.hospitalId ||
        c.get("activeHospitalId") ||
        doctor.hospitalId ||
        null,
      doctorId: doctor.id,
      recordType: "lab_order",
      title: `Lab order — ${parsed.data.tests.join(", ")}`,
      notes: parsed.data.notes || null,
      date: new Date().toISOString().split("T")[0],
    })
    .returning();
  // Phase 2.1: FTS5 sync.
  if (labMirror) await upsertRecordFts(db, labMirror);

  // Phase 1: backfill care team. Idempotent — existing primary_care
  // row stays, this is no-op on conflict.
  await upsertActiveCareTeam(db, {
    patientId: parsed.data.patientId,
    doctorId: doctor.id,
    role: "primary_care",
    invitedByUserId: userId,
  });

  // Notify lab staff — hospital-scoped first, global fallback.
  const orderId = order?.lab_orders?.id || order?.id;
  let labUsers: { id: string }[] = [];
  if (doctor?.hospitalId) {
    const scoped = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(hospitalStaff, eq(hospitalStaff.userId, users.id))
      .where(
        and(
          eq(users.role, "laboratory"),
          eq(hospitalStaff.hospitalId, doctor.hospitalId),
          eq(hospitalStaff.active, true)
        )
      );
    labUsers = scoped;
  }
  if (labUsers.length === 0) {
    labUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "laboratory"));
  }
  for (const u of labUsers) {
    await notify({
      db,
      userId: u.id,
      type: "lab_ready",
      title: `New ${parsed.data.priority} lab order`,
      body: `${parsed.data.tests.length} test(s) ordered`,
      data: { orderId, patientId: parsed.data.patientId },
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
      await notify({
        db,
        userId: patientUserId,
        type: "lab_ready",
        title: "Lab results ready",
        body: `Your lab report is ready. Open HealthHub to view it.`,
        data: { orderId: row?.lab_orders?.id || row?.id },
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
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
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

// ─── Doctor Time Off ─────────────────────────────────────
// GET /doctor-portal/time-off?from=YYYY-MM-DD&to=YYYY-MM-DD
doctorPortalRouter.get("/time-off", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const from = c.req.query("from");
  const to = c.req.query("to");

  const whereParts: any[] = [eq(doctorTimeOff.doctorId, doctor.id)];
  if (from) whereParts.push(gte(doctorTimeOff.date, from));
  if (to) whereParts.push(lt(doctorTimeOff.date, to));

  const rows = await db
    .select()
    .from(doctorTimeOff)
    .where(and(...whereParts))
    .orderBy(asc(doctorTimeOff.date));

  return c.json({ timeOff: rows });
});

// POST /doctor-portal/time-off { date, startTime?, endTime?, reason? }
doctorPortalRouter.post("/time-off", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const date = String(body?.date || "").trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "date (YYYY-MM-DD) required" }, 400);
  }
  const startTime = body?.startTime ? String(body.startTime) : null;
  const endTime = body?.endTime ? String(body.endTime) : null;
  const reason = body?.reason ? String(body.reason).slice(0, 200) : null;

  const [row] = await db
    .insert(doctorTimeOff)
    .values({
      doctorId: doctor.id,
      date,
      startTime,
      endTime,
      reason,
    } as any)
    .returning();
  return c.json({ timeOff: row }, 201);
});

// DELETE /doctor-portal/time-off/:id
doctorPortalRouter.delete("/time-off/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const id = c.req.param("id");
  const [own] = await db
    .select()
    .from(doctorTimeOff)
    .where(and(eq(doctorTimeOff.id, id), eq(doctorTimeOff.doctorId, doctor.id)))
    .limit(1);
  if (!own) return c.json({ error: "Not found" }, 404);
  await db.delete(doctorTimeOff).where(eq(doctorTimeOff.id, id));
  return c.json({ ok: true });
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
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
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
    await notify({
      db,
      userId: patientRow.userId,
      type: "appointment",
      title: `Appointment ${friendly[status] || status}`,
      body:
        status === "cancelled"
          ? `Your appointment on ${own.date} at ${own.time} was cancelled by the doctor.`
          : `Your appointment is now ${friendly[status] || status}.`,
      data: { appointmentId: id, status },
    });
  }

  // Audit + status history.
  await audit(db, {
    userId,
    action: "appointment.status_change",
    resource: "appointment",
    resourceId: id,
    details: { from: own.status, to: parsed.data.status },
  });
  await db.insert(appointmentStatusHistory).values({
    appointmentId: id,
    fromStatus: own.status,
    toStatus: parsed.data.status,
    changedByUserId: userId,
  } as any);

  // If doctor just cancelled a previously active slot, free queue numbers.
  if (
    ["cancelled", "no_show"].includes(parsed.data.status) &&
    ["scheduled", "confirmed", "in_progress"].includes(own.status)
  ) {
    await compactQueue(db, own.doctorId, own.date, own.time);
  }

  // Phase 4: billable event when the doctor marks the appointment
  // completed. Idempotent via the unique index.
  if (parsed.data.status === "completed" && own.status !== "completed") {
    await recordRevenueEvent({
      db,
      doctorId: own.doctorId,
      sourceKind: "appointment",
      sourceId: id,
      patientId: own.patientId,
    });
  }

  return c.json({ appointment: row?.appointments || row });
});

// ─── Doctors: search (re-export of /doctor/search) ───────
// Helper for the patient-detail picker: list doctors at the same hospital.
// GET /doctor-portal/colleagues
// Removed (unused): use /doctor/search?hospitalId=... instead.

// ─── V4: Doctor cross-patient records hub ────────────────
// GET /doctor-portal/records?q=&type=&patientId=&archived=&tags=&sort=&limit=&offset=
// Lists medical records across every patient this doctor has a relationship
// with (appointment / prescription / lab_order / medical_record) plus
// records they authored directly. Same query primitives as /medical-records/me
// but scoped to the doctor's patient set.
doctorPortalRouter.get("/records", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  const typeFilter = c.req.query("type");
  const qRaw = (c.req.query("q") || "").trim();
  const tagsCsv = (c.req.query("tags") || "").trim();
  const archivedParam = c.req.query("archived"); // "all" | "only" | default active
  const patientId = c.req.query("patientId") || "";
  const sortMode = (c.req.query("sort") || "newest") as
    | "newest"
    | "oldest"
    | "relevance";

  // ─── Resolve doctor's accessible patient set ────────
  // Union of: any patient this doctor has appointment/prescription/labOrder/medicalRecord for,
  // PLUS any patient in records where doctorId = me.
  const linkedRows = await db
    .select({ patientId: appointments.patientId })
    .from(appointments)
    .where(eq(appointments.doctorId, doctor.id));
  const rxRows = await db
    .select({ patientId: prescriptions.patientId })
    .from(prescriptions)
    .where(eq(prescriptions.doctorId, doctor.id));
  const labRows = await db
    .select({ patientId: labOrders.patientId })
    .from(labOrders)
    .where(eq(labOrders.doctorId, doctor.id));
  const mrRows = await db
    .select({ patientId: medicalRecords.patientId })
    .from(medicalRecords)
    .where(eq(medicalRecords.doctorId, doctor.id));

  const patientIdSet = new Set<string>();
  for (const r of [...linkedRows, ...rxRows, ...labRows, ...mrRows]) {
    if ((r as any).patientId) patientIdSet.add((r as any).patientId);
  }
  const linkedPatientIds = Array.from(patientIdSet);

  if (linkedPatientIds.length === 0) {
    return c.json({ records: [], total: 0, limit, offset });
  }

  const inScopeIds = patientId ? [patientId] : linkedPatientIds;

  // ─── Build WHERE ─────────────────────────────────────
  const whereParts: any[] = [inArray(medicalRecords.patientId, inScopeIds)];

  if (archivedParam === "only") {
    whereParts.push(isNotNull(medicalRecords.archivedAt));
  } else if (archivedParam !== "all") {
    whereParts.push(isNull(medicalRecords.archivedAt));
  }

  if (typeFilter) whereParts.push(eq(medicalRecords.recordType, typeFilter as any));

  if (tagsCsv) {
    const wanted = tagsCsv.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (wanted.length) {
      whereParts.push(sql`EXISTS (
        SELECT 1 FROM json_each(${medicalRecords.tags}) AS je
        WHERE je.value IN (${sql.join(
          wanted.map((t) => sql`${t}`),
          sql`, `
        )})
      )`);
    }
  }

  if (qRaw) {
    const like = `%${qRaw.replace(/[%_]/g, "\\$&")}%`;
    const likeCol = (col: any) => sql`${col} LIKE ${like} ESCAPE '\\'`;
    whereParts.push(
      or(
        likeCol(medicalRecords.title),
        likeCol(medicalRecords.diagnosis),
        likeCol(medicalRecords.summary),
        likeCol(medicalRecords.notes),
        likeCol(medicalRecords.recordType),
        likeCol(medicalRecords.extractedData)
      )
    );
  }

  let orderClause: any[] = [
    desc(medicalRecords.date),
    desc(medicalRecords.createdAt),
  ];
  if (sortMode === "oldest") orderClause = [sql`${medicalRecords.date} ASC`];

  const records = await db
    .select()
    .from(medicalRecords)
    .where(and(...whereParts))
    .orderBy(...orderClause)
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(medicalRecords)
    .where(and(...whereParts));
  const total = Number(totalRows[0]?.c ?? 0);

  // ─── Enrich ──────────────────────────────────────────
  const recordIds = records.map((r: any) => r.id);
  const fileCounts: Record<string, { count: number; first?: any }> = {};
  if (recordIds.length) {
    const allFiles = await db
      .select()
      .from(files)
      .where(inArray(files.recordId, recordIds));
    for (const f of allFiles as any[]) {
      if (!f.recordId) continue;
      const bucket = fileCounts[f.recordId] || { count: 0 };
      bucket.count += 1;
      if (!bucket.first) bucket.first = f;
      fileCounts[f.recordId] = bucket;
    }
  }

  const hospitalIds = Array.from(
    new Set(records.map((r: any) => r.hospitalId).filter(Boolean))
  ) as string[];
  const hospitalMap: Record<string, any> = {};
  if (hospitalIds.length) {
    const rows = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .where(inArray(hospitals.id, hospitalIds));
    for (const h of rows) hospitalMap[h.id] = { id: h.id, name: h.name };
  }

  // Patient name resolution for the row.
  const patientIds = Array.from(
    new Set(records.map((r: any) => r.patientId).filter(Boolean))
  ) as string[];
  const patientMap: Record<string, { id: string; name: string; photo: string | null }> = {};
  if (patientIds.length) {
    const rows = await db
      .select({
        id: patients.id,
        userId: patients.userId,
        name: users.name,
        photo: users.photo,
      })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.id))
      .where(inArray(patients.id, patientIds));
    for (const r of rows) {
      patientMap[r.id] = { id: r.id, name: r.name, photo: r.photo || null };
    }
  }

  return c.json({
    records: records.map((r: any) => ({
      ...r,
      tags: (() => {
        if (!r.tags) return [];
        try {
          const v = JSON.parse(r.tags);
          return Array.isArray(v) ? v.filter((x: any) => typeof x === "string") : [];
        } catch {
          return [];
        }
      })(),
      attachments: fileCounts[r.id] || { count: 0 },
      hospital: r.hospitalId ? hospitalMap[r.hospitalId] || null : null,
      patient: patientMap[r.patientId] || null,
    })),
    total,
    limit,
    offset,
  });
});

// ─── V3: Visit summary (one-shot clinical write-up) ────
// POST /doctor-portal/visit-summary
//   {
//     patientId, appointmentId?,
//     title,            // e.g. "Visit 2024-03-12"
//     diagnosis?,       // ICD-style or free text
//     subjective?,      // SOAP: what patient said
//     objective?,       // SOAP: exam / vitals / labs reviewed
//     assessment?,      // SOAP: clinical impression
//     plan?,            // SOAP: treatment plan / instructions
//     notes?,           // free-form addition
//     prescriptionItems?:  [{ name, dosage, frequency, duration, instructions }],
//     labOrders?:         [{ testName, instructions? }],
//     followUp?:          { followUpDate, title, notes? },
//     markAppointmentCompleted?: boolean,
//   }
//
// P2 atomicity refactor: visit-summary used to be six sequential writes
// (visit record + N prescriptions + N mirrors + N lab mirrors +
// follow-up + appointment status flip) — a crash mid-loop left orphan
// prescriptions without their chart mirror, or a "completed" appointment
// with no actual clinical record. Now the entire payload is wrapped in
// a single SQLite transaction. If anything in the loop throws, SQLite
// rolls the whole batch back. Read-only safety/wellness checks remain
// outside the transaction so a 409 surface exactly the same way as
// before.
doctorPortalRouter.post("/visit-summary", async (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole") || (c.get("dbUser") as any)?.role;
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));

  if (userRole !== "doctor") {
    return c.json({ error: "Doctor role required" }, 403);
  }
  const patientId = String(body.patientId || "").trim();
  if (!patientId) return c.json({ error: "patientId is required" }, 400);

  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const title = String(body.title || `Visit ${new Date().toISOString().slice(0, 10)}`).slice(0, 200);
  const diagnosis = body.diagnosis ? String(body.diagnosis).slice(0, 500) : null;
  const subjective = body.subjective ? String(body.subjective).slice(0, 4000) : null;
  const objective = body.objective ? String(body.objective).slice(0, 4000) : null;
  const assessment = body.assessment ? String(body.assessment).slice(0, 4000) : null;
  const plan = body.plan ? String(body.plan).slice(0, 4000) : null;
  const notes = body.notes ? String(body.notes).slice(0, 2000) : null;
  const appointmentId = body.appointmentId ? String(body.appointmentId) : null;

  // Compose a single SOAP-style summary for the patient's chart
  const soapParts: string[] = [];
  if (subjective) soapParts.push(`SUBJECTIVE\n${subjective}`);
  if (objective) soapParts.push(`OBJECTIVE\n${objective}`);
  if (assessment) soapParts.push(`ASSESSMENT\n${assessment}`);
  if (plan) soapParts.push(`PLAN\n${plan}`);
  const summary = soapParts.length ? soapParts.join("\n\n") : null;

  const today = new Date().toISOString().slice(0, 10);

  const prescriptionItems: any[] = Array.isArray(body.prescriptionItems)
    ? body.prescriptionItems
    : [];
  const labOrderItems: any[] = Array.isArray(body.labOrders) ? body.labOrders : [];

  // Safety pre-flight OUTSIDE the transaction. Pure-read: warns if any
  // prescription item has a critical allergy / severe interaction.
  const safetyCandidates = prescriptionItems
    .filter((p) => p && p.name)
    .map((p) => ({ name: String(p.name) }));
  if (safetyCandidates.length) {
    const safetyWarnings = await runSafetyCheck(db, patientId, safetyCandidates);
    const safetyTop = topSeverity(safetyWarnings);
    const BLOCKING = (s?: string | null) => s === "severe" || s === "critical";
    const override = c.req.header("X-Confirm-Warning") === "true";
    if (BLOCKING(safetyTop) && !override) {
      return c.json(
        {
          error: "Safety warning",
          requiresConfirmation: true,
          warnings: safetyWarnings,
          severity: safetyTop,
          message: `Severe safety warning detected (${safetyTop}). Confirm to proceed.`,
        },
        409
      );
    }
  }

  // ─── ATOMIC WRITE BATCH ─────────────────────────────────
  const result = await txWrite(db, async (tx) => {
    // 1) Visit record
    const [visit] = await tx
      .insert(medicalRecords)
      .values({
        patientId,
        hospitalId:
        c.get("activeHospitalId") || doctor.hospitalId || null,
        doctorId: doctor.id,
        recordType: "clinical_note",
        title,
        diagnosis,
        summary,
        notes,
        date: today,
        appointmentId,
      } as any)
      .returning();

    if (visit) await upsertRecordFts(tx, visit);

    // 2) Prescriptions + their chart mirrors
    const createdPrescriptions: any[] = [];
    for (const p of prescriptionItems) {
      if (!p?.name) continue;
      const [rx] = await tx
        .insert(prescriptions)
        .values({
          patientId,
          doctorId: doctor.id,
          hospitalId:
        c.get("activeHospitalId") || doctor.hospitalId || null,
          diagnosis: diagnosis || title,
          notes: p.instructions ? String(p.instructions).slice(0, 1000) : null,
        } as any)
        .returning();
      const [rxRecord] = await tx
        .insert(medicalRecords)
        .values({
          patientId,
          hospitalId:
        c.get("activeHospitalId") || doctor.hospitalId || null,
          doctorId: doctor.id,
          recordType: "prescription",
          title: `Prescription: ${String(p.name).slice(0, 100)}`,
          notes: [p.dosage, p.frequency, p.duration, p.instructions]
            .filter(Boolean)
            .join(" • ")
            .slice(0, 500) || null,
          date: today,
          appointmentId,
        } as any)
        .returning();
      if (rxRecord) await upsertRecordFts(tx, rxRecord);
      createdPrescriptions.push({ prescription: rx, record: rxRecord });
    }

    // 3) Lab-order mirrors
    const createdLabs: any[] = [];
    for (const l of labOrderItems) {
      if (!l?.testName) continue;
      const [labRec] = await tx
        .insert(medicalRecords)
        .values({
          patientId,
          hospitalId:
        c.get("activeHospitalId") || doctor.hospitalId || null,
          doctorId: doctor.id,
          recordType: "lab_order",
          title: `Lab order: ${String(l.testName).slice(0, 100)}`,
          notes: l.instructions ? String(l.instructions).slice(0, 500) : null,
          date: today,
          appointmentId,
        } as any)
        .returning();
      if (labRec) await upsertRecordFts(tx, labRec);
      createdLabs.push(labRec);
    }

    // 4) Follow-up
    let createdFollowUp: any = null;
    if (body.followUp?.followUpDate && body.followUp?.title) {
      const fu = body.followUp;
      const [fuRec] = await tx
        .insert(medicalRecords)
        .values({
          patientId,
          hospitalId:
        c.get("activeHospitalId") || doctor.hospitalId || null,
          doctorId: doctor.id,
          recordType: "follow_up",
          title: String(fu.title).slice(0, 200),
          notes: fu.notes ? String(fu.notes).slice(0, 1000) : null,
          followUpDate: String(fu.followUpDate).slice(0, 10),
          date: today,
          appointmentId,
        } as any)
        .returning();
      // Phase 2.1: FTS5 sync — follow-up mirror joins the search index.
      if (fuRec) await upsertRecordFts(tx, fuRec);
      createdFollowUp = fuRec;
    }

    // 5) Mark appointment completed (if requested) — guarded by
    // withStatusGuard so two concurrent completions can't both
    // succeed. Returns the previous status so callers can detect
    // the race.
    let completedAppointment: { id: string; previousStatus: string } | null = null;
    if (body.appointmentId && body.markAppointmentCompleted !== false) {
      const apptId = String(body.appointmentId);
      const [ownAppt] = await tx
        .select({ id: appointments.id, status: appointments.status })
        .from(appointments)
        .where(
          and(
            eq(appointments.id, apptId),
            eq(appointments.doctorId, doctor.id)
          )
        )
        .limit(1);
      if (ownAppt) {
        const guard = await withStatusGuard(
          tx,
          appointments,
          ownAppt.id,
          ["scheduled", "confirmed", "in_progress"],
          { status: "completed" }
        );
        if (guard.changed) {
          await tx.insert(appointmentStatusHistory).values({
            appointmentId: ownAppt.id,
            fromStatus: ownAppt.status,
            toStatus: "completed",
            changedByUserId: userId,
          } as any);
          completedAppointment = {
            id: ownAppt.id,
            previousStatus: ownAppt.status,
          };
        }
      }
    }

    return {
      visit,
      prescriptions: createdPrescriptions,
      labOrders: createdLabs,
      followUp: createdFollowUp,
      completedAppointment,
    };
  });

  // ─── POST-TX SIDE EFFECTS ─────────────────────────────────
  // Best-effort: notifications, audit, and revenue event recording.
  // These do not block the HTTP response on success/failure. Audit
  // failures are silently dropped (the audit module logs them
  // internally) — the patient's chart is already correct.
  if (result.visit) {
    audit(db, {
      userId,
      action: "visit_summary.create",
      resource: "visit_summary",
      resourceId: (result.visit as any).id,
      details: {
        patientId,
        prescriptionCount: result.prescriptions.length,
        labOrderCount: result.labOrders.length,
        followUp: !!result.followUp,
        appointmentCompleted: !!result.completedAppointment,
      },
    }).catch(() => {});
  }

  if (result.completedAppointment) {
    // Revenue event for the just-completed appointment. recordRevenueEvent
    // is idempotent via the (doctor, source_kind, source_id) UNIQUE
    // index, so retries are safe.
    recordRevenueEvent({
      db,
      doctorId: doctor.id,
      sourceKind: "appointment",
      sourceId: result.completedAppointment.id,
      patientId,
    }).catch(() => {});
  }

  return c.json(
    {
      visit: result.visit,
      prescriptions: result.prescriptions,
      labOrders: result.labOrders,
      followUp: result.followUp,
    },
    201
  );
});

export default doctorPortalRouter;