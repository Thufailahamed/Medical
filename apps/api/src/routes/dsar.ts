// @ts-nocheck
//
// Phase v3: DSAR (Data Subject Access Request) routes.
//
//   POST   /dsar/export           — self-service export (instant approve)
//   POST   /dsar/erasure          — anonymisation request (queued, 7d grace)
//   POST   /dsar/rectification    — correction request (queued)
//   GET    /dsar/jobs/:id         — poll status
//   GET    /dsar/jobs             — list mine
//
// All verbs rate-limited to 5/hour per user.

import { Hono } from "hono";
import { and, eq, desc } from "drizzle-orm";
import { dsarRequests } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import {
  createDsarRequest,
  exportPatient,
  anonymisePatient,
  requestRectification,
  underRateLimit,
} from "../lib/dsar";
import { dsarRequestSchema } from "@healthcare/shared/records";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const dsar = new Hono<AppEnvironment>();

dsar.use("*", authMiddleware);

// POST /dsar/export
dsar.post("/export", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  if (!(await underRateLimit(db, userId))) {
    return c.json({ error: "rate_limited", message: "5 requests / hour" }, 429);
  }
  const created = await createDsarRequest({ db, userId, purpose: "export" });
  await audit(db, {
    userId,
    action: "dsar_export_requested",
    resource: "dsar_request",
    resourceId: created.id,
  });
  // Self-service: complete the job inline so the caller gets the data
  // back without polling. For large exports the route could shift to
  // async + R2; for v3 the inline approach keeps the surface small.
  try {
    const bundle = await exportPatient(db, userId);
    await db
      .update(dsarRequests)
      .set({ status: "completed", completedAt: new Date().toISOString() })
      .where(eq(dsarRequests.id, created.id));
    return c.json({ id: created.id, status: "completed", bundle });
  } catch (err) {
    await db
      .update(dsarRequests)
      .set({ status: "failed" })
      .where(eq(dsarRequests.id, created.id));
    return c.json({ error: "export_failed", reason: (err as Error).message }, 500);
  }
});

// POST /dsar/erasure
dsar.post("/erasure", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  if (!(await underRateLimit(db, userId))) {
    return c.json({ error: "rate_limited" }, 429);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = dsarRequestSchema.safeParse({ ...body, purpose: "erasure" });
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: flattenTranslated(parsed.error) }, 400);
  }
  const created = await createDsarRequest({
    db,
    userId,
    purpose: "erasure",
    notes: parsed.data.notes,
  });
  await audit(db, {
    userId,
    action: "dsar_erasure_requested",
    resource: "dsar_request",
    resourceId: created.id,
  });
  // Erasure is gated by admin approval (`/admin/dsar/:id/approve` +
  // `/admin/dsar/:id/complete`). The patient submission only enqueues
  // the request — anonymisation runs once an operator confirms. The
  // requester can poll `/dsar/jobs/:id` to track status.
  return c.json(
    { id: created.id, status: created.status, message: "Erasure request queued for admin review." },
    202,
  );
});

// POST /dsar/rectification
dsar.post("/rectification", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  if (!(await underRateLimit(db, userId))) {
    return c.json({ error: "rate_limited" }, 429);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = dsarRequestSchema.safeParse({ ...body, purpose: "rectification" });
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: flattenTranslated(parsed.error) }, 400);
  }
  const fields = parsed.data.fields ?? [];
  if (!fields.length) {
    return c.json({ error: "fields_required" }, 400);
  }
  const created = await createDsarRequest({
    db,
    userId,
    purpose: "rectification",
    notes: parsed.data.notes,
    fields,
  });
  await requestRectification(db, {
    userId,
    fields,
    notes: parsed.data.notes,
  });
  await audit(db, {
    userId,
    action: "dsar_rectification_requested",
    resource: "dsar_request",
    resourceId: created.id,
  });
  return c.json({ id: created.id, status: created.status }, 202);
});

// GET /dsar/jobs/:id
dsar.get("/jobs/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [row] = await db
    .select()
    .from(dsarRequests)
    .where(and(eq(dsarRequests.id, id), eq(dsarRequests.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  return c.json(row);
});

// GET /dsar/jobs
dsar.get("/jobs", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.userId, userId))
    .orderBy(desc(dsarRequests.requestedAt));
  return c.json({ items: rows });
});

export default dsar;