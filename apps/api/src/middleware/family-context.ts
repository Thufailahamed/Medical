// @ts-nocheck
// Phase 2.3: family-context middleware. Runs AFTER authMiddleware.
//
// Reads `x-active-family-member-id` from the request header. If set,
// verifies the FM belongs to the requesting user (via family_members
// row joined to their patient). On valid → sets `c.get("activeFamilyMemberId")`.
// On invalid (deleted, not theirs) → 410 Gone + `{ reason: "family_member_gone" }`
// so the client clears its store.
//
// If the header is absent, falls back to `users.activeFamilyMemberId`
// column (durable cross-device state). The header, when present, wins —
// the client knows more than the server column.

import { and, eq } from "drizzle-orm";
import { familyMembers, patients, users } from "@healthcare/db";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

declare module "hono" {
  interface ContextVariableMap {
    activeFamilyMemberId?: string | null;
  }
}

export const familyContextMiddleware = async (
  c: any,
  next: any
): Promise<any> => {
  const userId = c.get("userId");
  if (!userId) return next(); // unauthenticated — let auth handle it

  const db = createDb(c.env.DB);
  const headerId = c.req.header("x-active-family-member-id") || null;
  let activeId: string | null = null;

  if (headerId) {
    // Two-query ownership check: cheaper than a subquery in D1.
    // 1) Resolve the principal patient for this user.
    // 2) Look up the FM by id scoped to that patient.
    const [own] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (own) {
      const [ownFm] = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .where(
          and(eq(familyMembers.id, headerId), eq(familyMembers.patientId, own.id))
        )
        .limit(1);
      if (ownFm) activeId = headerId;
    }

    if (!activeId) {
      return c.json(
        {
          error: "Active family member is no longer available",
          reason: "family_member_gone",
        },
        410
      );
    }
  } else {
    // Fall back to server column.
    const dbUser = c.get("dbUser");
    activeId = dbUser?.activeFamilyMemberId ?? null;
  }

  c.set("activeFamilyMemberId", activeId);
  return next();
};