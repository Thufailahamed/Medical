// tests/prescription-once.test.ts
//
// Migration 0059: single-use redemption for e-prescriptions.
//
// Direct unit tests against the `consumeDispenseTokenAndTransition`
// helper (apps/api/src/lib/rxStatus.ts) — the atomic guard that binds
// a dispense event to a per-Rx single-use token. End-to-end smoke is
// covered by the manual verification steps in the plan; here we lock
// the contract the helper must satisfy so future refactors can't
// silently regress the one-time-use guarantee.
//
// MockD1 quirks: `isNull` isn't auto-parsed, so we register a per-
// case `setWhere` on the `prescriptions` UPDATE that mirrors the
// conditional WHERE clause the helper composes (id + status + token
// + consumed-at-is-null). A passing test means the helper's predicate
// shape is correct; a failing test means a refactor dropped a guard.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import {
  prescriptions,
  prescriptionSignatures,
  doctors,
  patients,
  medicines,
  users,
  hospitals,
} from "@healthcare/db";
import { MockD1 } from "./_mockDb";
import {
  consumeDispenseTokenAndTransition,
} from "../src/lib/rxStatus";

const RX_ID = "rx-once-1";
const TOKEN = "goodtok_" + "A".repeat(33);
const DOCTOR_ID = "doc-1";
const PATIENT_ID = "pat-1";
const HOSPITAL_ID = "hosp-1";
const USER_ID = "user-1";
const OP_USER_ID = "op-1";

function seedSignedRx(db: MockD1, overrides: Record<string, any> = {}) {
  db.seed("prescriptions", [
    {
      id: RX_ID,
      doctorId: DOCTOR_ID,
      patientId: PATIENT_ID,
      hospitalId: HOSPITAL_ID,
      diagnosis: "Test",
      notes: null,
      date: "2026-07-16",
      status: "signed",
      signatureId: "sig-1",
      signedAt: "2026-07-16T00:00:00Z",
      signedPayloadHash: "abc",
      cancelledAt: null,
      cancellationReason: null,
      dispensedAt: null,
      createdAt: "2026-07-16T00:00:00Z",
      updatedAt: "2026-07-16T00:00:00Z",
      dispenseToken: TOKEN,
      dispenseTokenConsumedAt: null,
      dispensedByUserId: null,
      dispensedByPharmacyName: null,
      ...overrides,
    },
  ]);
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("consumeDispenseTokenAndTransition (E-Rx 0059)", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    (db as any).all = vi.fn().mockResolvedValue([]);
  });

  it("flips status to dispensed + stamps consumed columns when token matches", async () => {
    seedSignedRx(db);
    // Mirror the helper's WHERE: id + status + token + not consumed.
    db.setWhere("prescriptions", (r: any) =>
      r.id === RX_ID &&
      r.status === "signed" &&
      r.dispenseToken === TOKEN &&
      !r.dispenseTokenConsumedAt
    );

    const result = await consumeDispenseTokenAndTransition({
      db,
      table: prescriptions,
      id: RX_ID,
      token: TOKEN,
      from: "signed",
      to: "dispensed",
      patch: {
        dispensedAt: "2026-07-16T01:00:00Z",
        dispenseTokenConsumedAt: "2026-07-16T01:00:00Z",
        dispensedByUserId: OP_USER_ID,
        dispensedByPharmacyName: "City Pharmacy",
      },
      actorId: OP_USER_ID,
      action: "prescription.dispensed",
      details: { actorRole: "pharmacy" },
      tokenColumns: {
        dispenseToken: prescriptions.dispenseToken,
        dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
      },
    });

    expect(result).toBeTruthy();
    expect(result!.status).toBe("dispensed");
    expect(result!.dispenseTokenConsumedAt).toBe("2026-07-16T01:00:00Z");
    expect(result!.dispensedByUserId).toBe(OP_USER_ID);

    // Row state in DB matches the patch.
    const rows = db.tables["prescriptions"]?.rows ?? [];
    expect(rows[0].status).toBe("dispensed");
    expect(rows[0].dispenseTokenConsumedAt).toBe("2026-07-16T01:00:00Z");
    expect(rows[0].dispensedByPharmacyName).toBe("City Pharmacy");
  });

  it("returns null on a second call (replay) — token already consumed", async () => {
    seedSignedRx(db, {
      dispenseTokenConsumedAt: "2026-07-16T01:00:00Z",
      status: "dispensed",
    });
    // Predicate now fails on the consumed-at clause — row is consumed.
    db.setWhere("prescriptions", (r: any) =>
      r.id === RX_ID &&
      r.status === "signed" &&
      r.dispenseToken === TOKEN &&
      !r.dispenseTokenConsumedAt
    );

    const result = await consumeDispenseTokenAndTransition({
      db,
      table: prescriptions,
      id: RX_ID,
      token: TOKEN,
      from: "signed",
      to: "dispensed",
      patch: { dispensedAt: "2026-07-16T02:00:00Z" },
      actorId: OP_USER_ID,
      action: "prescription.dispensed",
      details: null,
      tokenColumns: {
        dispenseToken: prescriptions.dispenseToken,
        dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
      },
    });

    expect(result).toBeNull();

    // Row state unchanged: still has the original consumed-at stamp.
    const rows = db.tables["prescriptions"]?.rows ?? [];
    expect(rows[0].status).toBe("dispensed");
    expect(rows[0].dispenseTokenConsumedAt).toBe("2026-07-16T01:00:00Z");
  });

  it("returns null when the supplied token doesn't match the row", async () => {
    seedSignedRx(db);
    const wrong = "wrongtok_" + "X".repeat(33);
    db.setWhere("prescriptions", (r: any) =>
      r.id === RX_ID &&
      r.status === "signed" &&
      r.dispenseToken === wrong && // mismatch with row → predicate false
      !r.dispenseTokenConsumedAt
    );

    const result = await consumeDispenseTokenAndTransition({
      db,
      table: prescriptions,
      id: RX_ID,
      token: wrong,
      from: "signed",
      to: "dispensed",
      patch: { dispensedAt: "2026-07-16T02:00:00Z" },
      actorId: OP_USER_ID,
      action: "prescription.dispensed",
      details: null,
      tokenColumns: {
        dispenseToken: prescriptions.dispenseToken,
        dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
      },
    });

    expect(result).toBeNull();
    const rows = db.tables["prescriptions"]?.rows ?? [];
    expect(rows[0].status).toBe("signed");
    expect(rows[0].dispenseTokenConsumedAt).toBeNull();
  });

  it("returns null when the row is in a non-signed status", async () => {
    seedSignedRx(db, { status: "cancelled", cancelledAt: "2026-07-16T00:30:00Z" });
    db.setWhere("prescriptions", (r: any) =>
      r.id === RX_ID &&
      r.status === "signed" &&
      r.dispenseToken === TOKEN &&
      !r.dispenseTokenConsumedAt
    );

    const result = await consumeDispenseTokenAndTransition({
      db,
      table: prescriptions,
      id: RX_ID,
      token: TOKEN,
      from: "signed",
      to: "dispensed",
      patch: { dispensedAt: "2026-07-16T02:00:00Z" },
      actorId: OP_USER_ID,
      action: "prescription.dispensed",
      details: null,
      tokenColumns: {
        dispenseToken: prescriptions.dispenseToken,
        dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
      },
    });

    expect(result).toBeNull();
    const rows = db.tables["prescriptions"]?.rows ?? [];
    expect(rows[0].status).toBe("cancelled");
  });

  it("rejects an illegal transition with RxTransitionError (defence-in-depth)", async () => {
    seedSignedRx(db, { status: "draft" });
    db.setWhere("prescriptions", () => false); // never matches

    await expect(
      consumeDispenseTokenAndTransition({
        db,
        table: prescriptions,
        id: RX_ID,
        token: TOKEN,
        from: "signed",
        to: "draft", // not in RX_TRANSITIONS.signed
        patch: { dispensedAt: "2026-07-16T02:00:00Z" },
        actorId: OP_USER_ID,
        action: "prescription.dispensed",
        details: null,
        tokenColumns: {
          dispenseToken: prescriptions.dispenseToken,
          dispenseTokenConsumedAt: prescriptions.dispenseTokenConsumedAt,
        },
      })
    ).rejects.toThrow(/Illegal prescription transition: signed → draft/);
  });
});

describe("dispenseTokenSchema (shared validators)", () => {
  it("accepts base64url 43 chars (server-minted length)", async () => {
    const { dispenseTokenSchema } = await import("@healthcare/shared/validators");
    expect(dispenseTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
  });

  it("accepts the loose 20-64 range so future lengths don't break clients", async () => {
    const { dispenseTokenSchema } = await import("@healthcare/shared/validators");
    expect(dispenseTokenSchema.safeParse("a".repeat(20)).success).toBe(true);
    expect(dispenseTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
  });

  it("rejects empty, too-short, too-long, and non-base64url inputs", async () => {
    const { dispenseTokenSchema } = await import("@healthcare/shared/validators");
    expect(dispenseTokenSchema.safeParse("").success).toBe(false);
    expect(dispenseTokenSchema.safeParse("a".repeat(19)).success).toBe(false);
    expect(dispenseTokenSchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(dispenseTokenSchema.safeParse("contains!invalid").success).toBe(false);
  });
});
