// @ts-nocheck
// HOS-14: Inter-hospital record sharing. Mounted at /hospital-share-requests.
//
// Endpoints:
//   POST   /                        — requester hospital admin/staff creates
//   GET    /outgoing                — requests I (my hospital) sent
//   GET    /incoming                — requests targeting my hospital
//   GET    /:id                     — full detail + events + patient summary
//   POST   /:id/approve             — source hospital admin approves
//   POST   /:id/decline             — source hospital admin declines
//   POST   /:id/revoke              — either side revokes
//   GET    /:id/bundle              — once approved: fetch the requested patient bundle
//   GET    /:id/events              — event timeline

import { Hono } from "hono";
import { and, desc, eq, like, or } from "drizzle-orm";
import {
  hospitals,
  hospitalShareRequests,
  hospitalShareRequestEvents,
  hospitalPatients,
  hospitalStaff,
  hospitalDoctors,
  patients,
  users,
  admissions,
  medicalRecords,
  prescriptions,
  labOrders,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { notify } from "../lib/notifications";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

router.use(
  "*",
  authMiddleware,
  requireRole("hospital_admin", "hospital_staff", "doctor", "super_admin")
);

// ── helpers ───────────────────────────────────────────────

function genId(): string {
  const c = crypto as unknown as { randomUUID?: () => string };
  return c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}

function genToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isoPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

function myHospitalId(c: any): string | null {
  return c.get("activeHospitalId") || null;
}

async function myHospitalAdmins(db: any, hospitalId: string) {
  // Hospital admins (hospital_admin role tied to hospitals.user_id) + staff
  const adminRows = await db
    .select({ userId: hospitals.userId })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);
  const staffRows = await db
    .select({ userId: hospitalStaff.userId })
    .from(hospitalStaff)
    .where(eq(hospitalStaff.hospitalId, hospitalId));
  const doctorRows = await db
    .select({ userId: users.id })
    .from(hospitalDoctors)
    .innerJoin(
      (await import("@healthcare/db")).doctors,
      eq((await import("@healthcare/db")).doctors.id, hospitalDoctors.doctorId)
    )
    .innerJoin(users, eq(users.id, (await import("@healthcare/db")).doctors.userId))
    .where(eq(hospitalDoctors.hospitalId, hospitalId));
  const set = new Set<string>();
  for (const r of adminRows) if (r.userId) set.add(r.userId);
  for (const r of staffRows) if (r.userId) set.add(r.userId);
  for (const r of doctorRows) if (r.userId) set.add(r.userId);
  return Array.from(set);
}

async function logEvent(
  db: any,
  requestId: string,
  kind: string,
  actorUserId: string | null,
  details?: Record<string, any>
) {
  await db.insert(hospitalShareRequestEvents).values({
    id: genId(),
    requestId,
    kind,
    actorUserId,
    details: details ? JSON.stringify(details) : null,
    createdAt: new Date().toISOString(),
  });
}

async function listRequesterUserIds(db: any, hospitalId: string) {
  const ids = await myHospitalAdmins(db, hospitalId);
  return ids;
}

// ── POST / — create request ───────────────────────────────

router.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const {
    sourceHospitalId,
    patientId,
    scope = "full",
    reason,
    ttlHours = 24,
  } = body || {};

  if (!sourceHospitalId || !patientId || !reason) {
    return c.json(
      { error: "sourceHospitalId, patientId, and reason are required" },
      400
    );
  }
  if (sourceHospitalId === myId) {
    return c.json({ error: "Cannot request from your own hospital" }, 400);
  }
  if (!["full", "records", "prescriptions", "lab"].includes(scope)) {
    return c.json({ error: "invalid scope" }, 400);
  }
  const hours = Math.max(1, Math.min(168, Number(ttlHours) || 24));

  // Patient must be registered at source hospital.
  const [reg] = await db
    .select()
    .from(hospitalPatients)
    .where(
      and(
        eq(hospitalPatients.hospitalId, sourceHospitalId),
        eq(hospitalPatients.patientId, patientId)
      )
    )
    .limit(1);
  if (!reg) {
    return c.json(
      { error: "Patient not registered at source hospital" },
      404
    );
  }

  const id = genId();
  const token = genToken();
  const now = new Date().toISOString();
  await db.insert(hospitalShareRequests).values({
    id,
    requesterHospitalId: myId,
    sourceHospitalId,
    patientId,
    requestedByUserId: userId,
    scope,
    reason: String(reason).slice(0, 500),
    status: "pending",
    token,
    expiresAt: isoPlusHours(hours),
    createdAt: now,
  });
  await logEvent(db, id, "requested", userId, { scope, ttlHours: hours });

  // Notify source hospital admins/staff.
  const recipientIds = await listRequesterUserIds(db, sourceHospitalId);
  const [patient] = await db
    .select({ userId: patients.userId })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  const [requesterH] = await db
    .select({ name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, myId))
    .limit(1);
  for (const recipientId of recipientIds) {
    if (recipientId === userId) continue;
    await notify({
      db,
      userId: recipientId,
      type: "hospital_request",
      title: "Patient record requested",
      body: `${requesterH?.name ?? "A hospital"} requests patient chart access`,
      data: {
        kind: "hospital_request_incoming",
        requestId: id,
        requesterHospitalId: myId,
        requesterHospitalName: requesterH?.name ?? null,
        patientId,
        patientUserId: patient?.userId ?? null,
        scope,
      },
    });
  }

  await writeAudit(db, {
    userId,
    action: "share_request.create",
    resource: "hospital_share_request",
    resourceId: id,
    details: { sourceHospitalId, patientId, scope, ttlHours: hours },
  });

  return c.json({ id, status: "pending", expiresAt: isoPlusHours(hours) }, 201);
});

// ── GET /outgoing — requests I sent ───────────────────────

router.get("/outgoing", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });

  const rows = await db
    .select({
      req: hospitalShareRequests,
      source: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(hospitalShareRequests)
    .innerJoin(hospitals, eq(hospitals.id, hospitalShareRequests.sourceHospitalId))
    .innerJoin(patients, eq(patients.id, hospitalShareRequests.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(hospitalShareRequests.requesterHospitalId, myId))
    .orderBy(desc(hospitalShareRequests.createdAt))
    .limit(200);

  return c.json({ items: rows });
});

// ── GET /incoming — requests targeting me ──────────────────

router.get("/incoming", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });

  const rows = await db
    .select({
      req: hospitalShareRequests,
      requester: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(hospitalShareRequests)
    .innerJoin(hospitals, eq(hospitals.id, hospitalShareRequests.requesterHospitalId))
    .innerJoin(patients, eq(patients.id, hospitalShareRequests.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(hospitalShareRequests.sourceHospitalId, myId))
    .orderBy(desc(hospitalShareRequests.createdAt))
    .limit(200);

  return c.json({ items: rows });
});

// ── GET /source-patients — patients registered at another hospital ─

router.get("/source-patients", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ patients: [] });

  const sourceHospitalId = (c.req.query("sourceHospitalId") ?? "").trim();
  if (!sourceHospitalId) {
    return c.json({ error: "sourceHospitalId is required" }, 400);
  }
  if (sourceHospitalId === myId) {
    return c.json({ error: "Cannot request from your own hospital" }, 400);
  }

  const [sourceH] = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(eq(hospitals.id, sourceHospitalId))
    .limit(1);
  if (!sourceH) return c.json({ error: "Source hospital not found" }, 404);

  const q = (c.req.query("q") ?? "").trim();
  const whereParts: any[] = [
    eq(hospitalPatients.hospitalId, sourceHospitalId),
    eq(hospitalPatients.status, "registered"),
  ];
  if (q) {
    const pattern = `%${q}%`;
    whereParts.push(
      or(
        like(users.name, pattern),
        like(users.phone, pattern),
        like(users.email, pattern),
        like(hospitalPatients.mrn, pattern)
      )
    );
  }

  const rows = await db
    .select({
      id: patients.id,
      name: users.name,
      mrn: hospitalPatients.mrn,
      phone: users.phone,
      gender: patients.gender,
      dateOfBirth: patients.dateOfBirth,
    })
    .from(hospitalPatients)
    .innerJoin(patients, eq(patients.id, hospitalPatients.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(...whereParts))
    .orderBy(desc(hospitalPatients.registeredAt))
    .limit(100);

  return c.json({ patients: rows });
});

// ── GET /:id — detail + events ─────────────────────────────

router.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const myId = myHospitalId(c);

  const [row] = await db
    .select({
      req: hospitalShareRequests,
      requester: { id: hospitals.id, name: hospitals.name },
    })
    .from(hospitalShareRequests)
    .innerJoin(hospitals, eq(hospitals.id, hospitalShareRequests.requesterHospitalId))
    .where(eq(hospitalShareRequests.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);

  if (
    myId &&
    row.req.requesterHospitalId !== myId &&
    row.req.sourceHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }

  const [patient] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, row.req.patientId))
    .limit(1);

  const [sourceH] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, row.req.sourceHospitalId))
    .limit(1);

  return c.json({
    request: row.req,
    requester: row.requester,
    source: sourceH,
    patient: patient?.patient ?? null,
    user: patient?.user ?? null,
  });
});

// ── GET /:id/events ───────────────────────────────────────

router.get("/:id/events", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const myId = myHospitalId(c);

  const [req] = await db
    .select()
    .from(hospitalShareRequests)
    .where(eq(hospitalShareRequests.id, id))
    .limit(1);
  if (!req) return c.json({ items: [] });
  if (
    myId &&
    req.requesterHospitalId !== myId &&
    req.sourceHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ items: [] });
  }

  const rows = await db
    .select({
      ev: hospitalShareRequestEvents,
      actor: { id: users.id, name: users.name },
    })
    .from(hospitalShareRequestEvents)
    .leftJoin(users, eq(users.id, hospitalShareRequestEvents.actorUserId))
    .where(eq(hospitalShareRequestEvents.requestId, id))
    .orderBy(desc(hospitalShareRequestEvents.createdAt))
    .limit(200);

  return c.json({ items: rows });
});

// ── POST /:id/approve ─────────────────────────────────────

router.post("/:id/approve", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [row] = await db
    .select()
    .from(hospitalShareRequests)
    .where(eq(hospitalShareRequests.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.sourceHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the source hospital can approve" }, 403);
  }
  if (row.status !== "pending") {
    return c.json({ error: `request is ${row.status}` }, 409);
  }
  if (new Date(row.expiresAt) < new Date()) {
    await db
      .update(hospitalShareRequests)
      .set({ status: "expired" })
      .where(eq(hospitalShareRequests.id, id));
    return c.json({ error: "request has expired" }, 410);
  }

  const now = new Date().toISOString();
  await db
    .update(hospitalShareRequests)
    .set({
      status: "approved",
      approvedAt: now,
      approvedByUserId: userId,
    })
    .where(eq(hospitalShareRequests.id, id));
  await logEvent(db, id, "approved", userId);

  // Notify requester hospital admins + post-hoc patient notification.
  const recipientIds = await listRequesterUserIds(db, row.requesterHospitalId);
  for (const rid of recipientIds) {
    await notify({
      db,
      userId: rid,
      type: "hospital_request",
      title: "Patient record access approved",
      body: "Your hospital can now view the requested chart",
      data: {
        kind: "hospital_request_approved",
        requestId: id,
        sourceHospitalId: row.sourceHospitalId,
      },
    });
  }

  // Post-hoc patient notification.
  const [p] = await db
    .select({ userId: patients.userId })
    .from(patients)
    .where(eq(patients.id, row.patientId))
    .limit(1);
  if (p?.userId) {
    await notify({
      db,
      userId: p.userId,
      type: "hospital_request",
      title: "Your medical record was shared",
      body: "Another hospital's staff can now view your chart for the stated clinical purpose.",
      data: {
        kind: "hospital_request_patient_notice",
        requestId: id,
        requesterHospitalId: row.requesterHospitalId,
        sourceHospitalId: row.sourceHospitalId,
        scope: row.scope,
      },
    });
    await logEvent(db, id, "notified_patient", userId);
  }

  await writeAudit(db, {
    userId,
    action: "share_request.approve",
    resource: "hospital_share_request",
    resourceId: id,
    details: { requesterHospitalId: row.requesterHospitalId, patientId: row.patientId },
  });

  return c.json({ ok: true });
});

// ── POST /:id/decline ─────────────────────────────────────

router.post("/:id/decline", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "").slice(0, 500);

  const [row] = await db
    .select()
    .from(hospitalShareRequests)
    .where(eq(hospitalShareRequests.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.sourceHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the source hospital can decline" }, 403);
  }
  if (row.status !== "pending") {
    return c.json({ error: `request is ${row.status}` }, 409);
  }

  const now = new Date().toISOString();
  await db
    .update(hospitalShareRequests)
    .set({
      status: "declined",
      declinedAt: now,
      declinedReason: reason || null,
    })
    .where(eq(hospitalShareRequests.id, id));
  await logEvent(db, id, "declined", userId, { reason });

  const recipientIds = await listRequesterUserIds(db, row.requesterHospitalId);
  for (const rid of recipientIds) {
    await notify({
      db,
      userId: rid,
      type: "hospital_request",
      title: "Patient record request declined",
      body: reason ? `Reason: ${reason}` : "The source hospital declined the request.",
      data: {
        kind: "hospital_request_declined",
        requestId: id,
        sourceHospitalId: row.sourceHospitalId,
        reason,
      },
    });
  }

  await writeAudit(db, {
    userId,
    action: "share_request.decline",
    resource: "hospital_share_request",
    resourceId: id,
    details: { reason },
  });

  return c.json({ ok: true });
});

// ── POST /:id/revoke ──────────────────────────────────────

router.post("/:id/revoke", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [row] = await db
    .select()
    .from(hospitalShareRequests)
    .where(eq(hospitalShareRequests.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  if (
    row.requesterHospitalId !== myId &&
    row.sourceHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (row.status === "revoked") return c.json({ ok: true });

  const now = new Date().toISOString();
  await db
    .update(hospitalShareRequests)
    .set({ status: "revoked", revokedAt: now, revokedByUserId: userId })
    .where(eq(hospitalShareRequests.id, id));
  await logEvent(db, id, "revoked", userId);

  // Notify the OTHER side.
  const otherHospitalId =
    row.requesterHospitalId === myId ? row.sourceHospitalId : row.requesterHospitalId;
  const recipientIds = await listRequesterUserIds(db, otherHospitalId);
  for (const rid of recipientIds) {
    await notify({
      db,
      userId: rid,
      type: "hospital_request",
      title: "Patient record access revoked",
      body: "Chart access for this request has been revoked.",
      data: {
        kind: "hospital_request_revoked",
        requestId: id,
      },
    });
  }

  await writeAudit(db, {
    userId,
    action: "share_request.revoke",
    resource: "hospital_share_request",
    resourceId: id,
  });

  return c.json({ ok: true });
});

// ── GET /:id/bundle — fetch patient chart from source hospital ─

router.get("/:id/bundle", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [row] = await db
    .select()
    .from(hospitalShareRequests)
    .where(eq(hospitalShareRequests.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  if (row.requesterHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the requester hospital can fetch the bundle" }, 403);
  }
  if (row.status !== "approved") {
    return c.json({ error: `request is ${row.status}` }, 403);
  }
  if (new Date(row.expiresAt) < new Date()) {
    await db
      .update(hospitalShareRequests)
      .set({ status: "expired" })
      .where(eq(hospitalShareRequests.id, id));
    await logEvent(db, id, "expired", null);
    return c.json({ error: "request has expired" }, 410);
  }

  const patientId = row.patientId;
  const sourceHospitalId = row.sourceHospitalId;
  const scope: string = row.scope;

  const [patient] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, patientId))
    .limit(1);

  const includeAdmissions = scope === "full";
  const includeRecords = scope === "full" || scope === "records";
  const includePrescriptions = scope === "full" || scope === "prescriptions";
  const includeLab = scope === "full" || scope === "lab";

  const admissionsRows = includeAdmissions
    ? await db
        .select()
        .from(admissions)
        .where(
          and(
            eq(admissions.patientId, patientId),
            eq(admissions.hospitalId, sourceHospitalId)
          )
        )
        .orderBy(desc(admissions.admittedAt))
        .limit(50)
    : [];

  const recordsRows = includeRecords
    ? await db
        .select()
        .from(medicalRecords)
        .where(
          and(
            eq(medicalRecords.patientId, patientId),
            eq(medicalRecords.hospitalId, sourceHospitalId)
          )
        )
        .orderBy(desc(medicalRecords.date))
        .limit(50)
    : [];

  const prescriptionsRows = includePrescriptions
    ? await db
        .select()
        .from(prescriptions)
        .where(
          and(
            eq(prescriptions.patientId, patientId),
            eq(prescriptions.hospitalId, sourceHospitalId)
          )
        )
        .orderBy(desc(prescriptions.createdAt))
        .limit(50)
    : [];

  const labRows = includeLab
    ? await db
        .select()
        .from(labOrders)
        .where(
          and(
            eq(labOrders.patientId, patientId),
            eq(labOrders.hospitalId, sourceHospitalId)
          )
        )
        .orderBy(desc(labOrders.orderedAt))
        .limit(50)
    : [];

  // Bump viewed counter.
  await db
    .update(hospitalShareRequests)
    .set({
      viewedCount: (row.viewedCount ?? 0) + 1,
      lastViewedAt: new Date().toISOString(),
    })
    .where(eq(hospitalShareRequests.id, id));
  await logEvent(db, id, "viewed", userId, { scope });

  return c.json({
    patient: patient?.patient ?? null,
    user: patient?.user ?? null,
    scope,
    sourceHospitalId,
    admissions: admissionsRows,
    records: recordsRows,
    prescriptions: prescriptionsRows,
    labOrders: labRows,
  });
});

export default router;
