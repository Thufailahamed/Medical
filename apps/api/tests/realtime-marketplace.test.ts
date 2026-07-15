// tests/realtime-marketplace.test.ts
//
// Caretaker Marketplace: realtime poller unit tests.
//
// The /realtime SSE hub polls D1 every 2 s and emits typed events.
// The marketplace_inquiry poller is the one whose cursor advances on
// `updatedAt` (not `id`) so it can catch status changes on existing
// rows — accept / decline / auto-expire.
//
// These tests bypass the SSE plumbing and exercise the poller factory
// directly: build the poller, run its `select(where)`, assert which
// rows the caller can see.

import { describe, it, expect, beforeEach } from "vitest";
import { desc } from "drizzle-orm";
import { MockD1 } from "./_mockDb";
import { buildPollers } from "../src/routes/realtime";
import { caretakerMarketplaceInquiries } from "@healthcare/db";

const CARETAKER = "user-caretaker";
const OTHER_CARETAKER = "user-other-caretaker";
const PATIENT_A = "user-patient-a";
const PATIENT_B = "user-patient-b";

const PROFILE_C = "profile-c";

let db: MockD1;

function seedInquiry(overrides: Partial<{
  id: string;
  caretakerUserId: string;
  patientUserId: string;
  status: "pending" | "accepted" | "declined" | "expired";
  updatedAt: string;
  createdAt: string;
}>) {
  return {
    id: overrides.id ?? "inq-default",
    marketplaceProfileId: PROFILE_C,
    caretakerUserId: overrides.caretakerUserId ?? CARETAKER,
    patientUserId: overrides.patientUserId ?? PATIENT_A,
    patientMessage: "test message that is at least ten chars",
    status: overrides.status ?? "pending",
    decidedAt: null,
    linkId: null,
    createdAt: overrides.createdAt ?? "2026-07-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-07-01T00:00:00Z",
  };
}

function getMarketplacePoller(userId: string, role: string = "caretaker") {
  const pollers = buildPollers({
    role,
    userId,
    scopedPatientIds: [],
    db,
  });
  const p = pollers.find((x) => x.key === "marketplace_inquiry");
  if (!p) throw new Error("marketplace_inquiry poller not registered");
  return p;
}

async function runPollerSelect(p: ReturnType<typeof getMarketplacePoller>) {
  const where = p.where();
  return p
    .select(where as any)
    .orderBy(desc(p.cursorColumn))
    .limit(25) as any;
}

beforeEach(() => {
  db = new MockD1();
  db.seed("caretakerMarketplaceInquiries", []);
});

describe("marketplace_inquiry poller — visibility", () => {
  it("returns the inquiry for the caretaker side", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      seedInquiry({ id: "inq-1", caretakerUserId: CARETAKER, patientUserId: PATIENT_A }),
    ]);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) =>
        r.caretakerUserId === CARETAKER || r.patientUserId === CARETAKER
    );

    const p = getMarketplacePoller(CARETAKER);
    const rows = await runPollerSelect(p);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("inq-1");
    expect(rows[0].status).toBe("pending");
  });

  it("returns the inquiry for the patient side", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      seedInquiry({ id: "inq-2", caretakerUserId: CARETAKER, patientUserId: PATIENT_A }),
    ]);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) =>
        r.caretakerUserId === PATIENT_A || r.patientUserId === PATIENT_A
    );

    const p = getMarketplacePoller(PATIENT_A, "patient");
    const rows = await runPollerSelect(p);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("inq-2");
    expect(rows[0].caretakerUserId).toBe(CARETAKER);
    expect(rows[0].patientUserId).toBe(PATIENT_A);
  });

  it("excludes inquiries that don't involve the caller", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      seedInquiry({ id: "inq-mine", caretakerUserId: CARETAKER, patientUserId: PATIENT_A }),
      seedInquiry({ id: "inq-other", caretakerUserId: OTHER_CARETAKER, patientUserId: PATIENT_B }),
    ]);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) =>
        (r.caretakerUserId === CARETAKER || r.patientUserId === CARETAKER)
    );

    const p = getMarketplacePoller(CARETAKER);
    const rows = await runPollerSelect(p);
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("inq-mine");
  });

  it("payload shape includes all fields needed for UI updates", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      seedInquiry({
        id: "inq-payload",
        caretakerUserId: CARETAKER,
        patientUserId: PATIENT_A,
        status: "accepted",
        updatedAt: "2026-07-08T00:00:00Z",
      }),
    ]);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      () => true
    );

    const p = getMarketplacePoller(CARETAKER);
    const rows = await runPollerSelect(p);
    const payload = p.payload(rows[0]);
    expect(payload).toMatchObject({
      id: "inq-payload",
      marketplaceProfileId: PROFILE_C,
      caretakerUserId: CARETAKER,
      patientUserId: PATIENT_A,
      status: "accepted",
      decidedAt: null,
      linkId: null,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-08T00:00:00Z",
    });
  });
});

describe("marketplace_inquiry poller — cursor column", () => {
  it("declares updatedAt as the cursor column (not id)", () => {
    const p = getMarketplacePoller(CARETAKER);
    // Must be updatedAt so status mutations on existing rows are caught.
    expect(p.cursorColumnName).toBe("updatedAt");
    expect(p.cursorColumn).toBe(caretakerMarketplaceInquiries.updatedAt);
    // And the seen-set is still keyed on id (dedup logic uses id).
    expect(p.idColumn).toBe("id");
  });
});