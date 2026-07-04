// @ts-nocheck
// Phase MTN-1: Clinics CRUD + members + patients.
//
// Endpoints:
//   POST   /clinics                    create clinic (caller becomes owner)
//   GET    /clinics                    list clinics caller belongs to
//   GET    /clinics/:id                detail
//   PATCH  /clinics/:id                owner updates fields
//   GET    /clinics/:id/doctors         list doctor members
//   POST   /clinics/:id/doctors         owner invites doctor
//   PATCH  /clinics/:id/doctors/:docId  owner updates role/ownershipPct
//   DELETE /clinics/:id/doctors/:docId  owner removes doctor
//   GET    /clinics/:id/patients        list registered patients
//   POST   /clinics/:id/patients        register patient (assigns MRN)
//   DELETE /clinics/:id/patients/:pid   discharge patient

import { Hono } from "hono";
import { and, eq, sql, desc } from "drizzle-orm";
import {
  clinics,
  clinicDoctors,
  clinicPatients,
  doctors,
  users,
  patients as patientsTbl,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import type { AppEnvironment } from "../types";

const clinicRouter = new Hono<AppEnvironment>();
clinicRouter.use("*", authMiddleware);

// ── Validators ──────────────────────────────────────────
const createClinicSchema = z.object({
  name: z.string().min(2).max(200),
  license: z.string().max(64).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  location: z
    .object({ lat: z.number(), lng: z.number() })
    .optional(),
  specializations: z.array(z.string()).max(20).optional(),
});

const patchClinicSchema = createClinicSchema.partial();

const addDoctorSchema = z.object({
  doctorId: z.string().min(1),
  role: z
    .enum(["owner", "partner", "associate", "locum", "on_call"])
    .default("associate"),
  ownershipPct: z.number().min(0).max(100).default(0),
});

const patchDoctorSchema = z.object({
  role: z
    .enum(["owner", "partner", "associate", "locum", "on_call"])
    .optional(),
  ownershipPct: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

const registerPatientSchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

// ── Helpers ─────────────────────────────────────────────
async function ensureOwner(db: any, clinicId: string, userId: string) {
  const [c] = await db.select().from(clinics).where(eq(clinics.id, clinicId)).limit(1);
  if (!c) return { ok: false, status: 404, reason: "Clinic not found" };
  if (c.userId !== userId) {
    // Owner via clinic_doctors (multi-doctor clinics)
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return { ok: false, status: 403, reason: "Not an owner" };
    const [own] = await db
      .select({ id: clinicDoctors.id })
      .from(clinicDoctors)
      .where(
        and(
          eq(clinicDoctors.clinicId, clinicId),
          eq(clinicDoctors.doctorId, doc.id),
          eq(clinicDoctors.role, "owner"),
          eq(clinicDoctors.status, "active")
        )
      )
      .limit(1);
    if (!own) return { ok: false, status: 403, reason: "Not an owner" };
  }
  return { ok: true };
}

async function generateShortCode(db: any): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = (
      Math.floor(Math.random() * 36 ** 6).toString(36) + "000000"
    )
      .toUpperCase()
      .slice(0, 6);
    const [existing] = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(eq(clinics.shortCode, code))
      .limit(1);
    if (!existing) return code;
  }
  return "CL" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function generateMrn(db: any, clinicId: string): Promise<string> {
  const [c] = await db
    .select({ shortCode: clinics.shortCode })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);
  const prefix = c?.shortCode || "CL";
  const [count] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(clinicPatients)
    .where(eq(clinicPatients.clinicId, clinicId));
  const seq = String((Number(count?.n) || 0) + 1).padStart(6, "0");
  return `${prefix}-${seq}`;
}

// ── POST /clinics ───────────────────────────────────────
clinicRouter.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = createClinicSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  // Ensure caller is a doctor (so we can populate clinic_doctors.owner).
  const [doc] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  if (!doc) return c.json({ error: "Only doctors can create clinics" }, 403);

  const shortCode = await generateShortCode(db);
  const [created] = await db
    .insert(clinics)
    .values({
      userId,
      name: body.data.name,
      license: body.data.license,
      address: body.data.address,
      phone: body.data.phone,
      location: body.data.location
        ? JSON.stringify(body.data.location)
        : null,
      specializations: body.data.specializations
        ? JSON.stringify(body.data.specializations)
        : null,
      shortCode,
    })
    .returning();
  await db.insert(clinicDoctors).values({
    clinicId: created.id,
    doctorId: doc.id,
    role: "owner",
    ownershipPct: 100,
    status: "active",
  });
  return c.json({ ...created, myRole: "owner" }, 201);
});

// ── GET /clinics ────────────────────────────────────────
clinicRouter.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = (c.get("dbUser") as any)?.role;

  if (role === "doctor") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return c.json([], 200);
    const rows = await db
      .select({
        id: clinics.id,
        name: clinics.name,
        address: clinics.address,
        phone: clinics.phone,
        role: clinicDoctors.role,
        ownershipPct: clinicDoctors.ownershipPct,
        joinedAt: clinicDoctors.joinedAt,
      })
      .from(clinicDoctors)
      .innerJoin(clinics, eq(clinics.id, clinicDoctors.clinicId))
      .where(
        and(
          eq(clinicDoctors.doctorId, doc.id),
          eq(clinicDoctors.status, "active")
        )
      );
    return c.json(rows, 200);
  }

  if (role === "patient") {
    const [pat] = await db
      .select({ id: patientsTbl.id })
      .from(patientsTbl)
      .where(eq(patientsTbl.userId, userId))
      .limit(1);
    if (!pat) return c.json([], 200);
    const rows = await db
      .select({
        id: clinics.id,
        name: clinics.name,
        address: clinics.address,
        phone: clinics.phone,
        mrn: clinicPatients.mrn,
        registeredAt: clinicPatients.registeredAt,
      })
      .from(clinicPatients)
      .innerJoin(clinics, eq(clinics.id, clinicPatients.clinicId))
      .where(
        and(
          eq(clinicPatients.patientId, pat.id),
          eq(clinicPatients.status, "registered")
        )
      );
    return c.json(rows, 200);
  }

  return c.json([], 200);
});

// ── GET /clinics/:id ────────────────────────────────────
clinicRouter.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row, 200);
});

// ── PATCH /clinics/:id ──────────────────────────────────
clinicRouter.patch("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const guard = await ensureOwner(db, id, userId);
  if (!guard.ok) return c.json({ error: guard.reason }, guard.status);

  const body = patchClinicSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const update: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
  for (const [k, v] of Object.entries(body.data)) {
    if (k === "location" || k === "specializations") {
      update[k] = v ? JSON.stringify(v) : null;
    } else {
      update[k] = v;
    }
  }
  await db.update(clinics).set(update).where(eq(clinics.id, id));
  const [updated] = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
  return c.json(updated, 200);
});

// ── GET /clinics/:id/doctors ────────────────────────────
clinicRouter.get("/:id/doctors", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const rows = await db
    .select({
      id: doctors.id,
      userId: doctors.userId,
      name: users.name,
      specialization: doctors.specialization,
      role: clinicDoctors.role,
      ownershipPct: clinicDoctors.ownershipPct,
      joinedAt: clinicDoctors.joinedAt,
      status: clinicDoctors.status,
    })
    .from(clinicDoctors)
    .innerJoin(doctors, eq(doctors.id, clinicDoctors.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(clinicDoctors.clinicId, id));
  return c.json(rows, 200);
});

// ── POST /clinics/:id/doctors ───────────────────────────
clinicRouter.post("/:id/doctors", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const guard = await ensureOwner(db, id, userId);
  if (!guard.ok) return c.json({ error: guard.reason }, guard.status);

  const body = addDoctorSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const [doc] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, body.data.doctorId))
    .limit(1);
  if (!doc) return c.json({ error: "Doctor not found" }, 404);

  // Validate ownershipPct doesn't push total over 100. Compute the
  // existing sum in JS so the mock + the production SQL layer both
  // behave identically (no SQL aggregate translation needed).
  if (body.data.role === "owner" && body.data.ownershipPct > 0) {
    const existingOwners = await db
      .select({ ownershipPct: clinicDoctors.ownershipPct })
      .from(clinicDoctors)
      .where(
        and(
          eq(clinicDoctors.clinicId, id),
          eq(clinicDoctors.role, "owner"),
          eq(clinicDoctors.status, "active")
        )
      );
    const currentSum = existingOwners.reduce(
      (acc, r) => acc + Number(r.ownershipPct || 0),
      0
    );
    if (currentSum + body.data.ownershipPct > 100) {
      return c.json({ error: "Total ownership would exceed 100%" }, 400);
    }
  }

  try {
    const [created] = await db
      .insert(clinicDoctors)
      .values({
        clinicId: id,
        doctorId: body.data.doctorId,
        role: body.data.role,
        ownershipPct: body.data.ownershipPct,
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

// ── PATCH /clinics/:id/doctors/:docId ───────────────────
clinicRouter.patch("/:id/doctors/:docId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const docId = c.req.param("docId");
  const guard = await ensureOwner(db, id, userId);
  if (!guard.ok) return c.json({ error: guard.reason }, guard.status);

  const body = patchDoctorSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const update: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
  for (const [k, v] of Object.entries(body.data)) update[k] = v;
  await db
    .update(clinicDoctors)
    .set(update)
    .where(
      and(eq(clinicDoctors.clinicId, id), eq(clinicDoctors.doctorId, docId))
    );
  const [updated] = await db
    .select()
    .from(clinicDoctors)
    .where(
      and(eq(clinicDoctors.clinicId, id), eq(clinicDoctors.doctorId, docId))
    )
    .limit(1);
  return c.json(updated, 200);
});

// ── DELETE /clinics/:id/doctors/:docId ──────────────────
clinicRouter.delete("/:id/doctors/:docId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const docId = c.req.param("docId");
  const guard = await ensureOwner(db, id, userId);
  if (!guard.ok) return c.json({ error: guard.reason }, guard.status);

  await db
    .update(clinicDoctors)
    .set({
      status: "inactive",
      leftAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(
      and(eq(clinicDoctors.clinicId, id), eq(clinicDoctors.doctorId, docId))
    );
  return c.json({ ok: true }, 200);
});

// ── GET /clinics/:id/patients ───────────────────────────
clinicRouter.get("/:id/patients", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const rows = await db
    .select({
      id: patientsTbl.id,
      userId: patientsTbl.userId,
      name: users.name,
      mrn: clinicPatients.mrn,
      status: clinicPatients.status,
      registeredAt: clinicPatients.registeredAt,
    })
    .from(clinicPatients)
    .innerJoin(patientsTbl, eq(patientsTbl.id, clinicPatients.patientId))
    .innerJoin(users, eq(users.id, patientsTbl.userId))
    .where(eq(clinicPatients.clinicId, id))
    .orderBy(desc(clinicPatients.registeredAt));
  return c.json(rows, 200);
});

// ── POST /clinics/:id/patients ──────────────────────────
clinicRouter.post("/:id/patients", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const guard = await ensureOwner(db, id, userId);
  if (!guard.ok) return c.json({ error: guard.reason }, guard.status);

  const body = registerPatientSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const [pat] = await db
    .select()
    .from(patientsTbl)
    .where(eq(patientsTbl.id, body.data.patientId))
    .limit(1);
  if (!pat) return c.json({ error: "Patient not found" }, 404);

  const mrn = await generateMrn(db, id);
  try {
    const [created] = await db
      .insert(clinicPatients)
      .values({
        clinicId: id,
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

// ── DELETE /clinics/:id/patients/:pid ───────────────────
clinicRouter.delete("/:id/patients/:pid", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const pid = c.req.param("pid");
  const guard = await ensureOwner(db, id, userId);
  if (!guard.ok) return c.json({ error: guard.reason }, guard.status);

  await db
    .update(clinicPatients)
    .set({
      status: "discharged",
      dischargedAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(
      and(eq(clinicPatients.clinicId, id), eq(clinicPatients.patientId, pid))
    );
  return c.json({ ok: true }, 200);
});

// ── DELETE /clinics/:id ──────────────────────────────────
clinicRouter.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");

  const guard = await ensureOwner(db, id, userId);
  if (!guard.ok) return c.json({ error: guard.reason }, guard.status);

  // Delete memberships first to satisfy foreign key constraints.
  await db.delete(clinicDoctors).where(eq(clinicDoctors.clinicId, id));
  await db.delete(clinicPatients).where(eq(clinicPatients.clinicId, id));
  // Finally delete the clinic
  await db.delete(clinics).where(eq(clinics.id, id));

  return c.json({ ok: true, message: "Clinic deleted successfully" }, 200);
});

export default clinicRouter;