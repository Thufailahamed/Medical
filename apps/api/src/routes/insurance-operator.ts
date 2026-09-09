// @ts-nocheck
// Phase INS-MKT: Insurance operator back-office.
//
// role='insurance' users (insurer-side staff) see only the enrollments
// + claims for the operator_org they belong to. Mounted at
// /insurance-operator/*.

import { Hono } from "hono";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  insuranceEnrollments,
  insuranceProviders,
  insurancePlans,
  insuranceMarketplaceClaims,
  insuranceMarketplaceClaimDocs,
  insuranceMarketplaceClaimMessages,
  insuranceDependentMembers,
  operatorOrgs,
  users,
} from "@healthcare/db";
import {
  insuranceClaimDecisionSchema,
  insuranceProviderCreateSchema,
  insuranceProviderUpdateSchema,
  insurancePlanCreateSchema,
  insurancePlanUpdateSchema,
} from "@healthcare/shared/validators";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const operatorRouter = new Hono<AppEnvironment>();

const insuranceOperatorRegisterSchema = z.object({
  orgName: z.string().min(1).max(160),
  license: z.string().min(1).max(80),
  contactEmail: z.string().email().max(160).optional(),
  contactPhone: z.string().max(40).optional(),
  licenseDocKey: z.string().max(500).optional(),
});

// Public registration — must be defined before auth middleware so new
// providers without accounts can apply. The global auth guard below skips
// POST /register (see bypass); defining here first also keeps Hono order safe.
operatorRouter.post("/register", async (c) => {
  const db = c.get("db");
  const body = insuranceOperatorRegisterSchema.parse(await c.req.json());
  const orgId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(operatorOrgs)
    .values({
      id: orgId,
      name: body.orgName,
      kind: "insurance",
      status: "pending",
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
      licenseDocKey: body.licenseDocKey || null,
      createdAt: now,
    } as any);
  // Pending user linkage note: no user row yet — super_admin approves via
  // existing account_pending_review flow, then links role=insurance user to orgId.
  await audit(db, {
    userId: null,
    action: "insurance.operator.registered",
    resource: "operator_org",
    resourceId: orgId,
    details: {
      orgName: body.orgName,
      license: body.license,
      contactEmail: body.contactEmail || null,
      contactPhone: body.contactPhone || null,
    },
  });
  return c.json({ orgId, status: "pending" }, 201);
});

operatorRouter.use("*", async (c, next) => {
  if (c.req.method === "POST" && c.req.path.endsWith("/register")) {
    return next();
  }
  return authMiddleware(c, next);
});
operatorRouter.use("*", async (c, next) => {
  if (c.req.method === "POST" && c.req.path.endsWith("/register")) {
    return next();
  }
  return requireRole("insurance")(c, next);
});

// Resolve the operator org for the calling user (single-org binding).
async function resolveOperatorOrg(db: any, userId: string) {
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u || u.role !== "insurance" || !u.operatorOrgId) {
    return null;
  }
  const [org] = await db
    .select()
    .from(operatorOrgs)
    .where(eq(operatorOrgs.id, u.operatorOrgId))
    .limit(1);
  return org;
}

async function resolveProviderIds(db: any, orgId: string) {
  const rows = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.operatorOrgId, orgId));
  return rows.map((r) => r.id);
}

// ─── Dashboard counts ──────────────────────────────────
operatorRouter.get("/dashboard", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "No operator org" }, 403);

  const providerIds = await resolveProviderIds(db, org.id);
  if (providerIds.length === 0) {
    return c.json({
      org,
      activePolicies: 0,
      pendingClaims: 0,
      approvedThisMonth: 0,
      totalProviders: 0,
      providers: [],
    });
  }

  const allEnrollments = await db
    .select()
    .from(insuranceEnrollments)
    .where(inArray(insuranceEnrollments.providerId, providerIds));
  const allClaims = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .where(inArray(insuranceMarketplaceClaims.providerId, providerIds));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const approvedThisMonth = allClaims.filter(
    (cl) =>
      cl.status === "paid" &&
      cl.paidAt &&
      new Date(cl.paidAt) >= monthStart,
  );

  return c.json({
    org,
    activePolicies: allEnrollments.filter((e) => e.status === "active").length,
    pendingClaims: allClaims.filter((cl) =>
      ["submitted", "under_review", "more_info_needed"].includes(cl.status),
    ).length,
    approvedThisMonth: approvedThisMonth.length,
    totalProviders: providerIds.length,
    providers: providerIds,
  });
});

// ─── Enrollments list ──────────────────────────────────
operatorRouter.get("/enrollments", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ enrollments: [] });
  const providerIds = await resolveProviderIds(db, org.id);
  if (!providerIds.length) return c.json({ enrollments: [] });

  const rows = await db
    .select({
      enrollment: insuranceEnrollments,
      userName: users.name,
      planName: insurancePlans.name,
    })
    .from(insuranceEnrollments)
    .leftJoin(users, eq(users.id, insuranceEnrollments.userId))
    .leftJoin(insurancePlans, eq(insurancePlans.id, insuranceEnrollments.planId))
    .where(inArray(insuranceEnrollments.providerId, providerIds))
    .orderBy(desc(insuranceEnrollments.createdAt));

  const enrIds = rows.map((r) => r.enrollment.id);
  const deps = enrIds.length
    ? await db
        .select()
        .from(insuranceDependentMembers)
        .where(inArray(insuranceDependentMembers.enrollmentId, enrIds))
    : [];
  const depByEnr = new Map<string, any[]>();
  for (const d of deps) {
    const arr = depByEnr.get(d.enrollmentId) ?? [];
    arr.push(d);
    depByEnr.set(d.enrollmentId, arr);
  }

  return c.json({
    enrollments: rows.map((r) => ({
      id: r.enrollment.id,
      userId: r.enrollment.userId,
      userName: r.userName ?? "Unknown",
      planId: r.enrollment.planId,
      planName: r.planName ?? "Unknown plan",
      providerId: r.enrollment.providerId,
      policyNumber: r.enrollment.policyNumber,
      status: r.enrollment.status,
      billingCycle: r.enrollment.billingCycle,
      premiumAmountLkr: r.enrollment.premiumAmountLkr,
      coverageAmountLkr: r.enrollment.coverageAmountLkr,
      startDate: r.enrollment.startDate,
      endDate: r.enrollment.endDate,
      nextPremiumDueAt: r.enrollment.nextPremiumDueAt,
      nomineeName: r.enrollment.nomineeName,
      dependents: (depByEnr.get(r.enrollment.id) ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        relation: d.relation,
        dob: d.dob,
      })),
      createdAt: r.enrollment.createdAt,
    })),
  });
});

// ─── Claims queue ──────────────────────────────────────
operatorRouter.get("/claims", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ claims: [] });
  const providerIds = await resolveProviderIds(db, org.id);
  if (!providerIds.length) return c.json({ claims: [] });
  const status = c.req.query("status");
  let rows = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .where(inArray(insuranceMarketplaceClaims.providerId, providerIds))
    .orderBy(desc(insuranceMarketplaceClaims.createdAt));
  if (status) rows = rows.filter((r) => r.status === status);
  return c.json({ claims: rows });
});

// ─── Claim detail ──────────────────────────────────────
operatorRouter.get("/claims/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const providerIds = await resolveProviderIds(db, org.id);
  const claimId = c.req.param("id");
  const [row] = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .where(eq(insuranceMarketplaceClaims.id, claimId))
    .limit(1);
  if (!row || !providerIds.includes(row.providerId)) {
    return c.json({ error: "Not found" }, 404);
  }
  const docs = await db
    .select()
    .from(insuranceMarketplaceClaimDocs)
    .where(eq(insuranceMarketplaceClaimDocs.claimId, claimId));
  const msgs = await db
    .select()
    .from(insuranceMarketplaceClaimMessages)
    .where(eq(insuranceMarketplaceClaimMessages.claimId, claimId))
    .orderBy(insuranceMarketplaceClaimMessages.createdAt);
  return c.json({
    claim: {
      ...row,
      documents: docs,
      messages: msgs,
    },
  });
});

// ─── Decision ──────────────────────────────────────────
operatorRouter.post("/claims/:id/decision", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const providerIds = await resolveProviderIds(db, org.id);

  const claimId = c.req.param("id");
  const body = insuranceClaimDecisionSchema.parse(await c.req.json());

  const [claim] = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .where(eq(insuranceMarketplaceClaims.id, claimId))
    .limit(1);
  if (!claim || !providerIds.includes(claim.providerId)) {
    return c.json({ error: "Not found" }, 404);
  }
  if (!["submitted", "under_review", "more_info_needed"].includes(claim.status)) {
    return c.json(
      { error: `Cannot decide on ${claim.status} claim` },
      400,
    );
  }

  let nextStatus = "under_review";
  let amount: number | null = null;
  if (body.decision === "approve") {
    nextStatus = "approved";
    amount =
      body.amountApprovedLkr != null
        ? body.amountApprovedLkr
        : claim.amountRequestedLkr;
  } else if (body.decision === "reject") {
    nextStatus = "rejected";
  } else if (body.decision === "more_info") {
    nextStatus = "more_info_needed";
  }

  const now = new Date().toISOString();
  await db
    .update(insuranceMarketplaceClaims)
    .set({
      status: nextStatus,
      amountApprovedLkr: amount,
      insurerRemarks: body.insurerRemarks || null,
      reviewedByUserId: userId,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(insuranceMarketplaceClaims.id, claimId));

  // Notify the patient.
  const titles: Record<string, string> = {
    approved: "Claim approved",
    rejected: "Claim rejected",
    more_info_needed: "More information needed",
  };
  const bodies: Record<string, string> = {
    approved: `Your claim for LKR ${claim.amountRequestedLkr.toFixed(2)} was approved${
      amount != null ? ` (approved amount LKR ${amount.toFixed(2)})` : ""
    }.`,
    rejected: "Your claim was rejected. Tap to see the insurer remarks.",
    more_info_needed:
      "The reviewer requested additional information. Please respond with documents.",
  };
  await notify({
    db,
    env: c.env,
    userId: claim.userId,
    type: "insurance",
    title: titles[nextStatus] ?? "Claim updated",
    body: bodies[nextStatus] ?? `Your claim status is now ${nextStatus}.`,
    data: { claimId, status: nextStatus },
  });

  await audit(db, {
    userId,
    action: `insurance.claim.${body.decision}`,
    resource: "insurance_claim",
    resourceId: claimId,
    details: { amount, remarks: body.insurerRemarks },
  });

  return c.json({
    claim: {
      ...claim,
      status: nextStatus,
      amountApprovedLkr: amount,
      insurerRemarks: body.insurerRemarks || null,
      reviewedByUserId: userId,
      reviewedAt: now,
    },
  });
});

// ─── Payout ────────────────────────────────────────────
operatorRouter.post("/claims/:id/pay", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const providerIds = await resolveProviderIds(db, org.id);

  const claimId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { amountApprovedLkr, transactionRef } = body as {
    amountApprovedLkr?: number;
    transactionRef?: string;
  };
  if (!transactionRef || typeof transactionRef !== "string" || !transactionRef.trim()) {
    return c.json({ error: "transactionRef required" }, 400);
  }
  if (amountApprovedLkr != null && (typeof amountApprovedLkr !== "number" || amountApprovedLkr < 0)) {
    return c.json({ error: "amountApprovedLkr must be a non-negative number" }, 400);
  }

  const [claim] = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .where(eq(insuranceMarketplaceClaims.id, claimId))
    .limit(1);
  if (!claim || !providerIds.includes(claim.providerId)) {
    return c.json({ error: "Not found" }, 404);
  }
  if (claim.status !== "approved") {
    return c.json(
      { error: `Cannot pay ${claim.status} claim (must be approved)` },
      400,
    );
  }

  const now = new Date().toISOString();
  const amount = amountApprovedLkr ?? claim.amountApprovedLkr ?? claim.amountRequestedLkr;
  await db
    .update(insuranceMarketplaceClaims)
    .set({
      status: "paid",
      amountApprovedLkr: amount,
      paidAt: now,
      transactionRef: transactionRef.trim(),
      updatedAt: now,
    })
    .where(eq(insuranceMarketplaceClaims.id, claimId));

  await notify({
    db,
    env: c.env,
    userId: claim.userId,
    type: "insurance",
    title: "Claim paid",
    body: `Your claim payout of LKR ${Number(amount).toFixed(2)} was sent (ref ${transactionRef.trim()}).`,
    data: { claimId, status: "paid", transactionRef: transactionRef.trim() },
  });

  await audit(db, {
    userId,
    action: "insurance.claim.paid",
    resource: "insurance_claim",
    resourceId: claimId,
    details: { amount, transactionRef: transactionRef.trim() },
  });

  return c.json({
    claim: {
      ...claim,
      status: "paid",
      amountApprovedLkr: amount,
      paidAt: now,
      transactionRef: transactionRef.trim(),
      updatedAt: now,
    },
  });
});

// ─── Provider drafts (operator creates, super_admin publishes) ───
// Mirrors admin-insurance.ts validation via same Zod schemas, but forces
// isPublished=false and scopes operatorOrgId to caller's org.
operatorRouter.post("/providers", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const raw = await c.req.json();
  const body = insuranceProviderCreateSchema.parse({
    ...raw,
    operatorOrgId: org.id,
    isPublished: false,
  });
  const id = crypto.randomUUID();
  await db.insert(insuranceProviders).values({
    id,
    operatorOrgId: org.id,
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
    isPublished: false,
  } as any);
  await audit(db, {
    userId,
    action: "insurance.operator_provider.drafted",
    resource: "insurance_provider",
    resourceId: id,
    details: { operatorOrgId: org.id, slug: body.slug },
  });
  const [row] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.id, id))
    .limit(1);
  return c.json({ provider: row }, 201);
});

operatorRouter.put("/providers/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.id, id))
    .limit(1);
  if (!existing || existing.operatorOrgId !== org.id) {
    return c.json({ error: "Not found" }, 404);
  }
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
    if (v !== undefined && k !== "operatorOrgId" && k !== "isPublished") {
      patch[map[k] ?? k] = v;
    }
  }
  // Force draft: operator cannot publish.
  patch.is_published = 0;
  patch.updated_at = new Date().toISOString();
  await db
    .update(insuranceProviders)
    .set(patch)
    .where(eq(insuranceProviders.id, id));
  await audit(db, {
    userId,
    action: "insurance.operator_provider.updated",
    resource: "insurance_provider",
    resourceId: id,
    details: { operatorOrgId: org.id },
  });
  const [row] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.id, id))
    .limit(1);
  return c.json({ provider: row });
});

// ─── Plan drafts ───
operatorRouter.post("/plans", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const raw = await c.req.json();
  const body = insurancePlanCreateSchema.parse({
    ...raw,
    isPublished: false,
  });
  const [provider] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.id, body.providerId))
    .limit(1);
  if (!provider || provider.operatorOrgId !== org.id) {
    return c.json({ error: "Provider not found in your org" }, 404);
  }
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
    isPublished: false,
    isFeatured: body.isFeatured ?? false,
  } as any);
  await audit(db, {
    userId,
    action: "insurance.operator_plan.drafted",
    resource: "insurance_plan",
    resourceId: id,
    details: { providerId: body.providerId },
  });
  const [row] = await db
    .select()
    .from(insurancePlans)
    .where(eq(insurancePlans.id, id))
    .limit(1);
  return c.json({ plan: row }, 201);
});

operatorRouter.put("/plans/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(insurancePlans)
    .where(eq(insurancePlans.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const [provider] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.id, existing.providerId))
    .limit(1);
  if (!provider || provider.operatorOrgId !== org.id) {
    return c.json({ error: "Not found" }, 404);
  }
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
    if (v !== undefined && k !== "isPublished" && k !== "providerId") {
      patch[camelToSnake[k] ?? k] = v;
    }
  }
  patch.is_published = 0;
  if (typeof body.isFeatured === "boolean") {
    patch.is_featured = body.isFeatured ? 1 : 0;
  }
  await db.update(insurancePlans).set(patch).where(eq(insurancePlans.id, id));
  await audit(db, {
    userId,
    action: "insurance.operator_plan.updated",
    resource: "insurance_plan",
    resourceId: id,
    details: { operatorOrgId: org.id },
  });
  const [row] = await db
    .select()
    .from(insurancePlans)
    .where(eq(insurancePlans.id, id))
    .limit(1);
  return c.json({ plan: row });
});

// ─── KYC decision (manual verify, scoped to org providers) ───
const insuranceKycDecisionSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
});

operatorRouter.post("/enrollments/:id/kyc", async (c) => {
  const db = c.get("db");
  const env = c.env;
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const providerIds = await resolveProviderIds(db, org.id);
  const enrollmentId = c.req.param("id");
  const body = insuranceKycDecisionSchema.parse(await c.req.json());
  const [enrollment] = await db
    .select()
    .from(insuranceEnrollments)
    .where(eq(insuranceEnrollments.id, enrollmentId))
    .limit(1);
  if (!enrollment || !providerIds.includes(enrollment.providerId)) {
    return c.json({ error: "Not found" }, 404);
  }
  const now = new Date().toISOString();
  await db
    .update(insuranceEnrollments)
    .set({ kycStatus: body.decision, updatedAt: now })
    .where(eq(insuranceEnrollments.id, enrollmentId));
  await notify({
    db,
    env,
    userId: enrollment.userId,
    type: "insurance",
    title:
      body.decision === "verified" ? "KYC verified" : "KYC needs attention",
    body:
      body.decision === "verified"
        ? "Your identity verification was approved. You can proceed to payment."
        : "Your identity verification was rejected. Please re-upload a clear NIC via Files and contact support.",
    data: { enrollmentId, kycStatus: body.decision },
  });
  await audit(db, {
    userId,
    action: `insurance.enrollment.kyc.${body.decision}`,
    resource: "insurance_enrollment",
    resourceId: enrollmentId,
    details: { decision: body.decision, providerId: enrollment.providerId },
  });
  return c.json({
    enrollment: { ...enrollment, kycStatus: body.decision, updatedAt: now },
  });
});

// Operator can reply to patient thread.
operatorRouter.post("/claims/:id/messages", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const org = await resolveOperatorOrg(db, userId);
  if (!org) return c.json({ error: "Forbidden" }, 403);
  const providerIds = await resolveProviderIds(db, org.id);
  const claimId = c.req.param("id");
  const [claim] = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .where(eq(insuranceMarketplaceClaims.id, claimId))
    .limit(1);
  if (!claim || !providerIds.includes(claim.providerId)) {
    return c.json({ error: "Not found" }, 404);
  }
  const body = await c.req.json();
  if (!body.body || typeof body.body !== "string") {
    return c.json({ error: "body required" }, 400);
  }
  const [row] = await db
    .insert(insuranceMarketplaceClaimMessages)
    .values({
      id: crypto.randomUUID(),
      claimId,
      senderUserId: userId,
      senderRole: "operator",
      body: body.body,
      attachmentFileKey: body.attachmentFileKey || null,
    } as any)
    .returning();
  await notify({
    db,
    env: c.env,
    userId: claim.userId,
    type: "insurance",
    title: "Update on your claim",
    body: body.body.slice(0, 140),
    data: { claimId },
  });
  return c.json({ message: row }, 201);
});

export default operatorRouter;