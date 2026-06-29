// @ts-nocheck
// Deterministic, structured one-pager summary of the patient health record.
// Supports `?format=json|text`. Same render every time — not AI-generated.

import { Hono } from "hono";
import { eq, and, desc, gte } from "drizzle-orm";
import {
  patients,
  allergies,
  medicines,
  vitals,
  medicalRecords,
  appointments,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const summaryRouter = new Hono<AppEnvironment>();

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

summaryRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const format = (c.req.query("format") || "json").toLowerCase();

  // Parallel-ish reads
  const allergyRows = await db
    .select()
    .from(allergies)
    .where(
      and(eq(allergies.patientId, patient.id), eq(allergies.active, true) as any)
    )
    .orderBy(desc(allergies.createdAt));

  const medicineRows = await db
    .select()
    .from(medicines)
    .where(eq(medicines.patientId, patient.id));
  const activeMedicines = medicineRows.filter(
    (m: any) => !m.endDate || new Date(m.endDate) > new Date()
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentVitals = await db
    .select()
    .from(vitals)
    .where(
      and(
        eq(vitals.patientId, patient.id),
        gte(vitals.recordedAt, thirtyDaysAgo.toISOString())
      )
    )
    .orderBy(desc(vitals.recordedAt))
    .limit(40);

  const recentDiagnoses = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.patientId, patient.id),
        eq(medicalRecords.recordType, "diagnosis") as any
      )
    )
    .orderBy(desc(medicalRecords.recordDate))
    .limit(10);

  const upcomingAppts = await db
    .select()
    .from(appointments)
    .where(eq(appointments.patientId, patient.id))
    .orderBy(appointments.scheduledAt)
    .limit(10);
  const followUps = upcomingAppts
    .filter((a: any) =>
      ["scheduled", "confirmed", "rescheduled"].includes(String(a.status || "").toLowerCase())
    )
    .slice(0, 5);

  const conditions = recentDiagnoses.map((d: any) => ({
    title: d.title,
    diagnosedOn: d.recordDate,
    notes: d.description,
  }));

  const recentVitalsByType: Record<string, any[]> = {};
  for (const v of recentVitals) {
    (recentVitalsByType[v.type] ??= []).push(v);
  }
  const recentVitalsSummary = Object.entries(recentVitalsByType).map(([type, rows]) => {
    const vals = rows.map((r: any) => Number(r.value)).filter((n: number) => Number.isFinite(n));
    return {
      type,
      latest: rows[0]
        ? {
            value: rows[0].value,
            secondary: rows[0].secondaryValue,
            unit: rows[0].unit,
            recordedAt: rows[0].recordedAt,
          }
        : null,
      avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      count: rows.length,
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    demographics: {
      name: patient.fullName || null,
      dob: patient.dateOfBirth || null,
      age: computeAge(patient.dateOfBirth),
      sex: patient.gender || patient.sex || null,
      bloodGroup: patient.bloodGroup || null,
      heightCm: patient.heightCm || null,
      weightKg: patient.weightKg || null,
      bmi: computeBMI(patient.heightCm, patient.weightKg),
    },
    allergies: allergyRows.map((a: any) => ({
      substance: a.substance,
      severity: a.severity,
      reaction: a.reaction,
    })),
    conditions,
    activeMedicines: activeMedicines.map((m: any) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      since: m.startDate,
    })),
    recentVitals: recentVitalsSummary,
    followUps: followUps.map((a: any) => ({
      title: a.reason || a.type || "Appointment",
      scheduledAt: a.scheduledAt,
      location: a.location,
      provider: a.providerName,
    })),
    lifestyle: {
      smoker: patient.smoker || null,
      alcohol: patient.alcoholUse || null,
      exercise: patient.exerciseFrequency || null,
      diet: patient.dietNotes || null,
    },
  };

  if (format === "text") {
    const text = renderText(summary);
    return c.text(text);
  }

  return c.json(summary);
});

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function computeBMI(h?: number | null, w?: number | null): number | null {
  if (!h || !w) return null;
  const m = h / 100;
  if (m <= 0) return null;
  return Math.round((w / (m * m)) * 10) / 10;
}

function renderText(s: any): string {
  const lines: string[] = [];
  lines.push("HEALTH SUMMARY");
  lines.push(`Generated: ${s.generatedAt}`);
  lines.push("");

  const d = s.demographics;
  if (d.name) lines.push(`Patient: ${d.name}`);
  const demoBits = [
    d.age != null ? `Age ${d.age}` : null,
    d.sex,
    d.bloodGroup ? `Blood ${d.bloodGroup}` : null,
    d.heightCm ? `${d.heightCm} cm` : null,
    d.weightKg ? `${d.weightKg} kg` : null,
    d.bmi ? `BMI ${d.bmi}` : null,
  ].filter(Boolean);
  if (demoBits.length) lines.push(demoBits.join(" • "));
  lines.push("");

  lines.push("ALLERGIES");
  if (s.allergies.length === 0) lines.push("  None recorded");
  for (const a of s.allergies) {
    lines.push(`  • ${a.substance} (${a.severity})${a.reaction ? " — " + a.reaction : ""}`);
  }
  lines.push("");

  lines.push("ACTIVE CONDITIONS");
  if (s.conditions.length === 0) lines.push("  None on record");
  for (const c of s.conditions) {
    lines.push(`  • ${c.title}${c.diagnosedOn ? " (" + c.diagnosedOn + ")" : ""}`);
  }
  lines.push("");

  lines.push("ACTIVE MEDICINES");
  if (s.activeMedicines.length === 0) lines.push("  None");
  for (const m of s.activeMedicines) {
    lines.push(`  • ${m.name}${m.dosage ? " " + m.dosage : ""}${m.frequency ? " " + m.frequency : ""}`);
  }
  lines.push("");

  lines.push("RECENT VITALS (30 days)");
  if (s.recentVitals.length === 0) lines.push("  None");
  for (const v of s.recentVitals) {
    const l = v.latest;
    if (!l) continue;
    lines.push(
      `  • ${v.type.replace(/_/g, " ")}: ${l.value}${l.secondary != null ? "/" + l.secondary : ""} ${l.unit || ""}`
    );
  }
  lines.push("");

  lines.push("UPCOMING FOLLOW-UPS");
  if (s.followUps.length === 0) lines.push("  None scheduled");
  for (const f of s.followUps) {
    lines.push(`  • ${f.title} — ${f.scheduledAt}${f.location ? " @ " + f.location : ""}`);
  }
  lines.push("");

  return lines.join("\n");
}

export default summaryRouter;