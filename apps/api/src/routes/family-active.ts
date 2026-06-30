// @ts-nocheck
// Phase 2.3: GET /family/active + PATCH /family/active.
//
// The client uses these to sync its local store (zustand + secureStorage)
// with the server-cached column. Idempotent: setting to null clears
// the column; setting to a valid FM id binds it.
//
// Audit row on every PATCH.

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  familyMembers,
  patients,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// GET /family/active — return { activeId, member } (member is null if
// no active FM or the FM was deleted; client should clear its store).
router.get("/active", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);

  const [u] = await db
    .select({ activeFamilyMemberId: users.activeFamilyMemberId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const activeId = u?.activeFamilyMemberId ?? null;
  if (!activeId) return c.json({ activeId: null, member: null });

  // Verify the FM still exists. Stale → null + clear column.
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ activeId: null, member: null });

  const [fm] = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.id, activeId),
        eq(familyMembers.patientId, patient.id)
      )
    )
    .limit(1);

  if (!fm) {
    // Stale column → clear it.
    await db
      .update(users)
      .set({ activeFamilyMemberId: null } as any)
      .where(eq(users.id, userId));
    return c.json({ activeId: null, member: null });
  }

  return c.json({ activeId: fm.id, member: fm });
});

// PATCH /family/active — set the active FM (or null to clear).
router.patch("/active", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = createDb(c.env.DB);
  const body = await c.req.json().catch(() => ({}));

  const newId: string | null = body.memberId ?? null;

  // Read current value for the audit row.
  const [u] = await db
    .select({ activeFamilyMemberId: users.activeFamilyMemberId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const oldId = u?.activeFamilyMemberId ?? null;

  if (newId) {
    // Verify the FM belongs to this user.
    const patient = await getOwnPatient(db, userId);
    if (!patient) return c.json({ error: "Patient not found" }, 404);

    const [fm] = await db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, newId),
          eq(familyMembers.patientId, patient.id)
        )
      )
      .limit(1);

    if (!fm) {
      return c.json(
        {
          error: "Family member not found or access denied",
        },
        404
      );
    }
  }

  await db
    .update(users)
    .set({ activeFamilyMemberId: newId } as any)
    .where(eq(users.id, userId));

  await writeAudit(db, {
    userId,
    action: "active_member_set",
    details: { from: oldId, to: newId },
  });

  return c.json({ activeId: newId });
});

export default router;