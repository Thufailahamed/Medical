// @ts-nocheck
// HOS-14: Cross-hospital referrals. Mounted at /cross-hospital-referrals.

import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import {
  crossHospitalReferrals,
  doctors,
  hospitals,
  hospitalShareRequests,
  patients,
  users,
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

function genId(): string {
  const c = crypto as unknown as { randomUUID?: () => string };
  return c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}

function genToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function myHospitalId(c: any): string | null {
  return c.get("activeHospitalId") || null;
}

async function notifyHospitalStaff(
  db: any,
  hospitalId: string,
  notification: {
    type: any;
    title: string;
    body: string;
    data: Record<string, any>;
  }
) {
  const adminRows = await db
    .select({ userId: hospitals.userId })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);
  for (const r of adminRows) {
    if (!r.userId) continue;
    await notify({
      db,
      userId: r.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });
  }
}

const FALLBACK_DOCTOR_ID = "00000000-0000-0000-0000-000000000001";

// POST / — create referral
router.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const {
    patientId,
    toHospitalId,
    toSpecialty,
    reason,
    clinicalSummary,
    urgency = "routine",
  } = body || {};

  if (!patientId || !toHospitalId || !toSpecialty || !reason || !clinicalSummary) {
    return c.json(
      {
        error:
          "patientId, toHospitalId, toSpecialty, reason, clinicalSummary are required",
      },
      400
    );
  }
  if (!["routine", "urgent", "emergency"].includes(urgency)) {
    return c.json({ error: "invalid urgency" }, 400);
  }
  if (toHospitalId === myId) {
    return c.json({ error: "Cannot refer to your own hospital" }, 400);
  }

  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);

  const id = genId();
  await db.insert(crossHospitalReferrals).values({
    id,
    patientId,
    fromHospitalId: myId,
    fromDoctorId: doc?.id ?? FALLBACK_DOCTOR_ID,
    toHospitalId,
    toSpecialty: String(toSpecialty).slice(0, 80),
    reason: String(reason).slice(0, 500),
    clinicalSummary: String(clinicalSummary).slice(0, 4000),
    urgency,
    status: "pending",
  });

  const [fromH] = await db
    .select({ name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, myId))
    .limit(1);
  const [p] = await db
    .select({ userId: patients.userId, userName: users.name })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, patientId))
    .limit(1);

  await notifyHospitalStaff(db, toHospitalId, {
    type: "hospital_request",
    title: "Patient referral received",
    body: `${fromH?.name ?? "A hospital"} referred a patient for ${toSpecialty}`,
    data: {
      kind: "referral_received",
      referralId: id,
      fromHospitalId: myId,
      fromHospitalName: fromH?.name ?? null,
      patientId,
      patientName: p?.userName ?? null,
      toSpecialty,
      urgency,
    },
  });

  await writeAudit(db, {
    userId,
    action: "referral.create",
    resource: "cross_hospital_referral",
    resourceId: id,
    details: { toHospitalId, patientId, toSpecialty, urgency },
  });

  return c.json({ id, status: "pending" }, 201);
});

// GET /outgoing
router.get("/outgoing", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });
  const rows = await db
    .select({
      ref: crossHospitalReferrals,
      to: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(crossHospitalReferrals)
    .innerJoin(hospitals, eq(hospitals.id, crossHospitalReferrals.toHospitalId))
    .innerJoin(patients, eq(patients.id, crossHospitalReferrals.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(crossHospitalReferrals.fromHospitalId, myId))
    .orderBy(desc(crossHospitalReferrals.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

// GET /incoming
router.get("/incoming", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });
  const rows = await db
    .select({
      ref: crossHospitalReferrals,
      from: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(crossHospitalReferrals)
    .innerJoin(hospitals, eq(hospitals.id, crossHospitalReferrals.fromHospitalId))
    .innerJoin(patients, eq(patients.id, crossHospitalReferrals.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(crossHospitalReferrals.toHospitalId, myId))
    .orderBy(desc(crossHospitalReferrals.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

// GET /:id
router.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const myId = myHospitalId(c);

  const [ref] = await db
    .select()
    .from(crossHospitalReferrals)
    .where(eq(crossHospitalReferrals.id, id))
    .limit(1);
  if (!ref) return c.json({ error: "not_found" }, 404);
  if (
    myId &&
    ref.fromHospitalId !== myId &&
    ref.toHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }

  const [fromH] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, ref.fromHospitalId))
    .limit(1);
  const [toH] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, ref.toHospitalId))
    .limit(1);
  const [patient] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, ref.patientId))
    .limit(1);

  return c.json({
    referral: ref,
    from: fromH,
    to: toH,
    patient: patient?.patient ?? null,
    user: patient?.user ?? null,
  });
});

// POST /:id/accept
router.post("/:id/accept", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [ref] = await db
    .select()
    .from(crossHospitalReferrals)
    .where(eq(crossHospitalReferrals.id, id))
    .limit(1);
  if (!ref) return c.json({ error: "not_found" }, 404);
  if (ref.toHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the receiving hospital can accept" }, 403);
  }
  if (ref.status !== "pending") {
    return c.json({ error: `referral is ${ref.status}` }, 409);
  }

  const now = new Date().toISOString();
  await db
    .update(crossHospitalReferrals)
    .set({
      status: "accepted",
      acceptedAt: now,
      acceptedByUserId: userId,
      linkedShareRequestId: shareId,
    })
    .where(eq(crossHospitalReferrals.id, id));

  const shareId = genId();
  const token = genToken();
  const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
  await db.insert(hospitalShareRequests).values({
    id: shareId,
    requesterHospitalId: ref.toHospitalId,
    sourceHospitalId: ref.fromHospitalId,
    patientId: ref.patientId,
    requestedByUserId: userId,
    scope: "full",
    reason: `Referral #${ref.id.slice(0, 8)} — ${ref.toSpecialty}`,
    status: "approved",
    token,
    expiresAt: expires,
    approvedByUserId: userId,
    approvedAt: now,
    createdAt: now,
  });

  await notifyHospitalStaff(db, ref.fromHospitalId, {
    type: "hospital_request",
    title: "Referral accepted",
    body: `Your referral for ${ref.toSpecialty} was accepted`,
    data: {
      kind: "referral_accepted",
      referralId: id,
      toHospitalId: ref.toHospitalId,
      shareRequestId: shareId,
    },
  });

  await writeAudit(db, {
    userId,
    action: "referral.accept",
    resource: "cross_hospital_referral",
    resourceId: id,
    details: { shareRequestId: shareId },
  });

  return c.json({ ok: true, shareRequestId: shareId });
});

// POST /:id/decline
router.post("/:id/decline", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "").slice(0, 500);

  const [ref] = await db
    .select()
    .from(crossHospitalReferrals)
    .where(eq(crossHospitalReferrals.id, id))
    .limit(1);
  if (!ref) return c.json({ error: "not_found" }, 404);
  if (ref.toHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the receiving hospital can decline" }, 403);
  }
  if (ref.status !== "pending") {
    return c.json({ error: `referral is ${ref.status}` }, 409);
  }

  await db
    .update(crossHospitalReferrals)
    .set({
      status: "declined",
      declinedAt: new Date().toISOString(),
      declinedReason: reason || null,
    })
    .where(eq(crossHospitalReferrals.id, id));

  await notifyHospitalStaff(db, ref.fromHospitalId, {
    type: "hospital_request",
    title: "Referral declined",
    body: reason ? `Reason: ${reason}` : "The receiving hospital declined the referral.",
    data: { kind: "referral_declined", referralId: id, reason },
  });

  await writeAudit(db, {
    userId,
    action: "referral.decline",
    resource: "cross_hospital_referral",
    resourceId: id,
  });

  return c.json({ ok: true });
});

// POST /:id/complete
router.post("/:id/complete", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [ref] = await db
    .select()
    .from(crossHospitalReferrals)
    .where(eq(crossHospitalReferrals.id, id))
    .limit(1);
  if (!ref) return c.json({ error: "not_found" }, 404);
  if (
    ref.fromHospitalId !== myId &&
    ref.toHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (ref.status !== "accepted") {
    return c.json({ error: `referral is ${ref.status}` }, 409);
  }

  await db
    .update(crossHospitalReferrals)
    .set({ status: "completed", completedAt: new Date().toISOString() })
    .where(eq(crossHospitalReferrals.id, id));

  await writeAudit(db, {
    userId,
    action: "referral.complete",
    resource: "cross_hospital_referral",
    resourceId: id,
  });

  return c.json({ ok: true });
});

export default router;
