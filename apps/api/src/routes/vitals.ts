// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, gte, lte, asc } from "drizzle-orm";
import { vitals, symptoms, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";
import {
  VITAL_REGISTRY,
  VITAL_TYPES,
  VITAL_SOURCES,
  VITAL_CONTEXTS,
  defaultUnit,
  addVitalSchema,
  type VitalType,
  type VitalContext,
  type VitalSource,
  type LatestByType,
} from "@healthcare/shared/vitals";
import { derivedBlock, latestByType, classifyAlerts } from "../lib/vitals-derived";

const vitalsRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
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
  if (type) {
    if (!(VITAL_TYPES as readonly string[]).includes(type)) {
      return c.json({ error: `type must be one of: ${VITAL_TYPES.join(", ")}` }, 400);
    }
    conditions.push(eq(vitals.type, type as any));
  }

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
  const parsed = addVitalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      400,
    );
  }
  const v = parsed.data;

  if (v.type === "blood_pressure" && (v.secondaryValue == null || !Number.isFinite(v.secondaryValue))) {
    return c.json({ error: "blood_pressure requires secondaryValue (diastolic)" }, 400);
  }

  const [row] = await db
    .insert(vitals)
    .values({
      patientId,
      type: v.type as VitalType,
      value: v.value,
      unit: v.unit || defaultUnit(v.type as VitalType),
      secondaryValue: v.secondaryValue != null ? v.secondaryValue : null,
      context: (v.context ?? null) as VitalContext | null,
      recordedAt: v.recordedAt || new Date().toISOString(),
      source: (v.source ?? "manual") as VitalSource,
      notes: v.notes ?? null,
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
  if (!(VITAL_TYPES as readonly string[]).includes(type)) {
    return c.json({ error: `type must be one of: ${VITAL_TYPES.join(", ")}` }, 400);
  }

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
    context: r.context ?? null,
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

  // Add classification for the latest point
  let latestClassification: string | null = null;
  if (points.length > 0) {
    const lastRow = rows[rows.length - 1];
    const patient = await getOwnPatient(db, userId);
    const alerts = classifyAlerts([lastRow], { patient });
    if (alerts.length > 0) {
      latestClassification = alerts[0].classification;
    }
  }

  return c.json({
    type,
    range: { from: from || null, to: to || null },
    points,
    stats,
    latestClassification,
  });
});

// ─── Derived metrics block ────────────────────────────────
// Returns MAP / pulse pressure / WHR / BMR / BMI computed from latest
// readings and the patient profile. Pure derived math — no extra
// storage required.
vitalsRouter.get("/me/derived", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) {
    return c.json({
      derived: { map: null, pulsePressure: null, whr: null, bmr: null, bmi: null, bmiCategory: null },
      latestByType: [],
    });
  }

  const patient = await getOwnPatient(db, userId);
  const allRows = await db
    .select()
    .from(vitals)
    .where(eq(vitals.patientId, patientId))
    .orderBy(desc(vitals.recordedAt))
    .limit(500);

  const derived = derivedBlock({ rows: allRows, patient });
  const lbt: LatestByType[] = latestByType(allRows, { patient });
  return c.json({ derived, latestByType: lbt });
});

// ─── Out-of-range alerts (last 30 days by default) ────────
vitalsRouter.get("/me/alerts", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ alerts: [], count: 0 });

  const days = Math.min(parseInt(c.req.query("days") || "30", 10), 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const patient = await getOwnPatient(db, userId);
  const rows = await db
    .select()
    .from(vitals)
    .where(and(eq(vitals.patientId, patientId), gte(vitals.recordedAt, since.toISOString())))
    .orderBy(desc(vitals.recordedAt))
    .limit(500);

  const alerts = classifyAlerts(rows, { patient });
  return c.json({ alerts, count: alerts.length, days });
});

// ─── Symptoms list ────────────────────────────────────────
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

// Re-export registry helpers for clients that may want to look them up.
// (Not strictly needed for the API surface itself but keeps the module
// self-contained for shared consumers.)
export const __meta = {
  types: VITAL_TYPES,
  contexts: VITAL_CONTEXTS,
  sources: VITAL_SOURCES,
  registry: VITAL_REGISTRY,
};

export default vitalsRouter;
