// @ts-nocheck

import { Hono } from "hono";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { medicineDoses, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { scheduleTodayForPatient } from "../lib/medicine-scheduler";
import type { AppEnvironment } from "../types";

const dosesRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

// ─── List doses for a date range (or medicine) ───────────
dosesRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ doses: [] });

  const from = c.req.query("from");
  const to = c.req.query("to");
  const medicineId = c.req.query("medicineId");

  const conditions = [eq(medicineDoses.patientId, patientId)];
  if (from) conditions.push(gte(medicineDoses.scheduledFor, from));
  if (to) conditions.push(lte(medicineDoses.scheduledFor, to));
  if (medicineId) conditions.push(eq(medicineDoses.medicineId, medicineId));

  const rows = await db
    .select()
    .from(medicineDoses)
    .where(and(...conditions))
    .orderBy(desc(medicineDoses.scheduledFor))
    .limit(200);

  return c.json({ doses: rows });
});

// ─── Mark a dose taken ───────────────────────────────────
dosesRouter.post("/:id/taken", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const doseId = c.req.param("id") as string;
  const body = await c.req.json().catch(() => ({}));
  const takenAt = body.takenAt || new Date().toISOString();

  const [dose] = await db
    .select()
    .from(medicineDoses)
    .where(
      and(
        eq(medicineDoses.id, doseId),
        eq(medicineDoses.patientId, patientId)
      )
    )
    .limit(1);

  if (!dose) return c.json({ error: "Dose not found" }, 404);

  // B3 (notes): only overwrite notes when the client explicitly provides
  // them. Without this, untake → re-mark loses the previous "after lunch"
  // style note because the body omits notes and we fell back to null.
  const patch: any = { takenAt, skipped: false };
  if (body.notes !== undefined) patch.notes = body.notes;
  const [updated] = await db
    .update(medicineDoses)
    .set(patch)
    .where(eq(medicineDoses.id, doseId))
    .returning();

  return c.json({ dose: updated?.medicine_doses || updated });
});

// ─── Mark a dose skipped ─────────────────────────────────
dosesRouter.post("/:id/skip", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const doseId = c.req.param("id") as string;
  const body = await c.req.json().catch(() => ({}));

  const [dose] = await db
    .select()
    .from(medicineDoses)
    .where(
      and(
        eq(medicineDoses.id, doseId),
        eq(medicineDoses.patientId, patientId)
      )
    )
    .limit(1);
  if (!dose) return c.json({ error: "Dose not found" }, 404);

  // B3 (notes): same pattern as mark-taken — preserve notes unless the
  // client explicitly passes a new value.
  const patch: any = { skipped: true, takenAt: null };
  if (body.notes !== undefined) patch.notes = body.notes;
  const [updated] = await db
    .update(medicineDoses)
    .set(patch)
    .where(eq(medicineDoses.id, doseId))
    .returning();

  return c.json({ dose: updated?.medicine_doses || updated });
});

// ─── Bulk-create today's dose schedule from active meds ─
dosesRouter.post("/schedule/today", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  // R2: schedule logic lives in lib/medicine-scheduler so the cron can
  // call it server-side too. Idempotent — safe on retry.
  const { created, date } = await scheduleTodayForPatient(db, patientId);
  return c.json({ doses: [], count: created, date });
});

// ─── Untake a dose ───────────────────────────────────────
dosesRouter.delete("/:id/taken", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const doseId = c.req.param("id") as string;
  const [dose] = await db
    .select()
    .from(medicineDoses)
    .where(
      and(eq(medicineDoses.id, doseId), eq(medicineDoses.patientId, patientId))
    )
    .limit(1);
  if (!dose) return c.json({ error: "Dose not found" }, 404);

  await db
    .update(medicineDoses)
    .set({ takenAt: null, skipped: false })
    .where(eq(medicineDoses.id, doseId));

  return c.json({ message: "Dose unmarked" });
});

export default dosesRouter;