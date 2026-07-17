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
import { insuranceClaimDecisionSchema } from "@healthcare/shared/validators";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const operatorRouter = new Hono<AppEnvironment>();

operatorRouter.use("*", authMiddleware, requireRole("insurance"));

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
    .select()
    .from(insuranceEnrollments)
    .where(inArray(insuranceEnrollments.providerId, providerIds))
    .orderBy(desc(insuranceEnrollments.createdAt));

  const enrIds = rows.map((r) => r.id);
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
      id: r.id,
      userId: r.userId,
      planId: r.planId,
      providerId: r.providerId,
      policyNumber: r.policyNumber,
      status: r.status,
      billingCycle: r.billingCycle,
      premiumAmountLkr: r.premiumAmountLkr,
      coverageAmountLkr: r.coverageAmountLkr,
      startDate: r.startDate,
      endDate: r.endDate,
      nomineeName: r.nomineeName,
      dependents: (depByEnr.get(r.id) ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        relation: d.relation,
        dob: d.dob,
      })),
      createdAt: r.createdAt,
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
    userId: claim.userId,
    type: "insurance",
    title: "Update on your claim",
    body: body.body.slice(0, 140),
    data: { claimId },
  });
  return c.json({ message: row }, 201);
});

export default operatorRouter;