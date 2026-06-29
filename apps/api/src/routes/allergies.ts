// @ts-nocheck
// Structured allergies — CRUD for the patient-facing allergy registry.
// Backed by `allergies` table (V3 migration).

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { allergies, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const allergiesRouter = new Hono<AppEnvironment>();

const SEVERITIES = ["mild", "moderate", "severe", "critical"] as const;

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// ─── List my allergies ───────────────────────────────────
allergiesRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ allergies: [] });

  const rows = await db
    .select()
    .from(allergies)
    .where(eq(allergies.patientId, patient.id))
    .orderBy(desc(allergies.createdAt));

  return c.json({ allergies: rows });
});

// ─── Add an allergy ───────────────────────────────────────
allergiesRouter.post("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const substance = String(body.substance || "").trim();
  if (!substance) return c.json({ error: "substance is required" }, 400);
  if (substance.length > 200) return c.json({ error: "substance too long" }, 400);

  const severity = SEVERITIES.includes(body.severity) ? body.severity : "moderate";

  const [row] = await db
    .insert(allergies)
    .values({
      patientId: patient.id,
      substance,
      severity,
      reaction: body.reaction ? String(body.reaction).slice(0, 500) : null,
      onsetDate: body.onsetDate || null,
      notes: body.notes ? String(body.notes).slice(0, 1000) : null,
      active: true,
    } as any)
    .returning();

  return c.json({ allergy: row }, 201);
});

// ─── Update an allergy ────────────────────────────────────
allergiesRouter.patch("/:id", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const allergyId = c.req.param("id");
  if (!allergyId) return c.json({ error: "Missing id" }, 400);

  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const [existing] = await db
    .select()
    .from(allergies)
    .where(and(eq(allergies.id, allergyId), eq(allergies.patientId, patient.id)))
    .limit(1);
  if (!existing) return c.json({ error: "Allergy not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const partial: Record<string, any> = {};
  if (typeof body.substance === "string" && body.substance.trim()) {
    partial.substance = body.substance.trim().slice(0, 200);
  }
  if (SEVERITIES.includes(body.severity)) partial.severity = body.severity;
  if (typeof body.reaction === "string") partial.reaction = body.reaction.slice(0, 500);
  if (typeof body.onsetDate === "string") partial.onsetDate = body.onsetDate;
  if (typeof body.notes === "string") partial.notes = body.notes.slice(0, 1000);
  if (typeof body.active === "boolean") partial.active = body.active;

  if (Object.keys(partial).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const [updated] = await db
    .update(allergies)
    .set(partial)
    .where(eq(allergies.id, allergyId))
    .returning();

  return c.json({ allergy: updated });
});

// ─── Delete an allergy ────────────────────────────────────
allergiesRouter.delete("/:id", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const allergyId = c.req.param("id");
  if (!allergyId) return c.json({ error: "Missing id" }, 400);

  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const [existing] = await db
    .select()
    .from(allergies)
    .where(and(eq(allergies.id, allergyId), eq(allergies.patientId, patient.id)))
    .limit(1);
  if (!existing) return c.json({ error: "Allergy not found" }, 404);

  await db.delete(allergies).where(eq(allergies.id, allergyId));
  return c.json({ message: "Allergy removed" });
});

export default allergiesRouter;