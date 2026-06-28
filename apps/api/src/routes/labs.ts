// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { labReports, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const labsRouter = new Hono<AppEnvironment>();

async function getPatientId(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p?.id || null;
}

// ─── List patient's lab reports ──────────────────────────
labsRouter.get("/me", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const patientId = await getPatientId(db, userId);
  if (!patientId) return c.json({ reports: [] });

  const rows = await db
    .select()
    .from(labReports)
    .where(eq(labReports.patientId, patientId))
    .orderBy(desc(labReports.createdAt));

  return c.json({ reports: rows });
});

// ─── Create lab report (lab role) ────────────────────────
labsRouter.post("/", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();

  if (!body.patientId || !body.reportType) {
    return c.json({ error: "patientId and reportType required" }, 400);
  }

  const [row] = await db
    .insert(labReports)
    .values({
      patientId: body.patientId,
      labId: body.labId || userId,
      recordId: body.recordId || null,
      reportType: body.reportType,
      status: body.status || "pending",
      pdfUrl: body.pdfUrl || null,
      aiSummary: body.aiSummary || null,
    } as any)
    .returning();

  return c.json({ report: row?.lab_reports || row }, 201);
});

// ─── Update lab report status ────────────────────────────
labsRouter.put("/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id") as string;
  const body = await c.req.json();

  const allowed = ["pending", "sample_collected", "in_progress", "completed", "cancelled"];
  if (body.status && !allowed.includes(body.status)) {
    return c.json({ error: `status must be one of: ${allowed.join(", ")}` }, 400);
  }

  const [row] = await db
    .update(labReports)
    .set({
      status: body.status,
      pdfUrl: body.pdfUrl,
      aiSummary: body.aiSummary,
    })
    .where(eq(labReports.id, id))
    .returning();

  return c.json({ report: row?.lab_reports || row });
});

export default labsRouter;