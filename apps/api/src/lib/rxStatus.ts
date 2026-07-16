// @ts-nocheck
// ─── E-Rx Phase 8: Prescription status state machine ──────────
//
// One source of truth for the prescription lifecycle transitions.
// Every status-changing route (sign, cancel, dispense, edit-draft) MUST
// go through `assertRxTransition` so an impossible move (e.g.
// dispensed → signed) returns a deterministic 409 instead of silently
// succeeding.
//
// Transition map (lifecycle: see apps/api/src/routes/doctor.ts):
//
//   draft     → signed (sign), cancelled (cancel/discard)
//   signed    → cancelled (cancel), dispensed (dispense)
//   cancelled → ∅
//   dispensed → ∅
//
// The map mirrors the audit actions written by each route:
//   prescription.signed       (signature.ts POST /sign)
//   prescription.cancelled    (doctor.ts POST /:id/cancel)
//   prescription.dispensed    (doctor.ts POST /:id/dispense)
//   prescription.edited       (doctor.ts PATCH /:id)
//   prescription.create_with_warnings  (doctor.ts POST / create)

import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { withStatusGuard } from "./status-guard";
import { audit } from "./audit";

/**
 * Allowed transitions. Each key is the *current* status, the value
 * is the set of statuses it may move to.
 */
export const RX_TRANSITIONS: Record<string, string[]> = {
  draft: ["signed", "cancelled"],
  signed: ["cancelled", "dispensed"],
  cancelled: [],
  dispensed: [],
};

/**
 * Throws a typed `RxTransitionError` if `from → to` is not in
 * RX_TRANSITIONS. Use it as a guard before mutating rows.
 */
export class RxTransitionError extends Error {
  from: string;
  to: string;
  constructor(from: string, to: string) {
    super(`Illegal prescription transition: ${from} → ${to}`);
    this.name = "RxTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function assertRxTransition(from: string, to: string): void {
  const allowed = RX_TRANSITIONS[from];
  if (!allowed) {
    throw new RxTransitionError(from, to);
  }
  if (!allowed.includes(to)) {
    throw new RxTransitionError(from, to);
  }
}

/**
 * Atomic status flip + audit row. The status guard ensures concurrent
 * requests can't double-flip; the audit insert captures the actor +
 * details for compliance.
 *
 * Returns the updated row, or `null` if the guard did not match (i.e.
 * another in-flight request already moved past the expected prior
 * state). Caller should respond 409 in that case.
 */
export async function applyRxTransition(opts: {
  db: any;
  table: any;
  id: string;
  from: string;
  to: string;
  patch?: Record<string, any>;
  actorId?: string | null;
  action: string; // e.g. "prescription.cancelled"
  details?: Record<string, any> | null;
}) {
  const { db, table, id, from, to, patch = {}, actorId, action, details } =
    opts;
  assertRxTransition(from, to);

  const guard = await withStatusGuard(db, table, id, [from], {
    status: to,
    ...patch,
  });
  if (!guard.changed) {
    return null;
  }

  await audit(db, {
    userId: actorId,
    action,
    resource: "prescription",
    resourceId: id,
    details: details ?? { from, to },
  });

  return guard.row;
}

/**
 * Same atomic-flip + audit pair as `applyRxTransition`, but extends
 * the WHERE clause with token-binding guards. Used by the pharmacy
 * (and doctor-side legacy) dispense route to satisfy one-time-use
 * redemption: the UPDATE only fires when the row is in `from`-state,
 * the supplied `dispense_token` matches, AND the row has not yet been
 * consumed. A second caller fails the WHERE, the helper returns null,
 * and the route translates that into 409 `token_consumed`.
 *
 * Extra `patch` fields beyond `status` (e.g. `dispensed_at`,
 * `dispense_token_consumed_at`, `dispensed_by_user_id`) live in
 * `patch` and are written on success.
 *
 * The `tokenColumns` map gives the helper the resolved column objects
 * (not strings) so it can compose type-safe `eq`/`isNull` predicates
 * on the same table passed to `applyRxTransition`.
 */
export async function consumeDispenseTokenAndTransition(opts: {
  db: any;
  table: any;
  id: string;
  token: string;
  from: string;
  to: string;
  patch?: Record<string, any>;
  actorId?: string | null;
  action: string;
  details?: Record<string, any> | null;
  tokenColumns: {
    dispenseToken: any;
    dispenseTokenConsumedAt: any;
  };
}) {
  const {
    db,
    table,
    id,
    token,
    from,
    to,
    patch = {},
    actorId,
    action,
    details,
    tokenColumns,
  } = opts;

  assertRxTransition(from, to);

  const setExpr: Record<string, any> = {
    status: to,
    ...patch,
    updatedAt: sql`CURRENT_TIMESTAMP`,
  };

  const [row] = await db
    .update(table)
    .set(setExpr)
    .where(
      and(
        eq(table.id, id),
        inArray(table.status, [from]),
        eq(tokenColumns.dispenseToken, token),
        isNull(tokenColumns.dispenseTokenConsumedAt)
      )
    )
    .returning();

  if (!row) {
    return null;
  }

  await audit(db, {
    userId: actorId,
    action,
    resource: "prescription",
    resourceId: id,
    details: details ?? { from, to },
  });

  return row;
}
