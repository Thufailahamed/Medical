// @ts-nocheck
// HOS-14: Discharge handoffs. Mounted at /discharge-handoffs.

import { Hono } from "hono";
import { and, desc, eq, or } from "drizzle-orm";
import {
  admissions,
  clinics,
  dischargeHandoffs,
  hospitals,
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
  requireRole("hospital_admin", "hospital_staff", "doctor", "clinic", "super_admin")
);

function myHospitalId(c: any): string | null {
  return c.get("activeHospitalId") || null;
}

// GET /outgoing
router.get("/outgoing", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });
  const rows = await db
    .select({
      handoff: dischargeHandoffs,
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
      toHospital: { id: hospitals.id, name: hospitals.name },
      toClinic: { id: clinics.id, name: clinics.name },
    })
    .from(dischargeHandoffs)
    .innerJoin(patients, eq(patients.id, dischargeHandoffs.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .leftJoin(hospitals, eq(hospitals.id, dischargeHandoffs.toHospitalId))
    .leftJoin(clinics, eq(clinics.id, dischargeHandoffs.toClinicId))
    .where(eq(dischargeHandoffs.fromHospitalId, myId))
    .orderBy(desc(dischargeHandoffs.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

// GET /incoming — handoffs received by my hospital
router.get("/incoming", async (c) => {
  const db = c.get("db");
  const myId = myHospitalId(c);
  if (!myId) return c.json({ items: [] });
  const rows = await db
    .select({
      handoff: dischargeHandoffs,
      from: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(dischargeHandoffs)
    .innerJoin(hospitals, eq(hospitals.id, dischargeHandoffs.fromHospitalId))
    .innerJoin(patients, eq(patients.id, dischargeHandoffs.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(dischargeHandoffs.toHospitalId, myId))
    .orderBy(desc(dischargeHandoffs.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

// GET /:id
router.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const myId = myHospitalId(c);

  const [row] = await db
    .select({
      handoff: dischargeHandoffs,
      from: { id: hospitals.id, name: hospitals.name },
      patient: { id: patients.id },
      user: { id: users.id, name: users.name },
    })
    .from(dischargeHandoffs)
    .innerJoin(hospitals, eq(hospitals.id, dischargeHandoffs.fromHospitalId))
    .innerJoin(patients, eq(patients.id, dischargeHandoffs.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(dischargeHandoffs.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  if (
    myId &&
    row.handoff.fromHospitalId !== myId &&
    row.handoff.toHospitalId !== myId &&
    c.get("userRole") !== "super_admin"
  ) {
    return c.json({ error: "forbidden" }, 403);
  }

  let toClinic: { id: string; name: string } | null = null;
  if (row.handoff.toClinicId) {
    const [cl] = await db
      .select({ id: clinics.id, name: clinics.name })
      .from(clinics)
      .where(eq(clinics.id, row.handoff.toClinicId))
      .limit(1);
    toClinic = cl ?? null;
  }
  let toHospital: { id: string; name: string } | null = null;
  if (row.handoff.toHospitalId) {
    const [h] = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .where(eq(hospitals.id, row.handoff.toHospitalId))
      .limit(1);
    toHospital = h ?? null;
  }

  return c.json({
    handoff: row.handoff,
    from: row.from,
    toClinic,
    toHospital,
    patient: row.patient,
    user: row.user,
  });
});

// POST /:id/acknowledge
router.post("/:id/acknowledge", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const myId = myHospitalId(c);

  const [row] = await db
    .select()
    .from(dischargeHandoffs)
    .where(eq(dischargeHandoffs.id, id))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  if (myId && row.toHospitalId !== myId && c.get("userRole") !== "super_admin") {
    return c.json({ error: "Only the receiving hospital can acknowledge" }, 403);
  }
  if (row.acknowledgedAt) return c.json({ ok: true });

  await db
    .update(dischargeHandoffs)
    .set({
      acknowledgedAt: new Date().toISOString(),
      acknowledgedByUserId: userId,
      sharedAt: row.sharedAt ?? new Date().toISOString(),
    })
    .where(eq(dischargeHandoffs.id, id));

  // Notify originating hospital admin.
  const [admin] = await db
    .select({ userId: hospitals.userId })
    .from(hospitals)
    .where(eq(hospitals.id, row.fromHospitalId))
    .limit(1);
  if (admin?.userId) {
    await notify({
      db,
      userId: admin.userId,
      type: "hospital_request",
      title: "Discharge handoff acknowledged",
      body: "The receiving hospital has acknowledged the discharge summary.",
      data: { kind: "discharge_handoff_acknowledged", handoffId: id },
    });
  }

  await writeAudit(db, {
    userId,
    action: "discharge_handoff.acknowledge",
    resource: "discharge_handoff",
    resourceId: id,
  });

  return c.json({ ok: true });
});

export default router;
