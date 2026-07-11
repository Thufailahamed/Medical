// @ts-nocheck
import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  ambulanceDispatches,
  insuranceClaims,
  operatorOrgs,
  users,
} from "@healthcare/db";
import { requireOperator, recordAdminAction } from "../middleware/admin";
import { requirePasskeyFresh } from "../middleware/stepup";
import type { AppEnvironment } from "../types";

const operatorRouter = new Hono<AppEnvironment>();
operatorRouter.use("*", requireOperator);

// ─── Operator self / org context ───────────────────────
operatorRouter.get("/profile", async (c) => {
  const db = c.get("db");
  const dbUser = c.get("dbUser") as any;

  // super_admin may not have an org.
  if (dbUser.role === "super_admin") {
    return c.json({
      role: dbUser.role,
      org: null,
      isCrossOrg: true,
    });
  }

  if (!dbUser.operatorOrgId) {
    return c.json({ role: dbUser.role, org: null, isCrossOrg: false });
  }

  const [org] = await db
    .select()
    .from(operatorOrgs)
    .where(eq(operatorOrgs.id, dbUser.operatorOrgId))
    .limit(1);

  return c.json({
    role: dbUser.role,
    org: org ?? null,
    isCrossOrg: false,
  });
});

// ─── Operator user list (super_admin sees all; operators see peers) ───
operatorRouter.get("/users", async (c) => {
  const db = c.get("db");
  const dbUser = c.get("dbUser") as any;
  const role = c.req.query("role") as string | undefined;

  let scope;
  if (dbUser.role === "super_admin") {
    scope = role ? eq(users.role, role as any) : undefined;
  } else {
    // Operators see only users in their org + same role family.
    const familyRole =
      dbUser.role === "insurance" ? "insurance" : "ambulance";
    scope = and(
      eq(users.role, (role ?? familyRole) as any),
      eq(users.operatorOrgId, dbUser.operatorOrgId),
    );
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      operatorOrgId: users.operatorOrgId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(scope as any)
    .orderBy(desc(users.createdAt))
    .limit(Math.min(parseInt(c.req.query("limit") ?? "200", 10) || 200, 500));

  return c.json({ items: rows, total: rows.length });
});

// ─── Insurance claims (scoped to org via denormalized linkage) ───
// NOTE: insuranceClaims.insuranceId is a *patient policy* id, not a
// company id. Phase ADM-2 ships the operator surface but full org→claim
// scoping requires a `claim_operators` table — out of scope here. Until
// that lands, super_admin sees all claims; insurance operators with no
// org see an empty list and a hint.
operatorRouter.get("/claims", async (c) => {
  const db = c.get("db");
  const dbUser = c.get("dbUser") as any;
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 500);

  if (dbUser.role !== "super_admin" && !dbUser.operatorOrgId) {
    return c.json({ items: [], total: 0, hint: "no_org" });
  }

  const where = status ? eq(insuranceClaims.status, status as any) : undefined;
  const rows = await db
    .select()
    .from(insuranceClaims)
    .where(where as any)
    .orderBy(desc(insuranceClaims.createdAt))
    .limit(limit);

  return c.json({ items: rows, total: rows.length });
});

const claimDecisionSchema = z.object({
  reason: z.string().max(500).optional(),
});

operatorRouter.post("/claims/:id/approve", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = claimDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const [existing] = await db
    .select()
    .from(insuranceClaims)
    .where(eq(insuranceClaims.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "Claim not found" }, 404);

  const now = new Date().toISOString();
  await db
    .update(insuranceClaims)
    .set({ status: "approved" })
    .where(eq(insuranceClaims.id, id));

  await recordAdminAction(c, {
    action: "operator.claims.approve",
    resource: "insurance_claim",
    resourceId: id,
    details: { reason: parsed.data.reason ?? null },
  });

  return c.json({ ok: true, status: "approved", at: now });
});

operatorRouter.post("/claims/:id/reject", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = claimDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const [existing] = await db
    .select()
    .from(insuranceClaims)
    .where(eq(insuranceClaims.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "Claim not found" }, 404);

  await db
    .update(insuranceClaims)
    .set({ status: "rejected", notes: parsed.data.reason ?? null })
    .where(eq(insuranceClaims.id, id));

  await recordAdminAction(c, {
    action: "operator.claims.reject",
    resource: "insurance_claim",
    resourceId: id,
    details: { reason: parsed.data.reason ?? null },
  });

  return c.json({ ok: true, status: "rejected" });
});

// ─── Ambulance dispatches (operator-org scoped) ─────────
operatorRouter.get("/dispatches", async (c) => {
  const db = c.get("db");
  const dbUser = c.get("dbUser") as any;
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 500);

  if (dbUser.role !== "super_admin" && !dbUser.operatorOrgId) {
    return c.json({ items: [], total: 0, hint: "no_org" });
  }

  const whereParts: any[] = [];
  if (dbUser.role !== "super_admin") {
    whereParts.push(eq(ambulanceDispatches.operatorOrgId, dbUser.operatorOrgId));
  }
  if (status) whereParts.push(eq(ambulanceDispatches.status, status as any));
  const where = whereParts.length ? and(...whereParts) : undefined;

  const rows = await db
    .select()
    .from(ambulanceDispatches)
    .where(where as any)
    .orderBy(desc(ambulanceDispatches.createdAt))
    .limit(limit);

  return c.json({ items: rows, total: rows.length });
});

operatorRouter.post("/dispatches/:id/acknowledge", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const dbUser = c.get("dbUser") as any;

  const [existing] = await db
    .select()
    .from(ambulanceDispatches)
    .where(eq(ambulanceDispatches.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "Dispatch not found" }, 404);

  if (
    dbUser.role !== "super_admin" &&
    existing.operatorOrgId !== dbUser.operatorOrgId
  ) {
    return c.json({ error: "Out of scope", code: "out_of_scope" }, 403);
  }

  const now = new Date().toISOString();
  await db
    .update(ambulanceDispatches)
    .set({ status: "acknowledged", acknowledgedAt: now })
    .where(eq(ambulanceDispatches.id, id));

  await recordAdminAction(c, {
    action: "operator.dispatches.acknowledge",
    resource: "ambulance_dispatch",
    resourceId: id,
  });

  return c.json({ ok: true, status: "acknowledged", at: now });
});

export default operatorRouter;