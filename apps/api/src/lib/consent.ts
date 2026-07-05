// @ts-nocheck
// ─── Phase v3: Granular consent ───────────────────────────────────────
// Per-purpose, per-recipient, per-record-scope, revocable. Single
// source of truth is the `consent_grants` table; this module provides
// issue/revoke/check helpers and an audit timeline.

import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { consentGrants, medicalRecords, shareLinks } from "@healthcare/db";
import {
  CONSENT_PURPOSES,
  ConsentPurpose,
  classifyConsent,
  purposeAllowsKind,
  type RecordKind,
} from "@healthcare/shared/records";

// ─── helpers ───────────────────────────────────────────────────

function genId(): string {
  // tiny uuid without deps — matches Drizzle's $defaultFn shape
  const c = crypto as unknown as { randomUUID?: () => string };
  return c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}

function nowIso(): string {
  return new Date().toISOString();
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString();
}

function isoPlusHours(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

// ─── issue ───────────────────────────────────────────────────

export interface IssueConsentInput {
  patientId: string;
  familyMemberId?: string;
  recipientUserId?: string;
  recipientToken?: string;
  purpose: ConsentPurpose;
  scope: Record<string, unknown>; // serialised as JSON
  durationDays?: number;
  expiresAt?: string;
  label?: string;
  grantedByUserId: string;
  db: any;
}

export async function issueConsent(input: IssueConsentInput) {
  if (!CONSENT_PURPOSES.includes(input.purpose)) {
    throw new Error(`Unknown purpose: ${input.purpose}`);
  }
  if (!input.recipientUserId && !input.recipientToken) {
    throw new Error("Either recipientUserId or recipientToken is required");
  }
  const expires =
    input.expiresAt ||
    (input.durationDays !== undefined
      ? isoPlusDays(input.durationDays)
      : input.purpose === "emergency"
      ? isoPlusHours(2)
      : isoPlusDays(30));
  const id = genId();
  await input.db.insert(consentGrants).values({
    id,
    patientId: input.patientId,
    familyMemberId: input.familyMemberId ?? null,
    grantedToUserId: input.recipientUserId ?? null,
    grantedToToken: input.recipientToken ?? null,
    purpose: input.purpose,
    scopeJson: JSON.stringify(input.scope),
    expiresAt: expires,
    revokedAt: null,
    grantedAt: nowIso(),
    grantedByUserId: input.grantedByUserId,
    label: input.label ?? null,
  });
  return { id, expiresAt: expires };
}

// ─── revoke ───────────────────────────────────────────────────

export async function revokeConsent(
  db: any,
  consentId: string,
  byUserId: string,
): Promise<{ revoked: boolean; reason?: string }> {
  const [row] = await db
    .select()
    .from(consentGrants)
    .where(eq(consentGrants.id, consentId))
    .limit(1);
  if (!row) return { revoked: false, reason: "not_found" };
  if (row.revokedAt) return { revoked: false, reason: "already_revoked" };
  await db
    .update(consentGrants)
    .set({ revokedAt: nowIso(), revokedByUserId: byUserId })
    .where(eq(consentGrants.id, consentId));
  return { revoked: true };
}

// ─── check ───────────────────────────────────────────────────

export interface ConsentCheck {
  ok: boolean;
  reason?: "no_grant" | "expired" | "revoked" | "out_of_scope";
  consentId?: string;
  purpose?: ConsentPurpose;
  scope?: Record<string, unknown>;
  expiresAt?: string;
}

export interface RequireConsentInput {
  viewerUserId: string;
  patientId: string;
  purpose: ConsentPurpose;
  familyMemberId?: string;
  /** Optional record kind to test against purpose + scope */
  recordKind?: RecordKind;
  /** Optional specific record id */
  recordId?: string;
}

/**
 * Returns the most permissive active grant for (viewer, patient, purpose)
 * — or { ok:false, reason } if none applies.
 */
export async function requireConsent(
  db: any,
  input: RequireConsentInput,
): Promise<ConsentCheck> {
  // Patient always has access to themselves.
  // We can't check that here without joining patients; the caller is
  // expected to short-circuit when viewerUserId === patientUserId.

  const now = nowIso();
  const rows = await db
    .select()
    .from(consentGrants)
    .where(
      and(
        eq(consentGrants.patientId, input.patientId),
        eq(consentGrants.purpose, input.purpose),
        eq(consentGrants.grantedToUserId, input.viewerUserId),
        isNull(consentGrants.revokedAt),
        gt(consentGrants.expiresAt, now),
        input.familyMemberId
          ? eq(consentGrants.familyMemberId, input.familyMemberId)
          : sql`1=1`,
      ),
    );

  if (!rows.length) {
    // Try token-issued grants (anonymous first-responder etc.) — caller
    // should resolve the token to a viewerUserId before invoking us.
    return { ok: false, reason: "no_grant" };
  }

  // Most-permissive: pick the one whose scope contains the requested
  // record kind, falling back to the freshest.
  let best: (typeof rows)[number] | undefined;
  for (const r of rows) {
    if (input.recordKind) {
      if (purposeAllowsKind(input.purpose, input.recordKind)) {
        if (!best || r.expiresAt > best.expiresAt) best = r;
      }
    } else if (!best || r.expiresAt > best.expiresAt) {
      best = r;
    }
  }
  if (!best) {
    // Try narrower scope test
    if (input.recordId) {
      for (const r of rows) {
        const scope = safeParseJson(r.scopeJson, {});
        const ids: string[] | undefined = (scope as { recordIds?: string[] }).recordIds;
        if (Array.isArray(ids) && ids.includes(input.recordId)) {
          best = r;
          break;
        }
      }
    }
  }
  if (!best) return { ok: false, reason: "out_of_scope" };
  return {
    ok: true,
    consentId: best.id,
    purpose: input.purpose,
    scope: safeParseJson(best.scopeJson, {}),
    expiresAt: best.expiresAt,
  };
}

/**
 * Looser check used by portals: returns a list of all active grants
 * the viewer holds over the patient. Useful for "what can this doctor
 * see?" UI.
 */
export async function listActiveGrants(
  db: any,
  viewerUserId: string,
  patientId: string,
): Promise<Array<{
  id: string;
  purpose: ConsentPurpose;
  scope: Record<string, unknown>;
  expiresAt: string;
  label: string | null;
  familyMemberId: string | null;
  status: "active" | "expired";
}>> {
  const now = nowIso();
  const rows = await db
    .select()
    .from(consentGrants)
    .where(
      and(
        eq(consentGrants.patientId, patientId),
        eq(consentGrants.grantedToUserId, viewerUserId),
        isNull(consentGrants.revokedAt),
        gt(consentGrants.expiresAt, now),
      ),
    );
  return rows.map((r: any) => ({
    id: r.id,
    purpose: r.purpose,
    scope: safeParseJson(r.scopeJson, {}),
    expiresAt: r.expiresAt,
    label: r.label,
    familyMemberId: r.familyMemberId,
    status: "active",
  }));
}

// ─── audit timeline ──────────────────────────────────────────

export async function listConsentAudit(
  db: any,
  patientId: string,
): Promise<Array<{
  id: string;
  purpose: ConsentPurpose;
  grantedToUserId: string | null;
  grantedToToken: string | null;
  grantedAt: string;
  grantedByUserId: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  label: string | null;
  status: ReturnType<typeof classifyConsent>;
}>> {
  const rows = await db
    .select()
    .from(consentGrants)
    .where(eq(consentGrants.patientId, patientId));
  const now = new Date();
  return rows
    .map((r: any) => ({
      id: r.id,
      purpose: r.purpose,
      grantedToUserId: r.grantedToUserId,
      grantedToToken: r.grantedToToken,
      grantedAt: r.grantedAt,
      grantedByUserId: r.grantedByUserId,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      revokedByUserId: r.revokedByUserId,
      label: r.label,
      status: classifyConsent(r.expiresAt, r.revokedAt, now),
    }))
    .sort((a: any, b: any) => (a.grantedAt < b.grantedAt ? 1 : -1));
}

// ─── util ────────────────────────────────────────────────────

function safeParseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}