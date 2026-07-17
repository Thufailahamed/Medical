// @ts-nocheck
// Phase INS-MKT: super_admin CRUD for insurance providers + plans + read
// for enrollments/claims. Mirrors the admin-nav placeholder entries at
// `apps/marketing/src/portal/components/admin/admin-nav.ts:72,79`.
//
// All routes require super_admin. provider/plan endpoints auto-link to
// operator_orgs(kind='insurance').

import { Hono } from "hono";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  insuranceProviders,
  insurancePlans,
  insuranceEnrollments,
  insuranceMarketplaceClaims,
  operatorOrgs,
} from "@healthcare/db";
import {
  insuranceProviderCreateSchema,
  insuranceProviderUpdateSchema,
  insurancePlanCreateSchema,
  insurancePlanUpdateSchema,
} from "@healthcare/shared/validators";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const adminRouter = new Hono<AppEnvironment>();

adminRouter.use("*", authMiddleware, requireRole("super_admin"));

// ─── Providers ─────────────────────────────────────────

adminRouter.get("/insurance-providers", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(insuranceProviders)
    .orderBy(desc(insuranceProviders.createdAt));
  return c.json({ providers: rows });
});

adminRouter.post("/insurance-providers", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = insuranceProviderCreateSchema.parse(await c.req.json());

  // Ensure operator_org row exists for `kind='insurance'`.
  let [org] = await db
    .select()
    .from(operatorOrgs)
    .where(eq(operatorOrgs.id, body.operatorOrgId))
    .limit(1);
  if (!org) {
    [org] = await db
      .insert(operatorOrgs)
      .values({
        id: body.operatorOrgId,
        name: body.name,
        kind: "insurance",
        status: "active",
      } as any)
      .returning();
  } else if (org.kind !== "insurance") {
    return c.json(
      { error: `Operator org ${org.id} is kind=${org.kind}, not insurance` },
      400,
    );
  }

  const id = crypto.randomUUID();
  await db.insert(insuranceProviders).values({
    id,
    operatorOrgId: body.operatorOrgId,
    slug: body.slug,
    name: body.name,
    logoUrl: body.logoUrl || null,
    tagline: body.tagline || null,
    description: body.description || null,
    regulatorLicense: body.regulatorLicense || null,
    claimSettlementRatioPct: body.claimSettlementRatioPct ?? null,
    cashlessHospitalCount: body.cashlessHospitalCount ?? null,
    websiteUrl: body.websiteUrl || null,
    supportPhone: body.supportPhone || null,
    isPublished: body.isPublished ?? false,
  } as any);

  await audit(db, {
    userId,
    action: "admin.insurance_provider.created",
    resource: "insurance_provider",
    resourceId: id,
    details: { slug: body.slug, name: body.name },
  });

  const [row] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.id, id))
    .limit(1);
  return c.json({ provider: row }, 201);
});

adminRouter.put("/insurance-providers/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = insuranceProviderUpdateSchema.parse(await c.req.json());
  const patch: Record<string, any> = {};
  const map: Record<string, string> = {
    name: "name",
    slug: "slug",
    logoUrl: "logo_url",
    tagline: "tagline",
    description: "description",
    regulatorLicense: "regulator_license",
    claimSettlementRatioPct: "claim_settlement_ratio_pct",
    cashlessHospitalCount: "cashless_hospital_count",
    websiteUrl: "website_url",
    supportPhone: "support_phone",
  };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) {
      patch[map[k] ?? k] = v;
    }
  }
  if (typeof body.isPublished === "boolean") {
    patch.is_published = body.isPublished ? 1 : 0;
  }
  patch.updated_at = new Date().toISOString();
  await db
    .update(insuranceProviders)
    .set(patch)
    .where(eq(insuranceProviders.id, id));
  await audit(db, {
    userId,
    action: "admin.insurance_provider.updated",
    resource: "insurance_provider",
    resourceId: id,
    details: body,
  });
  const [row] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.id, id))
    .limit(1);
  return c.json({ provider: row });
});

// ─── Plans ─────────────────────────────────────────────

adminRouter.get("/insurance-plans", async (c) => {
  const db = c.get("db");
  const providerId = c.req.query("provider_id");
  const where = providerId
    ? eq(insurancePlans.providerId, providerId)
    : undefined;
  const rows = await db
    .select()
    .from(insurancePlans)
    .where(where as any)
    .orderBy(desc(insurancePlans.createdAt));
  return c.json({ plans: rows });
});

adminRouter.post("/insurance-plans", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = insurancePlanCreateSchema.parse(await c.req.json());
  const id = crypto.randomUUID();
  await db.insert(insurancePlans).values({
    id,
    providerId: body.providerId,
    slug: body.slug,
    name: body.name,
    planType: body.planType,
    coverageSummaryLkr: body.coverageSummaryLkr,
    coverageDetailsJson: body.coverageDetailsJson || null,
    monthlyPremiumLkr: body.monthlyPremiumLkr,
    annualPremiumLkr: body.annualPremiumLkr,
    annualDiscountPct: body.annualDiscountPct ?? 10,
    deductibleLkr: body.deductibleLkr ?? 0,
    copayPct: body.copayPct ?? 10,
    coPaymentCapLkr: body.coPaymentCapLkr ?? 0,
    waitingPeriodDays: body.waitingPeriodDays ?? 30,
    preExistingWaitingDays: body.preExistingWaitingDays ?? 365,
    networkHospitalCount: body.networkHospitalCount ?? 0,
    keyFeaturesJson: body.keyFeaturesJson || null,
    exclusionsJson: body.exclusionsJson || null,
    termMonths: body.termMonths ?? 12,
    isPublished: body.isPublished ?? false,
    isFeatured: body.isFeatured ?? false,
  } as any);
  await audit(db, {
    userId,
    action: "admin.insurance_plan.created",
    resource: "insurance_plan",
    resourceId: id,
    details: { providerId: body.providerId, name: body.name, planType: body.planType },
  });
  const [row] = await db
    .select()
    .from(insurancePlans)
    .where(eq(insurancePlans.id, id))
    .limit(1);
  return c.json({ plan: row }, 201);
});

adminRouter.put("/insurance-plans/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = insurancePlanUpdateSchema.parse(await c.req.json());
  const camelToSnake: Record<string, string> = {
    name: "name",
    slug: "slug",
    planType: "plan_type",
    coverageSummaryLkr: "coverage_summary_lkr",
    coverageDetailsJson: "coverage_details_json",
    monthlyPremiumLkr: "monthly_premium_lkr",
    annualPremiumLkr: "annual_premium_lkr",
    annualDiscountPct: "annual_discount_pct",
    deductibleLkr: "deductible_lkr",
    copayPct: "copay_pct",
    coPaymentCapLkr: "co_payment_cap_lkr",
    waitingPeriodDays: "waiting_period_days",
    preExistingWaitingDays: "pre_existing_waiting_days",
    networkHospitalCount: "network_hospital_count",
    keyFeaturesJson: "key_features_json",
    exclusionsJson: "exclusions_json",
    termMonths: "term_months",
  };
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) {
      patch[camelToSnake[k] ?? k] = v;
    }
  }
  if (typeof body.isPublished === "boolean") {
    patch.is_published = body.isPublished ? 1 : 0;
  }
  if (typeof body.isFeatured === "boolean") {
    patch.is_featured = body.isFeatured ? 1 : 0;
  }
  await db.update(insurancePlans).set(patch).where(eq(insurancePlans.id, id));
  await audit(db, {
    userId,
    action: "admin.insurance_plan.updated",
    resource: "insurance_plan",
    resourceId: id,
    details: body,
  });
  const [row] = await db
    .select()
    .from(insurancePlans)
    .where(eq(insurancePlans.id, id))
    .limit(1);
  return c.json({ plan: row });
});

// ─── Enrollments + claims (read-only for super_admin) ──

adminRouter.get("/insurance-enrollments", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(insuranceEnrollments)
    .orderBy(desc(insuranceEnrollments.createdAt));
  return c.json({ enrollments: rows });
});

adminRouter.get("/insurance-claims", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .orderBy(desc(insuranceMarketplaceClaims.createdAt));
  return c.json({ claims: rows });
});

export default adminRouter;