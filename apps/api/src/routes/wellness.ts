// @ts-nocheck

import { Hono } from "hono";
import { eq, and, gte, desc } from "drizzle-orm";
import {
  patients,
  vitals,
  medicines,
  medicineDoses,
  medicalRecords,
  appointments,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";
import {
  classifyReading,
  classifyToHealthFactor,
  bmrMifflinStJeor,
  meanArterialPressure,
  pulsePressure,
  waistHipRatio,
  bmiCategory,
  bmi,
  type VitalType,
} from "@healthcare/shared/vitals";
import { classifyAlerts, derivedBlock } from "../lib/vitals-derived";

const wellnessRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

function clamp(n: number, lo = 0, hi = 20) {
  return Math.max(lo, Math.min(hi, n));
}

function parseJsonArray(s: string | null | undefined): any[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function profileScore(patient: any): { score: number; filled: number; total: number; missing: string[] } {
  const checks = [
    { key: "bloodGroup", label: "Blood group" },
    { key: "dateOfBirth", label: "Date of birth" },
    { key: "gender", label: "Gender" },
    { key: "height", label: "Height" },
    { key: "weight", label: "Weight" },
  ];
  const listChecks = [
    { key: "allergies", label: "Allergies" },
    { key: "medicalConditions", label: "Conditions" },
    { key: "emergencyContacts", label: "Emergency contact" },
    { key: "lifestyle", label: "Lifestyle" },
  ];
  const total = checks.length + listChecks.length;
  let filled = 0;
  const missing: string[] = [];
  for (const c of checks) {
    const v = patient?.[c.key];
    const ok = v !== null && v !== undefined && v !== "";
    if (ok) filled += 1;
    else missing.push(c.label);
  }
  for (const c of listChecks) {
    const arr = parseJsonArray(patient?.[c.key]);
    if (arr.length > 0) filled += 1;
  }
  return { score: Math.round((filled / total) * 20), filled, total, missing };
}

function levelFor(score: number) {
  if (score >= 80) return { label: "Excellent", tone: "success" };
  if (score >= 60) return { label: "Good", tone: "info" };
  if (score >= 40) return { label: "Fair", tone: "warning" };
  return { label: "Needs attention", tone: "danger" };
}

// ─── GET /wellness/me ────────────────────────────────────
wellnessRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) {
    return c.json({
      score: 0,
      level: { label: "Set up profile", tone: "warning" },
      components: {},
      updatedAt: new Date().toISOString(),
    });
  }

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  // BMI (registry-driven)
  const bmiVal = bmi(patient?.height, patient?.weight);
  const bmiPart = bmiVal != null ? bmiCategory(bmiVal) : { category: "Underweight", score: 8 };

  // Adherence: today's scheduled doses vs taken
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const todaysDoses = await db
    .select()
    .from(medicineDoses)
    .where(
      and(
        eq(medicineDoses.patientId, patientId),
        gte(medicineDoses.scheduledFor, dayStart.toISOString()),
      ),
    );

  const scheduled = todaysDoses.length;
  const taken = todaysDoses.filter((d: any) => d.takenAt && !d.skipped).length;
  const adherenceRatio = scheduled > 0 ? taken / scheduled : null;
  const adherencePoints = adherenceRatio == null ? 15 : Math.round(adherenceRatio * 20);

  // Vitals: average health factor across recent (30d) readings using
  // the registry-driven classifier. Falls back to the baseline when no
  // readings exist.
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const recentVitals = await db
    .select()
    .from(vitals)
    .where(and(eq(vitals.patientId, patientId), gte(vitals.recordedAt, thirtyAgo.toISOString())))
    .orderBy(desc(vitals.recordedAt))
    .limit(50);

  let vitalsPoints = 10; // baseline for no data
  let vitalsCount = 0;
  if (recentVitals.length > 0) {
    const factors: number[] = [];
    for (const v of recentVitals as any[]) {
      const cls = classifyReading({
        type: v.type as VitalType,
        value: Number(v.value),
        secondary: v.secondaryValue != null ? Number(v.secondaryValue) : null,
        context: (v.context ?? null) as any,
      });
      factors.push(classifyToHealthFactor(cls.classification));
    }
    vitalsCount = factors.length;
    if (factors.length > 0) {
      const avg = factors.reduce((a, b) => a + b, 0) / factors.length;
      vitalsPoints = clamp(Math.round(avg * 20));
    }
  }

  // Derived-metrics bonus (0-5): reward patients whose MAP / pulse
  // pressure / WHR / BMR all sit in healthy bands. Capped at 5 so it
  // can't dominate the score.
  const derived = derivedBlock({ rows: recentVitals, patient });
  let derivedPoints = 0;
  const derivedChecks: Array<{ ok: boolean }> = [
    { ok: derived.map != null && derived.map >= 70 && derived.map <= 100 },     // MAP
    { ok: derived.pulsePressure != null && derived.pulsePressure >= 30 && derived.pulsePressure <= 60 },
    { ok: derived.whr == null || (derived.whr < 1.0) },                          // permissive
  ];
  for (const ch of derivedChecks) if (ch.ok) derivedPoints += 2;
  derivedPoints = clamp(derivedPoints, 0, 5);

  // Profile completeness
  const prof = profileScore(patient);

  // Engagement: active medicines + records/vitals logged in last 30d
  const activeMeds = await db
    .select()
    .from(medicines)
    .where(and(eq(medicines.patientId, patientId), eq(medicines.active, true)));

  const recentRecords = await db
    .select()
    .from(medicalRecords)
    .where(and(eq(medicalRecords.patientId, patientId), gte(medicalRecords.date, thirtyAgo.toISOString().slice(0, 10))));

  // Appointment health: completed vs no_show in last 90d
  const ninetyAgo = new Date();
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const recentAppts = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.patientId, patientId), gte(appointments.date, ninetyAgo.toISOString().slice(0, 10))));

  const completed = recentAppts.filter((a: any) => a.status === "completed").length;
  const noShows = recentAppts.filter((a: any) => a.status === "no_show").length;
  const apptTotal = completed + noShows;

  let engPoints = 0;
  if (activeMeds.length > 0) engPoints += 4;
  if (activeMeds.length >= 3) engPoints += 2;
  if (recentRecords.length > 0) engPoints += 4;
  if (recentRecords.length >= 3) engPoints += 2;
  if (recentVitals.length > 0) engPoints += 4;
  if (recentVitals.length >= 5) engPoints += 2;
  if (apptTotal > 0) {
    const ratio = completed / apptTotal;
    engPoints += Math.round(ratio * 6);
  }
  engPoints = clamp(engPoints);

  const total =
    bmiPart.score + adherencePoints + vitalsPoints + derivedPoints + prof.score + engPoints;
  const capped = clamp(total, 0, 100);
  const level = levelFor(capped);

  // Alerts (30d) — surfaced for home/portal UI
  const alerts = classifyAlerts(recentVitals, { patient });

  const components: Array<{ key: string; label: string; score: number; max: number; tip?: string }> = [
    {
      key: "bmi",
      label: "BMI",
      score: bmiPart.score,
      max: 20,
      tip:
        bmiVal == null
          ? "Add height and weight to your profile."
          : bmiPart.score >= 20
          ? undefined
          : `BMI ${bmiVal} (${bmiPart.category}).`,
    },
    {
      key: "adherence",
      label: "Medicine adherence",
      score: adherencePoints,
      max: 20,
      tip:
        adherenceRatio == null
          ? "No medicines scheduled today."
          : adherenceRatio < 0.8
          ? `Only ${taken}/${scheduled} doses taken today.`
          : undefined,
    },
    {
      key: "vitals",
      label: "Vitals in range",
      score: vitalsPoints,
      max: 20,
      tip:
        vitalsCount === 0
          ? "Log a vitals reading to track your health."
          : vitalsPoints < 16
          ? "Some recent readings are out of range."
          : undefined,
    },
    {
      key: "derived",
      label: "Derived metrics",
      score: derivedPoints,
      max: 5,
      tip: derivedPoints < 4
        ? "Track BP, weight, height & waist to derive MAP/WHR/BMR."
        : undefined,
    },
    {
      key: "profile",
      label: "Profile",
      score: prof.score,
      max: 20,
      tip:
        prof.missing.length > 0
          ? `Add: ${prof.missing.slice(0, 3).join(", ")}.`
          : undefined,
    },
    {
      key: "engagement",
      label: "Engagement",
      score: engPoints,
      max: 20,
      tip:
        engPoints < 14
          ? "Track medicines, vitals and visits to improve your score."
          : undefined,
    },
  ];

  const topTip = components
    .filter((c) => c.tip)
    .sort((a, b) => a.score / a.max - b.score / b.max)[0]?.tip;

  return c.json({
    score: capped,
    level,
    components,
    topTip,
    bmi: bmiVal,
    bmiCategory: bmiPart.category,
    derived: {
      map: derived.map,
      pulsePressure: derived.pulsePressure,
      whr: derived.whr,
      bmr: derived.bmr,
    },
    adherence: {
      taken,
      scheduled,
      ratio: adherenceRatio,
    },
    vitals: { readings: vitalsCount, recent: recentVitals.length },
    alerts: {
      count: alerts.length,
      lastAt: alerts[0]?.recordedAt ?? null,
      items: alerts.slice(0, 5),
    },
    profile: { filled: prof.filled, total: prof.total, missing: prof.missing },
    engagement: {
      activeMedicines: activeMeds.length,
      recentRecords: recentRecords.length,
      recentVitals: recentVitals.length,
      completedAppointments: completed,
      noShows,
    },
    updatedAt: new Date().toISOString(),
  });
});

export default wellnessRouter;
