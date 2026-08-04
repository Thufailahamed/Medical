// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { lookupLoinc, lookupRxNorm } from "@healthcare/shared";

describe("Clinical AI & Standardized Medical Coding", () => {
  it("correctly looks up LOINC codes for common lab tests", () => {
    const hba1c = lookupLoinc("HbA1c");
    expect(hba1c).not.toBeNull();
    expect(hba1c?.code).toBe("4548-4");
    expect(hba1c?.unit).toBe("%");

    const ldl = lookupLoinc("LDL");
    expect(ldl).not.toBeNull();
    expect(ldl?.code).toBe("13457-7");

    const hemoglobin = lookupLoinc("Hemoglobin");
    expect(hemoglobin).not.toBeNull();
    expect(hemoglobin?.code).toBe("718-7");
  });

  it("correctly looks up RxNorm concept codes for medications", () => {
    const amox = lookupRxNorm("Amoxicillin");
    expect(amox).not.toBeNull();
    expect(amox?.code).toBe("723");

    const atorvastatin = lookupRxNorm("Lipitor");
    expect(atorvastatin).not.toBeNull();
    expect(atorvastatin?.code).toBe("83367");

    const paracetamol = lookupRxNorm("Paracetamol");
    expect(paracetamol).not.toBeNull();
    expect(paracetamol?.code).toBe("161");
  });
});
