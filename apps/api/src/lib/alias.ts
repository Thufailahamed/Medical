// @ts-nocheck
// Phase 1.4: alias generation + lookup helpers for email-to-record
// ingestion. Used by:
//   - routes/auth.ts (eager provisioning on user create)
//   - routes/email.ts (read / rotate)
//   - email/inbound.ts (resolve To/From → patient)

import { eq } from "drizzle-orm";
import { users, patients } from "@healthcare/db";

/**
 * Generate a fresh 8-hex alias like `u_a1b2c3d4`. 32 bits of entropy
 * gives ~0.023 collision probability across 10k users — vanishingly
 * rare. The migration's UNIQUE index + suffix-retry loop catches the
 * remaining edge case.
 */
export function generateAlias(): string {
  // crypto.getRandomValues is available in Cloudflare Workers + Node 19+.
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `u_${hex}`;
}

/**
 * Compose the full email address users see. `EMAIL_ALIAS_DOMAIN` is a
 * required Worker binding (see apps/api/wrangler.toml).
 */
export function aliasAddress(alias: string, domain: string): string {
  return `${alias}@${domain}`;
}

/**
 * Find a user by their personal inbox alias. Returns the user row + the
 * patient's `id` (joined via the `patients` table). Null if no match.
 *
 * Used by the email handler — runs on every inbound. Indexed lookup
 * via the `users_email_alias_unique` index.
 */
export async function findUserByAlias(db: any, alias: string) {
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      phone: users.phone,
      name: users.name,
      patientId: patients.id,
    })
    .from(users)
    .leftJoin(patients, eq(patients.userId, users.id))
    .where(eq(users.emailAlias, alias))
    .limit(1);
  return row?.patientId
    ? { userId: row.userId, email: row.email, patientId: row.patientId }
    : null;
}

/**
 * Find a user (and their patient row) by the From address of an inbound
 * email. Used for the legacy path: any user can mail themselves
 * without remembering the alias, as long as they send from the address
 * they have registered. Equality match is strict (case-insensitive on
 * LHS lowered + trimmed).
 */
export async function findUserByEmail(db: any, email: string) {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      phone: users.phone,
      name: users.name,
      patientId: patients.id,
      emailAlias: users.emailAlias,
    })
    .from(users)
    .leftJoin(patients, eq(patients.userId, users.id))
    .where(eq(users.email, normalised))
    .limit(1);
  return row?.patientId
    ? {
        userId: row.userId,
        email: row.email,
        patientId: row.patientId,
        emailAlias: row.emailAlias,
      }
    : null;
}
