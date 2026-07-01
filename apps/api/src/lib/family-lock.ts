// @ts-nocheck
// Phase 2.3.3: family-member privacy lock helpers.
//
// Why this exists
// ---------------
// A principal can mark a family member "locked" so their records don't
// appear in the principal's family view. The lock is a privacy toggle
// from the *principal's* perspective; the locked member themselves —
// if they hold their own account — still sees everything when they
// switch into their own FM context.
//
// What this module gives the rest of the app
// ------------------------------------------
// - `redactLockedRecords` — takes a list of records (each with a
//   `familyMemberId`) and replaces content fields with a placeholder
//   when the FM is locked and owned by the requesting principal. Used
//   by list endpoints so the payload shape stays uniform.
//
// - `isLockedFm` — single-row helper used when a route receives an
//   explicit `familyMemberId` query parameter (e.g. GET
//   /medical-records?familyMemberId=xxx).
//
// Enforcement is intentionally narrow in Phase 2.3.3: medical-records
// timeline only. Other resources (vaccinations, medicines, vitals,
// doses) follow the same pattern — apply `redactLockedRecords` to
// their list handlers when their queries fan out across FMs.

import { and, eq, inArray } from "drizzle-orm";
import { familyMembers } from "@healthcare/db";

export const LOCKED_PLACEHOLDER_TITLE = "[locked]";
export const LOCKED_PLACEHOLDER_BODY =
  "Records hidden by family privacy lock.";

/**
 * Find all locked family members owned by `principalPatientId`.
 * Returns a Set of FM ids. Empty if no locks — fast-path the redaction.
 */
export async function lockedFmIdsForPrincipal(
  db: any,
  principalPatientId: string,
): Promise<Set<string>> {
  if (!principalPatientId) return new Set();
  const rows = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.patientId, principalPatientId),
        eq(familyMembers.isLocked, true),
      ),
    )
    .all();
  return new Set(rows.map((r: any) => r.id));
}

interface RedactOptions {
  /** Title field on each record. Defaults to "title". */
  titleField?: string;
  /** Fields to scrub when the FM is locked. */
  scrubFields?: string[];
}

/**
 * Redact records belonging to locked family members. Records tagged to
 * the principal themselves (familyMemberId === null) are passed
 * through untouched. Returns a new array — never mutates the input.
 */
export function redactLockedRecords<T extends Record<string, any>>(
  records: T[],
  lockedIds: Set<string>,
  opts: RedactOptions = {},
): T[] {
  if (lockedIds.size === 0 || records.length === 0) return records;
  const titleField = opts.titleField ?? "title";
  const scrubFields = opts.scrubFields ?? [
    "diagnosis",
    "summary",
    "notes",
    "extractedData",
    "tags",
  ];
  return records.map((r) => {
    if (!r.familyMemberId) return r;
    if (!lockedIds.has(r.familyMemberId)) return r;
    const out: Record<string, any> = { ...r };
    out[titleField] = LOCKED_PLACEHOLDER_TITLE;
    for (const f of scrubFields) {
      if (f in out) out[f] = null;
    }
    out.locked = true;
    return out as T;
  });
}

/**
 * Single-FM lookup. Use when a caller passed an explicit
 * `familyMemberId` filter and we need to know whether to gate the
 * query.
 */
export async function isLockedFm(
  db: any,
  fmId: string,
  principalPatientId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.id, fmId),
        eq(familyMembers.patientId, principalPatientId),
        eq(familyMembers.isLocked, true),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Batched lookup: returns a Set of FM ids that ARE locked for the
 * principal, intersected with the provided candidate set. Used when
 * the caller already has a list of FM ids (e.g. `familyMemberId IN
 * (...)`) and just needs to know which to redact.
 */
export async function filterLockedFromCandidates(
  db: any,
  candidateFmIds: string[],
  principalPatientId: string,
): Promise<Set<string>> {
  if (!candidateFmIds.length || !principalPatientId) return new Set();
  const rows = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.patientId, principalPatientId),
        eq(familyMembers.isLocked, true),
        inArray(familyMembers.id, candidateFmIds),
      ),
    )
    .all();
  return new Set(rows.map((r: any) => r.id));
}