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

const wellnessRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

// BMI from patient.height (cm) + patient.weight (kg)
function computeBmi(heightCm?: number | null, weightKg?: number | null) {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// 0-20 score: 18.5-24.9 = full, +/- bands taper
function bmiScore(bmi: number | null): { score: number; bmi: number | null; category: string } {
  if (bmi == null) return { score: 8, bmi: null, category: "Unknown" };
  let category: string;
  let score: number;
  if (bmi < 16) {
    category = "Severely underweight";
    score = 4;
  } else if (bmi < 18.5) {
    category = "Underweight";
    score = 10;
  } else if (bmi < 25) {
    category = "Healthy";
    score = 20;
  } else if (bmi < 30) {
    category = "Overweight";
    score = 14;
  } else if (bmi < 35) {
    category = "Obese I";
    score = 8;
  } else if (bmi < 40) {
    category = "Obese II";
    score = 5;
  } else {
    category = "Severely obese";
    score = 2;
  }
  return { score, bmi: Math.round(bmi * 10) / 10, category };
}

function clamp(n: number, lo = 0, hi = 20) {
  return Math.max(lo, Math.min(hi, n));
}

// Each vital type contributes a 0-1 health factor; we average recent readings
// (last 30d) that fall within "normal" adult ranges.
function vitalHealthScore(type: string, value: number, secondary?: number | null): number | null {
  switch (type) {
    case "blood_pressure": {
      const sys = value;
      const dia = secondary ?? 0;
      // Optimal <120/<80, normal <130/<85, high-normal 130-139/85-89
      if (sys < 120 && dia < 80) return 1;
      if (sys < 130 && dia < 85) return 0.85;
      if (sys < 140 && dia < 90) return 0.6;
      if (sys < 160 && dia < 100) return 0.35;
      return 0.1;
    }
    case "blood_sugar": {
      // Fasting 70-100, random <140. We can't tell mode from a single reading so
      // give partial credit for a wide normal band.
      if (value >= 70 && value <= 100) return 1;
      if (value < 70) return 0.5; // hypoglycemia
      if (value <= 125) return 0.7; // prediabetes
      if (value <= 180) return 0.4;
      return 0.15;
    }
    case "heart_rate": {
      if (value >= 60 && value <= 100) return 1;
      if ((value >= 50 && value < 60) || (value > 100 && value <= 110)) return 0.7;
      return 0.3;
    }
    case "spo2": {
      if (value >= 95) return 1;
      if (value >= 92) return 0.7;
      if (value >= 88) return 0.4;
      return 0.15;
    }
    case "temperature": {
      if (value >= 36.1 && value <= 37.2) return 1;
      if (value >= 35.5 && value <= 38) return 0.7;
      return 0.3;
    }
    case "cholesterol": {
      // Total cholesterol; desirable <200, borderline 200-239, high >=240
      if (value < 200) return 1;
      if (value < 240) return 0.6;
      return 0.25;
    }
    default:
      return null; // weight/height handled via BMI; ignore
  }
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
    else missing.push(c.label);
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

  const bmi = computeBmi(patient?.height, patient?.weight);
  const bmiPart = bmiScore(bmi);

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
  // No doses scheduled → neutral 15/20 (no penalty, no boost)
  const adherencePoints = adherenceRatio == null ? 15 : Math.round(adherenceRatio * 20);

  // Vitals: average health factor across recent (30d) readings
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
      const f = vitalHealthScore(v.type, Number(v.value), v.secondaryValue != null ? Number(v.secondaryValue) : null);
      if (f != null) factors.push(f);
    }
    vitalsCount = factors.length;
    if (factors.length > 0) {
      const avg = factors.reduce((a, b) => a + b, 0) / factors.length;
      vitalsPoints = clamp(Math.round(avg * 20));
    }
  }

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

  // Engagement score combines med count, records activity, and appt follow-through
  let engPoints = 0;
  if (activeMeds.length > 0) engPoints += 4;
  if (activeMeds.length >= 3) engPoints += 2;
  if (recentRecords.length > 0) engPoints += 4;
  if (recentRecords.length >= 3) engPoints += 2;
  if (recentVitals.length > 0) engPoints += 4;
  if (recentVitals.length >= 5) engPoints += 2;
  if (apptTotal > 0) {
    const ratio = completed / apptTotal;
    engPoints += Math.round(ratio * 6); // up to +6 for perfect attendance
  }
  engPoints = clamp(engPoints);

  const total =
    bmiPart.score + adherencePoints + vitalsPoints + prof.score + engPoints;
  const capped = clamp(total, 0, 100);
  const level = levelFor(capped);

  // Build top tip
  const components: Array<{ key: string; label: string; score: number; max: number; tip?: string }> = [
    {
      key: "bmi",
      label: "BMI",
      score: bmiPart.score,
      max: 20,
      tip:
        bmiPart.bmi == null
          ? "Add height and weight to your profile."
          : bmiPart.score >= 20
          ? undefined
          : bmiPart.category === "Healthy"
          ? undefined
          : `BMI ${bmiPart.bmi} (${bmiPart.category}).`,
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
    bmi: bmiPart.bmi,
    bmiCategory: bmiPart.category,
    adherence: {
      taken,
      scheduled,
      ratio: adherenceRatio,
    },
    vitals: { readings: vitalsCount, recent: recentVitals.length },
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