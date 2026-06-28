// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { patientNotes, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const notesRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

// ─── List patient notes ──────────────────────────────────
notesRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ notes: [] });

  const rows = await db
    .select()
    .from(patientNotes)
    .where(eq(patientNotes.patientId, patientId))
    .orderBy(desc(patientNotes.pinned), desc(patientNotes.createdAt))
    .limit(200);

  return c.json({ notes: rows });
});

// ─── Create note ─────────────────────────────────────────
notesRouter.post("/", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json();
  if (!body.body || !String(body.body).trim()) {
    return c.json({ error: "body required" }, 400);
  }

  const [row] = await db
    .insert(patientNotes)
    .values({
      patientId,
      title: body.title || null,
      body: String(body.body),
      pinned: !!body.pinned,
    } as any)
    .returning();

  return c.json({ note: row }, 201);
});

// ─── Update note (with ownership check) ──────────────────
notesRouter.put("/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const id = c.req.param("id") as string;
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(patientNotes)
    .where(and(eq(patientNotes.id, id), eq(patientNotes.patientId, patientId)))
    .limit(1);
  if (!existing) return c.json({ error: "Note not found" }, 404);

  const [updated] = await db
    .update(patientNotes)
    .set({
      title: body.title ?? existing.patient_notes?.title ?? existing.title ?? null,
      body: body.body ?? existing.patient_notes?.body ?? existing.body,
      pinned:
        body.pinned != null
          ? !!body.pinned
          : existing.patient_notes?.pinned ?? existing.pinned ?? false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(patientNotes.id, id))
    .returning();

  return c.json({ note: updated?.patient_notes || updated });
});

// ─── Delete note ─────────────────────────────────────────
notesRouter.delete("/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const id = c.req.param("id") as string;
  const [existing] = await db
    .select()
    .from(patientNotes)
    .where(and(eq(patientNotes.id, id), eq(patientNotes.patientId, patientId)))
    .limit(1);
  if (!existing) return c.json({ error: "Note not found" }, 404);

  await db.delete(patientNotes).where(eq(patientNotes.id, id));
  return c.json({ message: "Note deleted" });
});

export default notesRouter;