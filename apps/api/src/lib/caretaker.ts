// @ts-nocheck
// Caretaker Profiles: shared helpers for the patient_links + caretaker_invites
// domain. Mirrors apps/api/src/lib/access.ts shape so the routes stay thin.

import { and, eq } from "drizzle-orm";
import { patientLinks, users, patients } from "@healthcare/db";

/**
 * Resolve the patient row the current request is operating on.
 *
 * For role='patient' → the patient's own row.
 * For role='caretaker' → the active principal (resolved by the
 *   caretaker-context middleware; falls back to the durable column).
 *
 * Returns null when:
 *   - patient has no patients row (legacy / data drift)
 *   - caretaker has no active principal (caller should pick one first
 *     via PATCH /caretaker/me/active-principal)
 */
export async function resolvePatientContext(c: any) {
  const db = c.get("db");
  const dbUser = c.get("dbUser");
  const userId = c.get("userId");
  if (!userId) return null;
  const role = dbUser?.role;

  if (role === "caretaker") {
    const activeId =
      (c.get("activePrincipalPatientId") as string | null) ||
      dbUser?.activePrincipalPatientId ||
      null;
    if (!activeId) return null;
    const [p] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, activeId))
      .limit(1);
    return p || null;
  }

  // Default: own patient row.
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

/** Resolve a single active link, or null. */
export async function resolveCaretakerLink(
  db: any,
  caretakerUserId: string,
  principalPatientId: string
) {
  const [link] = await db
    .select()
    .from(patientLinks)
    .where(
      and(
        eq(patientLinks.caretakerUserId, caretakerUserId),
        eq(patientLinks.principalPatientId, principalPatientId),
        eq(patientLinks.status, "active")
      )
    )
    .limit(1);
  return link || null;
}

/** List every active principal this caretaker is linked to (with the
 *  principal's user-row metadata). */
export async function accessiblePrincipalsFor(
  db: any,
  caretakerUserId: string
) {
  // Two-step: load principal rows, then map the caretaker's own
  // verified state on top. Cleaner than a self-join that Drizzle's
  // mock parser doesn't roundtrip well.
  const rows = await db
    .select({
      linkId: patientLinks.id,
      principalPatientId: patientLinks.principalPatientId,
      careRole: patientLinks.careRole,
      status: patientLinks.status,
      acceptedAt: patientLinks.acceptedAt,
      invitedAt: patientLinks.invitedAt,
      principalUserId: patients.userId,
      principalName: users.name,
      principalPhoto: users.photo,
      principalPhone: users.phone,
    })
    .from(patientLinks)
    .innerJoin(patients, eq(patients.id, patientLinks.principalPatientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(
      and(
        eq(patientLinks.caretakerUserId, caretakerUserId),
        eq(patientLinks.status, "active")
      )
    );

  const [self] = await db
    .select({ verified: users.verified })
    .from(users)
    .where(eq(users.id, caretakerUserId))
    .limit(1);
  const caretakerVerified = !!(self as any)?.verified;

  return rows.map((r: any) => ({ ...r, caretakerVerified }));
}

/** List every caretaker linked to a principal patient (with the caretaker's
 *  user-row metadata). Used by the principal-side "who has access" UI. */
export async function accessibleCaretakersFor(db: any, principalPatientId: string) {
  const rows = await db
    .select({
      linkId: patientLinks.id,
      caretakerUserId: patientLinks.caretakerUserId,
      careRole: patientLinks.careRole,
      status: patientLinks.status,
      invitedAt: patientLinks.invitedAt,
      acceptedAt: patientLinks.acceptedAt,
      revokedAt: patientLinks.revokedAt,
      invitedByUserId: patientLinks.invitedByUserId,
      caretakerName: users.name,
      caretakerPhone: users.phone,
      caretakerEmail: users.email,
      caretakerPhoto: users.photo,
      // Verified-tier signal: drives the principal-side badge in
      // (app)/caretakers.tsx.
      caretakerVerified: users.verified,
    })
    .from(patientLinks)
    .innerJoin(users, eq(users.id, patientLinks.caretakerUserId))
    .where(eq(patientLinks.principalPatientId, principalPatientId));
  return rows;
}

/** Soft-revoke a link. Idempotent — already-revoked links return false. */
export async function revokeCaretakerLink(
  db: any,
  linkId: string,
  revokedByUserId: string,
  reason?: string
) {
  const [existing] = await db
    .select()
    .from(patientLinks)
    .where(eq(patientLinks.id, linkId))
    .limit(1);
  if (!existing) return false;
  if (existing.status === "revoked") return false;

  const now = new Date().toISOString();
  await db
    .update(patientLinks)
    .set({
      status: "revoked",
      revokedAt: now,
      revokedByUserId,
      revokedReason: reason || null,
      updatedAt: now,
    } as any)
    .where(eq(patientLinks.id, linkId));
  return true;
}

/** Pause or resume a link. Returns the updated row, or null if not found. */
export async function patchCaretakerLinkStatus(
  db: any,
  linkId: string,
  status: "active" | "paused"
) {
  const [existing] = await db
    .select()
    .from(patientLinks)
    .where(eq(patientLinks.id, linkId))
    .limit(1);
  if (!existing) return null;
  if (existing.status === "revoked") return null; // cannot un-revoke via patch
  const now = new Date().toISOString();
  await db
    .update(patientLinks)
    .set({ status, updatedAt: now } as any)
    .where(eq(patientLinks.id, linkId));
  return { ...existing, status, updatedAt: now };
}
