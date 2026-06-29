// @ts-nocheck
// Right-of-access data export. Single bundle: profile + records + files +
// medicines + vitals + symptoms + appointments + prescriptions + family +
// insurance + emergency history.

import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import {
  patients,
  medicalRecords,
  files,
  medicines,
  vitals,
  symptoms,
  appointments,
  prescriptions,
  familyMembers,
  insurancePolicies,
  emergencyEvents,
  allergies,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const exportRouter = new Hono<AppEnvironment>();

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

async function bundlePatient(db: any, patientId: string) {
  const [
    [patient],
    recs,
    fs,
    meds,
    vit,
    sym,
    appts,
    rx,
    fam,
    ins,
    ems,
    allr,
  ] = await Promise.all([
    db.select().from(patients).where(eq(patients.id, patientId)).limit(1),
    db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.patientId, patientId))
      .orderBy(desc(medicalRecords.recordDate)),
    db.select().from(files).where(eq(files.patientId, patientId)),
    db.select().from(medicines).where(eq(medicines.patientId, patientId)),
    db.select().from(vitals).where(eq(vitals.patientId, patientId)),
    db.select().from(symptoms).where(eq(symptoms.patientId, patientId)),
    db.select().from(appointments).where(eq(appointments.patientId, patientId)),
    db.select().from(prescriptions).where(eq(prescriptions.patientId, patientId)),
    db.select().from(familyMembers).where(eq(familyMembers.patientId, patientId)),
    db.select().from(insurancePolicies).where(eq(insurancePolicies.patientId, patientId)),
    db.select().from(emergencyEvents).where(eq(emergencyEvents.patientId, patientId)),
    db.select().from(allergies).where(eq(allergies.patientId, patientId)),
  ]);

  return {
    patient: patient || null,
    records: recs,
    files: fs,
    medicines: meds,
    vitals: vit,
    symptoms: sym,
    appointments: appts,
    prescriptions: rx,
    familyMembers: fam,
    insurancePolicies: ins,
    emergencyHistory: ems,
    allergies: allr,
  };
}

exportRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const format = (c.req.query("format") || "json").toLowerCase();
  const bundle = await bundlePatient(db, patient.id);
  const payload = {
    schema: "healthhub.export.v3",
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    bundle,
  };

  if (format === "txt") {
    const lines: string[] = [];
    lines.push(`HealthHub Data Export`);
    lines.push(`Exported: ${payload.exportedAt}`);
    lines.push("");
    const p: any = bundle.patient || {};
    lines.push(`Patient: ${p.fullName || ""}`);
    lines.push(`DOB: ${p.dateOfBirth || ""}`);
    lines.push(`Blood group: ${p.bloodGroup || ""}`);
    lines.push("");
    lines.push(`Allergies (${(bundle.allergies || []).length}):`);
    for (const a of bundle.allergies || []) {
      lines.push(`  - ${a.substance} (${a.severity})`);
    }
    lines.push("");
    lines.push(`Active medicines (${(bundle.medicines || []).length}):`);
    for (const m of bundle.medicines || []) {
      lines.push(`  - ${m.name} ${m.dosage || ""} ${m.frequency || ""}`);
    }
    lines.push("");
    lines.push(`Records (${(bundle.records || []).length}):`);
    for (const r of bundle.records || []) {
      lines.push(`  - [${r.recordType}] ${r.title} (${r.recordDate || ""})`);
    }
    lines.push("");
    lines.push(`Vitals (${(bundle.vitals || []).length}):`);
    for (const v of bundle.vitals || []) {
      lines.push(`  - ${v.type} ${v.value}${v.secondaryValue != null ? "/" + v.secondaryValue : ""} ${v.unit || ""} @ ${v.recordedAt}`);
    }
    const filename = `healthhub-export-${new Date().toISOString().slice(0, 10)}.txt`;
    c.header("Content-Type", "text/plain; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.text(lines.join("\n"));
  }

  if (format === "fhir-bundle") {
    // Minimal FHIR-flavored bundle (entry array of resources)
    const entries: any[] = [];
    const p: any = bundle.patient;
    if (p) {
      entries.push({
        resource: {
          resourceType: "Patient",
          id: p.id,
          name: [{ text: p.fullName }],
          birthDate: p.dateOfBirth,
          gender: p.gender || p.sex || undefined,
        },
      });
    }
    for (const a of bundle.allergies || []) {
      entries.push({
        resource: {
          resourceType: "AllergyIntolerance",
          id: a.id,
          code: { text: a.substance },
          criticality:
            a.severity === "critical"
              ? "high"
              : a.severity === "severe"
              ? "high"
              : a.severity === "moderate"
              ? "low"
              : "low",
          reaction: a.reaction
            ? [{ manifestation: [{ text: a.reaction }] }]
            : undefined,
        },
      });
    }
    for (const m of bundle.medicines || []) {
      entries.push({
        resource: {
          resourceType: "MedicationStatement",
          id: m.id,
          medicationCodeableConcept: { text: m.name },
          dosage: [
            {
              text: [m.dosage, m.frequency].filter(Boolean).join(" "),
            },
          ],
          effectivePeriod: { start: m.startDate, end: m.endDate || undefined },
        },
      });
    }
    for (const v of bundle.vitals || []) {
      entries.push({
        resource: {
          resourceType: "Observation",
          id: v.id,
          status: "final",
          code: { text: v.type },
          effectiveDateTime: v.recordedAt,
          valueQuantity: {
            value: Number(v.value),
            unit: v.unit || undefined,
          },
        },
      });
    }
    for (const r of bundle.records || []) {
      entries.push({
        resource: {
          resourceType: "DocumentReference",
          id: r.id,
          status: "current",
          type: { text: r.recordType },
          date: r.recordDate || r.createdAt,
          description: r.title,
        },
      });
    }
    const filename = `healthhub-export-${new Date().toISOString().slice(0, 10)}.json`;
    c.header("Content-Type", "application/fhir+json; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.json({
      resourceType: "Bundle",
      type: "collection",
      timestamp: payload.exportedAt,
      entry: entries,
    });
  }

  // default JSON
  const filename = `healthhub-export-${new Date().toISOString().slice(0, 10)}.json`;
  c.header("Content-Type", "application/json; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.json(payload);
});

export default exportRouter;
