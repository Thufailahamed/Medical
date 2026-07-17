// @ts-nocheck
// Right-of-access data export. Single bundle: profile + records + files +
// medicines + vitals + symptoms + appointments + prescriptions + family +
// insurance + emergency history.

import { Hono } from "hono";
import { eq, desc, sql } from "drizzle-orm";
import {
  users,
  patients,
  medicalRecords,
  files,
  documentDicomMetadata,
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
import { LOINC_MAP as SHARED_LOINC } from "@healthcare/shared/vitals";
import { derivedBlock, latestByType } from "../lib/vitals-derived";

const exportRouter = new Hono<AppEnvironment>();

// Centralised in @healthcare/shared so the API and mobile use the same codes.
// Older keys (`body_temperature`, etc.) kept as aliases for back-compat.
const LOINC_MAP: Record<string, { code: string; display: string }> = {
  ...SHARED_LOINC,
  body_temperature: SHARED_LOINC.temperature,
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
    derived: derivedBlock({ rows: vit, patient: pRow }),
    latestVitals: latestByType(vit, { patient: pRow }),
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

    // Derived components — MAP / pulse pressure / WHR / BMR / BMI.
    // Emitted as additional Observation resources flagged via
    // `derived: true` extension so consumers know they were computed
    // rather than measured. v1 only; richer FHIR Provenance later.
    const derivedBundle = bundle.derived;
    if (derivedBundle) {
      const derivedObs = [
        { id: `derived-map-${p?.id}`, code: "8478-0", display: "Mean arterial pressure", value: derivedBundle.map, unit: "mmHg" },
        { id: `derived-pp-${p?.id}`, code: "8491-3", display: "Pulse pressure", value: derivedBundle.pulsePressure, unit: "mmHg" },
        { id: `derived-whr-${p?.id}`, code: "28730-0", display: "Waist-hip ratio", value: derivedBundle.whr, unit: "" },
        { id: `derived-bmr-${p?.id}`, code: "1731-9", display: "Basal metabolic rate", value: derivedBundle.bmr, unit: "kcal/day" },
        { id: `derived-bmi-${p?.id}`, code: "39156-5", display: "Body mass index", value: derivedBundle.bmi, unit: "kg/m2" },
      ];
      for (const d of derivedObs) {
        if (d.value == null) continue;
        entries.push({
          resource: {
            resourceType: "Observation",
            id: d.id,
            status: "final",
            category: [
              {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/observation-category",
                    code: "vital-signs",
                  },
                ],
              },
            ],
            code: { coding: [{ system: "http://loinc.org", code: d.code, display: d.display }] },
            subject: { reference: `Patient/${p?.id}` },
            effectiveDateTime: new Date().toISOString(),
            derivedFrom: (bundle.latestVitals || []).map((l: any) => ({
              reference: l.latest ? `Observation/${l.type}-${p?.id}` : undefined,
            })).filter((r: any) => r.reference),
            valueQuantity: {
              value: d.value,
              unit: d.unit || undefined,
              system: "http://unitsofmeasure.org",
            },
            extension: [
              {
                url: "http://healthhub.app/fhir/StructureDefinition/derived",
                valueBoolean: true,
              },
            ],
          },
        });
      }
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

    // Phase IMG-1: FHIR R4 ImagingStudy resources per distinct
    // StudyInstanceUID. We group by study, accumulate series + instances
    // with modality codes, and emit one entry per study. Skipped entirely
    // when the patient has no DICOM in the vault.
    {
      const dicomInstances = await db
        .select({
          file: files,
          record: medicalRecords,
          meta: documentDicomMetadata,
        })
        .from(documentDicomMetadata)
        .innerJoin(files, eq(files.id, documentDicomMetadata.fileId))
        .innerJoin(medicalRecords, eq(medicalRecords.id, files.recordId))
        .where(
          p?.id ? eq(medicalRecords.patientId, p.id) : sql`1=0`
        );

      const studyMap = new Map<string, any>();
      for (const inst of dicomInstances) {
        const studyUid = inst.meta.studyInstanceUid || "unknown";
        if (!studyMap.has(studyUid)) {
          studyMap.set(studyUid, {
            resourceType: "ImagingStudy",
            id: studyUid,
            meta: {
              profile: [
                "http://hl7.org/fhir/StructureDefinition/ImagingStudy",
              ],
            },
            status: "available",
            subject: { reference: `Patient/${p?.id}` },
            identifier: [{ system: "urn:dicom:uid", value: studyUid }],
            started: inst.meta.studyDate
              ? `${inst.meta.studyDate.slice(0, 4)}-${inst.meta.studyDate.slice(
                  4,
                  6
                )}-${inst.meta.studyDate.slice(6, 8)}`
              : undefined,
            modality: [] as Array<{ system: string; code: string }>,
            numberOfSeries: 0,
            numberOfInstances: 0,
            series: [] as any[],
          });
        }
        const study = studyMap.get(studyUid);
        const sUid = inst.meta.seriesInstanceUid || "unknown";
        let series = study.series.find((s: any) => s.uid === sUid);
        if (!series) {
          series = {
            uid: sUid,
            modality: inst.meta.modality || "unknown",
            bodySite: inst.meta.bodyPart
              ? {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      display: inst.meta.bodyPart,
                    },
                  ],
                }
              : undefined,
            instance: [] as any[],
          };
          study.series.push(series);
        }
        series.instance.push({
          uid: inst.meta.sopInstanceUid || `file-${inst.file.id}`,
          sopClass: inst.meta.sopClassUid
            ? { system: "urn:ietf:rfc:3986", code: inst.meta.sopClassUid }
            : undefined,
        });
        study.numberOfInstances += 1;
      }
      for (const study of studyMap.values()) {
        const seen = new Set<string>();
        for (const s of study.series) {
          if (s.modality && !seen.has(s.modality)) {
            seen.add(s.modality);
            study.modality.push({
              system: "http://dicom.nema.org/resources/ontology/DCM",
              code: s.modality,
            });
          }
        }
        study.numberOfSeries = study.series.length;
        entries.push({ resource: study });
      }
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
