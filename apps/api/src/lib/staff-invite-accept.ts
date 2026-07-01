// @ts-nocheck
// ─── Phase 3.1 slice 3: shared accept helper ───────────────
// Used by both the public POST /staff/invites/:token/accept and the
// inline-consume path at the end of POST /auth/register when the
// caller supplies an invite token. Centralising avoids drift between
// the two consumption paths.
//
// `hospitalStaffInvites` and `hospitalStaff` tables live in
// packages/db/src/schema.ts. Audit trail mirrors
// apps/api/src/routes/family-invites.ts.

import { eq } from "drizzle-orm";
import {
  hospitalStaffInvites,
  hospitalStaff,
} from "@healthcare/db";
import { writeAudit } from "./audit";

export type AcceptResult =
  | { ok: true; alreadyAccepted: boolean; hospitalId: string; role: string }
  | { ok: false; status: 404 | 410 | 500; error: string };

/**
 * Consume a staff-invite token for the given user.
 * Returns a tagged result so callers can decide their own HTTP shape.
 * Never throws.
 */
export async function acceptStaffInvite(
  db: any,
  token: string,
  userId: string
): Promise<AcceptResult> {
  const [row] = await db
    .select()
    .from(hospitalStaffInvites)
    .where(eq(hospitalStaffInvites.token, token))
    .limit(1);

  if (!row) {
    return { ok: false, status: 404, error: "Invite not found" };
  }
  if (row.revoked) {
    return { ok: false, status: 410, error: "Invite revoked" };
  }
  if (row.consumedAt) {
    if (row.consumedByUserId === userId) {
      return {
        ok: true,
        alreadyAccepted: true,
        hospitalId: row.hospitalId,
        role: row.role,
      };
    }
    return { ok: false, status: 410, error: "Invite already consumed" };
  }
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false, status: 410, error: "Invite expired" };
  }

  try {
    const [existingStaff] = await db
      .select()
      .from(hospitalStaff)
      .where(eq(hospitalStaff.userId, userId))
      .limit(1);

    if (existingStaff) {
      await db
        .update(hospitalStaff)
        .set({
          hospitalId: row.hospitalId,
          role: row.role,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          active: true,
        } as any)
        .where(eq(hospitalStaff.id, existingStaff.id));
    } else {
      await db.insert(hospitalStaff).values({
        hospitalId: row.hospitalId,
        userId,
        fullName: row.fullName,
        role: row.role,
        shift: "morning",
        phone: row.phone,
        email: row.email,
        active: true,
      } as any);
    }

    const consumedAt = new Date().toISOString();
    await db
      .update(hospitalStaffInvites)
      .set({ consumedAt, consumedByUserId: userId } as any)
      .where(eq(hospitalStaffInvites.id, row.id));

    await writeAudit(db, {
      userId,
      action: "staff_invite_accepted",
      resource: "hospital_staff_invite",
      resourceId: row.id,
      details: { hospitalId: row.hospitalId, role: row.role },
    });

    return {
      ok: true,
      alreadyAccepted: false,
      hospitalId: row.hospitalId,
      role: row.role,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      error: err?.message || "Failed to accept invite",
    };
  }
}
