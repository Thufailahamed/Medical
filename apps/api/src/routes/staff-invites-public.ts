// @ts-nocheck
// ─── Phase 3.1 slice 3: public staff-invite endpoints ──────
// Two endpoints mounted on the public app router (no auth middleware):
//   GET  /staff/invites/:token           → safe preview
//   POST /staff/invites/:token/accept    → consume the token (auth req)
//
// The accept logic lives in apps/api/src/lib/staff-invite-accept.ts
// so the inline-consume path at the end of POST /auth/register can
// share it. Mirrors the family-invite pattern at
// apps/api/src/routes/family-invites.ts:193-245 (preview).

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { hospitalStaffInvites, hospitals } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { acceptStaffInvite } from "../lib/staff-invite-accept";
import type { AppEnvironment } from "../types";

const staffInviteRouter = new Hono<AppEnvironment>();

// ─── Public preview ───────────────────────────────────────
staffInviteRouter.get("/staff/invites/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");

  const [row] = await db
    .select()
    .from(hospitalStaffInvites)
    .innerJoin(hospitals, eq(hospitals.id, hospitalStaffInvites.hospitalId))
    .where(eq(hospitalStaffInvites.token, token))
    .limit(1);

  if (!row) {
    return c.json({ error: "Invite not found" }, 404);
  }
  // row shape: { hospital_staff_invites: {...}, hospitals: {...} }
  const invite: any = row.hospital_staff_invites;
  const hospital: any = row.hospitals;

  if (invite.revoked) {
    return c.json({ error: "Invite revoked" }, 410);
  }
  if (invite.consumedAt) {
    return c.json({ error: "Invite already consumed" }, 410);
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return c.json({ error: "Invite expired" }, 410);
  }

  await writeAudit(db, {
    userId: null,
    action: "staff_invite_viewed",
    resource: "hospital_staff_invite",
    resourceId: invite.id,
    details: {
      ip:
        c.req.header("cf-connecting-ip") ||
        c.req.header("x-forwarded-for") ||
        null,
      ua: c.req.header("user-agent") || null,
    },
  });

  return c.json({
    role: invite.role,
    fullName: invite.fullName,
    email: invite.email,
    hospitalName: hospital.name,
    hospitalId: hospital.id,
    expiresAt: invite.expiresAt,
  });
});

// ─── Accept (auth required, role=hospital_staff) ──────────
staffInviteRouter.post(
  "/staff/invites/:token/accept",
  authMiddleware,
  requireRole("hospital_staff"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const token = c.req.param("token");

    const result = await acceptStaffInvite(db, token, userId);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }

    // Notify the inviter (admin) that their invite was claimed.
    try {
      const { notify } = await import("../lib/notifications");
      const [inviteRow] = await db
        .select()
        .from(hospitalStaffInvites)
        .where(eq(hospitalStaffInvites.token, token))
        .limit(1);
      if (inviteRow?.createdByUserId) {
        await notify(db, {
          userId: inviteRow.createdByUserId,
          type: "general",
          title: "Staff invite accepted",
          body: `${inviteRow.fullName} accepted their invite.`,
          data: { inviteId: inviteRow.id },
        });
      }
    } catch {
      // Non-fatal: notification failure shouldn't block the accept.
    }

    return c.json({
      hospitalId: result.hospitalId,
      role: result.role,
      alreadyAccepted: result.alreadyAccepted,
    });
  }
);

export default staffInviteRouter;
