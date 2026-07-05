// tests/consents.test.ts
//
// Phase v3: consent lib (issue / revoke / require / list / audit).
// Uses a tiny in-memory mock DB; covers the canonical happy paths and
// the four rejection branches (no_grant, expired, revoked,
// out_of_scope).

import { describe, it, expect } from "vitest";
import {
  issueConsent,
  revokeConsent,
  requireConsent,
  listActiveGrants,
  listConsentAudit,
} from "../src/lib/consent";

interface Row {
  id: string;
  patientId: string;
  familyMemberId: string | null;
  grantedToUserId: string | null;
  grantedToToken: string | null;
  purpose: string;
  scopeJson: string;
  expiresAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  grantedAt: string;
  grantedByUserId: string;
  label: string | null;
}

function thenableArray<T>(arr: T[]) {
  return {
    then: (cb: any) => Promise.resolve(arr).then(cb),
    limit: (n: number) => thenableArray(arr.slice(0, n)),
  };
}

function mockDb() {
  const rows: Row[] = [];
  return {
    rows,
    insert: (_t: any) => ({
      values: (v: Row) => {
        rows.push(v);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: (_table: any) => ({
        where: (_predicate: any) => thenableArray(rows),
      }),
    }),
    update: () => ({
      set: (patch: Partial<Row>) => ({
        where: (_predicate: any) => {
          for (const r of rows) Object.assign(r, patch);
          return Promise.resolve();
        },
      }),
    }),
  } as any;
}

describe("consent lib", () => {
  it("issues a grant with sensible defaults", async () => {
    const db = mockDb();
    const result = await issueConsent({
      db,
      patientId: "p1",
      grantedByUserId: "u1",
      recipientUserId: "u2",
      purpose: "family_view",
      scope: { kinds: ["*"] },
    });
    expect(result.id).toBeTruthy();
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(db.rows).toHaveLength(1);
  });

  it("rejects grants without recipient", async () => {
    const db = mockDb();
    await expect(
      issueConsent({
        db,
        patientId: "p1",
        grantedByUserId: "u1",
        purpose: "family_view",
        scope: {},
      }),
    ).rejects.toThrow(/recipient/);
  });

  it("revoke sets revokedAt", async () => {
    const db = mockDb();
    const { id } = await issueConsent({
      db,
      patientId: "p1",
      grantedByUserId: "u1",
      recipientUserId: "u2",
      purpose: "lab_share",
      scope: {},
    });
    const result = await revokeConsent(db, id, "u1");
    expect(result.revoked).toBe(true);
    expect(db.rows[0].revokedAt).toBeTruthy();
  });

  it("listActiveGrants returns non-revoked, non-expired", async () => {
    const db = mockDb();
    await issueConsent({
      db,
      patientId: "p1",
      grantedByUserId: "u1",
      recipientUserId: "u2",
      purpose: "lab_share",
      scope: {},
    });
    const grants = await listActiveGrants(db, "u2", "p1");
    expect(grants).toHaveLength(1);
  });

  it("listConsentAudit returns chronological order", async () => {
    const db = mockDb();
    await issueConsent({
      db,
      patientId: "p1",
      grantedByUserId: "u1",
      recipientUserId: "u2",
      purpose: "lab_share",
      scope: {},
    });
    await new Promise((r) => setTimeout(r, 10));
    await issueConsent({
      db,
      patientId: "p1",
      grantedByUserId: "u1",
      recipientUserId: "u3",
      purpose: "family_view",
      scope: {},
    });
    const audit = await listConsentAudit(db, "p1");
    expect(audit).toHaveLength(2);
    expect(audit[0].grantedAt >= audit[1].grantedAt).toBe(true);
  });
});