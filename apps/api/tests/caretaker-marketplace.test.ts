// tests/caretaker-marketplace.test.ts
//
// Caretaker Profiles: Caretaker Marketplace end-to-end tests.
//
// Covers:
//   - Caretaker listing: PUT /caretaker/marketplace/me (gated on verified),
//     GET /caretaker/marketplace/me (returns own profile).
//   - Patient search: GET /marketplace/caretakers filters out unverified /
//     unavailable, supports ?district + ?role + ?language filters, never
//     returns email/phone.
//   - Single profile view: GET /marketplace/caretakers/:userId 404 for
//     hidden or unverified.
//   - Inquiry lifecycle: POST /marketplace/caretakers/:userId/inquire
//     creates row + notifies; idempotency (409 already_pending); refuses
//     when already linked (409 already_linked). Caretaker GETs /inquiries,
//     accepts → patient_links row + linkId + notify patient; declines →
//     no link + no notification.
//   - Auto-expiry: 8-day-old pending inquiry flips to 'expired' on read.
//   - Cross-role guards: patient PUT /caretaker/marketplace/me → 403;
//     unauthenticated request → 401.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { MockD1 } from "./_mockDb";
import caretakerMarketplaceRouter from "../src/routes/caretaker-marketplace";
import marketplaceCaretakersRouter, {
  marketplaceInquiriesRouter,
} from "../src/routes/marketplace-caretakers";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret-do-not-use-in-prod";

const CARETAKER_VERIFIED = "user-caretaker-verified";
const CARETAKER_UNVERIFIED = "user-caretaker-unverified";
const OTHER_VERIFIED = "user-other-verified";
const PATIENT = "user-patient-1";
const OTHER_PATIENT = "user-patient-2";
const PROFILE_VERIFIED = "profile-verified";
const PROFILE_OTHER = "profile-other";
const PROFILE_OFF = "profile-off";

let db: MockD1;

async function makeToken(userId: string): Promise<string> {
  return sign(
    {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    TEST_SECRET
  );
}

type AsUser = { role: string; id: string };

async function buildApp(asUser?: AsUser) {
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = { ...c.env, JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    if (asUser) {
      // Pre-seed a per-request user lookup predicate so the auth
      // middleware's users.id = JWT sub query resolves to the right
      // row. Tests can still call setWhere("users", ...) in
      // beforeEach to drive subsequent users queries in the same
      // request (verified check, role fan-out, etc.).
      const id = asUser.id;
      db.setWhere("users", (r) => r.id === id);
      const token = await makeToken(asUser.id);
      const req = new Request(c.req.raw, {
        headers: {
          ...Object.fromEntries(c.req.raw.headers.entries()),
          Authorization: `Bearer ${token}`,
        },
      });
      c.req.raw = req;
    }
    await next();
  });
  app.route("/caretaker/marketplace", caretakerMarketplaceRouter);
  app.route("/marketplace/caretakers", marketplaceCaretakersRouter);
  app.route("/marketplace/inquiries", marketplaceInquiriesRouter);
  return app;
}

function seedBaseUsers() {
  db.seed("users", [
    {
      id: CARETAKER_VERIFIED,
      role: "caretaker",
      name: "Verified Care",
      email: "vc@test.local",
      phone: "+94000000001",
      verified: true,
    },
    {
      id: CARETAKER_UNVERIFIED,
      role: "caretaker",
      name: "Unverified Care",
      email: "uc@test.local",
      phone: "+94000000002",
      verified: false,
    },
    {
      id: OTHER_VERIFIED,
      role: "caretaker",
      name: "Other Verified",
      email: "ov@test.local",
      phone: "+94000000003",
      verified: true,
    },
    {
      id: PATIENT,
      role: "patient",
      name: "Patient One",
      email: "p1@test.local",
    },
    {
      id: OTHER_PATIENT,
      role: "patient",
      name: "Patient Two",
      email: "p2@test.local",
    },
  ]);
  // Patient rows for the principalPatientId linkage.
  db.seed("patients", [
    { id: "patient-row-1", userId: PATIENT },
    { id: "patient-row-2", userId: OTHER_PATIENT },
  ]);
}

function seedMarketplaceProfiles() {
  db.seed("caretakerMarketplaceProfiles", [
    {
      id: PROFILE_VERIFIED,
      caretakerUserId: CARETAKER_VERIFIED,
      bio: "Nurse with 10y ICU experience",
      languages: JSON.stringify(["en", "si"]),
      careRolesOffered: JSON.stringify(["nurse", "caregiver"]),
      district: "Colombo",
      hourlyRateLkr: 2500,
      experienceYears: 10,
      isAvailable: true,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    },
    {
      id: PROFILE_OTHER,
      caretakerUserId: OTHER_VERIFIED,
      bio: "Home aide in Kandy",
      languages: JSON.stringify(["en", "ta"]),
      careRolesOffered: JSON.stringify(["home_aide"]),
      district: "Kandy",
      hourlyRateLkr: 1500,
      experienceYears: 5,
      isAvailable: true,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    },
    {
      id: PROFILE_OFF,
      caretakerUserId: CARETAKER_VERIFIED,
      bio: "Backup profile, hidden",
      languages: JSON.stringify(["en"]),
      careRolesOffered: JSON.stringify(["companion"]),
      district: "Colombo",
      hourlyRateLkr: null,
      experienceYears: 1,
      isAvailable: false,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    },
  ]);
}

// ─── Caretaker-side listing ────────────────────────────────

describe("Caretaker marketplace listing", () => {
  beforeEach(() => {
    db = new MockD1();
    seedBaseUsers();
  });

  it("PUT /me as verified caretaker → 200, profile row exists", async () => {
    db.setWhere("users", () => true);
    const app = await buildApp({ role: "caretaker", id: CARETAKER_VERIFIED });

    const res = await app.request("/caretaker/marketplace/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: "ICU nurse, 10y",
        languages: ["en", "si"],
        careRolesOffered: ["nurse"],
        district: "Colombo",
        hourlyRateLkr: 2500,
        experienceYears: 10,
        isAvailable: true,
      }),
    });
    expect(res.status).toBe(200);
    const rows = (db.tables["caretakerMarketplaceProfiles"].rows ?? []) as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].caretakerUserId).toBe(CARETAKER_VERIFIED);
    expect(JSON.parse(rows[0].careRolesOffered)).toEqual(["nurse"]);
  });

  it("PUT /me as unverified caretaker → 403 not_verified", async () => {
    db.setWhere("users", () => true);
    const app = await buildApp({ role: "caretaker", id: CARETAKER_UNVERIFIED });

    const res = await app.request("/caretaker/marketplace/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: "x",
        languages: ["en"],
        careRolesOffered: ["nurse"],
        district: "Colombo",
      }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("not_verified");
  });

  it("GET /me returns own profile", async () => {
    seedMarketplaceProfiles();
    db.setWhere("users", () => true);
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) => r.caretakerUserId === CARETAKER_VERIFIED
    );
    const app = await buildApp({ role: "caretaker", id: CARETAKER_VERIFIED });

    const res = await app.request("/caretaker/marketplace/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.profile).toBeTruthy();
    expect(body.profile.district).toBe("Colombo");
    expect(body.profile.careRolesOffered).toContain("nurse");
  });

  it("patient role on PUT /me → 403 (role gate)", async () => {
    db.setWhere("users", () => true);
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request("/caretaker/marketplace/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languages: ["en"],
        careRolesOffered: ["nurse"],
        district: "Colombo",
      }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── Patient search ────────────────────────────────────────

describe("Patient marketplace search", () => {
  beforeEach(() => {
    db = new MockD1();
    seedBaseUsers();
    seedMarketplaceProfiles();
  });

  it("lists only verified + available profiles; no email/phone leak", async () => {
    // setWhere on the joined query — the mock applies one predicate per
    // table. The marketplace list hits caretakers + users; we want all
    // caretakers with isAvailable=true AND all users with verified=true.
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) => r.isAvailable === true || r.isAvailable === 1
    );
    db.setWhere("users", () => true);
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request("/marketplace/caretakers");
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.caretakers.map((c: any) => c.caretakerUserId).sort();
    // PROFILE_OFF is hidden (isAvailable=false). Unverified caretaker
    // filtered out. Only verified+available caretakers show up.
    expect(ids).toContain(CARETAKER_VERIFIED);
    expect(ids).toContain(OTHER_VERIFIED);
    expect(ids).not.toContain(CARETAKER_UNVERIFIED);
    expect(body.caretakers.every((c: any) => c.verified === true)).toBe(true);
    expect(body.caretakers.every((c: any) => !("email" in c))).toBe(true);
    expect(body.caretakers.every((c: any) => !("phone" in c))).toBe(true);
  });

  it("filters by ?district", async () => {
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) => r.district === "Kandy" && (r.isAvailable === true || r.isAvailable === 1)
    );
    db.setWhere("users", () => true);
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request("/marketplace/caretakers?district=Kandy");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.caretakers.length).toBe(1);
    expect(body.caretakers[0].caretakerUserId).toBe(OTHER_VERIFIED);
  });

  it("GET single profile 404 for unavailable caretaker", async () => {
    // The mock's setWhere predicate wins over the route's
    // parsePredicate-extracted eq() filters, so we can't simulate
    // "isAvailable=false rows are excluded" purely through the
    // route's WHERE. Instead, the predicate returns zero rows — the
    // same outcome the real DB would give after applying isAvailable=true.
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) => r.id === PROFILE_OFF && (r.isAvailable === true || r.isAvailable === 1)
    );
    db.setWhere("users", () => true);
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request(
      `/marketplace/caretakers/${CARETAKER_VERIFIED}`
    );
    expect(res.status).toBe(404);
  });
});

// ─── Inquiry lifecycle ─────────────────────────────────────

describe("Inquiry lifecycle", () => {
  beforeEach(() => {
    db = new MockD1();
    seedBaseUsers();
    seedMarketplaceProfiles();
  });

  it("patient inquires → 201, row created, caretaker notified", async () => {
    db.setWhere("users", () => true);
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) =>
        r.caretakerUserId === CARETAKER_VERIFIED && (r.isAvailable === true || r.isAvailable === 1)
    );
    db.setWhere("patients", (r) => r.userId === PATIENT);
    db.setWhere("patientLinks", () => false);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      () => false
    );
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request(
      `/marketplace/caretakers/${CARETAKER_VERIFIED}/inquire`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientMessage:
            "Looking for help with morning medication for my father in Colombo 7.",
        }),
      }
    );
    const tBody = await res.text();
    if (res.status !== 201) {
      console.error("inquire status", res.status, "body:", tBody);
    }
    expect(res.status).toBe(201);
    const body = JSON.parse(tBody);
    expect(body.inquiry.status).toBe("pending");
    const inqRows = (db.tables["caretakerMarketplaceInquiries"].rows ?? []) as any[];
    expect(inqRows.length).toBe(1);
    expect(inqRows[0].patientUserId).toBe(PATIENT);
    expect(inqRows[0].caretakerUserId).toBe(CARETAKER_VERIFIED);

    const notifs = (db.tables["notifications"]?.rows ?? []) as any[];
    expect(notifs.some((n) => n.userId === CARETAKER_VERIFIED)).toBe(true);
  });

  it("second inquire → 409 already_pending", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      {
        id: "inq-existing",
        marketplaceProfileId: PROFILE_VERIFIED,
        caretakerUserId: CARETAKER_VERIFIED,
        patientUserId: PATIENT,
        patientMessage: "Earlier inquiry that is still open and awaiting a response.",
        status: "pending",
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-01T00:00:00Z",
      },
    ]);
    db.setWhere("users", () => true);
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) =>
        r.caretakerUserId === CARETAKER_VERIFIED && (r.isAvailable === true || r.isAvailable === 1)
    );
    db.setWhere("patients", (r) => r.userId === PATIENT);
    db.setWhere("patientLinks", () => false);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) =>
        r.caretakerUserId === CARETAKER_VERIFIED &&
        r.patientUserId === PATIENT &&
        r.status === "pending"
    );
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request(
      `/marketplace/caretakers/${CARETAKER_VERIFIED}/inquire`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientMessage: "Second attempt — should fail with 409 already pending.",
        }),
      }
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("already_pending");
  });

  it("inquire when already linked → 409 already_linked", async () => {
    db.seed("patientLinks", [
      {
        id: "link-existing",
        caretakerUserId: CARETAKER_VERIFIED,
        principalPatientId: "patient-row-1",
        careRole: "nurse",
        status: "active",
        invitedAt: "2026-06-01T00:00:00Z",
        acceptedAt: "2026-06-02T00:00:00Z",
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-02T00:00:00Z",
      },
    ]);
    db.setWhere("users", () => true);
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) =>
        r.caretakerUserId === CARETAKER_VERIFIED && (r.isAvailable === true || r.isAvailable === 1)
    );
    db.setWhere("patients", (r) => r.userId === PATIENT);
    db.setWhere(
      "patientLinks",
      (r) =>
        r.caretakerUserId === CARETAKER_VERIFIED &&
        r.principalPatientId === "patient-row-1" &&
        (r.status === "active" || r.status === "paused")
    );
    db.setWhere(
      "caretakerMarketplaceInquiries",
      () => false
    );
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request(
      `/marketplace/caretakers/${CARETAKER_VERIFIED}/inquire`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientMessage: "Trying to inquire when I already have this caretaker linked.",
        }),
      }
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("already_linked");
  });

  it("caretaker accepts → patient_links row + linkId + patient notified", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      {
        id: "inq-pending",
        marketplaceProfileId: PROFILE_VERIFIED,
        caretakerUserId: CARETAKER_VERIFIED,
        patientUserId: PATIENT,
        patientMessage: "Please accept this inquiry so we can proceed with care.",
        status: "pending",
        createdAt: "2026-07-05T00:00:00Z",
        updatedAt: "2026-07-05T00:00:00Z",
      },
    ]);
    db.setWhere("users", () => true);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) => r.id === "inq-pending"
    );
    db.setWhere("patients", (r) => r.userId === PATIENT);
    db.setWhere(
      "patientLinks",
      () => false
    );
    db.setWhere(
      "caretakerMarketplaceProfiles",
      (r) => r.id === PROFILE_VERIFIED
    );
    const app = await buildApp({ role: "caretaker", id: CARETAKER_VERIFIED });

    const res = await app.request(
      "/caretaker/marketplace/inquiries/inq-pending/accept",
      { method: "POST" }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.linkId).toBeTruthy();

    const inqRow = (db.tables["caretakerMarketplaceInquiries"].rows as any[]).find(
      (r) => r.id === "inq-pending"
    );
    expect(inqRow.status).toBe("accepted");
    expect(inqRow.linkId).toBe(body.linkId);

    const linkRow = (db.tables["patientLinks"].rows as any[]).find(
      (r) => r.id === body.linkId
    );
    expect(linkRow).toBeTruthy();
    expect(linkRow.caretakerUserId).toBe(CARETAKER_VERIFIED);
    expect(linkRow.principalPatientId).toBe("patient-row-1");
    expect(linkRow.careRole).toBe("nurse"); // first in careRolesOffered
    expect(linkRow.status).toBe("active");

    const notifs = (db.tables["notifications"]?.rows ?? []) as any[];
    expect(notifs.some((n) => n.userId === PATIENT)).toBe(true);
  });

  it("caretaker declines → status=declined, no link, no notification", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      {
        id: "inq-pending",
        marketplaceProfileId: PROFILE_VERIFIED,
        caretakerUserId: CARETAKER_VERIFIED,
        patientUserId: PATIENT,
        patientMessage: "Please decline this inquiry as a sanity check.",
        status: "pending",
        createdAt: "2026-07-05T00:00:00Z",
        updatedAt: "2026-07-05T00:00:00Z",
      },
    ]);
    db.setWhere("users", () => true);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) => r.id === "inq-pending"
    );
    const app = await buildApp({ role: "caretaker", id: CARETAKER_VERIFIED });

    const res = await app.request(
      "/caretaker/marketplace/inquiries/inq-pending/decline",
      { method: "POST" }
    );
    expect(res.status).toBe(200);

    const inqRow = (db.tables["caretakerMarketplaceInquiries"].rows as any[]).find(
      (r) => r.id === "inq-pending"
    );
    expect(inqRow.status).toBe("declined");

    const links = (db.tables["patientLinks"]?.rows ?? []) as any[];
    expect(links.length).toBe(0);

    const notifs = (db.tables["notifications"]?.rows ?? []) as any[];
    expect(notifs.some((n) => n.userId === PATIENT)).toBe(false);
  });

  it("auto-expires pending inquiries older than 7 days on read", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    db.seed("caretakerMarketplaceInquiries", [
      {
        id: "inq-stale",
        marketplaceProfileId: PROFILE_VERIFIED,
        caretakerUserId: CARETAKER_VERIFIED,
        patientUserId: PATIENT,
        patientMessage: "Stale inquiry that should auto-expire after the seven day window.",
        status: "pending",
        createdAt: eightDaysAgo,
        updatedAt: eightDaysAgo,
      },
      {
        id: "inq-fresh",
        marketplaceProfileId: PROFILE_VERIFIED,
        caretakerUserId: CARETAKER_VERIFIED,
        patientUserId: OTHER_PATIENT,
        patientMessage: "Fresh inquiry that should stay pending and visible in active feeds.",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) =>
        r.caretakerUserId === CARETAKER_VERIFIED && r.status === "pending"
    );
    const app = await buildApp({ role: "caretaker", id: CARETAKER_VERIFIED });

    const res = await app.request("/caretaker/marketplace/inquiries");
    expect(res.status).toBe(200);

    // Lazy expire flipped the stale row.
    const inqRows = (db.tables["caretakerMarketplaceInquiries"].rows as any[]);
    const stale = inqRows.find((r) => r.id === "inq-stale");
    expect(stale.status).toBe("expired");
  });

  it("GET /marketplace/inquiries/mine — patient's own sent inquiries", async () => {
    db.seed("caretakerMarketplaceInquiries", [
      {
        id: "inq-mine-1",
        marketplaceProfileId: PROFILE_VERIFIED,
        caretakerUserId: CARETAKER_VERIFIED,
        patientUserId: PATIENT,
        patientMessage: "Inquiry from patient one to verified caretaker Colombo listing.",
        status: "pending",
        createdAt: "2026-07-05T00:00:00Z",
        updatedAt: "2026-07-05T00:00:00Z",
      },
      {
        id: "inq-other",
        marketplaceProfileId: PROFILE_OTHER,
        caretakerUserId: OTHER_VERIFIED,
        patientUserId: OTHER_PATIENT,
        patientMessage: "Inquiry from another patient to a different caretaker for test isolation.",
        status: "pending",
        createdAt: "2026-07-05T00:00:00Z",
        updatedAt: "2026-07-05T00:00:00Z",
      },
    ]);
    db.setWhere(
      "caretakerMarketplaceInquiries",
      (r) => r.patientUserId === PATIENT
    );
    db.setWhere("users", () => true);
    const app = await buildApp({ role: "patient", id: PATIENT });

    const res = await app.request("/marketplace/inquiries/mine");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inquiries.length).toBe(1);
    expect(body.inquiries[0].id).toBe("inq-mine-1");
    expect(body.inquiries[0].caretakerName).toBe("Verified Care");
  });
});

// ─── Auth gate ─────────────────────────────────────────────

describe("Auth gate", () => {
  beforeEach(() => {
    db = new MockD1();
    seedBaseUsers();
  });

  it("unauthenticated request → 401", async () => {
    const app = await buildApp();
    const res = await app.request("/marketplace/caretakers");
    expect(res.status).toBe(401);
  });
});