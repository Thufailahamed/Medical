// @ts-nocheck
// Right-of-access data export. Single bundle: profile + records + files +
// medicines + vitals + symptoms + appointments + prescriptions + family +
// insurance + emergency history.

import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import {
  users,
  patients,
  medicalRecords,
  files,
  medicines,
  vitals,
  symptoms,
  appointments,
  prescriptions,
  familyMembers,
  insurance,
  emergencies,
  allergies,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const exportRouter = new Hono<AppEnvironment>();

const LOINC_MAP: Record<string, { code: string; display: string }> = {
  blood_pressure: { code: "85354-9", display: "Blood pressure systolic & diastolic" },
  heart_rate: { code: "8867-4", display: "Heart rate" },
  body_temperature: { code: "8310-5", display: "Body temperature" },
  weight: { code: "29463-7", display: "Body weight" },
  height: { code: "8302-2", display: "Body height" },
  spo2: { code: "59408-5", display: "Oxygen saturation in Arterial blood by Pulse oximetry" },
  blood_sugar: { code: "15074-8", display: "Glucose [Moles/volume] in Blood" },
};

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
    patientJoined,
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
    db
      .select({
        patient: patients,
        user: users,
      })
      .from(patients)
      .leftJoin(users, eq(users.id, patients.userId))
      .where(eq(patients.id, patientId))
      .limit(1),
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
    db.select().from(insurance).where(eq(insurance.patientId, patientId)),
    db.select().from(emergencies).where(eq(emergencies.patientId, patientId)),
    db.select().from(allergies).where(eq(allergies.patientId, patientId)),
  ]);

  const pRow = patientJoined[0]?.patient || null;
  const uRow = patientJoined[0]?.user || null;

  return {
    patient: pRow,
    user: uRow,
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
    const u: any = bundle.user || {};
    lines.push(`Patient: ${u.name || p.fullName || ""}`);
    if (u.nic) lines.push(`NIC: ${u.nic}`);
    lines.push(`DOB: ${p.dateOfBirth || u.dateOfBirth || ""}`);
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
    const entries: any[] = [];
    const p: any = bundle.patient;
    const u: any = bundle.user;
    if (p && u) {
      entries.push({
        resource: {
          resourceType: "Patient",
          id: p.id,
          meta: {
            profile: ["http://hl7.org/fhir/StructureDefinition/Patient"],
          },
          identifier: u.nic
            ? [
                {
                  use: "official",
                  type: {
                    coding: [
                      {
                        system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                        code: "NI",
                        display: "National Identifier",
                      },
                    ],
                    text: "National Identity Card (NIC)",
                  },
                  system: "http://registrargeneral.gov.lk/nic",
                  value: u.nic,
                },
              ]
            : [],
          name: [{ text: u.name }],
          telecom: [
            ...(u.phone ? [{ system: "phone", value: u.phone, use: "mobile" }] : []),
            ...(u.email ? [{ system: "email", value: u.email, use: "home" }] : []),
          ],
          gender: p.gender || undefined,
          birthDate: p.dateOfBirth || u.dateOfBirth || undefined,
        },
      });
    }
    for (const a of bundle.allergies || []) {
      entries.push({
        resource: {
          resourceType: "AllergyIntolerance",
          id: a.id,
          meta: {
            profile: ["http://hl7.org/fhir/StructureDefinition/AllergyIntolerance"],
          },
          clinicalStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                code: "active",
              },
            ],
          },
          patient: { reference: `Patient/${p?.id}` },
          code: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "414285001",
                display: "Food allergy",
              },
            ],
            text: a.substance,
          },
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
          meta: {
            profile: ["http://hl7.org/fhir/StructureDefinition/MedicationStatement"],
          },
          status: "active",
          subject: { reference: `Patient/${p?.id}` },
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
      const typeKey = (v.type || "").toLowerCase().replace(/\s+/g, "_");
      const loinc = LOINC_MAP[typeKey];
      entries.push({
        resource: {
          resourceType: "Observation",
          id: v.id,
          meta: {
            profile: ["http://hl7.org/fhir/StructureDefinition/vitalsigns"],
          },
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "vital-signs",
                  display: "Vital Signs",
                },
              ],
            },
          ],
          code: {
            coding: loinc
              ? [
                  {
                    system: "http://loinc.org",
                    code: loinc.code,
                    display: loinc.display,
                  },
                ]
              : [],
            text: v.type,
          },
          subject: { reference: `Patient/${p?.id}` },
          effectiveDateTime: v.recordedAt,
          valueQuantity: {
            value: Number(v.value),
            unit: v.unit || undefined,
            system: "http://unitsofmeasure.org",
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
          subject: { reference: `Patient/${p?.id}` },
          type: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "371530004",
                display: "Clinical consultation report",
              },
            ],
            text: r.recordType,
          },
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
