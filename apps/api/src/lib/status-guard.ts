// @ts-nocheck
//
// `withStatusGuard` — conditional UPDATE that only fires when the
// row's current status is one of the allowed prior states. The
// canonical pattern for status machines where a double-flip would
// be a bug (sign → two signatures, complete → two revenue events,
// mark-read → lost-update on unread counters).
//
// Uses atomic SQL: `UPDATE … WHERE id = ? AND status IN (…)`. The
// caller treats `changed = false` as a 409 Conflict because another
// in-flight request already moved the row past the expected
// transition.
//
// Example:
//
//   const { changed, row } = await withStatusGuard(
//     db, appointments, existing.id, ['scheduled', 'confirmed'],
//     { status: 'completed', completedAt: sql`CURRENT_TIMESTAMP` }
//   );
//   if (!changed) return c.json({ error: 'Concurrent modification' }, 409);

import { and, eq, inArray, sql } from "drizzle-orm";

export type StatusGuardResult<T = any> = {
  changed: boolean;
  row: T | null;
};

export async function withStatusGuard<T = any>(
  db: any,
  table: any,
  id: string,
  fromStatuses: string[],
  patch: Record<string, any>
): Promise<StatusGuardResult<T>> {
  const setExpr: Record<string, any> = { ...patch };
  setExpr.updatedAt = setExpr.updatedAt ?? sql`CURRENT_TIMESTAMP`;

  // Drizzle's `db.update` with a WHERE that includes an IN clause
  // combined with an equality on id. Returns the row when the
  // conditional matched, NULL otherwise.
  const [row] = await db
    .update(table)
    .set(setExpr)
    .where(and(eq(table.id, id), inArray(table.status, fromStatuses)))
    .returning();

  return { changed: !!row, row: row ?? null };
}

/**
 * Same conditional logic but increments a numeric counter atomically
 * using SQL arithmetic — eliminates the read-modify-write race we
 * had on messages.unread and revenue events. `field` must exist on
 * the table.
 *
 *   await atomicIncrement(db, messagesConversations, conv.id, { doctorUnread: 1 })
 */
export async function atomicIncrement(
  db: any,
  table: any,
  id: string,
  patch: Record<string, any>
): Promise<void> {
  const setExpr: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "number") {
      setExpr[k] = sql`${table[k]} + ${v}`;
    } else {
      setExpr[k] = v;
    }
  }
  await db
    .update(table)
    .set(setExpr)
    .where(eq(table.id, id));
}

/**
 * Insert-or-update helper for the partial-unique `care_team_active_unique`
 * constraint. Attempts INSERT; if it raises a unique-constraint
 * violation, the row is left untouched (the existing active row wins).
 * Returns true when a NEW row was inserted, false when an active row
 * already existed.
 */
export async function upsertActiveCareTeam(
  db: any,
  row: {
    patientId: string;
    doctorId: string;
    role: string;
    scope?: string;
    invitedByUserId?: string;
    consentRecordId?: string | null;
  }
): Promise<{ inserted: boolean; id?: string }> {
  try {
    const [r] = await db
      .insert((await import("@healthcare/db")).careTeamMembers)
      .values({
        patientId: row.patientId,
        doctorId: row.doctorId,
        role: row.role as any,
        scope: (row.scope || "full") as any,
        status: "active",
        invitedByUserId: row.invitedByUserId || null,
        consentRecordId: row.consentRecordId || null,
        acceptedAt: sql`CURRENT_TIMESTAMP`,
      })
      .returning();
    return { inserted: true, id: r?.id };
  } catch (err: any) {
    const m = String(err?.message || "").toLowerCase();
    if (m.includes("unique") || m.includes("constraint")) {
      return { inserted: false };
    }
    throw err;
  }
}
