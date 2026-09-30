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
  users,
} from "@healthcare/db";
import {
  insuranceProviderCreateSchema,
  insuranceProviderUpdateSchema,
  insurancePlanCreateSchema,
  insurancePlanUpdateSchema,
} from "@healthcare/shared/validators";
import { authMiddleware } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const adminRouter = new Hono<AppEnvironment>();

// requireAdmin enforces super_admin role + aud="admin" so mobile-issued
// tokens can't reach these endpoints (the role-only check would have
// allowed any token whose payload carries role=super_admin, including
// ones minted for the mobile audience).
adminRouter.use("*", authMiddleware, requireAdmin);

// ─── Providers ─────────────────────────────────────────

adminRouter.get("/insurance-providers", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(insuranceProviders)
    .orderBy(desc(insuranceProviders.createdAt));
  // Per-provider plan + enrollment counts for the admin directory.
  const [plans, enrollments] = await Promise.all([
    db.select({ providerId: insurancePlans.providerId }).from(insurancePlans),
    db.select({ providerId: insuranceEnrollments.providerId }).from(insuranceEnrollments),
  ]);
  const tally = (list: { providerId: string }[]) => {
    const m = new Map<string, number>();
    for (const r of list) m.set(r.providerId, (m.get(r.providerId) ?? 0) + 1);
    return m;
  };
  const planCounts = tally(plans);
  const enrollmentCounts = tally(enrollments);
  const providers = rows.map((r) => ({
    ...r,
    planCount: planCounts.get(r.id) ?? 0,
    enrollmentCount: enrollmentCounts.get(r.id) ?? 0,
  }));
  return c.json({ providers, total: providers.length });
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
  // Drizzle's .set() matches on schema property names (camelCase); snake_case
  // keys are silently dropped, which left an empty SET clause.
  const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) patch[k] = v;
  }
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
  const providerId =
    c.req.query("provider_id") ?? c.req.query("providerId");
  const where = providerId
    ? eq(insurancePlans.providerId, providerId)
    : undefined;
  const rows = await db
    .select()
    .from(insurancePlans)
    .where(where as any)
    .orderBy(desc(insurancePlans.createdAt));
  const [providers, enrollments] = await Promise.all([
    db.select({ id: insuranceProviders.id, name: insuranceProviders.name }).from(insuranceProviders),
    db.select({ planId: insuranceEnrollments.planId }).from(insuranceEnrollments),
  ]);
  const providerNames = new Map(providers.map((p) => [p.id, p.name]));
  const enrollmentCounts = new Map<string, number>();
  for (const e of enrollments) enrollmentCounts.set(e.planId, (enrollmentCounts.get(e.planId) ?? 0) + 1);
  const plans = rows.map((r) => ({
    ...r,
    providerName: providerNames.get(r.providerId) ?? "Unknown",
    enrollmentCount: enrollmentCounts.get(r.id) ?? 0,
  }));
  return c.json({ plans, total: plans.length });
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
  // See provider PUT: keys must be schema property names, not column names.
  const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) patch[k] = v;
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
  const status = c.req.query("status");
  const rows = await db
    .select({
      enrollment: insuranceEnrollments,
      userName: users.name,
      planName: insurancePlans.name,
      providerName: insuranceProviders.name,
    })
    .from(insuranceEnrollments)
    .leftJoin(users, eq(users.id, insuranceEnrollments.userId))
    .leftJoin(insurancePlans, eq(insurancePlans.id, insuranceEnrollments.planId))
    .leftJoin(insuranceProviders, eq(insuranceProviders.id, insuranceEnrollments.providerId))
    .where(status ? eq(insuranceEnrollments.status, status as any) : undefined)
    .orderBy(desc(insuranceEnrollments.createdAt));
  const enrollments = rows.map((r) => ({
    ...r.enrollment,
    userName: r.userName ?? "Unknown",
    planName: r.planName ?? "Unknown plan",
    providerName: r.providerName ?? "Unknown",
  }));
  return c.json({ enrollments, total: enrollments.length });
});

adminRouter.get("/insurance-mkt-claims", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const rows = await db
    .select({
      id: insuranceMarketplaceClaims.id,
      enrollmentId: insuranceMarketplaceClaims.enrollmentId,
      userId: insuranceMarketplaceClaims.userId,
      providerId: insuranceMarketplaceClaims.providerId,
      treatmentType: insuranceMarketplaceClaims.treatmentType,
      amountRequestedLkr: insuranceMarketplaceClaims.amountRequestedLkr,
      amountApprovedLkr: insuranceMarketplaceClaims.amountApprovedLkr,
      status: insuranceMarketplaceClaims.status,
      createdAt: insuranceMarketplaceClaims.createdAt,
      patientName: users.name,
      providerName: insuranceProviders.name,
      policyNumber: insuranceEnrollments.policyNumber,
    })
    .from(insuranceMarketplaceClaims)
    .leftJoin(users, eq(users.id, insuranceMarketplaceClaims.userId))
    .leftJoin(
      insuranceProviders,
      eq(insuranceProviders.id, insuranceMarketplaceClaims.providerId),
    )
    .leftJoin(
      insuranceEnrollments,
      eq(insuranceEnrollments.id, insuranceMarketplaceClaims.enrollmentId),
    )
    .where(
      status
        ? eq(insuranceMarketplaceClaims.status, status as any)
        : undefined,
    )
    .orderBy(desc(insuranceMarketplaceClaims.createdAt));
  const claims = rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    userId: r.userId,
    providerId: r.providerId,
    patientName: r.patientName ?? "Unknown",
    providerName: r.providerName ?? "Unknown",
    policyNumber: r.policyNumber ?? "",
    treatmentType: r.treatmentType,
    amountRequestedLkr: r.amountRequestedLkr,
    amountApprovedLkr: r.amountApprovedLkr,
    status: r.status,
    submittedAt: r.createdAt,
    createdAt: r.createdAt,
  }));
  return c.json({ claims, total: claims.length });
});

export default adminRouter;