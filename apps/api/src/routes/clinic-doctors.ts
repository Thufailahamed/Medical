// @ts-nocheck
// Phase MTN-1: Clinic ↔ Doctor management — thin route exposing
// clinic-doctor membership endpoints. Most of the logic lives in
// routes/clinics.ts (mounted at /clinics/:id/doctors). This file
// provides the inverse "list clinics I'm in" + "self-service leave"
// flows.
//
// Endpoints:
//   GET    /clinic-doctors?clinicId=    members (mirrors /clinics/:id/doctors)
//   POST   /clinic-doctors/:id/leave    doctor leaves (soft)
//   PATCH  /clinic-doctors/:id/accept   invited doctor accepts (status→active)

import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { clinicDoctors, doctors } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();
router.use("*", authMiddleware);

router.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const clinicId = c.req.query("clinicId");
  if (!clinicId) return c.json({ error: "clinicId required" }, 400);
  // Same join as routes/clinics.ts but exposed here so the mobile can
  // hit a single endpoint surface for membership tables.
  const rows = await db
    .select({
      id: clinicDoctors.id,
      doctorId: clinicDoctors.doctorId,
      role: clinicDoctors.role,
      ownershipPct: clinicDoctors.ownershipPct,
      status: clinicDoctors.status,
      joinedAt: clinicDoctors.joinedAt,
      leftAt: clinicDoctors.leftAt,
    })
    .from(clinicDoctors)
    .where(eq(clinicDoctors.clinicId, clinicId));
  // Strip caller info if requested via ?mine=1 (used for the "my
  // membership" pill).
  if (c.req.query("mine") === "1") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    return c.json(doc ? rows.filter((r) => r.doctorId === doc.id) : [], 200);
  }
  return c.json(rows, 200);
});

router.post("/:id/leave", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  if (!doc) return c.json({ error: "No doctor profile" }, 403);

  const [row] = await db
    .select()
    .from(clinicDoctors)
    .where(and(eq(clinicDoctors.id, id), eq(clinicDoctors.doctorId, doc.id)))
    .limit(1);
  if (!row) return c.json({ error: "Not a member" }, 404);

  await db
    .update(clinicDoctors)
    .set({
      status: "inactive",
      leftAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(clinicDoctors.id, id));
  return c.json({ ok: true }, 200);
});

router.post("/:id/accept", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  if (!doc) return c.json({ error: "No doctor profile" }, 403);

  const [row] = await db
    .select()
    .from(clinicDoctors)
    .where(and(eq(clinicDoctors.id, id), eq(clinicDoctors.doctorId, doc.id)))
    .limit(1);
  if (!row) return c.json({ error: "Not a member" }, 404);
  if (row.status === "active") return c.json(row, 200);

  await db
    .update(clinicDoctors)
    .set({ status: "active", updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(clinicDoctors.id, id));
  const [updated] = await db
    .select()
    .from(clinicDoctors)
    .where(eq(clinicDoctors.id, id))
    .limit(1);
  return c.json(updated, 200);
});

export default router;