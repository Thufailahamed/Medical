// @ts-nocheck
// Phase MTN-1: Hospital ↔ Doctor membership.
//
// Endpoints:
//   GET    /hospital-doctors?hospitalId=   list members
//   POST   /hospital-doctors               admin adds doctor
//   PATCH  /hospital-doctors/:id           admin updates role/status/dept
//   DELETE /hospital-doctors/:id           admin removes doctor

import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import {
  hospitals,
  hospitalDoctors,
  doctors,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();
router.use("*", authMiddleware);

const createSchema = z.object({
  hospitalId: z.string().min(1),
  doctorId: z.string().min(1),
  role: z
    .enum(["consultant", "visiting", "resident", "on_call", "admin"])
    .default("consultant"),
  department: z.string().max(100).optional(),
});

const patchSchema = createSchema
  .omit({ hospitalId: true, doctorId: true })
  .partial()
  .extend({
    status: z.enum(["active", "inactive", "suspended"]).optional(),
  });

async function isHospitalAdmin(db: any, userId: string, hospitalId: string) {
  const [h] = await db
    .select({ id: hospitals.id })
    .from(hospitals)
    .where(and(eq(hospitals.id, hospitalId), eq(hospitals.userId, userId)))
    .limit(1);
  return !!h;
}

router.get("/", async (c) => {
  const db = c.get("db");
  const hospitalId = c.req.query("hospitalId");
  if (!hospitalId) return c.json({ error: "hospitalId required" }, 400);
  const rows = await db
    .select({
      id: hospitalDoctors.id,
      doctorId: doctors.id,
      userId: doctors.userId,
      name: users.name,
      specialization: doctors.specialization,
      department: hospitalDoctors.department,
      role: hospitalDoctors.role,
      status: hospitalDoctors.status,
      joinedAt: hospitalDoctors.joinedAt,
    })
    .from(hospitalDoctors)
    .innerJoin(doctors, eq(doctors.id, hospitalDoctors.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(hospitalDoctors.hospitalId, hospitalId));
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

  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.id, body.data.doctorId))
    .limit(1);
  if (!doc) return c.json({ error: "Doctor not found" }, 404);

  try {
    const [created] = await db
      .insert(hospitalDoctors)
      .values({
        hospitalId: body.data.hospitalId,
        doctorId: body.data.doctorId,
        role: body.data.role,
        department: body.data.department,
      })
      .returning();
    return c.json(created, 201);
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) {
      return c.json({ error: "Doctor already a member" }, 409);
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
    .from(hospitalDoctors)
    .where(eq(hospitalDoctors.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);
  if (!(await isHospitalAdmin(db, userId, row.hospitalId))) {
    return c.json({ error: "Not the hospital admin" }, 403);
  }

  const update: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
  for (const [k, v] of Object.entries(body.data)) update[k] = v;
  await db.update(hospitalDoctors).set(update).where(eq(hospitalDoctors.id, id));
  const [updated] = await db
    .select()
    .from(hospitalDoctors)
    .where(eq(hospitalDoctors.id, id))
    .limit(1);
  return c.json(updated, 200);
});

router.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(hospitalDoctors)
    .where(eq(hospitalDoctors.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);
  if (!(await isHospitalAdmin(db, userId, row.hospitalId))) {
    return c.json({ error: "Not the hospital admin" }, 403);
  }
  await db
    .update(hospitalDoctors)
    .set({
      status: "inactive",
      leftAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(hospitalDoctors.id, id));
  return c.json({ ok: true }, 200);
});

export default router;