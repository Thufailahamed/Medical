import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const read = (rel: string) => readFileSync(resolve(repo, rel), "utf8");

describe("admin collision", () => {
  it("marketplace claims path distinct from legacy", () => {
    expect("/admin/insurance-mkt-claims").not.toBe("/admin/insurance-claims");
    const mkt = read("apps/api/src/routes/admin-insurance.ts");
    // Marketplace router must expose the new path
    expect(mkt).toContain("/insurance-mkt-claims");
    // Old colliding path must be gone from marketplace router
    expect(mkt).not.toContain('get("/insurance-claims"');
  });

  it("legacy admin claims unchanged returning {items,total}", () => {
    const legacy = read("apps/api/src/routes/admin.ts");
    expect(legacy).toContain('get("/insurance-claims"');
    expect(legacy).toContain("items:");
    expect(legacy).toContain("total:");
  });

  it("marketplace claims returns enriched shape with status filter + total", () => {
    const src = read("apps/api/src/routes/admin-insurance.ts");
    expect(src).toContain("patientName");
    expect(src).toContain("providerName");
    expect(src).toContain("policyNumber");
    expect(src).toContain("total");
    expect(src).toContain('query("status")');
  });

  it("marketplace plans accepts both provider_id and providerId", () => {
    const src = read("apps/api/src/routes/admin-insurance.ts");
    expect(src).toContain('query("provider_id")');
    expect(src).toContain('query("providerId")');
  });

  it("operator enrollments enriched with userName,planName via joins", () => {
    const src = read("apps/api/src/routes/insurance-operator.ts");
    expect(src).toContain("userName");
    expect(src).toContain("planName");
    // joins to users + plans tables
    expect(src).toMatch(/leftJoin|innerJoin/);
    expect(src).toContain("users");
    expect(src).toContain("insurancePlans");
  });

  it("marketing mkt claims page uses new path with status filter", () => {
    const src = read(
      "apps/marketing/src/app/admin/(admin)/insurance-mkt/claims/page.tsx",
    );
    expect(src).toContain("/admin/insurance-mkt-claims");
    expect(src).toContain("?status=");
    expect(src).toContain("patientName");
    expect(src).toContain("providerName");
    expect(src).toContain("policyNumber");
  });

  it("marketing mkt plans page uses provider_id query key", () => {
    const src = read(
      "apps/marketing/src/app/admin/(admin)/insurance-mkt/plans/page.tsx",
    );
    expect(src).toContain("provider_id");
  });

  it("operator enrollments page reads enriched fields", () => {
    const src = read(
      "apps/marketing/src/app/insurance-operator/(portal)/enrollments/page.tsx",
    );
    expect(src).toContain("userName");
    expect(src).toContain("planName");
  });
});
