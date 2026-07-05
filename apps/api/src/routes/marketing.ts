// @ts-nocheck
// ─── Marketing-site waitlist ──────────────────────────────
//
// Public POST endpoint hit by the waitlist form on the
// marketing landing page (website/index.html). Anyone, no
// auth. Email + role + light attribution.
//
// Behavioural contract:
//   - First time submitting: 201, returns { id, status: "received" }.
//   - Duplicate email:        200, returns { id, status: "already_on_list" }
//                             — the form always shows a friendly success.
//   - Validation error:       400, { error, details }.
//   - CORS: the form is hosted on https://healthhub.app and posts
//     to https://api.healthhub.app. CORS is set at app-level
//     (see src/index.ts); we don't override it here.
//
// Privacy:
//   We deliberately do NOT capture IP. CF logs already have it
//   for abuse handling — keeping it out of the table means
//   a sales export can never accidentally leak it.
//   We do capture User-Agent and Referer as light attribution
//   (helps us split landing variants in admin). Both are nullable
//   so privacy-mode browsers still get a 201.

import { Hono } from "hono";
import { z } from "zod";
import { eq, desc, isNull, and, sql } from "drizzle-orm";
import { marketingWaitlist } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const marketingRouter = new Hono<AppEnvironment>();

// ─── Schema ──────────────────────────────────────────────
// Kept permissive on purpose — the public form should
// never bounce a real user. role is constrained to the
// three values the <select> in index.html ships, but a
// future variant of the form can pass something else and
// the API will store it (audited via the admin view).
const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z
    .enum(["patient", "doctor", "hospital"])
    .optional()
    .default("patient"),
  source: z.string().max(64).optional(),
});

// ─── Public POST ─────────────────────────────────────────
marketingRouter.post("/waitlist", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = waitlistSchema.safeParse(body);
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
  const email = data.email;

  // Dedupe: SQLite's unique index on `email` will reject a
  // duplicate. We catch the constraint violation and return
  // 200 "already_on_list" so the public form never errors
  // visibly — the user sees success either way.
  const referer = c.req.header("Referer") || null;
  const ua = c.req.header("User-Agent") || null;

  try {
    const [row] = await c
      .get("db")
      .insert(marketingWaitlist)
      .values({
        email,
        role: data.role || "patient",
        source: data.source || "marketing-site",
        referrer: referer ? referer.slice(0, 512) : null,
        userAgent: ua ? ua.slice(0, 512) : null,
      } as any)
      .returning({ id: marketingWaitlist.id });

    return c.json({ id: row.id, status: "received" }, 201);
  } catch (err: any) {
    // SQLite UNIQUE constraint violation message starts with
    // "UNIQUE constraint failed: marketing_waitlist.email".
    // We don't want to leak driver details so we just match
    // the substring and treat any failure as a duplicate.
    const msg = String(err?.message || err);
    if (msg.includes("UNIQUE") && msg.includes("marketing_waitlist")) {
      const [existing] = await c
        .get("db")
        .select({ id: marketingWaitlist.id })
        .from(marketingWaitlist)
        .where(eq(marketingWaitlist.email, email))
        .limit(1);
      return c.json(
        {
          id: existing?.id ?? null,
          status: "already_on_list",
        },
        200
      );
    }
    console.error("waitlist insert failed:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});

// ─── Admin read ──────────────────────────────────────────
// Super-admin only. Used by the future admin dashboard
// (`/admin/waitlist` page). NOT mounted at /public —
// auth required.
marketingRouter.get(
  "/waitlist",
  authMiddleware,
  requireRole("super_admin"),
  async (c) => {
    const db = c.get("db");
    const status = c.req.query("status"); // "pending" | "invited" | "all" (default)
    const limit = Math.min(parseInt(c.req.query("limit") || "100", 10) || 100, 500);

    // `pending` filters at the DB layer via the index (cheap).
    // `invited` and the default `all` both fall through to the
    // unfiltered scan — still small enough at private-beta scale.
    const rows = await db
      .select()
      .from(marketingWaitlist)
      .where(
        status === "pending"
          ? isNull(marketingWaitlist.invitedAt)
          : status === "invited"
          ? sql`${marketingWaitlist.invitedAt} IS NOT NULL`
          : undefined
      )
      .orderBy(desc(marketingWaitlist.createdAt))
      .limit(limit);

    return c.json({ signups: rows, total: rows.length });
  }
);

export default marketingRouter;
