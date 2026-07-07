// @ts-nocheck
// ─── Admin bulk operations (Phase ADM-2) ────────────────────
//
// Wraps the single-item approve / reject / suspend / unsuspend /
// delete flows from routes/admin.ts so an admin can apply them to
// up to 200 users at once. Partial-success semantics: each item is
// tried independently, failures don't abort the batch.
//
// Why no transaction: D1's sqlite is single-statement per request
// model — there's no cheap way to rollback 50 writes. Each item
// is its own write so we accept partial-success instead.

import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { users, notifications } from "@healthcare/db";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import { flattenTranslated } from "../lib/validation-error";
import { getSetting } from "../lib/settings";
import type { AppEnvironment } from "../types";

const MAX_BATCH = 200;

const bulkBodySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(MAX_BATCH),
});

interface BulkResult {
  results: Array<{
    userId: string;
    status: "ok" | "error";
    code?: string;
    message?: string;
  }>;
  successCount: number;
  failureCount: number;
}

class BulkSkip extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function ensureBulkEnabled(c: any): Promise<{ ok: true } | Response> {
  const enabled = await getSetting<boolean>(c.get("db"), "featureFlags.bulkOpsEnabled", true);
  if (!enabled) {
    return c.json({ error: "Bulk operations are disabled in system settings" }, 403);
  }
  return { ok: true };
}

const bulkRouter = new Hono<AppEnvironment>();
bulkRouter.use("*", requireAdmin);

// ─── Bulk approve ───────────────────────────────────────────
bulkRouter.post("/approve", async (c) => {
  const gate = await ensureBulkEnabled(c);
  if (gate instanceof Response) return gate;

  const body = await c.req.json().catch(() => ({}));
  const parsed = bulkBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const db = c.get("db");
  const actor = c.get("adminActor");
  const now = new Date().toISOString();

  const out: BulkResult = { results: [], successCount: 0, failureCount: 0 };
  for (const userId of parsed.data.userIds) {
    try {
      const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!existing) throw new BulkSkip("not_found", "User not found");
      if ((existing as any).status !== "pending") {
        throw new BulkSkip("not_pending", `User is ${(existing as any).status}, not pending`);
      }

      await db
        .update(users)
        .set({
          status: "active",
          approvedAt: now,
          approvedByUserId: actor?.id ?? null,
          rejectedAt: null,
          rejectionReason: null,
          suspendedAt: null,
          suspendedReason: null,
          suspendedByUserId: null,
        } as any)
        .where(eq(users.id, userId));

      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId,
        type: "general",
        title: "Your account is approved",
        body: "You can now sign in to the platform.",
        data: null,
        read: 0,
      });

      out.results.push({ userId, status: "ok" });
      out.successCount++;
    } catch (e: any) {
      out.results.push({ userId, status: "error", code: e.code ?? "unknown", message: e.message });
      out.failureCount++;
    }
  }

  await recordAdminAction(c, {
    action: "bulk_approve",
    resource: "user",
    details: {
      count: parsed.data.userIds.length,
      success: out.successCount,
      failure: out.failureCount,
    },
  });

  return c.json(out);
});

// ─── Bulk reject ────────────────────────────────────────────
const bulkRejectSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(MAX_BATCH),
  reason: z.string().min(3).max(500),
});

bulkRouter.post("/reject", async (c) => {
  const gate = await ensureBulkEnabled(c);
  if (gate instanceof Response) return gate;

  const body = await c.req.json().catch(() => ({}));
  const parsed = bulkRejectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const db = c.get("db");
  const actor = c.get("adminActor");
  const now = new Date().toISOString();

  const out: BulkResult = { results: [], successCount: 0, failureCount: 0 };
  for (const userId of parsed.data.userIds) {
    try {
      const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!existing) throw new BulkSkip("not_found", "User not found");
      if ((existing as any).status !== "pending") {
        throw new BulkSkip("not_pending", `User is ${(existing as any).status}, not pending`);
      }

      await db
        .update(users)
        .set({
          status: "rejected",
          rejectedAt: now,
          rejectionReason: parsed.data.reason,
          approvedAt: null,
          approvedByUserId: null,
        } as any)
        .where(eq(users.id, userId));

      out.results.push({ userId, status: "ok" });
      out.successCount++;
    } catch (e: any) {
      out.results.push({ userId, status: "error", code: e.code ?? "unknown", message: e.message });
      out.failureCount++;
    }
  }

  await recordAdminAction(c, {
    action: "bulk_reject",
    resource: "user",
    details: {
      count: parsed.data.userIds.length,
      success: out.successCount,
      failure: out.failureCount,
      reason: parsed.data.reason,
    },
  });

  return c.json(out);
});

// ─── Bulk suspend ───────────────────────────────────────────
const bulkSuspendSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(MAX_BATCH),
  reason: z.string().min(3).max(500),
});

bulkRouter.post("/suspend", async (c) => {
  const gate = await ensureBulkEnabled(c);
  if (gate instanceof Response) return gate;

  const body = await c.req.json().catch(() => ({}));
  const parsed = bulkSuspendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const db = c.get("db");
  const actor = c.get("adminActor");
  const now = new Date().toISOString();

  const out: BulkResult = { results: [], successCount: 0, failureCount: 0 };
  for (const userId of parsed.data.userIds) {
    try {
      const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!existing) throw new BulkSkip("not_found", "User not found");
      if (existing.role === "super_admin" && existing.id === actor?.id) {
        throw new BulkSkip("self_suspend", "Cannot suspend yourself");
      }
      if ((existing as any).status === "suspended") {
        throw new BulkSkip("already_suspended", "User already suspended");
      }

      await db
        .update(users)
        .set({
          status: "suspended",
          suspendedAt: now,
          suspendedReason: parsed.data.reason,
          suspendedByUserId: actor?.id ?? null,
        } as any)
        .where(eq(users.id, userId));

      out.results.push({ userId, status: "ok" });
      out.successCount++;
    } catch (e: any) {
      out.results.push({ userId, status: "error", code: e.code ?? "unknown", message: e.message });
      out.failureCount++;
    }
  }

  await recordAdminAction(c, {
    action: "bulk_suspend",
    resource: "user",
    details: {
      count: parsed.data.userIds.length,
      success: out.successCount,
      failure: out.failureCount,
      reason: parsed.data.reason,
    },
  });

  return c.json(out);
});

// ─── Bulk unsuspend ─────────────────────────────────────────
bulkRouter.post("/unsuspend", async (c) => {
  const gate = await ensureBulkEnabled(c);
  if (gate instanceof Response) return gate;

  const body = await c.req.json().catch(() => ({}));
  const parsed = bulkBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const db = c.get("db");
  const out: BulkResult = { results: [], successCount: 0, failureCount: 0 };
  for (const userId of parsed.data.userIds) {
    try {
      const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!existing) throw new BulkSkip("not_found", "User not found");
      if ((existing as any).status !== "suspended") {
        throw new BulkSkip("not_suspended", `User is ${(existing as any).status}, not suspended`);
      }

      await db
        .update(users)
        .set({
          status: "active",
          suspendedAt: null,
          suspendedReason: null,
          suspendedByUserId: null,
        } as any)
        .where(eq(users.id, userId));

      out.results.push({ userId, status: "ok" });
      out.successCount++;
    } catch (e: any) {
      out.results.push({ userId, status: "error", code: e.code ?? "unknown", message: e.message });
      out.failureCount++;
    }
  }

  await recordAdminAction(c, {
    action: "bulk_unsuspend",
    resource: "user",
    details: {
      count: parsed.data.userIds.length,
      success: out.successCount,
      failure: out.failureCount,
    },
  });

  return c.json(out);
});

// ─── Bulk delete (requires confirm) ─────────────────────────
const bulkDeleteSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(MAX_BATCH),
  confirm: z.literal(true),
});

bulkRouter.post("/delete", async (c) => {
  const gate = await ensureBulkEnabled(c);
  if (gate instanceof Response) return gate;

  const body = await c.req.json().catch(() => ({}));
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: "Bulk delete requires { confirm: true }",
      details: flattenTranslated(parsed.error, c.get("locale")),
    }, 400);
  }

  const db = c.get("db");
  const actor = c.get("adminActor");

  const out: BulkResult = { results: [], successCount: 0, failureCount: 0 };
  for (const userId of parsed.data.userIds) {
    try {
      const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!existing) throw new BulkSkip("not_found", "User not found");
      if (existing.role === "super_admin" && existing.id === actor?.id) {
        throw new BulkSkip("self_delete", "Cannot delete yourself");
      }

      await db.delete(users).where(eq(users.id, userId));
      out.results.push({ userId, status: "ok" });
      out.successCount++;
    } catch (e: any) {
      out.results.push({ userId, status: "error", code: e.code ?? "unknown", message: e.message });
      out.failureCount++;
    }
  }

  await recordAdminAction(c, {
    action: "bulk_delete",
    resource: "user",
    details: {
      count: parsed.data.userIds.length,
      success: out.successCount,
      failure: out.failureCount,
    },
  });

  return c.json(out);
});

export default bulkRouter;