// @ts-nocheck
//
// Caretaker Profiles: Verified Caretaker Tier.
//
// Caretaker-side endpoints for the identity-verification flow. The
// caretaker uploads an ID document via the existing /files/upload, gets
// a fileId, and posts here to open a verification request. Admins
// review and either approve (flips users.verified=true) or reject
// (records a decision note, no flip).
//
// Re-requesting while a request is pending marks the older row as
// 'superseded' so we keep history without letting duplicates pile up.
//
// Routes:
//   POST   /caretaker/verification/request   create / supersede previous
//   GET    /caretaker/verification/me        read latest + users.verified
//   DELETE /caretaker/verification/me        cancel a pending request
//
// Audit actions (recorded from the admin side):
//   caretaker_verification_approved
//   caretaker_verification_rejected
//   caretaker_verification_revoked

import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  caretakerVerifications,
  users,
  files,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { notify } from "../lib/notifications";
import type { AppEnvironment } from "../types";

const caretakerVerificationsRouter = new Hono<AppEnvironment>();

const requestSchema = z.object({
  documentType: z.enum(["nic", "passport", "drivers_license", "other"]),
  documentFileId: z.string().min(1).max(200),
});

// ─── Submit a verification request ─────────────────────────
//
// Validates that the uploaded file belongs to the caller, refuses
// when the caller is already verified, and supersedes any older
// pending row so admins only see the most recent.
caretakerVerificationsRouter.post(
  "/request",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    // Already verified → refuse. Admin must revoke first.
    const [self] = await db
      .select({ verified: users.verified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (self?.verified) {
      return c.json(
        {
          error: "Already verified — admin must revoke before resubmitting",
          code: "already_verified",
        },
        409
      );
    }

    // File ownership check — caretakers can only submit files they
    // uploaded themselves. The /files route doesn't own this invariant
    // (it's role-agnostic), so we enforce it here by parsing the
    // R2 key path `medical/<userId>/...`.
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, parsed.data.documentFileId))
      .limit(1);
    if (!file) {
      return c.json({ error: "Document file not found" }, 404);
    }
    const keyUserId = String((file as any).r2Key ?? "").split("/")[1];
    if (keyUserId !== userId) {
      return c.json({ error: "Document file does not belong to caller" }, 403);
    }

    // Supersede any existing pending row before inserting the new one.
    const existingPending = await db
      .select({ id: caretakerVerifications.id })
      .from(caretakerVerifications)
      .where(
        and(
          eq(caretakerVerifications.caretakerUserId, userId),
          eq(caretakerVerifications.status, "pending")
        )
      );
    if (existingPending.length) {
      await db
        .update(caretakerVerifications)
        .set({ status: "superseded" } as any)
        .where(
          and(
            eq(caretakerVerifications.caretakerUserId, userId),
            eq(caretakerVerifications.status, "pending")
          )
        );
    }

    const id = crypto.randomUUID();
    await db.insert(caretakerVerifications).values({
      id,
      caretakerUserId: userId,
      documentType: parsed.data.documentType,
      documentFileId: parsed.data.documentFileId,
      status: "pending",
    } as any);

    await writeAudit(db, {
      userId,
      action: "caretaker_verification_requested",
      resource: "caretaker_verification",
      resourceId: id,
    });

    // Notify all super_admins — admins read this in the verification
    // queue. Fan-out runs per-admin so each can decide independently.
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "super_admin"));
    for (const a of admins) {
      await notify({
        db,
        userId: a.id,
        type: "general",
        title: "Caretaker verification request",
        body: "A caretaker submitted identity documents for review.",
        data: { verificationId: id },
      });
    }

    return c.json(
      {
        verification: {
          id,
          status: "pending",
          documentType: parsed.data.documentType,
          submittedAt: new Date().toISOString(),
        },
      },
      201
    );
  }
);

// ─── Read my own verification status ───────────────────────
//
// Returns the most recent verification row regardless of status so
// the UI can show "pending review" / "rejected — reason: …" /
// "approved". `verified` reflects the live users.verified boolean.
caretakerVerificationsRouter.get(
  "/me",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const [latest] = await db
      .select()
      .from(caretakerVerifications)
      .where(eq(caretakerVerifications.caretakerUserId, userId))
      .orderBy(desc(caretakerVerifications.submittedAt))
      .limit(1);

    const [self] = await db
      .select({ verified: users.verified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return c.json({
      verified: !!(self as any)?.verified,
      verification: latest
        ? {
            id: latest.id,
            status: latest.status,
            documentType: latest.documentType,
            submittedAt: latest.submittedAt,
            decidedAt: latest.decidedAt ?? null,
            decisionNote: latest.decisionNote ?? null,
          }
        : null,
    });
  }
);

// ─── Cancel a pending request ──────────────────────────────
//
// Caretaker self-service: marks the pending row as 'superseded'. No
// notification — admin queue just clears it on next refresh.
caretakerVerificationsRouter.delete(
  "/me",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    await db
      .update(caretakerVerifications)
      .set({ status: "superseded" } as any)
      .where(
        and(
          eq(caretakerVerifications.caretakerUserId, userId),
          eq(caretakerVerifications.status, "pending")
        )
      );

    await writeAudit(db, {
      userId,
      action: "caretaker_verification_cancelled",
      resource: "caretaker_verification",
      resourceId: null,
    });

    return c.json({ ok: true });
  }
);

export default caretakerVerificationsRouter;
