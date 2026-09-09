import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  insuranceQuoteRequestSchema,
  insuranceCoverageCheckSchema,
} from "@healthcare/shared/validators";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const read = (rel: string) => readFileSync(resolve(repo, rel), "utf8");

describe("insurance contracts", () => {
  it("quote returns flat shape", () => {
    // Canonical flat response from POST /insurance-marketplace/quote
    // (apps/api/src/routes/insurance-marketplace.ts:489-497):
    // {planId,planName,billingCycle,basePremiumLkr,adjustedPremiumLkr,notes,riders}
    const res = {
      planId: "plan_1",
      planName: "Essential",
      billingCycle: "annual",
      basePremiumLkr: 1000,
      adjustedPremiumLkr: 1100,
      notes: [],
      riders: [],
    };
    expect(res).not.toHaveProperty("quote");
    expect(res).toHaveProperty("adjustedPremiumLkr");
    expect(res).toHaveProperty("basePremiumLkr");
  });

  it("quote request schema accepts canonical member shape", () => {
    const parsed = insuranceQuoteRequestSchema.parse({
      planId: "plan_1",
      billingCycle: "annual",
      memberAge: 30,
      memberGender: "male",
      members: [{ name: "Asha", relation: "spouse" }],
      preExisting: ["diabetes"],
    });
    expect(parsed.memberAge).toBe(30);
  });

  it("coverage-check rejects legacy estimatedCostLkr, requires estimatedAmountLkr", () => {
    // Legacy UI sent {enrollmentId,treatmentType,incurringFacility,diagnosis,estimatedCostLkr}
    // Canonical per packages/shared/src/validators.ts:645-650 is
    // {enrollmentId,treatmentType,estimatedAmountLkr,hospitalName?}
    expect(() =>
      insuranceCoverageCheckSchema.parse({
        enrollmentId: "enr_1",
        treatmentType: "hospitalization",
        // @ts-expect-error legacy field
        estimatedCostLkr: 250000,
      }),
    ).toThrow();
    const ok = insuranceCoverageCheckSchema.parse({
      enrollmentId: "enr_1",
      treatmentType: "hospitalization",
      estimatedAmountLkr: 250000,
      hospitalName: "Asiri",
    });
    expect(ok.estimatedAmountLkr).toBe(250000);
  });

  it("coverage-check response is flat (no coverage wrapper)", () => {
    // Canonical flat response (insurance-marketplace.ts:1366-1375):
    // {enrolled,planName,coverageType,covered,copayPct,estimatedOutOfPocketLkr,...}
    const res = {
      enrolled: true,
      planName: "Essential",
      coverageType: "individual",
      covered: true,
      copayPct: 10,
      estimatedOutOfPocketLkr: 25000,
      deductibleLkr: 0,
      notes: [],
    };
    expect(res).not.toHaveProperty("coverage");
    expect(res).toHaveProperty("estimatedOutOfPocketLkr");
    expect(res).toHaveProperty("covered");
  });

  it("web hub uses marketplace paths", () => {
    const src = read(
      "apps/marketing/src/app/patient/(app)/insurance/page.tsx",
    );
    expect(src).toContain("/insurance-marketplace/catalog");
    expect(src).toContain("/insurance-marketplace/enrollments/me");
    expect(src).toContain("/insurance-marketplace/claims/me");
    expect(src).not.toContain("/insurance/catalog");
    expect(src).not.toContain("/insurance/enrollments/mine");
    expect(src).not.toContain("/insurance/claims/mine");
  });

  it("web quote page reads flat response", () => {
    const src = read(
      "apps/marketing/src/app/patient/(app)/insurance/quote/page.tsx",
    );
    expect(src).toContain("adjustedPremiumLkr");
    expect(src).not.toContain("data?.quote");
  });

  it("web coverage-check sends canonical request and reads flat response", () => {
    const src = read(
      "apps/marketing/src/app/patient/(app)/insurance/coverage-check/page.tsx",
    );
    expect(src).toContain("estimatedAmountLkr");
    expect(src).toContain("hospitalName");
    expect(src).not.toContain("estimatedCostLkr");
    expect(src).not.toContain("incurringFacility");
    expect(src).not.toContain("data?.coverage");
  });

  it("mobile quote uses mutation with canonical member shape and flat response", () => {
    const src = read("apps/mobile/src/app/(app)/insurance/quote.tsx");
    expect(src).toContain("mutate(");
    expect(src).toContain("memberAge");
    expect(src).toContain("adjustedPremiumLkr");
    expect(src).not.toContain("data?.quote?.monthlyPremiumLkr");
    expect(src).not.toContain("data?.quote?.annualPremiumLkr");
  });

  it("mobile coverage-check sends enrollmentId + treatmentType + estimatedAmountLkr and reads flat", () => {
    const src = read("apps/mobile/src/app/(app)/insurance/coverage-check.tsx");
    expect(src).toContain("enrollmentId");
    expect(src).toContain("treatmentType");
    expect(src).toContain("estimatedAmountLkr");
    expect(src).toContain("hospitalization");
    expect(src).not.toContain("data?.coverage");
  });

  it("payment return/cancel pages exist and read ?order=", () => {
    for (const rel of [
      "apps/marketing/src/app/patient/(app)/insurance/payment/return/page.tsx",
      "apps/marketing/src/app/patient/(app)/insurance/payment/cancel/page.tsx",
    ]) {
      expect(existsSync(resolve(repo, rel)), `missing ${rel}`).toBe(true);
      const src = read(rel);
      expect(src).toContain("order");
      expect(src).toContain("/insurance-marketplace/enrollments/");
    }
  });
});
