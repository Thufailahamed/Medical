// @ts-nocheck
//
// Caretaker Profiles: admin verification queue.
//
// Super-admin endpoints for reviewing and acting on caretaker
// identity-verification requests. All mutations require a fresh
// passkey session (requirePasskeyFresh) — matches the existing
// /admin/approvals step-up pattern.
//
// Routes:
//   GET    /admin/caretaker-verifications               list (filter ?status)
//   POST   /admin/caretaker-verifications/:id/approve   flip users.verified=true
//   POST   /admin/caretaker-verifications/:id/reject    record rejection note
//   POST   /admin/caretaker-verifications/:userId/revoke  flip users.verified=false
//
// Audit actions:
//   caretaker_verification_approved
//   caretaker_verification_rejected
//   caretaker_verification_revoked

import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  caretakerVerifications,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import { requirePasskeyFresh } from "../middleware/stepup";
import { notify } from "../lib/notifications";
import type { AppEnvironment } from "../types";

const adminCaretakerVerificationsRouter = new Hono<AppEnvironment>();

// All routes below require super_admin + aud='admin'. Passkey gate
// lives on individual mutations (reads are cheap, approvals are not).
adminCaretakerVerificationsRouter.use("*", authMiddleware, requireAdmin);

const decisionSchema = z.object({
  reason: z.string().min(1).max(500),
});

// ─── List verification requests ───────────────────────────
//
// Default = pending only (the queue). Pass ?status=approved|rejected
// to inspect history. Joins users for caretaker name/photo/email.
adminCaretakerVerificationsRouter.get("/", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");

  const allowed = ["pending", "approved", "rejected", "superseded"];
  if (status && !allowed.includes(status)) {
    return c.json({ error: `status must be one of: ${allowed.join(", ")}` }, 400);
  }

  const where = status
    ? eq(caretakerVerifications.status, status as any)
    : eq(caretakerVerifications.status, "pending");

  const rows = await db
    .select({
      id: caretakerVerifications.id,
      caretakerUserId: caretakerVerifications.caretakerUserId,
      documentType: caretakerVerifications.documentType,
      documentFileId: caretakerVerifications.documentFileId,
      status: caretakerVerifications.status,
      submittedAt: caretakerVerifications.submittedAt,
      decidedAt: caretakerVerifications.decidedAt,
      decisionNote: caretakerVerifications.decisionNote,
      revokedAt: caretakerVerifications.revokedAt,
      revokedReason: caretakerVerifications.revokedReason,
      caretakerName: users.name,
      caretakerEmail: users.email,
      caretakerPhoto: users.photo,
      caretakerVerified: users.verified,
    })
    .from(caretakerVerifications)
    .innerJoin(users, eq(users.id, caretakerVerifications.caretakerUserId))
    .where(where)
    .orderBy(desc(caretakerVerifications.submittedAt));

  return c.json({ verifications: rows });
});

// ─── Approve a pending request ────────────────────────────
//
// Sets verification row to approved + flips users.verified=true. The
// verified flag is the single source of truth — UI badges derive from
// it. notify() pushes a confirmation to the caretaker.
adminCaretakerVerificationsRouter.post(
  "/:id/approve",
  requirePasskeyFresh,
  async (c) => {
    const id = c.req.param("id");
    const db = c.get("db");

    const [existing] = await db
      .select()
      .from(caretakerVerifications)
      .where(eq(caretakerVerifications.id, id))
      .limit(1);
    if (!existing) {
      return c.json({ error: "Verification request not found" }, 404);
    }
    if (existing.status !== "pending") {
      return c.json(
        {
          error: `Request is ${existing.status}, not pending`,
          code: "not_pending",
        },
        409
      );
    }

    const actor = c.get("adminActor");
    const now = new Date().toISOString();

    await db
      .update(caretakerVerifications)
      .set({
        status: "approved",
        decidedAt: now,
        decidedByUserId: actor?.id ?? null,
        decisionNote: null,
      } as any)
      .where(eq(caretakerVerifications.id, id));

    await db
      .update(users)
      .set({ verified: true } as any)
      .where(eq(users.id, existing.caretakerUserId));

    await recordAdminAction(c, {
      action: "caretaker_verification_approved",
      resource: "caretaker_verification",
      resourceId: id,
      details: { caretakerUserId: existing.caretakerUserId },
    });

    await notify({
      db,
      userId: existing.caretakerUserId,
      type: "general",
      title: "Your identity is verified",
      body: "Your caretaker profile now shows a verified badge to the people you help.",
      data: { verificationId: id },
    });

    return c.json({ ok: true, verificationId: id });
  }
);

// ─── Reject a pending request ─────────────────────────────
//
// Records the decision with a required reason. Does NOT touch
// users.verified — rejection leaves the caretaker at the default
// unverified state, ready to re-submit with corrected documents.
adminCaretakerVerificationsRouter.post(
  "/:id/reject",
  requirePasskeyFresh,
  async (c) => {
    const id = c.req.param("id");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const [existing] = await db
      .select()
      .from(caretakerVerifications)
      .where(eq(caretakerVerifications.id, id))
      .limit(1);
    if (!existing) {
      return c.json({ error: "Verification request not found" }, 404);
    }
    if (existing.status !== "pending") {
      return c.json(
        {
          error: `Request is ${existing.status}, not pending`,
          code: "not_pending",
        },
        409
      );
    }

    const actor = c.get("adminActor");
    const now = new Date().toISOString();

    await db
      .update(caretakerVerifications)
      .set({
        status: "rejected",
        decidedAt: now,
        decidedByUserId: actor?.id ?? null,
        decisionNote: parsed.data.reason,
      } as any)
      .where(eq(caretakerVerifications.id, id));

    await recordAdminAction(c, {
      action: "caretaker_verification_rejected",
      resource: "caretaker_verification",
      resourceId: id,
      details: {
        caretakerUserId: existing.caretakerUserId,
        reason: parsed.data.reason,
      },
    });

    await notify({
      db,
      userId: existing.caretakerUserId,
      type: "general",
      title: "Verification not approved",
      body: `Reason: ${parsed.data.reason}`,
      data: { verificationId: id },
    });

    return c.json({ ok: true, verificationId: id });
  }
);

// ─── Revoke verification on an already-verified caretaker ──
//
// Flips users.verified=false and records the revocation on the latest
// approved row. Distinct from rejection (which targets pending) —
// revocation applies to a caretaker who was previously approved and
// lost that trust. Caretaker can re-submit afterwards.
adminCaretakerVerificationsRouter.post(
  "/:userId/revoke",
  requirePasskeyFresh,
  async (c) => {
    const userId = c.req.param("userId");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const [self] = await db
      .select({ id: users.id, verified: users.verified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!self) return c.json({ error: "User not found" }, 404);
    if (!self.verified) {
      return c.json(
        {
          error: "User is not currently verified — nothing to revoke",
          code: "not_verified",
        },
        409
      );
    }

    const actor = c.get("adminActor");
    const now = new Date().toISOString();

    // Find the latest approved row to stamp the revocation fields on.
    const [latestApproved] = await db
      .select({ id: caretakerVerifications.id })
      .from(caretakerVerifications)
      .where(
        and(
          eq(caretakerVerifications.caretakerUserId, userId),
          eq(caretakerVerifications.status, "approved")
        )
      )
      .orderBy(desc(caretakerVerifications.decidedAt))
      .limit(1);

    if (latestApproved) {
      await db
        .update(caretakerVerifications)
        .set({
          revokedAt: now,
          revokedByUserId: actor?.id ?? null,
          revokedReason: parsed.data.reason,
        } as any)
        .where(eq(caretakerVerifications.id, latestApproved.id));
    }

    await db
      .update(users)
      .set({ verified: false } as any)
      .where(eq(users.id, userId));

    await recordAdminAction(c, {
      action: "caretaker_verification_revoked",
      resource: "user",
      resourceId: userId,
      details: { reason: parsed.data.reason },
    });

    await notify({
      db,
      userId,
      type: "general",
      title: "Your verified status was revoked",
      body: `Reason: ${parsed.data.reason}. You can re-apply with new documents.`,
      data: null,
    });

    return c.json({ ok: true, userId });
  }
);

export default adminCaretakerVerificationsRouter;