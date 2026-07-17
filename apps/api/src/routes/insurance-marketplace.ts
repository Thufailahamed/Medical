// @ts-nocheck
// Phase INS-MKT: Health Insurance Marketplace — patient + public APIs.
//
// Catalog browsing, personalized quotes, enrollment, premium payments
// (PayHere), policy + E-card, reimbursement claims. Reuses `users`,
// `operator_orgs`, files route, notifications, audit, push.
//
// Companion files:
//   - admin-insurance.ts          → super_admin CRUD on providers/plans
//   - insurance-operator.ts       → role='insurance' back-office queues
//   - payments.ts (extended)      → notify dispatch on INS-* order_ids
//
// Amounts in LKR. Premium invoices use a `INS` PayHere order prefix so
// the global /payments/notify can dispatch back here.

import { Hono } from "hono";
import { eq, and, desc, like, or, sql, inArray } from "drizzle-orm";
import {
  insuranceProviders,
  insurancePlans,
  insuranceEnrollments,
  insuranceDependentMembers,
  insurancePremiumInvoices,
  insuranceEcards,
  insuranceMarketplaceClaims,
  insuranceMarketplaceClaimDocs,
  insuranceMarketplaceClaimMessages,
  operatorOrgs,
  users,
  patients,
} from "@healthcare/db";
import {
  insuranceEnrollRequestSchema,
  insuranceQuoteRequestSchema,
  insuranceClaimCreateSchema,
  insuranceClaimDecisionSchema,
  insuranceClaimMessageSchema,
  insuranceCoverageCheckSchema,
} from "@healthcare/shared/validators";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { logger } from "../lib/logger";
import { createDb } from "../lib/db";
import {
  mintOrderId,
  computeHash,
  checkoutUrl,
  isSandbox,
} from "../lib/payhere";
import type { AppEnvironment } from "../types";

const marketplaceRouter = new Hono<AppEnvironment>();

// ─── helpers ─────────────────────────────────────────────

function parseJson<T = any>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function shapeProvider(row: any, planCount?: number) {
  if (!row) return null;
  return {
    id: row.id,
    operatorOrgId: row.operatorOrgId,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logoUrl,
    tagline: row.tagline,
    description: row.description,
    regulatorLicense: row.regulatorLicense,
    claimSettlementRatioPct: row.claimSettlementRatioPct,
    cashlessHospitalCount: row.cashlessHospitalCount,
    websiteUrl: row.websiteUrl,
    supportPhone: row.supportPhone,
    ratingAvg: row.ratingAvg ?? 0,
    ratingCount: row.ratingCount ?? 0,
    isPublished: !!row.isPublished,
    planCount,
  };
}

function shapePlan(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    providerId: row.providerId,
    slug: row.slug,
    name: row.name,
    planType: row.planType,
    coverageSummaryLkr: row.coverageSummaryLkr,
    coverageDetails: parseJson(row.coverageDetailsJson),
    monthlyPremiumLkr: row.monthlyPremiumLkr,
    annualPremiumLkr: row.annualPremiumLkr,
    annualDiscountPct: row.annualDiscountPct ?? 0,
    deductibleLkr: row.deductibleLkr ?? 0,
    copayPct: row.copayPct ?? 0,
    coPaymentCapLkr: row.coPaymentCapLkr ?? 0,
    waitingPeriodDays: row.waitingPeriodDays ?? 30,
    preExistingWaitingDays: row.preExistingWaitingDays ?? 365,
    networkHospitalCount: row.networkHospitalCount ?? 0,
    keyFeatures: parseJson<string[]>(row.keyFeaturesJson),
    exclusions: parseJson<string[]>(row.exclusionsJson),
    termMonths: row.termMonths ?? 12,
    isPublished: !!row.isPublished,
    isFeatured: !!row.isFeatured,
  };
}

function shapeEnrollment(row: any, deps: any[] = []) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    providerId: row.providerId,
    policyNumber: row.policyNumber,
    status: row.status,
    billingCycle: row.billingCycle,
    premiumAmountLkr: row.premiumAmountLkr,
    coverageAmountLkr: row.coverageAmountLkr,
    startDate: row.startDate,
    endDate: row.endDate,
    nextPremiumDueAt: row.nextPremiumDueAt,
    lastPremiumPaidAt: row.lastPremiumPaidAt,
    kycStatus: row.kycStatus,
    nomineeName: row.nomineeName,
    nomineeRelation: row.nomineeRelation,
    nomineeDob: row.nomineeDob,
    dependents: deps.map((d) => ({
      id: d.id,
      enrollmentId: d.enrollmentId,
      name: d.name,
      relation: d.relation,
      dob: d.dob,
      gender: d.gender,
    })),
    paymentId: row.paymentId,
    cancelledAt: row.cancelledAt,
    cancelledReason: row.cancelledReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function shapeClaim(row: any, docs: any[] = [], msgs: any[] = []) {
  if (!row) return null;
  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    userId: row.userId,
    providerId: row.providerId,
    incurringFacility: row.incurringFacility,
    treatmentType: row.treatmentType,
    admissionDate: row.admissionDate,
    dischargeDate: row.dischargeDate,
    diagnosis: row.diagnosis,
    amountRequestedLkr: row.amountRequestedLkr,
    amountApprovedLkr: row.amountApprovedLkr,
    status: row.status,
    insurerRemarks: row.insurerRemarks,
    patientRemarks: row.patientRemarks,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    paidAt: row.paidAt,
    transactionRef: row.transactionRef,
    documents: docs.map((d) => ({
      id: d.id,
      claimId: d.claimId,
      kind: d.kind,
      fileKey: d.fileKey,
      fileName: d.fileName,
      contentType: d.contentType,
      uploadedAt: d.uploadedAt,
    })),
    messages: msgs.map((m) => ({
      id: m.id,
      claimId: m.claimId,
      senderUserId: m.senderUserId,
      senderRole: m.senderRole,
      body: m.body,
      attachmentFileKey: m.attachmentFileKey,
      createdAt: m.createdAt,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mintPolicyNumber(): string {
  // Human-friendly: POL-<year>-<8char base32>. Avoids ambiguous chars.
  const ts = new Date().getFullYear();
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 8; i++) {
    rand += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `POL-${ts}-${rand}`;
}

function mintCardNumber(): string {
  // 16-digit zero-padded, prefixed with insurer token. Plain number for
  // display; the QR token is the secure identity (random uuid).
  const block = () =>
    Math.floor(1000 + Math.random() * 9000)
      .toString()
      .padStart(4, "0");
  return `5551${block()}${block()}${block()}`;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── PUBLIC CATALOG ─────────────────────────────────────

/**
 * GET /insurance-marketplace/catalog
 * Public. Lists published providers + their published plans.
 * Query: ?plan_type=individual&q=cashless&sort=premium|rating
 */
marketplaceRouter.get("/catalog", async (c) => {
  const db = c.get("db");
  const planType = c.req.query("plan_type");
  const q = c.req.query("q")?.toLowerCase();
  const sort = c.req.query("sort") || "rating";

  const providerRows = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.isPublished, true))
    .orderBy(desc(insuranceProviders.ratingAvg));

  const providerIds = providerRows.map((p) => p.id);
  const planRows = providerIds.length
    ? await db
        .select()
        .from(insurancePlans)
        .where(
          and(
            eq(insurancePlans.isPublished, true),
            inArray(insurancePlans.providerId, providerIds),
          ),
        )
    : [];

  // Filter by plan_type + free-text search on plan name or provider name.
  let filteredPlans = planRows;
  if (planType) {
    filteredPlans = filteredPlans.filter((p) => p.planType === planType);
  }
  if (q) {
    filteredPlans = filteredPlans.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (providerRows
          .find((pr) => pr.id === p.providerId)
          ?.name.toLowerCase()
          .includes(q) ??
          false),
    );
  }

  // Sort plans.
  if (sort === "premium") {
    filteredPlans.sort((a, b) => a.annualPremiumLkr - b.annualPremiumLkr);
  } else if (sort === "premium-desc") {
    filteredPlans.sort((a, b) => b.annualPremiumLkr - a.annualPremiumLkr);
  } else {
    filteredPlans.sort(
      (a, b) =>
        (providerRows.find((p) => p.id === a.providerId)?.ratingAvg ?? 0) <
        (providerRows.find((p) => p.id === b.providerId)?.ratingAvg ?? 0)
          ? 1
          : -1,
    );
  }

  // Plan counts per provider for the cards.
  const planCountByProvider = new Map<string, number>();
  for (const p of filteredPlans) {
    planCountByProvider.set(
      p.providerId,
      (planCountByProvider.get(p.providerId) ?? 0) + 1,
    );
  }

  const providers = providerRows
    .filter((p) => planCountByProvider.has(p.id))
    .map((p) => shapeProvider(p, planCountByProvider.get(p.id) ?? 0));

  return c.json({
    providers,
    plans: filteredPlans.map(shapePlan),
    totalPlans: filteredPlans.length,
  });
});

/**
 * GET /insurance-marketplace/providers/:slug
 * Public. Provider detail + its plans + a couple of network stats.
 */
marketplaceRouter.get("/providers/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");
  const [row] = await db
    .select()
    .from(insuranceProviders)
    .where(eq(insuranceProviders.slug, slug))
    .limit(1);
  if (!row || !row.isPublished) return c.json({ error: "Not found" }, 404);

  const planRows = await db
    .select()
    .from(insurancePlans)
    .where(
      and(
        eq(insurancePlans.providerId, row.id),
        eq(insurancePlans.isPublished, true),
      ),
    );

  return c.json({
    provider: shapeProvider(row, planRows.length),
    plans: planRows.map(shapePlan),
  });
});

/**
 * GET /insurance-marketplace/plans/:id
 * Public. Plan detail (no provider duplication needed).
 */
marketplaceRouter.get("/plans/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db
    .select({
      plan: insurancePlans,
      providerName: insuranceProviders.name,
    })
    .from(insurancePlans)
    .innerJoin(
      insuranceProviders,
      eq(insurancePlans.providerId, insuranceProviders.id),
    )
    .where(
      and(eq(insurancePlans.id, id), eq(insurancePlans.isPublished, true)),
    )
    .limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({
    plan: {
      ...shapePlan(row.plan),
      providerName: row.providerName,
    },
  });
});

// ─── QUOTE ──────────────────────────────────────────────

/**
 * POST /insurance-marketplace/quote
 * Patient-only. Personalized premium preview for a plan.
 * Rule of thumb: monthly × 11.85 ≈ annual + 5% per pre-existing condition.
 */
marketplaceRouter.post(
  "/quote",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const body = insuranceQuoteRequestSchema.parse(await c.req.json());

    let baseMonthly = 0;
    let baseAnnual = 0;
    let planName: string | null = null;
    if (body.planId) {
      const [plan] = await db
        .select()
        .from(insurancePlans)
        .where(eq(insurancePlans.id, body.planId))
        .limit(1);
      if (!plan || !plan.isPublished) {
        return c.json({ error: "Plan not found" }, 404);
      }
      baseMonthly = plan.monthlyPremiumLkr;
      baseAnnual = plan.annualPremiumLkr;
      planName = plan.name;
    }

    const cycle = body.billingCycle;
    let base = cycle === "monthly" ? baseMonthly : baseAnnual;

    const notes: string[] = [];
    const riders: { id: string; name: string; priceLkr: number }[] = [];

    // Age uplift: +5% per decade above 40, -3% per decade below 30.
    if (typeof body.memberAge === "number") {
      const age = body.memberAge;
      if (age >= 60) {
        base *= 1.25;
        notes.push(`Age ${age}: senior loading 25% applied.`);
      } else if (age >= 40) {
        base *= 1.1;
        notes.push(`Age ${age}: mid-age loading 10% applied.`);
      } else if (age < 25) {
        base *= 0.95;
        notes.push(`Age ${age}: young-adult discount 5% applied.`);
      }
    }

    // Pre-existing uplift.
    const preCount = body.preExisting?.length ?? 0;
    if (preCount > 0) {
      const uplift = 1 + Math.min(preCount, 5) * 0.05;
      base *= uplift;
      notes.push(
        `${preCount} declared pre-existing condition${preCount > 1 ? "s" : ""}: ${Math.round((uplift - 1) * 100)}% loading.`,
      );
    }

    // Family members uplift: +30% per extra member (family_floater only).
    const extraMembers = Math.max(0, (body.members?.length ?? 1) - 1);
    if (extraMembers > 0 && body.planId) {
      const [plan] = await db
        .select()
        .from(insurancePlans)
        .where(eq(insurancePlans.id, body.planId))
        .limit(1);
      if (plan?.planType === "family_floater") {
        const uplift = 1 + extraMembers * 0.3;
        base *= uplift;
        notes.push(
          `Family floater: ${extraMembers} extra member${extraMembers > 1 ? "s" : ""}, ${Math.round((uplift - 1) * 100)}% uplift.`,
        );
      } else if (plan?.planType === "individual") {
        notes.push(
          "Note: this is an individual plan — extra members would need separate policies.",
        );
      }
    }

    // Optional riders based on declared conditions.
    if (body.preExisting?.some((c) => /diabet/i.test(c))) {
      riders.push({
        id: "diabetes_care",
        name: "Diabetes Care Rider",
        priceLkr: cycle === "monthly" ? 600 : 6500,
      });
    }
    if (body.preExisting?.some((c) => /hypertens|bp/i.test(c))) {
      riders.push({
        id: "cardiac_screening",
        name: "Annual Cardiac Screening",
        priceLkr: cycle === "monthly" ? 450 : 5000,
      });
    }

    const adjusted = Math.round(base * 100) / 100;

    return c.json({
      planId: body.planId ?? null,
      planName,
      billingCycle: cycle,
      basePremiumLkr: Math.round((cycle === "monthly" ? baseMonthly : baseAnnual) * 100) / 100,
      adjustedPremiumLkr: adjusted,
      notes,
      riders,
    });
  },
);

// ─── ENROLLMENT ─────────────────────────────────────────

/**
 * POST /insurance-marketplace/enrollments
 * Patient-only. Creates a draft enrollment + open premium invoice.
 * Returns the enrollment id; payment is initiated in the next call.
 */
marketplaceRouter.post(
  "/enrollments",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = insuranceEnrollRequestSchema.parse(await c.req.json());

    const [plan] = await db
      .select()
      .from(insurancePlans)
      .where(eq(insurancePlans.id, body.planId))
      .limit(1);
    if (!plan || !plan.isPublished) {
      return c.json({ error: "Plan not available" }, 404);
    }
    const [provider] = await db
      .select()
      .from(insuranceProviders)
      .where(eq(insuranceProviders.id, plan.providerId))
      .limit(1);
    if (!provider || !provider.isPublished) {
      return c.json({ error: "Provider not available" }, 404);
    }

    const premium =
      body.billingCycle === "monthly"
        ? plan.monthlyPremiumLkr
        : plan.annualPremiumLkr;

    const enrollmentId = crypto.randomUUID();
    const now = new Date().toISOString();
    const due = addDays(now, 3); // 3-day payment window
    const nextDue =
      body.billingCycle === "monthly"
        ? addDays(now, 30)
        : addDays(now, 365);

    await db.insert(insuranceEnrollments).values({
      id: enrollmentId,
      userId,
      planId: plan.id,
      providerId: provider.id,
      status: "payment_pending",
      billingCycle: body.billingCycle,
      premiumAmountLkr: premium,
      coverageAmountLkr: plan.coverageSummaryLkr,
      nextPremiumDueAt: nextDue,
      kycStatus: "pending",
      nomineeName: body.nomineeName,
      nomineeRelation: body.nomineeRelation,
      nomineeDob: body.nomineeDob || null,
      dependentsJson: body.dependents
        ? JSON.stringify(body.dependents)
        : null,
    } as any);

    if (body.dependents?.length) {
      await db.insert(insuranceDependentMembers).values(
        body.dependents.map((d) => ({
          id: crypto.randomUUID(),
          enrollmentId,
          name: d.name,
          relation: d.relation,
          dob: d.dob || null,
          gender: d.gender || null,
        })) as any,
      );
    }

    // First premium invoice.
    const invoiceId = crypto.randomUUID();
    await db.insert(insurancePremiumInvoices).values({
      id: invoiceId,
      enrollmentId,
      cycle: body.billingCycle,
      amountLkr: premium,
      dueAt: due,
      status: "open",
    } as any);

    await audit(db, {
      userId,
      action: "insurance.enrollment.created",
      resource: "insurance_enrollment",
      resourceId: enrollmentId,
      details: { planId: plan.id, billingCycle: body.billingCycle, premium },
    });

    const enrollment = await loadEnrollment(db, enrollmentId);
    try {
      return c.json({ enrollment, invoiceId }, 201);
    } catch (err: any) {
      console.error("[insurance-marketplace] /enrollments serialization failed", err?.message ?? err);
      return c.json({ error: "Serialization error", enrollmentId, invoiceId }, 500);
    }
  },
);

/**
 * POST /insurance-marketplace/enrollments/:id/pay
 * Patient-only. Initiates a PayHere order for the current open invoice.
 */
marketplaceRouter.post(
  "/enrollments/:id/pay",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const enrollmentId = c.req.param("id");
    const env = c.env;
    const merchantId = env.PAYHERE_MERCHANT_ID;
    const secret = env.PAYHERE_SECRET;
    if (!merchantId || !secret) {
      return c.json(
        { error: "Payments not configured. Set PAYHERE_MERCHANT_ID/SECRET." },
        503,
      );
    }

    const enrollment = await loadEnrollment(db, enrollmentId);
    if (!enrollment || enrollment.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }
    if (enrollment.status !== "payment_pending") {
      return c.json(
        { error: `Cannot pay: enrollment is ${enrollment.status}` },
        400,
      );
    }

    const [invoice] = await db
      .select()
      .from(insurancePremiumInvoices)
      .where(
        and(
          eq(insurancePremiumInvoices.enrollmentId, enrollmentId),
          eq(insurancePremiumInvoices.status, "open"),
        ),
      )
      .limit(1);
    if (!invoice) {
      return c.json({ error: "No open invoice to pay" }, 400);
    }

    // Reuse pending orderId if one already exists for this invoice.
    let orderId = invoice.paymentId ? null : null;
    if (invoice.paymentId) {
      orderId = invoice.paymentId;
    }
    if (!orderId) {
      orderId = `INS-${mintOrderId()}`;
      await db
        .update(insurancePremiumInvoices)
        .set({ paymentId: orderId, updatedAt: new Date().toISOString() })
        .where(eq(insurancePremiumInvoices.id, invoice.id));
    }

    const hash = await computeHash(
      merchantId,
      orderId,
      invoice.amountLkr,
      "LKR",
      secret,
    );

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const fullName =
      user?.name ||
      user?.email?.split("@")[0] ||
      "Patient";
    const [firstName, ...rest] = fullName.split(" ");
    const lastName = rest.join(" ") || "-";

    const publicUrl = env.PUBLIC_URL || "https://app.healthhub.app";
    const fields = {
      merchant_id: merchantId,
      return_url: `${publicUrl}/insurance/payment/return?order=${orderId}`,
      cancel_url: `${publicUrl}/insurance/payment/cancel?order=${orderId}`,
      notify_url: `${publicUrl}/api/payments/notify`,
      order_id: orderId,
      items: `Health insurance premium ${enrollment.billingCycle} (policy ${enrollment.policyNumber ?? "draft"})`,
      currency: "LKR",
      amount: invoice.amountLkr.toFixed(2),
      first_name: firstName,
      last_name: lastName,
      email: user?.email || "noreply@healthhub.app",
      phone: user?.phone || "+94770000000",
      address: "Sri Lanka",
      city: "Colombo",
      country: "Sri Lanka",
      hash,
    };

    return c.json({
      orderId,
      invoiceId: invoice.id,
      amount: invoice.amountLkr,
      currency: "LKR",
      hash,
      checkoutUrl: checkoutUrl(env),
      sandbox: isSandbox(env),
      fields,
    });
  },
);

/**
 * GET /insurance-marketplace/enrollments/me
 */
marketplaceRouter.get(
  "/enrollments/me",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const rows = await db
      .select()
      .from(insuranceEnrollments)
      .where(eq(insuranceEnrollments.userId, userId))
      .orderBy(desc(insuranceEnrollments.createdAt));
    const ids = rows.map((r) => r.id);
    const deps = ids.length
      ? await db
          .select()
          .from(insuranceDependentMembers)
          .where(inArray(insuranceDependentMembers.enrollmentId, ids))
      : [];
    const depByEnr = new Map<string, any[]>();
    for (const d of deps) {
      const arr = depByEnr.get(d.enrollmentId) ?? [];
      arr.push(d);
      depByEnr.set(d.enrollmentId, arr);
    }
    return c.json({
      enrollments: rows.map((r) => shapeEnrollment(r, depByEnr.get(r.id) ?? [])),
    });
  },
);

/**
 * GET /insurance-marketplace/enrollments/:id
 */
marketplaceRouter.get(
  "/enrollments/:id",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const enrollment = await loadEnrollment(db, c.req.param("id"));
    if (!enrollment || enrollment.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ enrollment });
  },
);

/**
 * DELETE /insurance-marketplace/enrollments/:id
 * Free-look cancellation within 14 days of policy start.
 */
marketplaceRouter.delete(
  "/enrollments/:id",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const enrollment = await loadEnrollment(db, c.req.param("id"));
    if (!enrollment || enrollment.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }
    if (enrollment.status !== "active") {
      return c.json(
        { error: "Only active policies can be cancelled" },
        400,
      );
    }
    if (enrollment.startDate) {
      const daysSinceStart =
        (Date.now() - new Date(enrollment.startDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceStart > 14) {
        return c.json(
          { error: "Free-look period expired (14 days)" },
          400,
        );
      }
    }
    const body = await c.req.json().catch(() => ({}));
    await db
      .update(insuranceEnrollments)
      .set({
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledReason: body.reason || "free-look cancellation",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(insuranceEnrollments.id, enrollment.id));
    await audit(db, {
      userId,
      action: "insurance.enrollment.cancelled",
      resource: "insurance_enrollment",
      resourceId: enrollment.id,
      details: { reason: body.reason || "free-look cancellation" },
    });
    return c.json({ message: "cancelled" });
  },
);

/**
 * POST /insurance-marketplace/enrollments/:id/renew
 * Generates the next premium invoice. Idempotent for the current cycle.
 */
marketplaceRouter.post(
  "/enrollments/:id/renew",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const enrollment = await loadEnrollment(db, c.req.param("id"));
    if (!enrollment || enrollment.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!["active", "grace", "expired"].includes(enrollment.status)) {
      return c.json(
        { error: `Cannot renew: status is ${enrollment.status}` },
        400,
      );
    }

    // If an open invoice already exists for the next cycle, return it.
    const [existing] = await db
      .select()
      .from(insurancePremiumInvoices)
      .where(
        and(
          eq(insurancePremiumInvoices.enrollmentId, enrollment.id),
          eq(insurancePremiumInvoices.status, "open"),
        ),
      )
      .limit(1);
    if (existing) return c.json({ invoice: existing });

    const dueAt =
      enrollment.billingCycle === "monthly"
        ? addDays(new Date().toISOString(), 30)
        : addDays(new Date().toISOString(), 365);
    const [invoice] = await db
      .insert(insurancePremiumInvoices)
      .values({
        id: crypto.randomUUID(),
        enrollmentId: enrollment.id,
        cycle: enrollment.billingCycle,
        amountLkr: enrollment.premiumAmountLkr,
        dueAt,
        status: "open",
      } as any)
      .returning();
    await db
      .update(insuranceEnrollments)
      .set({ nextPremiumDueAt: dueAt, updatedAt: new Date().toISOString() })
      .where(eq(insuranceEnrollments.id, enrollment.id));
    return c.json({ invoice }, 201);
  },
);

/**
 * GET /insurance-marketplace/enrollments/:id/ecard
 */
marketplaceRouter.get(
  "/enrollments/:id/ecard",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const enrollment = await loadEnrollment(db, c.req.param("id"));
    if (!enrollment || enrollment.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }
    if (enrollment.status !== "active") {
      return c.json(
        { error: "E-card only available for active policies" },
        400,
      );
    }
    const [card] = await db
      .select()
      .from(insuranceEcards)
      .where(eq(insuranceEcards.enrollmentId, enrollment.id))
      .limit(1);
    if (!card) return c.json({ error: "E-card not issued" }, 404);
    const [provider] = await db
      .select()
      .from(insuranceProviders)
      .where(eq(insuranceProviders.id, enrollment.providerId))
      .limit(1);
    return c.json({
      ecard: {
        id: card.id,
        enrollmentId: card.enrollmentId,
        cardNumber: card.cardNumber,
        qrToken: card.qrToken,
        issuedAt: card.issuedAt,
        validUntil: card.validUntil,
      },
      policyNumber: enrollment.policyNumber,
      providerName: provider?.name,
      holderName: null,
    });
  },
);

// ─── CLAIMS ─────────────────────────────────────────────

/**
 * POST /insurance-marketplace/claims
 * Patient-only. Create draft claim (status=draft).
 * To submit: call POST /claims/:id/submit next.
 */
marketplaceRouter.post(
  "/claims",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = insuranceClaimCreateSchema.parse(await c.req.json());

    const enrollment = await loadEnrollment(db, body.enrollmentId);
    if (!enrollment || enrollment.userId !== userId) {
      return c.json({ error: "Enrollment not found" }, 404);
    }
    if (enrollment.status !== "active") {
      return c.json(
        { error: "Claims allowed only on active policies" },
        400,
      );
    }

    const claimId = crypto.randomUUID();
    await db.insert(insuranceMarketplaceClaims).values({
      id: claimId,
      enrollmentId: enrollment.id,
      userId,
      providerId: enrollment.providerId,
      incurringFacility: body.incurringFacility || null,
      treatmentType: body.treatmentType,
      admissionDate: body.admissionDate || null,
      dischargeDate: body.dischargeDate || null,
      diagnosis: body.diagnosis || null,
      amountRequestedLkr: body.amountRequestedLkr,
      patientRemarks: body.patientRemarks || null,
      status: "draft",
    } as any);

    if (body.documents?.length) {
      await db.insert(insuranceMarketplaceClaimDocs).values(
        body.documents.map((d) => ({
          id: crypto.randomUUID(),
          claimId,
          kind: d.kind,
          fileKey: d.fileKey,
          fileName: d.fileName || null,
          contentType: d.contentType || null,
        })) as any,
      );
    }

    const claim = await loadClaim(db, claimId);
    await audit(db, {
      userId,
      action: "insurance.claim.draft_created",
      resource: "insurance_claim",
      resourceId: claimId,
      details: { amount: body.amountRequestedLkr },
    });
    return c.json({ claim }, 201);
  },
);

/**
 * POST /insurance-marketplace/claims/:id/submit
 * Patient-only. Flips draft → submitted; fires notification to operator org.
 */
marketplaceRouter.post(
  "/claims/:id/submit",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const claimId = c.req.param("id");
    const [claim] = await db
      .select()
      .from(insuranceMarketplaceClaims)
      .where(eq(insuranceMarketplaceClaims.id, claimId))
      .limit(1);
    if (!claim || claim.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }
    if (claim.status !== "draft") {
      return c.json({ error: `Cannot submit: status ${claim.status}` }, 400);
    }

    await db
      .update(insuranceMarketplaceClaims)
      .set({ status: "submitted", updatedAt: new Date().toISOString() })
      .where(eq(insuranceMarketplaceClaims.id, claimId));

    // Notify the operator org users.
    const [provider] = await db
      .select()
      .from(insuranceProviders)
      .where(eq(insuranceProviders.id, claim.providerId))
      .limit(1);
    if (provider?.operatorOrgId) {
      const operatorUsers = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.operatorOrgId, provider.operatorOrgId),
            eq(users.role, "insurance"),
          ),
        );
      for (const op of operatorUsers) {
        await notify({
          db,
          userId: op.id,
          type: "insurance",
          title: "New claim submitted",
          body: `A patient submitted a claim worth LKR ${claim.amountRequestedLkr.toFixed(2)}.`,
          data: { claimId, enrollmentId: claim.enrollmentId },
        });
      }
    }

    await audit(db, {
      userId,
      action: "insurance.claim.submitted",
      resource: "insurance_claim",
      resourceId: claimId,
      details: { providerId: claim.providerId },
    });

    return c.json({ claim: await loadClaim(db, claimId) });
  },
);

/**
 * GET /insurance-marketplace/claims/me
 */
marketplaceRouter.get(
  "/claims/me",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const rows = await db
      .select()
      .from(insuranceMarketplaceClaims)
      .where(eq(insuranceMarketplaceClaims.userId, userId))
      .orderBy(desc(insuranceMarketplaceClaims.createdAt));
    return c.json({ claims: rows.map((r) => shapeClaim(r)) });
  },
);

/**
 * GET /insurance-marketplace/claims/:id
 */
marketplaceRouter.get(
  "/claims/:id",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const claim = await loadClaim(db, c.req.param("id"));
    if (!claim || claim.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ claim });
  },
);

/**
 * POST /insurance-marketplace/claims/:id/messages
 * Patient replies to operator thread.
 */
marketplaceRouter.post(
  "/claims/:id/messages",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const claimId = c.req.param("id");
    const body = insuranceClaimMessageSchema.parse(await c.req.json());

    const [claim] = await db
      .select()
      .from(insuranceMarketplaceClaims)
      .where(eq(insuranceMarketplaceClaims.id, claimId))
      .limit(1);
    if (!claim || claim.userId !== userId) {
      return c.json({ error: "Not found" }, 404);
    }

    const [row] = await db
      .insert(insuranceMarketplaceClaimMessages)
      .values({
        id: crypto.randomUUID(),
        claimId,
        senderUserId: userId,
        senderRole: "patient",
        body: body.body,
        attachmentFileKey: body.attachmentFileKey || null,
      } as any)
      .returning();

    // If claim was in `more_info_needed`, flip back to `under_review` since
    // patient responded.
    if (claim.status === "more_info_needed") {
      await db
        .update(insuranceMarketplaceClaims)
        .set({
          status: "under_review",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(insuranceMarketplaceClaims.id, claimId));
    }

    return c.json({ message: row }, 201);
  },
);

// ─── COVERAGE CHECK ─────────────────────────────────────

/**
 * POST /insurance-marketplace/coverage-check
 * Patient asks: "Will my policy cover this treatment? How much out-of-pocket?"
 * No PII is mutated; pure estimate.
 */
marketplaceRouter.post(
  "/coverage-check",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = insuranceCoverageCheckSchema.parse(await c.req.json());

    const [enrollment] = await db
      .select()
      .from(insuranceEnrollments)
      .where(eq(insuranceEnrollments.id, body.enrollmentId))
      .limit(1);
    if (!enrollment || enrollment.userId !== userId) {
      return c.json({ enrolled: false, covered: false, notes: [] });
    }
    if (enrollment.status !== "active") {
      return c.json({
        enrolled: false,
        covered: false,
        planName: null,
        coverageType: null,
        copayPct: 0,
        estimatedOutOfPocketLkr: body.estimatedAmountLkr,
        deductibleLkr: 0,
        notes: [`Policy is ${enrollment.status}, not active.`],
      });
    }
    const [plan] = await db
      .select()
      .from(insurancePlans)
      .where(eq(insurancePlans.id, enrollment.planId))
      .limit(1);

    const notes: string[] = [];
    let deductible = plan?.deductibleLkr ?? 0;
    const copay = plan?.copayPct ?? 0;
    let covered = true;

    // Treatment-type matching.
    if (
      plan?.planType === "dental" &&
      body.treatmentType !== "dental"
    ) {
      covered = false;
      notes.push(
        "This is a dental-only plan; the requested treatment is not covered.",
      );
    }
    if (
      plan?.planType === "maternity" &&
      body.treatmentType !== "maternity"
    ) {
      notes.push(
        "Maternity plan: non-maternity treatments are subject to standard exclusions.",
      );
    }
    if (plan?.planType === "critical_illness" || plan?.planType === "cancer") {
      notes.push(
        "Critical-illness/cancer plans only pay a lump sum on diagnosis; reimbursement varies.",
      );
    }

    // Pre-existing waiting period (advisory only).
    if (enrollment.startDate) {
      const daysSinceStart =
        (Date.now() - new Date(enrollment.startDate).getTime()) /
        (1000 * 60 * 60 * 24);
      const preExistingWait = plan?.preExistingWaitingDays ?? 365;
      if (daysSinceStart < preExistingWait) {
        notes.push(
          `Within pre-existing waiting period (${preExistingWait} days).`,
        );
      }
      const generalWait = plan?.waitingPeriodDays ?? 30;
      if (daysSinceStart < generalWait) {
        notes.push(
          `Within initial waiting period (${generalWait} days).`,
        );
      }
    }

    // Out-of-pocket estimate = max(deductible, amount * copay).
    let oop = 0;
    if (covered) {
      const copayShare = (body.estimatedAmountLkr * copay) / 100;
      oop = Math.max(deductible, copayShare);
      if (plan?.coPaymentCapLkr && copayShare > plan.coPaymentCapLkr) {
        oop = Math.min(oop, plan.coPaymentCapLkr + deductible);
        notes.push(
          `Copay capped at LKR ${plan.coPaymentCapLkr.toFixed(2)} per claim.`,
        );
      }
      if (oop >= body.estimatedAmountLkr) {
        notes.push(
          "Estimated out-of-pocket equals or exceeds the estimated bill. Consider network hospital.",
        );
      }
    }

    return c.json({
      enrolled: true,
      planName: plan?.name ?? null,
      coverageType: plan?.planType ?? null,
      covered,
      copayPct: copay,
      estimatedOutOfPocketLkr: Math.round(oop * 100) / 100,
      deductibleLkr: deductible,
      notes,
    });
  },
);

// ─── INTERNAL: activation (called by payments.ts webhook) ─

/**
 * handlePremiumPaid
 * Called from /payments/notify when an INS-* order_id resolves to paid.
 *   - Flip the open invoice to `paid`
 *   - Mark enrollment `active`, mint policy number, generate E-card
 *   - Push notification to patient
 *   - Audit
 *
 * Exported so /payments/notify can call without crossing router boundaries.
 */
export async function handleInsurancePremiumPaid(
  env: any,
  orderId: string,
  payherePaymentId: string | null,
  method: string | null,
): Promise<void> {
  const db = createDbInternal(env);
  const [invoice] = await db
    .select()
    .from(insurancePremiumInvoices)
    .where(eq(insurancePremiumInvoices.paymentId, orderId))
    .limit(1);
  if (!invoice) {
    logger.warn("insurance.notify", "invoice not found for order", { orderId });
    return;
  }
  if (invoice.status === "paid") {
    return; // idempotent
  }

  const now = new Date().toISOString();
  await db
    .update(insurancePremiumInvoices)
    .set({
      status: "paid",
      paidAt: now,
      updatedAt: now,
    })
    .where(eq(insurancePremiumInvoices.id, invoice.id));

  const [enrollment] = await db
    .select()
    .from(insuranceEnrollments)
    .where(eq(insuranceEnrollments.id, invoice.enrollmentId))
    .limit(1);
  if (!enrollment) {
    logger.warn("insurance.notify", "enrollment not found for invoice", {
      invoiceId: invoice.id,
    });
    return;
  }

  const isFirstPremium = !enrollment.policyNumber;
  const policyNumber = enrollment.policyNumber ?? mintPolicyNumber();
  const startDate = enrollment.startDate ?? now;
  const endDate =
    enrollment.billingCycle === "monthly"
      ? addMonths(startDate, 1)
      : addMonths(startDate, 12);
  const nextDue =
    enrollment.billingCycle === "monthly"
      ? addMonths(startDate, 1)
      : addMonths(startDate, 12);

  await db
    .update(insuranceEnrollments)
    .set({
      status: "active",
      policyNumber,
      startDate,
      endDate,
      lastPremiumPaidAt: now,
      nextPremiumDueAt: nextDue,
      kycStatus: "verified",
      updatedAt: now,
    })
    .where(eq(insuranceEnrollments.id, enrollment.id));

  // Mint E-card on first activation.
  if (isFirstPremium) {
    const existingCard = await db
      .select()
      .from(insuranceEcards)
      .where(eq(insuranceEcards.enrollmentId, enrollment.id))
      .limit(1);
    if (existingCard.length === 0) {
      await db.insert(insuranceEcards).values({
        id: crypto.randomUUID(),
        enrollmentId: enrollment.id,
        cardNumber: mintCardNumber(),
        qrToken: crypto.randomUUID().replace(/-/g, ""),
        validUntil: addMonths(startDate, enrollment.billingCycle === "monthly" ? 1 : 12),
      } as any);
    }
  }

  await notify({
    db,
    userId: enrollment.userId,
    type: "insurance",
    title: isFirstPremium ? "Policy activated" : "Premium paid",
    body: isFirstPremium
      ? `Your health insurance policy ${policyNumber} is now active. Open the Insurance tab to view your E-card.`
      : `Premium of LKR ${invoice.amountLkr.toFixed(2)} received. Policy renewed to ${endDate.slice(0, 10)}.`,
    data: { enrollmentId: enrollment.id, policyNumber },
  });

  await audit(db, {
    userId: enrollment.userId,
    action: isFirstPremium
      ? "insurance.policy.activated"
      : "insurance.premium.paid",
    resource: "insurance_enrollment",
    resourceId: enrollment.id,
    details: {
      orderId,
      payherePaymentId,
      method,
      amount: invoice.amountLkr,
      cycle: invoice.cycle,
    },
  });
}

/** Mirror of handleInsurancePremiumPaid for failed/cancelled payments. */
export async function handleInsurancePremiumFailed(
  env: any,
  orderId: string,
  reason: string,
): Promise<void> {
  const db = createDbInternal(env);
  const [invoice] = await db
    .select()
    .from(insurancePremiumInvoices)
    .where(eq(insurancePremiumInvoices.paymentId, orderId))
    .limit(1);
  if (!invoice || invoice.status === "failed") return;
  await db
    .update(insurancePremiumInvoices)
    .set({
      status: "failed",
      attemptCount: (invoice.attemptCount ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(insurancePremiumInvoices.id, invoice.id));

  // Move enrollment to grace if it had been active.
  const [enrollment] = await db
    .select()
    .from(insuranceEnrollments)
    .where(eq(insuranceEnrollments.id, invoice.enrollmentId))
    .limit(1);
  if (!enrollment) return;
  if (enrollment.status === "active") {
    await db
      .update(insuranceEnrollments)
      .set({
        status: "grace",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(insuranceEnrollments.id, enrollment.id));
    await notify({
      db,
      userId: enrollment.userId,
      type: "insurance",
      title: "Premium payment failed",
      body: `Your last premium payment failed (${reason}). You have a 7-day grace period to retry before coverage lapses.`,
      data: { enrollmentId: enrollment.id },
    });
  }
}

// ─── internal helpers ───────────────────────────────────

async function loadEnrollment(db: any, id: string) {
  const [row] = await db
    .select()
    .from(insuranceEnrollments)
    .where(eq(insuranceEnrollments.id, id))
    .limit(1);
  if (!row) return null;
  const deps = await db
    .select()
    .from(insuranceDependentMembers)
    .where(eq(insuranceDependentMembers.enrollmentId, id));
  return shapeEnrollment(row, deps);
}

async function loadClaim(db: any, id: string) {
  const [row] = await db
    .select()
    .from(insuranceMarketplaceClaims)
    .where(eq(insuranceMarketplaceClaims.id, id))
    .limit(1);
  if (!row) return null;
  const docs = await db
    .select()
    .from(insuranceMarketplaceClaimDocs)
    .where(eq(insuranceMarketplaceClaimDocs.claimId, id));
  const msgs = await db
    .select()
    .from(insuranceMarketplaceClaimMessages)
    .where(eq(insuranceMarketplaceClaimMessages.claimId, id))
    .orderBy(insuranceMarketplaceClaimMessages.createdAt);
  return shapeClaim(row, docs, msgs);
}

function createDbInternal(env: any) {
  return createDb(env.DB);
}

export default marketplaceRouter;