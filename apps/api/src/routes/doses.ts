// @ts-nocheck

import { Hono } from "hono";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { medicineDoses, medicines, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
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

  const [updated] = await db
    .update(medicineDoses)
    .set({ takenAt, skipped: false, notes: body.notes ?? null })
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

  const [updated] = await db
    .update(medicineDoses)
    .set({ skipped: true, takenAt: null, notes: body.notes ?? null })
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

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const activeMeds = await db
    .select()
    .from(medicines)
    .where(
      and(eq(medicines.patientId, patientId), eq(medicines.active, true))
    );

  const slotsForFrequency = (freq: string | null): string[] => {
    switch ((freq || "").toLowerCase()) {
      case "once daily":
        return ["09:00"];
      case "twice daily":
        return ["09:00", "21:00"];
      case "three times daily":
        return ["09:00", "15:00", "21:00"];
      case "four times daily":
        return ["08:00", "13:00", "18:00", "22:00"];
      default:
        return ["09:00"];
    }
  };

  const today = now.toISOString().slice(0, 10);
  const created: any[] = [];
  for (const med of activeMeds) {
    const m = med.medicines || med;
    for (const time of slotsForFrequency(m.frequency)) {
      const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
      const scheduled = new Date(now);
      scheduled.setHours(hh || 9, mm || 0, 0, 0);

      const [row] = await db
        .insert(medicineDoses)
        .values({
          medicineId: m.id,
          patientId,
          scheduledFor: scheduled.toISOString(),
        } as any)
        .returning();
      created.push(row?.medicine_doses || row);
    }
  }

  return c.json({ doses: created, count: created.length, date: today });
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