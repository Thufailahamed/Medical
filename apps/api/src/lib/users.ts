// @ts-nocheck
// Phase 1.4: shared patient lookup helpers. Consolidates the 4 inline
// `select … from patients where eq(userId, x)` duplicates that previously
// lived in medical-records.ts:41-48, files.ts:26-33, health-summary.ts:20,
// share.ts:40, export.ts:27. New routes should use these helpers.

import { eq } from "drizzle-orm";
import { patients } from "@healthcare/db";
import type { createDb } from "./db";

export type DB = ReturnType<typeof createDb>;

/**
 * Fetch the patient row owned by `userId`. Returns the raw row (Drizzle
 * inferred type) or `null` if the user has no patient profile.
 *
 * The shape returned by Drizzle has both the `patients.*` columns AND
 * when joined, the `users.*` columns prefixed under `patients.users`
 * (relational query API). Callers that need fields from `users` should
 * join via `findPatientWithUser`.
 */
export async function getOwnPatient(db: DB, userId: string) {
  const [row] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Identical to `getOwnPatient` but returns `null` if there's no row.
 * Keeps existing call-sites that did `if (!patient) return ...` happy
 * without a `?.id` chain.
 */
export async function getOwnPatientId(
  db: DB,
  userId: string
): Promise<string | null> {
  const row = await getOwnPatient(db, userId);
  return row?.id ?? null;
}
