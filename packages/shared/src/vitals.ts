// @ts-nocheck
// Single source of truth for vitals: type registry, normal ranges,
// derived metrics, and per-reading classification. Shared by the API
// (validation + scoring + portal summaries) and the mobile app (UI +
// context chips + badges). No DB / no DOM.

import { z } from "zod";

// ─── Types ───────────────────────────────────────────────────────────

export type Sex = "male" | "female" | "other";

export const VITAL_TYPES = [
  "blood_pressure",
  "blood_sugar",
  "weight",
  "height",
  "heart_rate",
  "temperature",
  "spo2",
  "cholesterol",
  "respiratory_rate",
  "hrv_rmssd",
  "body_fat_pct",
  "waist_circumference",
  "hip_circumference",
  "pain_scale",
  "peak_flow",
] as const;

export type VitalType = (typeof VITAL_TYPES)[number];

export const VITAL_CONTEXTS = [
  "resting",
  "fasting",
  "post_meal",
  "pre_meal",
  "post_medication",
  "pre_medication",
  "exercise",
  "standing",
  "supine",
  "random",
] as const;

export type VitalContext = (typeof VITAL_CONTEXTS)[number];

export const VITAL_SOURCES = [
  "manual",
  "device",
  "imported",
  "apple_health",
  "google_fit",
] as const;
export type VitalSource = (typeof VITAL_SOURCES)[number];

export type Classification = "normal" | "elevated" | "high" | "low" | "critical";

export interface VitalDef {
  key: VitalType;
  label: string;
  unit: string;
  decimals: number;
  /** Higher = more clinically alarming if out of range */
  hasSecondary?: boolean; // BP only — systolic + diastolic
  /** Practitioner-facing category */
  category: "cardio" | "metabolic" | "body" | "respiratory" | "symptom";
}

export const VITAL_REGISTRY: Record<VitalType, VitalDef> = {
  blood_pressure:      { key: "blood_pressure",      label: "Blood pressure",        unit: "mmHg", decimals: 0, hasSecondary: true,  category: "cardio" },
  blood_sugar:         { key: "blood_sugar",         label: "Blood sugar",           unit: "mg/dL", decimals: 0, category: "metabolic" },
  weight:              { key: "weight",              label: "Weight",                unit: "kg", decimals: 1, category: "body" },
  height:              { key: "height",              label: "Height",                unit: "cm", decimals: 1, category: "body" },
  heart_rate:          { key: "heart_rate",          label: "Heart rate",            unit: "bpm", decimals: 0, category: "cardio" },
  temperature:         { key: "temperature",         label: "Temperature",           unit: "°C", decimals: 1, category: "body" },
  spo2:                { key: "spo2",                label: "SpO₂",                  unit: "%", decimals: 0, category: "cardio" },
  cholesterol:         { key: "cholesterol",         label: "Cholesterol",           unit: "mg/dL", decimals: 0, category: "metabolic" },
  respiratory_rate:    { key: "respiratory_rate",    label: "Respiratory rate",      unit: "br/min", decimals: 0, category: "respiratory" },
  hrv_rmssd:           { key: "hrv_rmssd",           label: "HRV (RMSSD)",           unit: "ms", decimals: 1, category: "cardio" },
  body_fat_pct:        { key: "body_fat_pct",        label: "Body fat",              unit: "%", decimals: 1, category: "body" },
  waist_circumference: { key: "waist_circumference", label: "Waist circumference",   unit: "cm", decimals: 1, category: "body" },
  hip_circumference:   { key: "hip_circumference",   label: "Hip circumference",     unit: "cm", decimals: 1, category: "body" },
  pain_scale:          { key: "pain_scale",          label: "Pain",                  unit: "/10", decimals: 0, category: "symptom" },
  peak_flow:           { key: "peak_flow",           label: "Peak flow",             unit: "L/min", decimals: 0, category: "respiratory" },
};

export function defaultUnit(type: VitalType): string {
  return VITAL_REGISTRY[type].unit;
}

// ─── Validation schemas ──────────────────────────────────────────────

export const vitalTypeSchema = z.enum(VITAL_TYPES);
export const vitalContextSchema = z.enum(VITAL_CONTEXTS);
export const vitalSourceSchema = z.enum(VITAL_SOURCES);

export const addVitalSchema = z.object({
  type: vitalTypeSchema,
  value: z.number().finite().refine((n) => Number.isFinite(n), {
    message: "value must be a finite number",
  }),
  secondaryValue: z.number().finite().nullable().optional(),
  unit: z.string().min(1).optional(),
  context: vitalContextSchema.nullable().optional(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
  source: vitalSourceSchema.optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type AddVitalInput = z.infer<typeof addVitalSchema>;

// ─── Normal ranges (adult defaults; age/sex split where relevant) ──
//
// Source: ordinary clinical practice values (AHA, WHO, ADA, NICE).
// Pediatric / pregnancy / athletic variants live in `rangeFor()` below.

interface AdultRange {
  low: number;
  high: number;
  criticalLow?: number;
  criticalHigh?: number;
  /** diastolic (BP only) */
  secondary?: { low: number; high: number; criticalLow?: number; criticalHigh?: number };
}

const ADULT_RANGES: Record<VitalType, AdultRange> = {
  blood_pressure: {
    low: 90,    high: 120,
    criticalLow: 80, criticalHigh: 180,
    secondary: { low: 60, high: 80, criticalLow: 50, criticalHigh: 120 },
  },
  blood_sugar:         { low: 70, high: 100, criticalLow: 54, criticalHigh: 250 },
  weight:              { low: 30, high: 200 },
  height:              { low: 80, high: 230 },
  heart_rate:          { low: 60, high: 100, criticalLow: 40, criticalHigh: 130 },
  temperature:         { low: 36.1, high: 37.2, criticalLow: 35.0, criticalHigh: 39.5 },
  spo2:                { low: 95, high: 100, criticalLow: 88, criticalHigh: 101 },
  cholesterol:         { low: 0, high: 200, criticalHigh: 280 },
  respiratory_rate:    { low: 12, high: 20, criticalLow: 8, criticalHigh: 30 },
  hrv_rmssd:           { low: 20, high: 100 }, // higher = better
  body_fat_pct:        { low: 5, high: 35 },   // context-dependent
  waist_circumference: { low: 50, high: 102, criticalHigh: 130 },
  hip_circumference:   { low: 70, high: 130 },
  pain_scale:          { low: 0, high: 3, criticalHigh: 7 }, // 0-10 subjective
  peak_flow:           { low: 300, high: 600, criticalLow: 150 }, // adult norm
};

export interface VitalRange {
  type: VitalType;
  low: number;
  high: number;
  criticalLow?: number;
  criticalHigh?: number;
  /** BP only */
  secondary?: { low: number; high: number; criticalLow?: number; criticalHigh?: number };
  source: "default" | "age" | "context";
}

/** Age-segregated overrides for pediatric / geriatric care. */
function ageAdjustments(type: VitalType, ageYears: number | null): Partial<AdultRange> {
  if (ageYears == null) return {};
  switch (type) {
    case "heart_rate":
      if (ageYears < 1) return { low: 100, high: 160 };
      if (ageYears < 3) return { low: 90, high: 150 };
      if (ageYears < 6) return { low: 80, high: 140 };
      if (ageYears < 12) return { low: 70, high: 120 };
      return {};
    case "respiratory_rate":
      if (ageYears < 1) return { low: 30, high: 60 };
      if (ageYears < 3) return { low: 24, high: 40 };
      if (ageYears < 6) return { low: 22, high: 34 };
      if (ageYears < 12) return { low: 18, high: 30 };
      return {};
    case "blood_sugar":
      // Pediatric fasting: 70-100 same; geriatric concern on low side
      if (ageYears >= 65) return { low: 80, high: 110 };
      return {};
    case "temperature":
      // Elderly run slightly lower baseline
      if (ageYears >= 65) return { low: 35.5, high: 37.0 };
      return {};
    default:
      return {};
  }
}

function contextAdjustments(type: VitalType, ctx: VitalContext | null): Partial<AdultRange> {
  if (!ctx) return {};
  if (type === "blood_sugar") {
    if (ctx === "fasting") return { high: 100 };
    if (ctx === "post_meal") return { low: 70, high: 140 };
    if (ctx === "pre_meal") return { low: 70, high: 100 };
    if (ctx === "random") return { low: 70, high: 140 };
  }
  if (type === "heart_rate" && ctx === "exercise") return { low: 60, high: 180, criticalHigh: 200 };
  if (type === "heart_rate" && ctx === "resting") return { low: 60, high: 100 };
  return {};
}

export function rangeFor(
  type: VitalType,
  opts?: { ageYears?: number | null; sex?: Sex | null; context?: VitalContext | null },
): VitalRange {
  const base: AdultRange = { ...ADULT_RANGES[type] };
  const adjA = ageAdjustments(type, opts?.ageYears ?? null);
  const adjC = contextAdjustments(type, opts?.context ?? null);
  const merged = { ...base, ...adjA, ...adjC };
  let source: VitalRange["source"] = "default";
  if (Object.keys(adjA).length) source = "age";
  if (Object.keys(adjC).length) source = "context";
  return {
    type,
    low: merged.low,
    high: merged.high,
    criticalLow: merged.criticalLow,
    criticalHigh: merged.criticalHigh,
    secondary: merged.secondary,
    source,
  };
}

// ─── Classification (per reading) ────────────────────────────────────
//
// Bands, per AHA / ADA / WHO:
//  blood_pressure: 5-tier (optimal / normal / elevated / stage1 / stage2 + crisis)
//  cholesterol:    <200 desirable, 200-239 borderline, ≥240 high
//  blood_sugar:    fasting <100 / 100-125 prediabetes / ≥126 diabetic territory
//                  random <140 normal, ≥200 diabetic territory
//  heart_rate / spo2 / temp / RR: normal / out-of-range / critical
//  pain_scale:     0 none, 1-3 mild, 4-6 moderate, 7-10 severe (subjective)
//  hrv_rmssd:      higher = better; below 20ms is poor
//  body_fat_pct:   sex-adjusted IDEAL bands not enforced here (just sanity low/high)

export interface ClassifyInput {
  type: VitalType;
  value: number;
  secondary?: number | null;
  context?: VitalContext | null;
  ageYears?: number | null;
  sex?: Sex | null;
}

export interface ClassifyResult {
  classification: Classification;
  /** informational message; e.g. "Above goal by 18 mmHg" */
  note?: string;
  range: VitalRange;
}

export function classifyReading(input: ClassifyInput): ClassifyResult {
  const r = rangeFor(input.type, {
    ageYears: input.ageYears,
    sex: input.sex,
    context: input.context,
  });

  if (input.type === "blood_pressure") {
    const sys = input.value;
    const dia = input.secondary ?? 0;
    // BP uses the more severe of systolic/diastolic bands
    let sysCls: Classification = "normal";
    if (sys < 90 || dia < 60) sysCls = "low";
    if (sys >= 120) sysCls = "elevated";
    if (sys >= 130 || dia >= 80) sysCls = "high";
    if (sys >= 140 || dia >= 90) sysCls = "high";
    if (sys >= 180 || dia >= 120) sysCls = "critical";
    if ((r.criticalLow != null && sys < r.criticalLow) || (r.secondary?.criticalLow != null && dia < r.secondary.criticalLow)) {
      sysCls = "critical";
    }
    const note =
      sysCls === "normal"
        ? "On goal"
        : sysCls === "elevated"
        ? "Slightly above goal"
        : sysCls === "high"
        ? `Above goal by ${sys - 130}/${dia - 80} mmHg`
        : sysCls === "critical"
        ? "Hypertensive crisis — seek care"
        : "Below normal";
    return { classification: sysCls, range: r, note };
  }

  if (input.type === "pain_scale") {
    // Subjective — pain 4-6 moderate, 7+ severe/critical
    if (input.value >= 7) return { classification: "critical", range: r, note: "Severe pain" };
    if (input.value >= 4) return { classification: "high", range: r, note: "Moderate pain" };
    if (input.value <= 3) return { classification: "normal", range: r, note: "Mild or none" };
    return { classification: "elevated", range: r };
  }

  if (input.type === "hrv_rmssd") {
    if (input.value >= 20) return { classification: "normal", range: r, note: "Healthy variability" };
    if (input.value >= 10) return { classification: "elevated", range: r, note: "Below average" };
    return { classification: "high", range: r, note: "Low HRV — recovery may be needed" };
  }

  // Generic bands
  const { low, high, criticalLow, criticalHigh } = r;
  if (criticalLow != null && input.value < criticalLow)
    return { classification: "critical", range: r, note: `Critically low (<${criticalLow}${r.unit === "mmHg" || r.unit === "mg/dL" ? " " + r.unit : ""})` };
  if (criticalHigh != null && input.value > criticalHigh)
    return { classification: "critical", range: r, note: `Critically high (>${criticalHigh} ${r.unit})` };
  if (input.value < low) return { classification: "low", range: r, note: `Below ${low} ${r.unit}` };
  if (input.value > high) return { classification: "elevated", range: r, note: `Above ${high} ${r.unit}` };
  return { classification: "normal", range: r, note: "Within range" };
}

/** 0-1 health factor used by the wellness aggregator. */
export function classifyToHealthFactor(c: Classification): number {
  switch (c) {
    case "normal": return 1;
    case "elevated": return 0.7;
    case "high": return 0.4;
    case "low": return 0.5;
    case "critical": return 0.1;
  }
}

// ─── Derived metrics (pure math) ─────────────────────────────────────

export function meanArterialPressure(sys: number, dia: number): number | null {
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null;
  return Math.round(((2 * dia + sys) / 3) * 10) / 10;
}

export function pulsePressure(sys: number, dia: number): number | null {
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null;
  return Math.round((sys - dia) * 10) / 10;
}

export function waistHipRatio(waistCm: number, hipCm: number): number | null {
  if (!Number.isFinite(waistCm) || !Number.isFinite(hipCm) || hipCm <= 0) return null;
  return Math.round((waistCm / hipCm) * 100) / 100;
}

/** Mifflin-St Jeor — gold-standard BMR formula. */
export function bmrMifflinStJeor(input: {
  sex: Sex | null | undefined;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number | null {
  const { sex, weightKg, heightCm, ageYears } = input;
  if (!weightKg || !heightCm || !ageYears) return null;
  const sexAdj = sex === "male" ? 5 : sex === "female" ? -161 : -78; // "other" midpoint
  const value = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexAdj;
  return Math.round(value);
}

export function bmiCategory(bmi: number | null): {
  category: "Underweight" | "Healthy" | "Overweight" | "Obese I" | "Obese II" | "Severely obese" | "Severely underweight";
  score: number;
} {
  if (bmi == null || !Number.isFinite(bmi)) return { category: "Underweight", score: 8 };
  if (bmi < 16) return { category: "Severely underweight", score: 4 };
  if (bmi < 18.5) return { category: "Underweight", score: 10 };
  if (bmi < 25) return { category: "Healthy", score: 20 };
  if (bmi < 30) return { category: "Overweight", score: 14 };
  if (bmi < 35) return { category: "Obese I", score: 8 };
  if (bmi < 40) return { category: "Obese II", score: 5 };
  return { category: "Severely obese", score: 2 };
}

export function bmi(heightCm: number | null | undefined, weightKg: number | null | undefined): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

// ─── LOINC map (for FHIR export) ─────────────────────────────────────

export const LOINC_MAP: Record<string, { code: string; display: string }> = {
  blood_pressure:      { code: "85354-9", display: "Blood pressure systolic & diastolic" },
  heart_rate:          { code: "8867-4",  display: "Heart rate" },
  temperature:         { code: "8310-5",  display: "Body temperature" },
  weight:              { code: "29463-7", display: "Body weight" },
  height:              { code: "8302-2",  display: "Body height" },
  spo2:                { code: "59408-5", display: "Oxygen saturation in Arterial blood by Pulse oximetry" },
  blood_sugar:         { code: "15074-8", display: "Glucose [Moles/volume] in Blood" },
  cholesterol:         { code: "2093-3",  display: "Cholesterol [Mass/volume] in Serum or Plasma" },
  respiratory_rate:    { code: "9279-1",  display: "Respiratory rate" },
  hrv_rmssd:           { code: "80422-7", display: "R-R interval.standard deviation (RMSSD)" },
  body_fat_pct:        { code: "41982-0", display: "Body fat percentage" },
  waist_circumference: { code: "8280-0",  display: "Waist circumference" },
  hip_circumference:   { code: "62409-8", display: "Hip circumference" },
  pain_scale:          { code: "72514-3", display: "Severity of pain" },
  peak_flow:           { code: "33452-4", display: "Peak expiratory flow rate" },
};

// ─── API response shapes ─────────────────────────────────────────────

export interface DerivedBlock {
  map: number | null;
  pulsePressure: number | null;
  whr: number | null;
  bmr: number | null;
  bmi: number | null;
  bmiCategory: ReturnType<typeof bmiCategory>["category"] | null;
}

export interface LatestByType {
  type: VitalType;
  latest: {
    value: number;
    secondary: number | null;
    unit: string;
    recordedAt: string;
    context: VitalContext | null;
    classification: Classification;
    note?: string;
  } | null;
}

export interface VitalAlert {
  id: string;
  type: VitalType;
  value: number;
  secondary: number | null;
  unit: string;
  classification: Classification;
  recordedAt: string;
  note?: string;
}
