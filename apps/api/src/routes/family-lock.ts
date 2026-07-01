// @ts-nocheck
// Phase 2.3.3: family-member privacy lock toggle.
//
// Routes:
//   PATCH /family/members/:id/lock   body: { locked: true | false }
//   GET   /family/members/locks       list every locked FM owned by the
//                                     principal — useful for the family
//                                     screen badge + audit.
//
// Semantics
// ---------
// - Only the principal (owner of the FM) may flip the switch.
// - On lock=true:   set isLocked, lockedBy = requesting user, lockedAt = now.
// - On lock=false:  clear isLocked, lockedBy, lockedAt. Audit records both
//                   transitions so we can replay the lock history.
// - Self-locking: if the FM `id` matches the requesting user's own
//   activeFamilyMemberId AND that user is the principal, they can lock
//   themselves too. Useful when an adult child wants to hide their own
//   records from the parent's family view.
//
// Audit:
//   family_member_locked
//   family_member_unlocked
//
// Privacy enforcement lives in `apps/api/src/lib/family-lock.ts` —
// `redactLockedRecords` is the canonical way to strip content fields
// when listing records tagged to a locked FM.

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { familyMembers, patients } from "@healthcare/db";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const lockRouter = new Hono<AppEnvironment>();

const lockSchema = z.object({
  locked: z.boolean(),
});

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

async function findOwnedFm(db: any, fmId: string, patientId: string) {
  const [fm] = await db
    .select()
    .from(familyMembers)
    .where(
      and(eq(familyMembers.id, fmId), eq(familyMembers.patientId, patientId)),
    )
    .limit(1);
  return fm || null;
}

// ─── PATCH /family/members/:id/lock ───────────────────────
lockRouter.patch("/members/:id/lock", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const fmId = c.req.param("id");
  if (!fmId) return c.json({ error: "Missing family member id" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = lockSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400,
    );
  }
  const { locked } = parsed.data;

  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const fm = await findOwnedFm(db, fmId, patient.id);
  if (!fm) {
    return c.json({ error: "Family member not found or access denied" }, 404);
  }

  // Deceased members are never re-locked — the principal can't see their
  // records anyway (the deceased badge gates the family view).
  if (locked && fm.isDeceased) {
    return c.json(
      { error: "Cannot lock a deceased family member" },
      400,
    );
  }

  // No-op when the requested state matches current state — keep the
  // response uniform but skip the audit row so the log stays clean.
  if (!!fm.isLocked === locked) {
    return c.json({
      ok: true,
      memberId: fm.id,
      locked,
      changed: false,
    });
  }

  if (locked) {
    await db
      .update(familyMembers)
      .set({
        isLocked: true,
        lockedBy: userId,
        lockedAt: new Date().toISOString(),
      } as any)
      .where(eq(familyMembers.id, fm.id));
    await writeAudit(db, {
      userId,
      action: "family_member_locked",
      resource: "family_member",
      resourceId: fm.id,
      details: { name: fm.name, relationship: fm.relationship },
    });
  } else {
    await db
      .update(familyMembers)
      .set({
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
      } as any)
      .where(eq(familyMembers.id, fm.id));
    await writeAudit(db, {
      userId,
      action: "family_member_unlocked",
      resource: "family_member",
      resourceId: fm.id,
      details: { name: fm.name, relationship: fm.relationship },
    });
  }

  return c.json({
    ok: true,
    memberId: fm.id,
    locked,
    changed: true,
  });
});

// ─── GET /family/members/locks ────────────────────────────
// Cheap batch read used by the family screen to render the locked
// badge without N+1 lookups. Returns just the ids + names of locked
// members; the family screen already has the full list, but the
// badge styling needs the live state (e.g. unlocked-by-other-tab).
lockRouter.get("/members/locks", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ locks: [] });

  const rows = await db
    .select({
      id: familyMembers.id,
      name: familyMembers.name,
      lockedAt: familyMembers.lockedAt,
    })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.patientId, patient.id),
        eq(familyMembers.isLocked, true),
      ),
    )
    .all();

  return c.json({ locks: rows });
});

export default lockRouter;