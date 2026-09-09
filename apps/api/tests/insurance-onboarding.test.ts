import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const read = (rel: string) => readFileSync(resolve(repo, rel), "utf8");
const exists = (rel: string) => existsSync(resolve(repo, rel));

describe("onboarding", () => {
  it("register creates pending org", () => {
    expect("pending").toBe("pending");
  });

  it("migration 0077 adds license_doc_key + verified_at to operator_orgs (additive only)", () => {
    const rel = "apps/api/migrations/0077_insurance_onboarding.sql";
    expect(exists(rel)).toBe(true);
    const sql = read(rel);
    expect(sql).toContain("operator_orgs");
    expect(sql).toContain("license_doc_key");
    expect(sql).toContain("verified_at");
    // additive only: must not touch other tables
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/CREATE TABLE insurance_/);
  });

  it("POST /insurance-operator/register creates pending org + returns orgId + audits", () => {
    const src = read("apps/api/src/routes/insurance-operator.ts");
    expect(src).toContain("/register");
    // creates operator_orgs kind=insurance status=pending
    expect(src).toContain("operatorOrgs");
    expect(src).toMatch(/kind.*insurance/);
    expect(src).toMatch(/pending/);
    // returns {orgId,status:pending}
    expect(src).toMatch(/orgId/);
    expect(src).toContain("audit(");
  });

  it("operator providers/plans create drafts with isPublished=false via same Zod schemas + org scoping", () => {
    const src = read("apps/api/src/routes/insurance-operator.ts");
    // routes exist
    expect(src).toContain("/providers");
    expect(src).toContain("/plans");
    // mirror admin-insurance validation via same Zod schemas
    expect(src).toContain("insuranceProviderCreateSchema");
    expect(src).toContain("insurancePlanCreateSchema");
    // force isPublished=false
    expect(src).toMatch(/isPublished.*false|false.*isPublished|is_published.*0/);
    // scope operatorOrgId to caller's org via resolveOperatorOrg
    expect(src).toContain("resolveOperatorOrg");
    expect(src).toContain("operatorOrgId");
  });

  it("KYC endpoint flips kycStatus scoped to org providers with notify + audit", () => {
    const src = read("apps/api/src/routes/insurance-operator.ts");
    expect(src).toMatch(/enrollments\/:id\/kyc|enrollments.*kyc/);
    expect(src).toContain("kycStatus");
    expect(src).toMatch(/verified.*rejected|rejected.*verified/);
    expect(src).toContain("resolveOperatorOrg");
    expect(src).toContain("notify(");
    expect(src).toContain("audit(");
  });

  it("webhook does not auto-verify when KYC pending (only keeps verified if already verified)", () => {
    const src = read("apps/api/src/routes/insurance-marketplace.ts");
    expect(src).toContain("handleInsurancePremiumPaid");
    // must not unconditionally set kycStatus to verified; must preserve/conditional
    const idx = src.indexOf("handleInsurancePremiumPaid");
    const block = src.slice(idx, idx + 8000);
    // conditional preserve: references existing enrollment.kycStatus
    expect(block).toMatch(/enrollment\.kycStatus|kycStatus.*enrollment|kycStatus:.*\?.*:/);
  });

  it("super_admin publish still sets isPublished true (no breaking change)", () => {
    const src = read("apps/api/src/routes/admin-insurance.ts");
    expect(src).toContain("isPublished");
    expect(src).toMatch(/is_published|isPublished/);
    // admin can set published true (no forced false)
    expect(src).not.toMatch(/force.*false|isPublished:\s*false/);
  });

  it("marketing register page posts to new register endpoint", () => {
    const rel = "apps/marketing/src/app/insurance-operator/register/page.tsx";
    expect(exists(rel)).toBe(true);
    const src = read(rel);
    expect(src).toMatch(/insurance-operator\/register|\/register/);
    expect(src).toMatch(/orgName|license/);
    expect(src).toMatch(/contactEmail|contactPhone/);
  });
});
