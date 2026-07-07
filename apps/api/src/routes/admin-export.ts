// @ts-nocheck
// ─── Admin data export (Phase ADM-3) ────────────────────────
//
// Streams CSV (RFC 4180) and JSON (NDJSON) for compliance + ops.
// Each export writes a single audit row with the filter set so
// we can prove who pulled what.

import { Hono } from "hono";
import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import {
  users,
  auditLogs,
  userAdminNotes,
  doctorVerificationDocs,
} from "@healthcare/db";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import type { AppEnvironment } from "../types";

const exportRouter = new Hono<AppEnvironment>();
exportRouter.use("*", requireAdmin);

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  // Escape per RFC 4180: wrap in quotes, double internal quotes.
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",") + "\n";
}

function jsonlRow(obj: unknown): string {
  return JSON.stringify(obj) + "\n";
}

function filename(prefix: string, ext: string): string {
  const d = new Date().toISOString().slice(0, 10);
  return `${prefix}-${d}.${ext}`;
}

function contentDisposition(name: string): string {
  return `attachment; filename="${name}"`;
}

const BATCH = 100;

// ─── Users export ───────────────────────────────────────────
exportRouter.get("/users", async (c) => {
  const db = c.get("db");
  const format = (c.req.query("format") || "csv") as "csv" | "json";
  const role = c.req.query("role");
  const status = c.req.query("status");
  const q = c.req.query("q");

  const where = and(
    role ? eq(users.role, role as any) : undefined,
    status ? eq(users.status, status as any) : undefined,
    q
      ? or(
          like(users.name, `%${q}%`),
          like(users.email, `%${q}%`),
          like(users.phone, `%${q}%`),
        )
      : undefined,
  );

  const COLS = [
    "id", "name", "email", "phone", "role", "status",
    "approvedAt", "rejectedAt", "suspendedAt", "createdAt",
  ];

  let rowCount = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        if (format === "csv") {
          controller.enqueue(enc.encode("﻿" + csvRow(COLS)));
        }
        let offset = 0;
        // D1 streaming-style: page in batches.
        while (true) {
          const rows = await db
            .select({
              id: users.id, name: users.name, email: users.email, phone: users.phone,
              role: users.role, status: users.status,
              approvedAt: users.approvedAt, rejectedAt: users.rejectedAt,
              suspendedAt: users.suspendedAt, createdAt: users.createdAt,
            })
            .from(users)
            .where(where)
            .orderBy(desc(users.createdAt))
            .limit(BATCH)
            .offset(offset);
          if (rows.length === 0) break;
          for (const r of rows) {
            if (format === "csv") {
              controller.enqueue(enc.encode(csvRow(COLS.map((k) => (r as any)[k]))));
            } else {
              controller.enqueue(enc.encode(jsonlRow(r)));
            }
            rowCount++;
          }
          if (rows.length < BATCH) break;
          offset += BATCH;
        }
      } finally {
        controller.close();
      }
    },
  });

  await recordAdminAction(c, {
    action: "export",
    resource: "user",
    details: { format, rowCount, filters: { role, status, q } },
  });

  const ct = format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8";
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Content-Disposition": contentDisposition(filename("users", format === "csv" ? "csv" : "jsonl")),
    },
  });
});

// ─── Audit export ───────────────────────────────────────────
exportRouter.get("/audit", async (c) => {
  const db = c.get("db");
  const format = (c.req.query("format") || "csv") as "csv" | "json";
  const userId = c.req.query("userId");
  const action = c.req.query("action");
  const resource = c.req.query("resource");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const where = and(
    userId ? eq(auditLogs.userId, userId) : undefined,
    action ? like(auditLogs.action, `${action}%`) : undefined,
    resource ? eq(auditLogs.resource, resource as any) : undefined,
    from ? gte(auditLogs.createdAt, from) : undefined,
    to ? lte(auditLogs.createdAt, to) : undefined,
  );

  const COLS = ["id", "userId", "action", "resource", "resourceId", "details", "ip", "createdAt"];

  let rowCount = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        if (format === "csv") {
          controller.enqueue(enc.encode("﻿" + csvRow(COLS)));
        }
        let offset = 0;
        while (true) {
          const rows = await db
            .select({
              id: auditLogs.id, userId: auditLogs.userId, action: auditLogs.action,
              resource: auditLogs.resource, resourceId: auditLogs.resourceId,
              details: auditLogs.details, ip: auditLogs.ip, createdAt: auditLogs.createdAt,
            })
            .from(auditLogs)
            .where(where)
            .orderBy(desc(auditLogs.createdAt))
            .limit(BATCH)
            .offset(offset);
          if (rows.length === 0) break;
          for (const r of rows) {
            if (format === "csv") {
              controller.enqueue(enc.encode(csvRow(COLS.map((k) => (r as any)[k]))));
            } else {
              controller.enqueue(enc.encode(jsonlRow(r)));
            }
            rowCount++;
          }
          if (rows.length < BATCH) break;
          offset += BATCH;
        }
      } finally {
        controller.close();
      }
    },
  });

  await recordAdminAction(c, {
    action: "export",
    resource: "audit",
    details: { format, rowCount, filters: { userId, action, resource, from, to } },
  });

  const ct = format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8";
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Content-Disposition": contentDisposition(filename("audit", format === "csv" ? "csv" : "jsonl")),
    },
  });
});

// ─── Approvals export (users with non-active status) ───────
exportRouter.get("/approvals", async (c) => {
  const db = c.get("db");
  const format = (c.req.query("format") || "csv") as "csv" | "json";
  const from = c.req.query("from");
  const to = c.req.query("to");

  const where = and(
    sql`${users.status} != 'active'`,
    from ? gte(users.createdAt, from) : undefined,
    to ? lte(users.createdAt, to) : undefined,
  );

  const COLS = ["id", "name", "email", "phone", "role", "status", "rejectionReason", "suspendedReason", "createdAt"];

  let rowCount = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        if (format === "csv") {
          controller.enqueue(enc.encode("﻿" + csvRow(COLS)));
        }
        let offset = 0;
        while (true) {
          const rows = await db
            .select({
              id: users.id, name: users.name, email: users.email, phone: users.phone,
              role: users.role, status: users.status,
              rejectionReason: users.rejectionReason,
              suspendedReason: users.suspendedReason,
              createdAt: users.createdAt,
            })
            .from(users)
            .where(where)
            .orderBy(desc(users.createdAt))
            .limit(BATCH)
            .offset(offset);
          if (rows.length === 0) break;
          for (const r of rows) {
            if (format === "csv") {
              controller.enqueue(enc.encode(csvRow(COLS.map((k) => (r as any)[k]))));
            } else {
              controller.enqueue(enc.encode(jsonlRow(r)));
            }
            rowCount++;
          }
          if (rows.length < BATCH) break;
          offset += BATCH;
        }
      } finally {
        controller.close();
      }
    },
  });

  await recordAdminAction(c, {
    action: "export",
    resource: "approval",
    details: { format, rowCount, filters: { from, to } },
  });

  const ct = format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8";
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Content-Disposition": contentDisposition(filename("approvals", format === "csv" ? "csv" : "jsonl")),
    },
  });
});

// ─── Notes export ───────────────────────────────────────────
exportRouter.get("/notes", async (c) => {
  const db = c.get("db");
  const format = (c.req.query("format") || "csv") as "csv" | "json";
  const userId = c.req.query("userId");

  const where = userId ? eq(userAdminNotes.userId, userId) : undefined;

  const COLS = ["id", "userId", "adminUserId", "body", "createdAt", "updatedAt", "deletedAt"];

  let rowCount = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        if (format === "csv") {
          controller.enqueue(enc.encode("﻿" + csvRow(COLS)));
        }
        let offset = 0;
        while (true) {
          const rows = await db
            .select({
              id: userAdminNotes.id, userId: userAdminNotes.userId,
              adminUserId: userAdminNotes.adminUserId, body: userAdminNotes.body,
              createdAt: userAdminNotes.createdAt, updatedAt: userAdminNotes.updatedAt,
              deletedAt: userAdminNotes.deletedAt,
            })
            .from(userAdminNotes)
            .where(where)
            .orderBy(desc(userAdminNotes.createdAt))
            .limit(BATCH)
            .offset(offset);
          if (rows.length === 0) break;
          for (const r of rows) {
            if (format === "csv") {
              controller.enqueue(enc.encode(csvRow(COLS.map((k) => (r as any)[k]))));
            } else {
              controller.enqueue(enc.encode(jsonlRow(r)));
            }
            rowCount++;
          }
          if (rows.length < BATCH) break;
          offset += BATCH;
        }
      } finally {
        controller.close();
      }
    },
  });

  await recordAdminAction(c, {
    action: "export",
    resource: "note",
    details: { format, rowCount, filters: { userId } },
  });

  const ct = format === "csv" ? "text/csv; charset=utf-8" : "application/x-ndjson; charset=utf-8";
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Content-Disposition": contentDisposition(filename("admin-notes", format === "csv" ? "csv" : "jsonl")),
    },
  });
});

export default exportRouter;