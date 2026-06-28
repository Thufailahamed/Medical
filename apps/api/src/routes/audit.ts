// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { auditLogs, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const auditRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

// ─── List audit entries touching this user's records ─────
// Patients see: their own actions + actions by others on their data.
auditRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);

  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return c.json({ auditLogs: rows });
});

// ─── Generic log writer (internal endpoints call this) ────
auditRouter.post("/", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json();

  const [row] = await db
    .insert(auditLogs)
    .values({
      userId,
      action: body.action,
      resource: body.resource,
      resourceId: body.resourceId || null,
      details: body.details ? JSON.stringify(body.details) : null,
      ip:
        c.req.header("cf-connecting-ip") ||
        c.req.header("x-forwarded-for") ||
        null,
    } as any)
    .returning();

  return c.json({ auditLog: row }, 201);
});

export default auditRouter;