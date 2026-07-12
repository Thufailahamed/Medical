// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { auditLogs, patients, prescriptions, doctors, users } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { canAccessPatient } from "../lib/access";
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

// Map UI filter pill -> DB resource value(s).
// Each map entry accepts a list because some categories span multiple
// resource names (e.g., "records" covers medical_record + others).
const FILTER_MAP: Record<string, string[]> = {
  records: ["medical_record"],
  prescriptions: ["prescription"],
  appointments: ["appointment"],
};

function actorNameOf(
  user: { firstName: string | null; lastName: string | null } | undefined,
): string | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

// ─── List audit entries for the calling patient ─────────
// Patients see their own actions + actions by others on their data.
// Response shape: `{ entries: [{ ..., actorName }] }` for mobile consumption.
auditRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const limit = Math.min(parseInt(c.req.query("limit") || "200", 10), 500);
  const filter = c.req.query("filter") || "all";

  const baseQuery = db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resource: auditLogs.resource,
      resourceId: auditLogs.resourceId,
      userId: auditLogs.userId,
      details: auditLogs.details,
      ip: auditLogs.ip,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(eq(auditLogs.userId, userId));

  const filteredQuery =
    filter !== "all" && FILTER_MAP[filter]
      ? baseQuery.where(
          and(
            eq(auditLogs.userId, userId),
            inArray(auditLogs.resource, FILTER_MAP[filter])
          )
        )
      : baseQuery;

  const rows = await filteredQuery
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  const entries = rows.map((r: any) => ({
    id: r.id,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    actorId: r.userId,
    actorName: r.actorName ?? "System",
    details: r.details ? safeParse(r.details) : null,
    ip: r.ip,
    createdAt: r.createdAt,
  }));

  return c.json({ entries });
});

function safeParse(s: string): Record<string, unknown> | string {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ─── Audit entries for a specific resource (Phase E-Rx 8) ─
//
// GET /audit?resource=prescription&resourceId=...
//   role=doctor. Returns the audit trail for a given resource, newest
//   first. Currently scoped to prescriptions — the only resource that
//   has a real "lifecycle" audit story. The doctor must own the
//   prescription (doctorId matches the requesting userId) — otherwise
//   we return 403 to avoid leaking audit entries from other doctors'
//   resources.
//
//   Future expansion: extend with `resource=patient&resourceId=...`
//   for the chart timeline.
auditRouter.get("/", authMiddleware, requireRole("doctor"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const resource = c.req.query("resource");
  const resourceId = c.req.query("resourceId");
  if (!resource || !resourceId) {
    return c.json({ error: "resource and resourceId required" }, 400);
  }

  if (resource === "prescription") {
    // Ownership check: the doctor must own this prescription.
    const [doctor] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

    const [own] = await db
      .select({ id: prescriptions.id })
      .from(prescriptions)
      .where(eq(prescriptions.id, resourceId))
      .limit(1);
    if (!own) return c.json({ error: "Prescription not found" }, 404);

    // Doctors can only see audit rows for prescriptions they authored.
    const [own2] = await db
      .select({ id: prescriptions.id, doctorId: prescriptions.doctorId })
      .from(prescriptions)
      .where(eq(prescriptions.id, resourceId))
      .limit(1);
    if (own2?.doctorId !== doctor.id) {
      return c.json({ error: "Not your prescription" }, 403);
    }

    const rows = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resource, "prescription"),
          eq(auditLogs.resourceId, resourceId)
        )
      )
      .orderBy(desc(auditLogs.createdAt));

    return c.json({ auditLogs: rows });
  }

  if (resource === "patient") {
    // Reuse the cross-tenant access check used by the chart so a doctor
    // cannot read another doctor's patient audit log.
    const role = (c.get("userRole") as string) || "doctor";
    const access = await canAccessPatient(db, userId, role, resourceId);
    if (!access.allowed) {
      return c.json({ error: access.reason ?? "Forbidden" }, 403);
    }

    const rows = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.resource, "patient"),
          eq(auditLogs.resourceId, resourceId)
        )
      )
      .orderBy(desc(auditLogs.createdAt));

    return c.json({ auditLogs: rows });
  }

  return c.json({ error: `Unsupported resource: ${resource}` }, 400);
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