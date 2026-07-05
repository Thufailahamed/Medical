// @ts-nocheck
// Aggregation + derived-metric helpers used by vitals/wellness/health-summary
// and the doctor/hospital portals. Pure functions over rows — no DB access.

import {
  VITAL_REGISTRY,
  classifyReading,
  meanArterialPressure,
  pulsePressure,
  waistHipRatio,
  bmrMifflinStJeor,
  bmi,
  bmiCategory,
  type VitalType,
  type VitalContext,
  type LatestByType,
  type DerivedBlock,
  type VitalAlert,
  type Classification,
} from "@healthcare/shared/vitals";

type VitalRow = {
  id: string;
  type: VitalType | string;
  value: number | string;
  secondaryValue: number | string | null;
  unit: string;
  recordedAt: string;
  context: VitalContext | string | null;
};

interface PatientLike {
  heightCm?: number | string | null;
  weightKg?: number | string | null;
  dateOfBirth?: string | null;
  gender?: "male" | "female" | "other" | null;
}

function num(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ageYears(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const diff = Date.now() - b.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

/** Most recent reading per vital type. Preserves raw shape so callers can
 *  also surface unit, notes, source. */
export function latestByType(rows: VitalRow[], opts?: { patient?: PatientLike | null }): LatestByType[] {
  const map = new Map<VitalType, VitalRow>();
  for (const r of rows) {
    const t = String(r.type) as VitalType;
    if (!VITAL_REGISTRY[t]) continue;
    const existing = map.get(t);
    if (!existing || (existing.recordedAt < r.recordedAt)) {
      map.set(t, r);
    }
  }

  const age = ageYears(opts?.patient?.dateOfBirth);
  const sex = (opts?.patient?.gender ?? null) as any;

  return Array.from(map.entries()).map(([type, row]) => {
    const v = num(row.value);
    const secondary = num(row.secondaryValue);
    const ctx = (row.context ?? null) as VitalContext | null;
    const cls = v != null
      ? classifyReading({ type, value: v, secondary, context: ctx, ageYears: age, sex })
      : { classification: "normal" as Classification };
    return {
      type,
      latest: {
        value: v ?? 0,
        secondary: secondary ?? null,
        unit: row.unit || VITAL_REGISTRY[type].unit,
        recordedAt: row.recordedAt,
        context: ctx ?? null,
        classification: cls.classification,
        note: (cls as any).note,
      },
    };
  });
}

/** Derived metrics block — used by /vitals/me/derived, /health-summary,
 *  /wellness. Returns null for any missing inputs. */
export function derivedBlock(opts: {
  rows: VitalRow[];
  patient: PatientLike | null | undefined;
}): DerivedBlock {
  const { rows, patient } = opts;
  const age = ageYears(patient?.dateOfBirth);
  const sex = (patient?.gender ?? null) as any;

  // Pull latest BP for MAP/pulse pressure
  const latestBp = pickLatest(rows, "blood_pressure");
  const map = latestBp && num(latestBp.value) != null && num(latestBp.secondaryValue) != null
    ? meanArterialPressure(num(latestBp.value)!, num(latestBp.secondaryValue)!)
    : null;
  const pp = latestBp && num(latestBp.value) != null && num(latestBp.secondaryValue) != null
    ? pulsePressure(num(latestBp.value)!, num(latestBp.secondaryValue)!)
    : null;

  const latestWaist = pickLatest(rows, "waist_circumference");
  const latestHip = pickLatest(rows, "hip_circumference");
  const whr =
    latestWaist && latestHip && num(latestWaist.value) != null && num(latestHip.value) != null
      ? waistHipRatio(num(latestWaist.value)!, num(latestHip.value)!)
      : null;

  const h = num(patient?.heightCm);
  const w = num(patient?.weightKg);
  const bmrVal = h != null && w != null && age != null
    ? bmrMifflinStJeor({ sex, weightKg: w, heightCm: h, ageYears: age })
    : null;
  const bmiVal = bmi(h, w);
  const cat = bmiVal != null ? bmiCategory(bmiVal) : null;

  return {
    map,
    pulsePressure: pp,
    whr,
    bmr: bmrVal,
    bmi: bmiVal,
    bmiCategory: cat?.category ?? null,
  };
}

/** Out-of-range readings from the supplied rows. Includes `critical`,
 *  `high`, and `low` per the registry's `classifyReading`. */
export function classifyAlerts(rows: VitalRow[], opts?: { patient?: PatientLike | null; sinceISO?: string | null }): VitalAlert[] {
  const age = ageYears(opts?.patient?.dateOfBirth);
  const sex = (opts?.patient?.gender ?? null) as any;
  const since = opts?.sinceISO ? new Date(opts.sinceISO).getTime() : null;
  const out: VitalAlert[] = [];
  for (const r of rows) {
    if (since != null) {
      const ts = new Date(r.recordedAt).getTime();
      if (!isFinite(ts) || ts < since) continue;
    }
    const t = String(r.type) as VitalType;
    if (!VITAL_REGISTRY[t]) continue;
    const v = num(r.value);
    const secondary = num(r.secondaryValue);
    if (v == null) continue;
    const ctx = (r.context ?? null) as VitalContext | null;
    const cls = classifyReading({ type: t, value: v, secondary, context: ctx, ageYears: age, sex });
    if (cls.classification === "normal") continue;
    out.push({
      id: r.id,
      type: t,
      value: v,
      secondary,
      unit: r.unit || VITAL_REGISTRY[t].unit,
      classification: cls.classification,
      recordedAt: r.recordedAt,
      note: (cls as any).note,
    });
  }
  // Most-recent-first
  out.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  return out;
}

function pickLatest(rows: VitalRow[], type: VitalType): VitalRow | null {
  let picked: VitalRow | null = null;
  for (const r of rows) {
    if (r.type !== type) continue;
    if (!picked || picked.recordedAt < r.recordedAt) picked = r;
  }
  return picked;
}
