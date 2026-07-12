// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, gte, lte, asc } from "drizzle-orm";
import { vitals, symptoms } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { resolvePatientContext } from "../lib/caretaker";
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

// Caretaker Profiles: getPatientId + getOwnPatient removed in favor of
// resolvePatientContext which respects the active-principal header for
// caretakers.

vitalsRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ vitals: [] });

  const type = c.req.query("type");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);

  const conditions = [eq(vitals.patientId, patient.id)];
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

vitalsRouter.post("/", authMiddleware, requireRole("patient", "caretaker", "doctor"), async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

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
      patientId: patient.id,
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

vitalsRouter.delete("/:id", authMiddleware, requireRole("patient", "caretaker", "doctor"), async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);
  const [row] = await db
    .select()
    .from(vitals)
    .where(and(eq(vitals.id, id), eq(vitals.patientId, patient.id)))
    .limit(1);
  if (!row) return c.json({ error: "Vital not found" }, 404);

  await db.delete(vitals).where(eq(vitals.id, id));
  return c.json({ message: "Vital deleted" });
});

vitalsRouter.get("/me/series", authMiddleware, async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ type: null, points: [], stats: null });

  const type = c.req.query("type");
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!type) return c.json({ error: "type is required" }, 400);
  if (!(VITAL_TYPES as readonly string[]).includes(type)) {
    return c.json({ error: `type must be one of: ${VITAL_TYPES.join(", ")}` }, 400);
  }

  const conditions: any[] = [
    eq(vitals.patientId, patient.id),
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

  let latestClassification: string | null = null;
  if (points.length > 0) {
    const lastRow = rows[rows.length - 1];
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

vitalsRouter.get("/me/derived", authMiddleware, async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) {
    return c.json({
      derived: { map: null, pulsePressure: null, whr: null, bmr: null, bmi: null, bmiCategory: null },
      latestByType: [],
    });
  }

  const allRows = await db
    .select()
    .from(vitals)
    .where(eq(vitals.patientId, patient.id))
    .orderBy(desc(vitals.recordedAt))
    .limit(500);

  const derived = derivedBlock({ rows: allRows, patient });
  const lbt: LatestByType[] = latestByType(allRows, { patient });
  return c.json({ derived, latestByType: lbt });
});

vitalsRouter.get("/me/alerts", authMiddleware, async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ alerts: [], count: 0 });

  const days = Math.min(parseInt(c.req.query("days") || "30", 10), 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select()
    .from(vitals)
    .where(and(eq(vitals.patientId, patient.id), gte(vitals.recordedAt, since.toISOString())))
    .orderBy(desc(vitals.recordedAt))
    .limit(500);

  const alerts = classifyAlerts(rows, { patient });
  return c.json({ alerts, count: alerts.length, days });
});

vitalsRouter.get("/symptoms/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ symptoms: [] });

  const rows = await db
    .select()
    .from(symptoms)
    .where(eq(symptoms.patientId, patient.id))
    .orderBy(desc(symptoms.startedAt))
    .limit(100);
  return c.json({ symptoms: rows });
});

vitalsRouter.post("/symptoms", authMiddleware, requireRole("patient", "caretaker", "doctor"), async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json();
  if (!body.symptom) return c.json({ error: "symptom required" }, 400);

  const severity = ["mild", "moderate", "severe"].includes(body.severity)
    ? body.severity
    : "mild";

  const [row] = await db
    .insert(symptoms)
    .values({
      patientId: patient.id,
      symptom: body.symptom,
      severity: severity as any,
      startedAt: body.startedAt || new Date().toISOString(),
      endedAt: body.endedAt || null,
      notes: body.notes || null,
    } as any)
    .returning();

  return c.json({ symptom: row }, 201);
});

vitalsRouter.delete("/symptoms/:id", authMiddleware, requireRole("patient", "caretaker", "doctor"), async (c) => {
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);
  const [row] = await db
    .select()
    .from(symptoms)
    .where(and(eq(symptoms.id, id), eq(symptoms.patientId, patient.id)))
    .limit(1);
  if (!row) return c.json({ error: "Symptom not found" }, 404);

  await db.delete(symptoms).where(eq(symptoms.id, id));
  return c.json({ message: "Symptom deleted" });
});

export const __meta = {
  types: VITAL_TYPES,
  contexts: VITAL_CONTEXTS,
  sources: VITAL_SOURCES,
  registry: VITAL_REGISTRY,
};

export default vitalsRouter;