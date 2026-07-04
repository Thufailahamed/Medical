// @ts-nocheck
// Phase MTN-1: Doctor ↔ Patient clinical-context relationships.
//
// THE clinical-context table. Every relationship is pinned to a
// specific tenant (hospital OR clinic). Same doctor + same patient +
// different tenants → multiple active rows.
//
// Endpoints:
//   GET    /doctor-patient-relationships?patientId=&doctorId=&contextType=&contextId=
//   POST   /doctor-patient-relationships
//   PATCH  /doctor-patient-relationships/:id
//   DELETE /doctor-patient-relationships/:id  (soft: status='ended')
//
// Membership is enforced:
//   - the doctor must be at the named tenant (hospital_doctors or
//     clinic_doctors, status='active')
//   - the patient must be at the named tenant (hospital_patients or
//     clinic_patients)

import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  doctorPatientRelationships,
  doctors,
  patients as patientsTbl,
  hospitalDoctors,
  hospitalPatients,
  clinicDoctors,
  clinicPatients,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();
router.use("*", authMiddleware);

const createSchema = z.object({
  doctorId: z.string().min(1),
  patientId: z.string().min(1),
  contextType: z.enum(["hospital", "clinic"]),
  contextId: z.string().min(1),
  relationshipKind: z
    .enum([
      "primary_care",
      "consulting",
      "covering",
      "referred_to",
      "referred_from",
      "on_call",
      "second_opinion",
    ])
    .default("consulting"),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

const patchSchema = z.object({
  status: z.enum(["active", "ended", "transferred"]).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

async function validateContextMembership(
  db: any,
  doctorId: string,
  patientId: string,
  contextType: "hospital" | "clinic",
  contextId: string
): Promise<{ ok: boolean; reason?: string }> {
  if (contextType === "hospital") {
    const [hd] = await db
      .select({ id: hospitalDoctors.id })
      .from(hospitalDoctors)
      .where(
        and(
          eq(hospitalDoctors.hospitalId, contextId),
          eq(hospitalDoctors.doctorId, doctorId),
          eq(hospitalDoctors.status, "active")
        )
      )
      .limit(1);
    if (!hd) return { ok: false, reason: "Doctor not at this hospital" };
    const [hp] = await db
      .select({ id: hospitalPatients.id })
      .from(hospitalPatients)
      .where(
        and(
          eq(hospitalPatients.hospitalId, contextId),
          eq(hospitalPatients.patientId, patientId)
        )
      )
      .limit(1);
    if (!hp) return { ok: false, reason: "Patient not at this hospital" };
    return { ok: true };
  }
  // clinic
  const [cd] = await db
    .select({ id: clinicDoctors.id })
    .from(clinicDoctors)
    .where(
      and(
        eq(clinicDoctors.clinicId, contextId),
        eq(clinicDoctors.doctorId, doctorId),
        eq(clinicDoctors.status, "active")
      )
    )
    .limit(1);
  if (!cd) return { ok: false, reason: "Doctor not at this clinic" };
  const [cp] = await db
    .select({ id: clinicPatients.id })
    .from(clinicPatients)
    .where(
      and(
        eq(clinicPatients.clinicId, contextId),
        eq(clinicPatients.patientId, patientId)
      )
    )
    .limit(1);
  if (!cp) return { ok: false, reason: "Patient not at this clinic" };
  return { ok: true };
}

router.get("/", async (c) => {
  const db = c.get("db");
  const patientId = c.req.query("patientId");
  const doctorId = c.req.query("doctorId");
  const contextType = c.req.query("contextType");
  const contextId = c.req.query("contextId");
  const status = c.req.query("status") || "active";

  const where: any[] = [eq(doctorPatientRelationships.status, status as any)];
  if (patientId) where.push(eq(doctorPatientRelationships.patientId, patientId));
  if (doctorId) where.push(eq(doctorPatientRelationships.doctorId, doctorId));
  if (contextType)
    where.push(eq(doctorPatientRelationships.contextType, contextType as any));
  if (contextId)
    where.push(eq(doctorPatientRelationships.contextId, contextId));

  const rows = await db
    .select({
      id: doctorPatientRelationships.id,
      doctorId: doctorPatientRelationships.doctorId,
      patientId: doctorPatientRelationships.patientId,
      contextType: doctorPatientRelationships.contextType,
      contextId: doctorPatientRelationships.contextId,
      relationshipKind: doctorPatientRelationships.relationshipKind,
      status: doctorPatientRelationships.status,
      isPrimary: doctorPatientRelationships.isPrimary,
      startedAt: doctorPatientRelationships.startedAt,
      endedAt: doctorPatientRelationships.endedAt,
      notes: doctorPatientRelationships.notes,
      doctorName: users.name,
    })
    .from(doctorPatientRelationships)
    .innerJoin(doctors, eq(doctors.id, doctorPatientRelationships.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(and(...where))
    .orderBy(desc(doctorPatientRelationships.startedAt));
  return c.json(rows, 200);
});

router.post("/", async (c) => {
  const db = c.get("db");
  const body = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.id, body.data.doctorId))
    .limit(1);
  if (!doc) return c.json({ error: "Doctor not found" }, 404);
  const [pat] = await db
    .select({ id: patientsTbl.id })
    .from(patientsTbl)
    .where(eq(patientsTbl.id, body.data.patientId))
    .limit(1);
  if (!pat) return c.json({ error: "Patient not found" }, 404);

  const guard = await validateContextMembership(
    db,
    body.data.doctorId,
    body.data.patientId,
    body.data.contextType,
    body.data.contextId
  );
  if (!guard.ok) return c.json({ error: guard.reason }, 400);

  try {
    const [created] = await db
      .insert(doctorPatientRelationships)
      .values({
        doctorId: body.data.doctorId,
        patientId: body.data.patientId,
        contextType: body.data.contextType,
        contextId: body.data.contextId,
        relationshipKind: body.data.relationshipKind,
        status: "active",
        isPrimary: body.data.isPrimary,
        notes: body.data.notes,
      })
      .returning();
    return c.json(created, 201);
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) {
      return c.json(
        {
          error: "Active relationship already exists for this triple",
        },
        409
      );
    }
    throw e;
  }
});

router.patch("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = patchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const update: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
  for (const [k, v] of Object.entries(body.data)) update[k] = v;
  if (body.data.status === "ended") {
    update.endedAt = sql`CURRENT_TIMESTAMP`;
  }
  await db
    .update(doctorPatientRelationships)
    .set(update)
    .where(eq(doctorPatientRelationships.id, id));
  const [updated] = await db
    .select()
    .from(doctorPatientRelationships)
    .where(eq(doctorPatientRelationships.id, id))
    .limit(1);
  return c.json(updated, 200);
});

router.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await db
    .update(doctorPatientRelationships)
    .set({
      status: "ended",
      endedAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(doctorPatientRelationships.id, id));
  return c.json({ ok: true }, 200);
});

export default router;