// @ts-nocheck
// Phase MTN-1: Clinic ↔ Patient self-service.
//
// Endpoints:
//   GET    /clinic-patients?clinicId=    list (mirrors /clinics/:id/patients)
//   POST   /clinic-patients/:id/leave    patient leaves (soft-discharge)

import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { clinicPatients, patients as patientsTbl } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();
router.use("*", authMiddleware);

router.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const clinicId = c.req.query("clinicId");
  if (!clinicId) return c.json({ error: "clinicId required" }, 400);
  if (c.req.query("mine") === "1") {
    const [pat] = await db
      .select({ id: patientsTbl.id })
      .from(patientsTbl)
      .where(eq(patientsTbl.userId, userId))
      .limit(1);
    if (!pat) return c.json([], 200);
    const [row] = await db
      .select()
      .from(clinicPatients)
      .where(
        and(
          eq(clinicPatients.clinicId, clinicId),
          eq(clinicPatients.patientId, pat.id)
        )
      )
      .limit(1);
    return c.json(row || null, 200);
  }
  // Non-mine: return all (admin only — checked by membership route).
  return c.json({ error: "Use /clinics/:id/patients for admin views" }, 400);
});

router.post("/:id/leave", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [pat] = await db
    .select({ id: patientsTbl.id })
    .from(patientsTbl)
    .where(eq(patientsTbl.userId, userId))
    .limit(1);
  if (!pat) return c.json({ error: "No patient profile" }, 403);

  const [row] = await db
    .select()
    .from(clinicPatients)
    .where(and(eq(clinicPatients.id, id), eq(clinicPatients.patientId, pat.id)))
    .limit(1);
  if (!row) return c.json({ error: "Not registered" }, 404);

  await db
    .update(clinicPatients)
    .set({
      status: "discharged",
      dischargedAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(clinicPatients.id, id));
  return c.json({ ok: true }, 200);
});

export default router;