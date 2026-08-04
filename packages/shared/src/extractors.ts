// Shared Zod schemas for structured document extraction (migration 0070).
// The LLM emits JSON matching these shapes; the API layer validates and
// normalises into the child tables. No DB / no DOM.
//
// Keep prompts in sync with these schemas. If a field is added here, the
// corresponding extractor prompt must enumerate it.

import { z } from "zod";

// ─── Lab report ───────────────────────────────────────────
export const labFlagSchema = z.enum([
  "normal",
  "low",
  "high",
  "critical",
  "abnormal",
  "unknown",
]);

export const labTestItemSchema = z.object({
  name: z.string().min(1).max(120),
  value: z.union([z.number(), z.string()]).optional(),
  unit: z.string().max(40).optional(),
  refLow: z.number().optional(),
  refHigh: z.number().optional(),
  refText: z.string().max(120).optional(),
  flag: labFlagSchema.optional(),
  loincCode: z.string().max(40).optional(),
});
export type LabTestItem = z.infer<typeof labTestItemSchema>;

export const labReportExtractionSchema = z.object({
  reportType: z.string().max(120).optional(),
  provider: z.string().max(240).optional(),
  collectedAt: z.string().max(40).optional(),
  reportedAt: z.string().max(40).optional(),
  tests: z.array(labTestItemSchema).max(200),
});
export type LabReportExtraction = z.infer<typeof labReportExtractionSchema>;

// ─── Imaging report ───────────────────────────────────────
export const imagingExtractionSchema = z.object({
  modality: z.string().min(1).max(60),
  bodyPart: z.string().max(120).optional(),
  studyDate: z.string().max(40).optional(),
  radiologistName: z.string().max(240).optional(),
  findings: z.string().max(8000).optional(),
  impression: z.string().max(4000).optional(),
  recommendations: z.string().max(4000).optional(),
  critical: z.boolean().optional(),
});
export type ImagingExtraction = z.infer<typeof imagingExtractionSchema>;

// ─── Discharge summary ────────────────────────────────────
export const dischargeProcedureSchema = z.object({
  name: z.string().min(1).max(240),
  date: z.string().max(40).optional(),
});
export const dischargeMedGivenSchema = z.object({
  name: z.string().min(1).max(240),
  dosage: z.string().max(120).optional(),
  duration: z.string().max(120).optional(),
});

export const dischargeExtractionSchema = z.object({
  admissionDate: z.string().max(40).optional(),
  dischargeDate: z.string().max(40).optional(),
  primaryDiagnosis: z.string().max(500).optional(),
  secondaryDiagnoses: z.array(z.string().max(240)).max(40).optional(),
  procedures: z.array(dischargeProcedureSchema).max(50).optional(),
  medicationsGiven: z.array(dischargeMedGivenSchema).max(80).optional(),
  followUpInstructions: z.string().max(4000).optional(),
  followUpDate: z.string().max(40).optional(),
  hospitalName: z.string().max(240).optional(),
  attendingDoctor: z.string().max(240).optional(),
});
export type DischargeExtraction = z.infer<typeof dischargeExtractionSchema>;

// ─── Vaccination card ─────────────────────────────────────
export const vaccinationItemSchema = z.object({
  vaccineName: z.string().min(1).max(160),
  date: z.string().max(40).nullable().optional(),
  doseNumber: z.number().int().nullable().optional(),
  provider: z.string().max(240).nullable().optional(),
  batchNumber: z.string().max(120).nullable().optional(),
  catalogId: z.string().max(80).nullable().optional(),
  catalogName: z.string().max(240).nullable().optional(),
  matched: z.boolean().optional(),
});
export const vaccinationExtractionSchema = z.object({
  vaccinations: z.array(vaccinationItemSchema).max(80),
});
export type VaccinationExtraction = z.infer<typeof vaccinationExtractionSchema>;

// ─── Prescription (PDF/scan) ──────────────────────────────
export const prescriptionMedicineSchema = z.object({
  name: z.string().min(1).max(240),
  dosage: z.string().max(80).nullable().optional(),
  frequency: z.string().max(80).nullable().optional(),
  timing: z.string().max(80).nullable().optional(),
  durationDays: z.number().int().nullable().optional(),
  refills: z.number().int().nullable().optional(),
});
export const prescriptionExtractionSchema = z.object({
  medicines: z.array(prescriptionMedicineSchema).max(40),
  doctor: z.string().max(240).optional(),
  date: z.string().max(40).optional(),
  diagnosis: z.string().max(500).optional(),
});
export type PrescriptionExtraction = z.infer<typeof prescriptionExtractionSchema>;

// ─── Extraction envelope (what extractors return) ────────
export const extractionMetaSchema = z.object({
  kind: z.enum([
    "lab_report",
    "imaging",
    "discharge_summary",
    "vaccination",
    "prescription",
  ]),
  confidence: z.number().min(0).max(1),
  modelVersion: z.string().max(120),
  rawText: z.string().max(20000),
  payload: z.unknown(),
});
export type ExtractionMeta = z.infer<typeof extractionMetaSchema>;
