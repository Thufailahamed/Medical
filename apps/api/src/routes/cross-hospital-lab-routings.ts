// @ts-nocheck
// HOS-14: Cross-hospital lab order routing. Mounted at /cross-hospital-lab-routings.

import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import {
  crossHospitalLabRoutings,
  hospitalShareRequests,
  hospitals,
  labOrders,
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
  requireRole("hospital_admin", "hospital_staff", "doctor", "laboratory", "super_admin")
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
  const rows = await db
    .select({ userId: hospitals.userId })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);
  for (const r of rows) {
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

// POST /
router.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const { labOrderId, toHospitalId, reason } = body || {};
  if (!labOrderId || !toHospitalId || !reason) {
    return c.json({ error: "labOrderId, toHospitalId, reason required" }, 400);
  }
  if (toHospitalId === myId) {
    return c.json({ error: "Cannot route to the same hospital" }, 400);
  }

  const [order] = await db
    .select()
    .from(labOrders)
    .where(eq(labOrders.id, labOrderId))
    .limit(1);
  if (!order) return c.json({ error: "lab order not found" }, 404);
  if (order.hospitalId !== myId) {
    return c.json({ error: "lab order does not belong to this hospital" }, 403);
  }

  const id = genId();
  await db.insert(crossHospitalLabRoutings).values({
    id,
    labOrderId,
    fromHospitalId: myId,
    toHospitalId,
    routedByUserId: userId,
    reason: String(reason).slice(0, 500),
    status: "pending",
  });

  const [fromH] = await db
    .select({ name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, myId))
    .limit(1);

  await notifyHospitalStaff(db, toHospitalId, {
    type: "hospital_request",
    title: "Lab order routed to you",
    body: `${fromH?.name ?? "A hospital"} routed a lab order (${order.tests?.slice(0, 80) ?? "see details"})`,
    data: {
      kind: "lab_routing_received",
      routingId: id,
      labOrderId,
      fromHospitalId: myId,
      fromHospitalName: fromH?.name ?? null,
    },
  });

  await writeAudit(db, {
    userId,
    action: "lab_routing.create",
    resource: "cross_hospital_lab_routing",
    resourceId: id,
    details: { labOrderId, toHospitalId },
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
      routing: crossHospitalLabRoutings,
      to: { id: hospitals.id, name: hospitals.name },
      order: labOrders,
    })
    .from(crossHospitalLabRoutings)
    .innerJoin(hospitals, eq(hospitals.id, crossHospitalLabRoutings.toHospitalId))
    .innerJoin(labOrders, eq(labOrders.id, crossHospitalLabRoutings.labOrderId))
    .where(eq(crossHospitalLabRoutings.fromHospitalId, myId))
    .orderBy(desc(crossHospitalLabRoutings.createdAt))
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
      routing: crossHospitalLabRoutings,
      from: { id: hospitals.id, name: hospitals.name },
      order: labOrders,
    })
    .from(crossHospitalLabRoutings)
    .innerJoin(hospitals, eq(hospitals.id, crossHospitalLabRoutings.fromHospitalId))
    .innerJoin(labOrders, eq(labOrders.id, crossHospitalLabRoutings.labOrderId))
    .where(eq(crossHospitalLabRoutings.toHospitalId, myId))
    .orderBy(desc(crossHospitalLabRoutings.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

// POST /:id/accept
router.post("/:id/accept", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [r] = await db
    .select()
    .from(crossHospitalLabRoutings)
    .where(eq(crossHospitalLabRoutings.id, id))
    .limit(1);
  if (!r) return c.json({ error: "not_found" }, 404);
  if (r.toHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the receiving hospital can accept" }, 403);
  }
  if (r.status !== "pending") return c.json({ error: `routing is ${r.status}` }, 409);

  await db
    .update(crossHospitalLabRoutings)
    .set({ status: "accepted", acceptedAt: new Date().toISOString(), acceptedByUserId: userId })
    .where(eq(crossHospitalLabRoutings.id, id));

  await notifyHospitalStaff(db, r.fromHospitalId, {
    type: "hospital_request",
    title: "Lab order accepted",
    body: "Your routed lab order has been accepted by the destination hospital.",
    data: { kind: "lab_routing_accepted", routingId: id },
  });

  await writeAudit(db, {
    userId,
    action: "lab_routing.accept",
    resource: "cross_hospital_lab_routing",
    resourceId: id,
  });

  return c.json({ ok: true });
});

// POST /:id/complete — auto-creates reverse share for results
router.post("/:id/complete", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [r] = await db
    .select()
    .from(crossHospitalLabRoutings)
    .where(eq(crossHospitalLabRoutings.id, id))
    .limit(1);
  if (!r) return c.json({ error: "not_found" }, 404);
  if (r.toHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the receiving hospital can complete" }, 403);
  }
  if (r.status !== "accepted") {
    return c.json({ error: `routing is ${r.status}` }, 409);
  }

  const [order] = await db
    .select()
    .from(labOrders)
    .where(eq(labOrders.id, r.labOrderId))
    .limit(1);

  await db
    .update(crossHospitalLabRoutings)
    .set({ status: "completed", completedAt: new Date().toISOString() })
    .where(eq(crossHospitalLabRoutings.id, id));

  // Auto-create reverse share so originating hospital can read results.
  let shareRequestId: string | null = null;
  if (order) {
    const shareId = genId();
    const token = genToken();
    const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
    await db.insert(hospitalShareRequests).values({
      id: shareId,
      requesterHospitalId: r.fromHospitalId,
      sourceHospitalId: r.toHospitalId,
      patientId: order.patientId,
      requestedByUserId: userId,
      scope: "lab",
      reason: `Lab results — routing #${id.slice(0, 8)}`,
      status: "approved",
      token,
      expiresAt: expires,
      approvedByUserId: userId,
      approvedAt: new Date().toISOString(),
    });
    shareRequestId = shareId;
    await db
      .update(crossHospitalLabRoutings)
      .set({ resultShareRequestId: shareId })
      .where(eq(crossHospitalLabRoutings.id, id));
  }

  await notifyHospitalStaff(db, r.fromHospitalId, {
    type: "hospital_request",
    title: "Lab results ready",
    body: "Your routed lab order is complete and results are available.",
    data: {
      kind: "lab_routing_completed",
      routingId: id,
      shareRequestId,
    },
  });

  await writeAudit(db, {
    userId,
    action: "lab_routing.complete",
    resource: "cross_hospital_lab_routing",
    resourceId: id,
    details: { shareRequestId },
  });

  return c.json({ ok: true, shareRequestId });
});

// POST /:id/cancel
router.post("/:id/cancel", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ error: "No active hospital" }, 400);

  const [r] = await db
    .select()
    .from(crossHospitalLabRoutings)
    .where(eq(crossHospitalLabRoutings.id, id))
    .limit(1);
  if (!r) return c.json({ error: "not_found" }, 404);
  if (
    r.fromHospitalId !== myId &&
    r.toHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (r.status === "cancelled" || r.status === "completed") {
    return c.json({ error: `routing is ${r.status}` }, 409);
  }

  await db
    .update(crossHospitalLabRoutings)
    .set({ status: "cancelled" })
    .where(eq(crossHospitalLabRoutings.id, id));

  await writeAudit(db, {
    userId,
    action: "lab_routing.cancel",
    resource: "cross_hospital_lab_routing",
    resourceId: id,
  });

  return c.json({ ok: true });
});

export default router;
