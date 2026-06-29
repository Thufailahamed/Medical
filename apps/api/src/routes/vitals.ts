// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, gte, lte, asc } from "drizzle-orm";
import { vitals, symptoms, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const vitalsRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

// ─── List vitals ─────────────────────────────────────────
vitalsRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ vitals: [] });

  const type = c.req.query("type");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);

  const conditions = [eq(vitals.patientId, patientId)];
  if (type) conditions.push(eq(vitals.type, type as any));

  const rows = await db
    .select()
    .from(vitals)
    .where(and(...conditions))
    .orderBy(desc(vitals.recordedAt))
    .limit(limit);

  return c.json({ vitals: rows });
});

// ─── Add vital ───────────────────────────────────────────
vitalsRouter.post("/", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json();
  const allowed = [
    "blood_pressure",
    "blood_sugar",
    "weight",
    "height",
    "heart_rate",
    "temperature",
    "spo2",
    "cholesterol",
  ];
  if (!allowed.includes(body.type)) {
    return c.json({ error: `type must be one of: ${allowed.join(", ")}` }, 400);
  }

  const [row] = await db
    .insert(vitals)
    .values({
      patientId,
      type: body.type,
      value: Number(body.value),
      unit: body.unit || defaultUnit(body.type),
      secondaryValue: body.secondaryValue != null ? Number(body.secondaryValue) : null,
      recordedAt: body.recordedAt || new Date().toISOString(),
      source: body.source || "manual",
      notes: body.notes || null,
    } as any)
    .returning();

  return c.json({ vital: row }, 201);
});

// ─── Delete vital ────────────────────────────────────────
vitalsRouter.delete("/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);
  const [row] = await db
    .select()
    .from(vitals)
    .where(and(eq(vitals.id, id), eq(vitals.patientId, patientId)))
    .limit(1);
  if (!row) return c.json({ error: "Vital not found" }, 404);

  await db.delete(vitals).where(eq(vitals.id, id));
  return c.json({ message: "Vital deleted" });
});

// ─── Vitals trend series (chart-ready) ───────────────────
vitalsRouter.get("/me/series", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ type: null, points: [], stats: null });

  const type = c.req.query("type");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!type) return c.json({ error: "type is required" }, 400);

  const conditions: any[] = [
    eq(vitals.patientId, patientId),
    eq(vitals.type, type as any),
  ];
  if (from) conditions.push(gte(vitals.recordedAt, from));
  if (to) conditions.push(lte(vitals.recordedAt, to));

  const rows = await db
    .select()
    .from(vitals)
    .where(and(...conditions))
    .orderBy(asc(vitals.recordedAt));

  const points = rows.map((r: any) => ({
    t: r.recordedAt,
    value: Number(r.value),
    secondary: r.secondaryValue != null ? Number(r.secondaryValue) : null,
    id: r.id,
    unit: r.unit,
  }));

  let stats = null;
  if (points.length > 0) {
    const values = points.map((p: any) => p.value).filter((v: number) => Number.isFinite(v));
    const min = values.length ? Math.min(...values) : null;
    const max = values.length ? Math.max(...values) : null;
    const sum = values.reduce((a: number, b: number) => a + b, 0);
    const avg = values.length ? sum / values.length : null;
    const latest = points[points.length - 1].value;
    const first = points[0].value;
    const delta = Number.isFinite(latest) && Number.isFinite(first) ? latest - first : null;
    stats = { min, max, avg, latest, delta, count: values.length };
  }

  return c.json({
    type,
    range: { from: from || null, to: to || null },
    points,
    stats,
  });
});

// ─── Symptoms list ───────────────────────────────────────
vitalsRouter.get("/symptoms/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ symptoms: [] });

  const rows = await db
    .select()
    .from(symptoms)
    .where(eq(symptoms.patientId, patientId))
    .orderBy(desc(symptoms.startedAt))
    .limit(100);
  return c.json({ symptoms: rows });
});

vitalsRouter.post("/symptoms", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json();
  if (!body.symptom) return c.json({ error: "symptom required" }, 400);

  const severity = ["mild", "moderate", "severe"].includes(body.severity)
    ? body.severity
    : "mild";

  const [row] = await db
    .insert(symptoms)
    .values({
      patientId,
      symptom: body.symptom,
      severity: severity as any,
      startedAt: body.startedAt || new Date().toISOString(),
      endedAt: body.endedAt || null,
      notes: body.notes || null,
    } as any)
    .returning();

  return c.json({ symptom: row }, 201);
});

vitalsRouter.delete("/symptoms/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ error: "Patient not found" }, 404);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);
  const [row] = await db
    .select()
    .from(symptoms)
    .where(and(eq(symptoms.id, id), eq(symptoms.patientId, patientId)))
    .limit(1);
  if (!row) return c.json({ error: "Symptom not found" }, 404);

  await db.delete(symptoms).where(eq(symptoms.id, id));
  return c.json({ message: "Symptom deleted" });
});

function defaultUnit(type: string): string {
  switch (type) {
    case "blood_pressure":
      return "mmHg";
    case "blood_sugar":
      return "mg/dL";
    case "weight":
      return "kg";
    case "height":
      return "cm";
    case "heart_rate":
      return "bpm";
    case "temperature":
      return "°C";
    case "spo2":
      return "%";
    case "cholesterol":
      return "mg/dL";
    default:
      return "";
  }
}

export default vitalsRouter;