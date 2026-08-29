import type { VitalPoint, VitalType } from "@/patient/types/patient";

export interface VitalMeta {
  key: VitalType;
  /** Full name used in headings and aria labels. */
  label: string;
  /** Short name used on tab pills. */
  shortLabel: string;
  unit: string;
  decimals: number;
}

/**
 * Display metadata for every vital the patient surface charts.
 *
 * The `type` strings match the enum on the `vitals` table exactly —
 * they are sent straight through as the `?type=` query parameter.
 */
export const VITAL_REGISTRY: Record<VitalType, VitalMeta> = {
  heart_rate: {
    key: "heart_rate",
    label: "Heart rate",
    shortLabel: "Heart Check",
    unit: "bpm",
    decimals: 0,
  },
  blood_pressure: {
    key: "blood_pressure",
    label: "Blood pressure",
    shortLabel: "Pressure",
    unit: "mmHg",
    decimals: 0,
  },
  spo2: {
    key: "spo2",
    label: "Oxygen saturation",
    shortLabel: "Saturation",
    unit: "%",
    decimals: 0,
  },
  temperature: {
    key: "temperature",
    label: "Temperature",
    shortLabel: "Temperature",
    unit: "°C",
    decimals: 1,
  },
  blood_sugar: {
    key: "blood_sugar",
    label: "Blood sugar",
    shortLabel: "Sugar",
    unit: "mg/dL",
    decimals: 0,
  },
  weight: {
    key: "weight",
    label: "Weight",
    shortLabel: "Weight",
    unit: "kg",
    decimals: 1,
  },
  respiratory_rate: {
    key: "respiratory_rate",
    label: "Respiratory rate",
    shortLabel: "Breathing",
    unit: "br/min",
    decimals: 0,
  },
  height: { key: "height", label: "Height", shortLabel: "Height", unit: "cm", decimals: 1 },
  cholesterol: { key: "cholesterol", label: "Cholesterol", shortLabel: "Cholesterol", unit: "mg/dL", decimals: 0 },
  hrv_rmssd: { key: "hrv_rmssd", label: "HRV (RMSSD)", shortLabel: "HRV", unit: "ms", decimals: 1 },
  body_fat_pct: { key: "body_fat_pct", label: "Body fat", shortLabel: "Body fat", unit: "%", decimals: 1 },
  waist_circumference: { key: "waist_circumference", label: "Waist circumference", shortLabel: "Waist", unit: "cm", decimals: 1 },
  hip_circumference: { key: "hip_circumference", label: "Hip circumference", shortLabel: "Hip", unit: "cm", decimals: 1 },
  pain_scale: { key: "pain_scale", label: "Pain", shortLabel: "Pain", unit: "/10", decimals: 0 },
  peak_flow: { key: "peak_flow", label: "Peak flow", shortLabel: "Peak flow", unit: "L/min", decimals: 0 },
};

/** The four vitals the dashboard trend card offers as tabs, in order. */
export const DASHBOARD_VITALS: VitalType[] = [
  "heart_rate",
  "spo2",
  "blood_pressure",
  "temperature",
];

export interface ChartPoint {
  t: string;
  value: number;
  secondary: number | null;
}

/**
 * API points → chart points.
 *
 * `secondary` carries the diastolic reading for blood pressure and is
 * null for every other type; it is preserved rather than flattened so
 * the BP chart can draw both series.
 */
export function toSeries(points: VitalPoint[]): ChartPoint[] {
  return points.map((p) => ({
    t: p.t,
    value: p.value,
    secondary: p.secondary ?? null,
  }));
}

/**
 * Index of the highest reading — the one bar rendered in the accent
 * colour. Returns -1 for an empty series so callers highlight nothing
 * rather than defaulting to index 0.
 */
export function peakIndex(points: ChartPoint[]): number {
  if (points.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].value > points[best].value) best = i;
  }
  return best;
}