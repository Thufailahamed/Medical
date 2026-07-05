// tests/vitals.test.ts
//
// Pure-math + classifier tests for the vitals registry and the
// `vitals-derived` lib. No DB needed — every function is deterministic
// and side-effect-free.

import { describe, it, expect } from "vitest";
import {
  meanArterialPressure,
  pulsePressure,
  waistHipRatio,
  bmrMifflinStJeor,
  bmi,
  bmiCategory,
  classifyReading,
  classifyToHealthFactor,
  rangeFor,
  VITAL_TYPES,
} from "@healthcare/shared/vitals";
import {
  derivedBlock,
  latestByType,
  classifyAlerts,
} from "../src/lib/vitals-derived";

const PATIENT = {
  heightCm: 175,
  weightKg: 78,
  dateOfBirth: "1990-06-15",
  gender: "male" as const,
};

describe("derived math", () => {
  it("MAP: (2*dia + sys)/3", () => {
    expect(meanArterialPressure(120, 80)).toBeCloseTo(93.3, 1);
    expect(meanArterialPressure(150, 95)).toBeCloseTo(113.3, 1);
    expect(meanArterialPressure(90, 60)).toBeCloseTo(70, 1);
    expect(meanArterialPressure(NaN as any, 80)).toBeNull();
  });

  it("pulse pressure: sys - dia", () => {
    expect(pulsePressure(120, 80)).toBe(40);
    expect(pulsePressure(150, 95)).toBe(55);
    expect(pulsePressure(100, 60)).toBe(40);
  });

  it("WHR: waist/hip, rounded", () => {
    expect(waistHipRatio(85, 95)).toBe(0.89);
    expect(waistHipRatio(100, 100)).toBe(1.0);
    expect(waistHipRatio(85, 0)).toBeNull();
  });

  it("BMR Mifflin-St Jeor: male vs female", () => {
    // Male 30y 80kg 180cm
    //   = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(
      bmrMifflinStJeor({ sex: "male", weightKg: 80, heightCm: 180, ageYears: 30 }),
    ).toBe(1780);
    // Female 30y 65kg 165cm
    //   = 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370.25 -> 1370
    expect(
      bmrMifflinStJeor({ sex: "female", weightKg: 65, heightCm: 165, ageYears: 30 }),
    ).toBe(1370);
  });

  it("BMI + WHO category", () => {
    expect(bmi(180, 80)).toBe(24.7);
    expect(bmi(0, 80)).toBeNull();
    expect(bmi(180, 0)).toBeNull();

    expect(bmiCategory(15).category).toBe("Severely underweight");
    expect(bmiCategory(18).category).toBe("Underweight");
    expect(bmiCategory(22).category).toBe("Healthy");
    expect(bmiCategory(27).category).toBe("Overweight");
    expect(bmiCategory(33).category).toBe("Obese I");
    expect(bmiCategory(40).category).toBe("Severely obese");
  });
});

describe("rangeFor age + context adjustments", () => {
  it("child heart rate is higher", () => {
    const child = rangeFor("heart_rate", { ageYears: 5 });
    const adult = rangeFor("heart_rate", { ageYears: 30 });
    expect(child.low).toBeGreaterThan(adult.low);
  });

  it("fasting glucose vs random has tighter high", () => {
    const fasting = rangeFor("blood_sugar", { context: "fasting" });
    const postMeal = rangeFor("blood_sugar", { context: "post_meal" });
    expect(fasting.high).toBeLessThanOrEqual(postMeal.high);
  });

  it("exercise HR widens the band", () => {
    const resting = rangeFor("heart_rate", { context: "resting" });
    const exercise = rangeFor("heart_rate", { context: "exercise" });
    expect(exercise.high).toBeGreaterThan(resting.high);
  });
});

describe("classifyReading", () => {
  it("normal blood pressure", () => {
    const r = classifyReading({ type: "blood_pressure", value: 115, secondary: 75 });
    expect(r.classification).toBe("normal");
  });

  it("elevated BP", () => {
    const r = classifyReading({ type: "blood_pressure", value: 125, secondary: 78 });
    expect(r.classification).toBe("elevated");
  });

  it("stage 1 hypertension", () => {
    const r = classifyReading({ type: "blood_pressure", value: 135, secondary: 85 });
    expect(r.classification).toBe("high");
  });

  it("hypertensive crisis", () => {
    const r = classifyReading({ type: "blood_pressure", value: 190, secondary: 125 });
    expect(r.classification).toBe("critical");
  });

  it("low SpO2 (88)", () => {
    const r = classifyReading({ type: "spo2", value: 88 });
    expect(["low", "critical"]).toContain(r.classification);
  });

  it("critical SpO2 (85)", () => {
    const r = classifyReading({ type: "spo2", value: 85 });
    expect(r.classification).toBe("critical");
  });

  it("HRV — higher is better", () => {
    expect(classifyReading({ type: "hrv_rmssd", value: 35 }).classification).toBe("normal");
    expect(classifyReading({ type: "hrv_rmssd", value: 15 }).classification).toBe("elevated");
    expect(classifyReading({ type: "hrv_rmssd", value: 8 }).classification).toBe("high");
  });

  it("pain scale 0-10 subjective bands", () => {
    expect(classifyReading({ type: "pain_scale", value: 2 }).classification).toBe("normal");
    expect(classifyReading({ type: "pain_scale", value: 5 }).classification).toBe("high");
    expect(classifyReading({ type: "pain_scale", value: 9 }).classification).toBe("critical");
  });

  it("fasting glucose 110 = elevated (prediabetes territory)", () => {
    const r = classifyReading({
      type: "blood_sugar",
      value: 110,
      context: "fasting",
    });
    expect(r.classification).toBe("elevated");
  });

  it("health factor 0-1 maps", () => {
    expect(classifyToHealthFactor("normal")).toBe(1);
    expect(classifyToHealthFactor("elevated")).toBe(0.7);
    expect(classifyToHealthFactor("critical")).toBe(0.1);
  });
});

describe("derivedBlock (registry + lib integration)", () => {
  it("MAP, pulse pressure, BMR, BMI from one BP reading + patient", () => {
    const rows: any[] = [
      {
        id: "v1",
        type: "blood_pressure",
        value: 120,
        secondaryValue: 80,
        unit: "mmHg",
        recordedAt: "2026-07-01T08:00:00.000Z",
        context: null,
      },
    ];
    const d = derivedBlock({ rows, patient: PATIENT });
    expect(d.map).toBeCloseTo(93.3, 1);
    expect(d.pulsePressure).toBe(40);
    expect(d.bmi).toBe(25.5);
    expect(d.bmr).toBeGreaterThan(1500);
    expect(d.bmiCategory).toBe("Overweight");
  });

  it("WHR computed from latest waist + hip", () => {
    const rows: any[] = [
      { id: "w", type: "waist_circumference", value: 90, secondaryValue: null, unit: "cm", recordedAt: "2026-07-01T08:00:00.000Z", context: null },
      { id: "h", type: "hip_circumference", value: 100, secondaryValue: null, unit: "cm", recordedAt: "2026-07-01T08:00:00.000Z", context: null },
    ];
    const d = derivedBlock({ rows, patient: PATIENT });
    expect(d.whr).toBe(0.9);
  });
});

describe("latestByType + classifyAlerts", () => {
  const rows: any[] = [
    { id: "1", type: "blood_pressure", value: 115, secondaryValue: 75, unit: "mmHg", recordedAt: "2026-07-01T00:00:00.000Z", context: null },
    { id: "2", type: "blood_pressure", value: 145, secondaryValue: 92, unit: "mmHg", recordedAt: "2026-07-03T00:00:00.000Z", context: null },
    { id: "3", type: "heart_rate", value: 72, secondaryValue: null, unit: "bpm", recordedAt: "2026-07-04T00:00:00.000Z", context: null },
  ];

  it("picks most-recent reading per type and classifies", () => {
    const lbt = latestByType(rows, { patient: PATIENT });
    const bp = lbt.find((x) => x.type === "blood_pressure");
    expect(bp?.latest?.value).toBe(145);
    expect(bp?.latest?.classification).toBe("high");

    const hr = lbt.find((x) => x.type === "heart_rate");
    expect(hr?.latest?.classification).toBe("normal");
  });

  it("alerts include only out-of-range readings", () => {
    const alerts = classifyAlerts(rows, { patient: PATIENT });
    // 145/92 BP is high → alert. 72 HR is normal. → 1 alert
    expect(alerts.length).toBe(1);
    expect(alerts[0].id).toBe("2");
    expect(alerts[0].classification).toBe("high");
  });
});

describe("VITAL_TYPES — full medical coverage", () => {
  it("includes new core types", () => {
    for (const k of [
      "blood_pressure", "blood_sugar", "weight", "height", "heart_rate",
      "temperature", "spo2", "cholesterol", "respiratory_rate", "hrv_rmssd",
      "body_fat_pct", "waist_circumference", "hip_circumference",
      "pain_scale", "peak_flow",
    ]) {
      expect(VITAL_TYPES).toContain(k);
    }
  });
});
