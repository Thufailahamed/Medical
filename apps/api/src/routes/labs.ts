// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { labReports, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { canAccessPatient } from "../lib/access";
import { audit } from "../lib/audit";
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

// ─── Create lab report (lab role only) ───────────────────
// P0 audit fix: previously any logged-in user could POST a lab
// report for any patient. Now requires the laboratory /
// hospital_staff / hospital_admin role; patient/doctor cannot mint
// lab reports from this endpoint.
labsRouter.post(
  "/",
  authMiddleware,
  requireRole(
    "laboratory",
    "hospital_staff",
    "hospital_admin",
    "super_admin"
  ),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const role = (c.get("dbUser") as any)?.role;
    const body = await c.req.json();

    if (!body.patientId || !body.reportType) {
      return c.json({ error: "patientId and reportType required" }, 400);
    }

    // Laboratory staff can only file reports under their own lab id.
    const labId =
      role === "laboratory"
        ? userId
        : body.labId || userId;

    const [row] = await db
      .insert(labReports)
      .values({
        patientId: body.patientId,
        labId,
        recordId: body.recordId || null,
        reportType: body.reportType,
        status: body.status || "pending",
        pdfUrl: body.pdfUrl || null,
        aiSummary: body.aiSummary || null,
      } as any)
      .returning();

    audit(db, userId, {
      action: "create",
      resource: "lab_report",
      resourceId: row?.id,
      details: { patientId: body.patientId, reportType: body.reportType },
    }).catch(() => {});

    return c.json({ report: row?.lab_reports || row }, 201);
  }
);

// ─── Update lab report ───────────────────────────────────
//
// P0 audit fix: previously any logged-in user could PATCH any
// lab report by id-guess — no RBAC, no ownership check, no
// relationship check. Now:
//   - laboratory role: must be the labId on the row.
//   - doctor role: must have a relationship with the patient
//     (via canAccessPatient) — they can attach results they've
//     personally verified.
//   - hospital_staff/admin/super_admin: any report at their hospital.
// The status transition is also gated through withStatusGuard in
// P2 (atomicity) — for P0 we keep the simple write but add the
// ownership check.
labsRouter.put(
  "/:id",
  authMiddleware,
  requireRole(
    "laboratory",
    "hospital_staff",
    "hospital_admin",
    "doctor",
    "super_admin"
  ),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const role = (c.get("dbUser") as any)?.role;
    const id = c.req.param("id") as string;
    const body = await c.req.json();

    const allowed = [
      "pending",
      "sample_collected",
      "in_progress",
      "completed",
      "cancelled",
    ];
    if (body.status && !allowed.includes(body.status)) {
      return c.json(
        { error: `status must be one of: ${allowed.join(", ")}` },
        400
      );
    }

    // Load the existing row for the ownership check.
    const [existing] = await db
      .select()
      .from(labReports)
      .where(eq(labReports.id, id))
      .limit(1);
    if (!existing) return c.json({ error: "Lab report not found" }, 404);

    if (role === "laboratory") {
      if (existing.labId !== userId) {
        return c.json(
          { error: "Lab staff can only update reports filed under their own lab id" },
          403
        );
      }
    } else if (role === "doctor") {
      const access = await canAccessPatient(
        db,
        userId,
        "doctor",
        existing.patientId
      );
      if (!access.allowed) {
        return c.json(
          { error: access.reason || "Forbidden", code: "no_relationship" },
          403
        );
      }
    } else if (role === "hospital_staff" || role === "hospital_admin") {
      // P1: tighten to require same-hospitalId relationship via
      // hospital_staff.hospital_id == the originating hospital. For
      // now we allow admin/staff — the role check above is the gate.
    }
    // super_admin bypass.

    const [row] = await db
      .update(labReports)
      .set({
        status: body.status,
        pdfUrl: body.pdfUrl,
        aiSummary: body.aiSummary,
      })
      .where(eq(labReports.id, id))
      .returning();

    audit(db, userId, {
      action: "update",
      resource: "lab_report",
      resourceId: id,
      details: body,
    }).catch(() => {});

    return c.json({ report: row?.lab_reports || row });
  }
);

export default labsRouter;