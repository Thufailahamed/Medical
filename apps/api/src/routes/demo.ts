// @ts-nocheck
// ─── Phase 3.1: Request-a-Demo lead capture ──────────────
// Public POST: anyone (no-auth, no-account) can submit a demo request.
// Admin read: sales team lists leads.
//
// TODO(phase-3.2): swap admin role for a dedicated `sales` role once the
// business org structure is finalised. Currently `hospital_admin` is the
// closest existing role — adequate for MVP since the sales team can be
// granted that role by the platform team.
//
// TODO(phase-3.2): wire CF Rate Limiting binding on POST to throttle
// abusive public submissions.

import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { demoRequests } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { demoRequestSchema } from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const demoRouter = new Hono<AppEnvironment>();

// ─── Public submit ───────────────────────────────────────
demoRouter.post("/demo-requests", async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = demoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }
  const data = parsed.data;

  // Insert with status='new' (DB default). Empty SLMC string normalises
  // to NULL so the partial unique index treats blank submissions the
  // same as no submission.
  const slmcValue =
    typeof data.slmcRegistrationNo === "string" &&
    data.slmcRegistrationNo.trim() === ""
      ? null
      : (data.slmcRegistrationNo as string | undefined) ?? null;

  const [row] = await db
    .insert(demoRequests)
    .values({
      clinicName: data.clinicName?.trim() || null,
      contactName: data.contactName.trim(),
      contactRole: data.contactRole || null,
      phone: data.phone.replace(/\s/g, ""),
      email: data.email.trim().toLowerCase(),
      nic: data.nic?.trim() || null,
      slmcRegistrationNo: slmcValue,
      specialty: data.specialty || null,
      clinicSize: data.clinicSize || null,
      message: data.message?.trim() || null,
      status: "new",
    } as any)
    .returning({ id: demoRequests.id });

  return c.json({ id: row.id, status: "received" }, 201);
});

// ─── Admin list ──────────────────────────────────────────
demoRouter.get(
  "/demo-requests",
  authMiddleware,
  requireRole("hospital_admin"),
  async (c) => {
    const db = c.get("db");
    const status = c.req.query("status");

    const rows = await db
      .select()
      .from(demoRequests)
      .where(
        status && ["new", "contacted", "qualified", "closed"].includes(status)
          ? eq(demoRequests.status, status)
          : undefined
      )
      .orderBy(desc(demoRequests.createdAt));

    return c.json({ requests: rows });
  }
);

export default demoRouter;