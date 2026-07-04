// @ts-nocheck
// Phase MTN-1: Hospital ↔ Patient registration.
//
// Endpoints:
//   GET    /hospital-patients?hospitalId=   list registered patients
//   POST   /hospital-patients               admin registers patient
//   PATCH  /hospital-patients/:id           admin discharges
//
// MRN format: HSP-<hospital_short_or_id8>-<6-digit seq>.
// Patients are auto-derived from the user's patient row.

import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  hospitals,
  hospitalPatients,
  patients as patientsTbl,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();
router.use("*", authMiddleware);

const createSchema = z.object({
  hospitalId: z.string().min(1),
  patientId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

const patchSchema = z.object({
  status: z.enum(["registered", "discharged", "deceased"]).optional(),
  notes: z.string().max(500).optional(),
});

async function isHospitalAdmin(db: any, userId: string, hospitalId: string) {
  const [h] = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(and(eq(hospitals.id, hospitalId), eq(hospitals.userId, userId)))
    .limit(1);
  return !!h;
}

async function generateMrn(db: any, hospitalId: string): Promise<string> {
  const [h] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);
  // Use first 3 letters of hospital name uppercased as the prefix.
  const prefix =
    (h?.name || "")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3) || "HSP";
  const [count] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(hospitalPatients)
    .where(eq(hospitalPatients.hospitalId, hospitalId));
  const seq = String((Number(count?.n) || 0) + 1).padStart(6, "0");
  return `${prefix}-${seq}`;
}

router.get("/", async (c) => {
  const db = c.get("db");
  const hospitalId = c.req.query("hospitalId");
  if (!hospitalId) return c.json({ error: "hospitalId required" }, 400);
  const rows = await db
    .select({
      id: patientsTbl.id,
      userId: patientsTbl.userId,
      name: users.name,
      mrn: hospitalPatients.mrn,
      status: hospitalPatients.status,
      registeredAt: hospitalPatients.registeredAt,
      dischargedAt: hospitalPatients.dischargedAt,
    })
    .from(hospitalPatients)
    .innerJoin(patientsTbl, eq(patientsTbl.id, hospitalPatients.patientId))
    .innerJoin(users, eq(users.id, patientsTbl.userId))
    .where(eq(hospitalPatients.hospitalId, hospitalId))
    .orderBy(desc(hospitalPatients.registeredAt));
  return c.json(rows, 200);
});

router.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  if (!(await isHospitalAdmin(db, userId, body.data.hospitalId))) {
    return c.json({ error: "Not the hospital admin" }, 403);
  }

  const [pat] = await db
    .select()
    .from(patientsTbl)
    .where(eq(patientsTbl.id, body.data.patientId))
    .limit(1);
  if (!pat) return c.json({ error: "Patient not found" }, 404);

  const mrn = await generateMrn(db, body.data.hospitalId);
  try {
    const [created] = await db
      .insert(hospitalPatients)
      .values({
        hospitalId: body.data.hospitalId,
        patientId: body.data.patientId,
        mrn,
        notes: body.data.notes,
      })
      .returning();
    return c.json(created, 201);
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) {
      return c.json({ error: "Patient already registered" }, 409);
    }
    throw e;
  }
});

router.patch("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = patchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const [row] = await db
    .select()
    .from(hospitalPatients)
    .where(eq(hospitalPatients.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);
  if (!(await isHospitalAdmin(db, userId, row.hospitalId))) {
    return c.json({ error: "Not the hospital admin" }, 403);
  }

  const update: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
  for (const [k, v] of Object.entries(body.data)) update[k] = v;
  if (body.data.status === "discharged") {
    update.dischargedAt = sql`CURRENT_TIMESTAMP`;
  }
  await db.update(hospitalPatients).set(update).where(eq(hospitalPatients.id, id));
  const [updated] = await db
    .select()
    .from(hospitalPatients)
    .where(eq(hospitalPatients.id, id))
    .limit(1);
  return c.json(updated, 200);
});

export default router;