// @ts-nocheck
// ─── Admin system health (Phase ADM-4) ────────────────────────
//
// Read-only observability for the super_admin. Returns row counts,
// queue depth, D1 storage estimate, and a tail of recent failures.
// All endpoints write a `admin.health_*` audit row so we can
// detect noisy admin probing.

import { Hono } from "hono";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import {
  users,
  doctors,
  prescriptions,
  dsarRequests,
  auditLogs,
  notifications,
} from "@healthcare/db";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import type { AppEnvironment } from "../types";

const healthRouter = new Hono<AppEnvironment>();

healthRouter.use("*", requireAdmin);

healthRouter.get("/overview", async (c) => {
  const db = c.get("db");

  const [
    totalUsersRes,
    totalDoctorsRes,
    totalRecordsRes,
    pendingDsarRes,
    pendingApprovalsRes,
    unreadNotifsRes,
    activeUsersRes,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(doctors),
    db.select({ count: sql<number>`count(*)` }).from(prescriptions),
    db
      .select({ count: sql<number>`count(*)` })
      .from(dsarRequests)
      .where(
        or(
          eq(dsarRequests.status, "queued"),
          eq(dsarRequests.status, "approved"),
          eq(dsarRequests.status, "processing"),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.status, "pending_review")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.read, false)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.status, "active")),
  ]);

  const totalUsers = totalUsersRes[0]?.count ?? 0;
  const totalDoctors = totalDoctorsRes[0]?.count ?? 0;
  const totalRecords = totalRecordsRes[0]?.count ?? 0;
  const pendingDsar = pendingDsarRes[0]?.count ?? 0;
  const pendingApprovals = pendingApprovalsRes[0]?.count ?? 0;
  const unreadNotifications = unreadNotifsRes[0]?.count ?? 0;
  const activeUsers = activeUsersRes[0]?.count ?? 0;

  // D1 storage estimate via PRAGMA page_count. Pages are 4KB by default.
  let d1Pages: number | null = null;
  let d1Bytes: number | null = null;
  try {
    const rows: any = await (db as any).$client?.pragma?.("page_count") ?? null;
    // mock D1 returns the pragma differently — handle both shapes.
    if (Array.isArray(rows) && rows[0]?.page_count != null) {
      d1Pages = Number(rows[0].page_count);
    } else if (rows?.page_count != null) {
      d1Pages = Number(rows.page_count);
    }
    if (d1Pages != null) d1Bytes = d1Pages * 4096;
  } catch {
    d1Pages = null;
  }

  await recordAdminAction(c, {
    action: "health_overview",
    resource: "system",
  });

  return c.json({
    counts: {
      totalUsers: Number(totalUsers),
      totalDoctors: Number(totalDoctors),
      totalRecords: Number(totalRecords),
      pendingDsar: Number(pendingDsar),
      pendingApprovals: Number(pendingApprovals),
      unreadNotifications: Number(unreadNotifications),
      activeUsers: Number(activeUsers),
    },
    storage: {
      d1Pages,
      d1Bytes,
    },
    generatedAt: new Date().toISOString(),
  });
});

healthRouter.get("/cron/:name", async (c) => {
  const db = c.get("db");
  const name = c.req.param("name");
  // Whitelist known cron names so the audit log query is bounded.
  const known = new Set([
    "booking",
    "dose",
    "refill",
    "reclassify",
    "vaccination",
  ]);
  if (!known.has(name)) {
    return c.json({ error: "Unknown cron name" }, 400);
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(like(auditLogs.action, `cron.${name}%`))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  await recordAdminAction(c, {
    action: "health_cron",
    resource: "system",
    resourceId: name,
  });

  return c.json({ name, items: rows });
});

healthRouter.get("/errors", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(auditLogs)
    .where(
      or(
        like(auditLogs.action, "%.fail"),
        like(auditLogs.action, "%.error"),
        like(auditLogs.action, "%.failure"),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  await recordAdminAction(c, {
    action: "health_errors",
    resource: "system",
  });

  return c.json({ items: rows });
});

export default healthRouter;