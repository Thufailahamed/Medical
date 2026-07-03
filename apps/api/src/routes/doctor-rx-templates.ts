// @ts-nocheck

import { Hono } from "hono";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  doctorRxTemplates,
  doctors,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const doctorRxTemplatesRouter = new Hono<AppEnvironment>();

doctorRxTemplatesRouter.use("*", authMiddleware, requireRole("doctor"));

async function getDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d;
}

function parseMedicines(value: any): { ok: true; items: any[] } | { ok: false; error: string } {
  if (Array.isArray(value)) {
    if (value.some((v: any) => typeof v !== "object" || !v)) {
      return { ok: false, error: "medicines must be an array of objects" };
    }
    return { ok: true, items: value };
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return { ok: false, error: "medicines JSON must be an array" };
      return { ok: true, items: parsed };
    } catch {
      return { ok: false, error: "medicines JSON parse failed" };
    }
  }
  return { ok: false, error: "medicines required" };
}

// ─── List templates ───────────────────────────────────────
// GET /doctor-rx-templates
doctorRxTemplatesRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const rows = await db
    .select()
    .from(doctorRxTemplates)
    .where(eq(doctorRxTemplates.doctorId, doctor.id))
    .orderBy(desc(doctorRxTemplates.useCount), desc(doctorRxTemplates.updatedAt));

  return c.json({
    templates: rows.map((r: any) => ({
      ...r,
      medicines: safeParse(r.medicinesJson),
    })),
  });
});

// ─── Get a single template ───────────────────────────────
// GET /doctor-rx-templates/:id
doctorRxTemplatesRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const id = c.req.param("id");

  const [tpl] = await db
    .select()
    .from(doctorRxTemplates)
    .where(
      and(eq(doctorRxTemplates.id, id), eq(doctorRxTemplates.doctorId, doctor.id))
    )
    .limit(1);
  if (!tpl) return c.json({ error: "Template not found" }, 404);

  return c.json({ template: { ...tpl, medicines: safeParse((tpl as any).medicinesJson) } });
});

// ─── Create a template ───────────────────────────────────
// POST /doctor-rx-templates  { name, diagnosis?, medicines, notes?, specialty? }
doctorRxTemplatesRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return c.json({ error: "name required" }, 400);
  if (name.length > 200) return c.json({ error: "name too long" }, 400);

  const parsed = parseMedicines(body.medicines);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  const [tpl] = await db
    .insert(doctorRxTemplates)
    .values({
      doctorId: doctor.id,
      name,
      diagnosis: body.diagnosis ? String(body.diagnosis).slice(0, 500) : null,
      medicinesJson: JSON.stringify(parsed.items),
      notes: body.notes ? String(body.notes).slice(0, 4000) : null,
      specialty: body.specialty
        ? String(body.specialty).slice(0, 100)
        : (doctor as any).specialization || null,
    } as any)
    .returning();

  return c.json({ template: { ...tpl, medicines: parsed.items } }, 201);
});

// ─── Update a template ───────────────────────────────────
// PATCH /doctor-rx-templates/:id  { name?, diagnosis?, medicines?, notes? }
doctorRxTemplatesRouter.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const [own] = await db
    .select()
    .from(doctorRxTemplates)
    .where(
      and(eq(doctorRxTemplates.id, id), eq(doctorRxTemplates.doctorId, doctor.id))
    )
    .limit(1);
  if (!own) return c.json({ error: "Template not found" }, 404);

  const updates: any = {
    updatedAt: new Date().toISOString(),
  };
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) return c.json({ error: "name cannot be empty" }, 400);
    updates.name = n.slice(0, 200);
  }
  if (body.diagnosis !== undefined) {
    updates.diagnosis = body.diagnosis ? String(body.diagnosis).slice(0, 500) : null;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes ? String(body.notes).slice(0, 4000) : null;
  }
  if (body.medicines !== undefined) {
    const parsed = parseMedicines(body.medicines);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    updates.medicinesJson = JSON.stringify(parsed.items);
  }

  const [updated] = await db
    .update(doctorRxTemplates)
    .set(updates)
    .where(eq(doctorRxTemplates.id, id))
    .returning();

  return c.json({
    template: { ...updated, medicines: safeParse((updated as any).medicinesJson) },
  });
});

// ─── Delete a template ───────────────────────────────────
// DELETE /doctor-rx-templates/:id
doctorRxTemplatesRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const id = c.req.param("id");

  const [own] = await db
    .select()
    .from(doctorRxTemplates)
    .where(
      and(eq(doctorRxTemplates.id, id), eq(doctorRxTemplates.doctorId, doctor.id))
    )
    .limit(1);
  if (!own) return c.json({ error: "Template not found" }, 404);

  await db.delete(doctorRxTemplates).where(eq(doctorRxTemplates.id, id));
  return c.json({ ok: true });
});

// ─── Record a use (increment counter) ────────────────────
// POST /doctor-rx-templates/:id/use
doctorRxTemplatesRouter.post("/:id/use", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const id = c.req.param("id");

  const [own] = await db
    .select()
    .from(doctorRxTemplates)
    .where(
      and(eq(doctorRxTemplates.id, id), eq(doctorRxTemplates.doctorId, doctor.id))
    )
    .limit(1);
  if (!own) return c.json({ error: "Template not found" }, 404);

  await db
    .update(doctorRxTemplates)
    .set({ useCount: sql`${doctorRxTemplates.useCount} + 1` })
    .where(eq(doctorRxTemplates.id, id));

  return c.json({ ok: true });
});

function safeParse(s: any): any[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default doctorRxTemplatesRouter;
