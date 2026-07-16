// tests/share-pack.test.ts
//
// Tier 1 records: Share Pack (record_bundle kind).
//
// Covers:
//   - POST /share/links with recordIds → kind=record_bundle,
//     record_ids column populated as JSON.
//   - 400 on any recordId not owned by the patient.
//   - 400 when recordIds is empty (Zod min(1) fails).
//   - 400 when recordIds exceeds 50 (Zod max fails).
//   - GET /share/:token on a bundle returns the picked records.
//   - audit `share_link_views` row inserted on public GET.
//   - DELETE /share/links/:id revokes bundles.
//
// We use the same auth pattern as the existing care-team tests
// (buildTestApp) and register `setWhere` predicates so MockD1 can
// resolve `eq()` lookups (tests/_mockDb.ts handles simple `eq`; for
// complex predicates we register explicitly).

import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

import { Hono } from "hono";
import shareRouter from "../src/routes/share";
import type { AppEnvironment } from "../src/types";
import { MockD1 } from "./_mockDb";
import {
  buildTestApp,
  postJson,
  deleteJson,
  getJson,
} from "./_testApp";

const PATIENT_USER = "user-patient-1";
const PATIENT_ID = "patient-1";
let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Alice" },
  ]);
  db.seed("patients", [
    { id: PATIENT_ID, userId: PATIENT_USER, fullName: "Alice" },
  ]);
});

describe("POST /share/links — record_bundle (share pack)", () => {
  it("mints a record_bundle link when recordIds is supplied and owned", async () => {
    db.seed("medical_records", [
      { id: "11111111-1111-1111-1111-111111111111", patientId: PATIENT_ID, kind: "lab_report", title: "Lipid panel", date: "2026-01-01" },
      { id: "22222222-2222-2222-2222-222222222222", patientId: PATIENT_ID, kind: "imaging", title: "Chest X-ray", date: "2026-02-01" },
      { id: "33333333-3333-3333-3333-333333333333", patientId: PATIENT_ID, kind: "prescription", title: "Statin", date: "2026-03-01" },
    ]);
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/share", shareRouter as any);

    const res = await postJson(app, "/share/links", {
      recordIds: [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
      ],
      label: "Pre-cardiology visit",
      expiresInHours: 168,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.link.kind).toBe("record_bundle");
    expect(body.link.recordIds).toBeTruthy();
    const ids = JSON.parse(body.link.recordIds);
    expect(ids.sort()).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
    ]);
    expect(body.url).toMatch(/^\/share\//);
  });

  it("rejects recordIds that don't all belong to the patient", async () => {
    db.seed("medical_records", [
      { id: "11111111-1111-1111-1111-111111111111", patientId: PATIENT_ID, kind: "lab_report", title: "Mine" },
      { id: "99999999-9999-9999-9999-999999999999", patientId: "patient-other", kind: "imaging", title: "Theirs" },
    ]);
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/share", shareRouter as any);

    const res = await postJson(app, "/share/links", {
      recordIds: [
        "11111111-1111-1111-1111-111111111111",
        "99999999-9999-9999-9999-999999999999",
      ],
      expiresInHours: 24,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toMatch(/do not belong/);
    expect(body.expected).toBe(2);
    expect(body.owned).toBe(1);
  });

  it("rejects when recordIds is empty", async () => {
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/share", shareRouter as any);

    const res = await postJson(app, "/share/links", {
      recordIds: [],
      expiresInHours: 24,
    });
    expect(res.status).toBe(400);
  });

  it("rejects when recordIds exceeds 50 (Zod max)", async () => {
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/share", shareRouter as any);

    // 51 unique UUIDs to satisfy the uuid() check while tripping max(50)
    const tooMany = Array.from({ length: 51 }, (_, i) =>
      `${(i + 1).toString().padStart(8, "0")}-0000-0000-0000-000000000000`
    );
    const res = await postJson(app, "/share/links", {
      recordIds: tooMany,
      expiresInHours: 24,
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /share/:token — record_bundle bundle", () => {
  it("returns the picked records for a non-authenticated request", async () => {
    db.seed("medical_records", [
      { id: "11111111-1111-1111-1111-111111111111", patientId: PATIENT_ID, kind: "lab_report", title: "Lipid panel", date: "2026-01-01" },
      { id: "22222222-2222-2222-2222-222222222222", patientId: PATIENT_ID, kind: "imaging", title: "Chest X-ray", date: "2026-02-01" },
      { id: "99999999-9999-9999-9999-999999999999", patientId: PATIENT_ID, kind: "prescription", title: "Other med" },
    ]);
    const token = "a".repeat(48);
    db.seed("share_links", [
      {
        id: "sl-1",
        patientId: PATIENT_ID,
        token,
        scope: "{}",
        label: "Pre-cardiology visit",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        revoked: 0,
        createdBy: PATIENT_USER,
        kind: "record_bundle",
        recordIds: JSON.stringify([
          "11111111-1111-1111-1111-111111111111",
          "22222222-2222-2222-2222-222222222222",
        ]),
        createdAt: new Date().toISOString(),
      },
    ]);
    // MockD1's auto-parse of `and(inArray, eq)` doesn't always combine
    // correctly — register the predicates explicitly so this public
    // endpoint returns the correct rows + patient.
    db.setWhere("medical_records", (r) =>
      ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"].includes(r.id) &&
      r.patientId === PATIENT_ID
    );
    db.setWhere("patients", (r) => r.id === PATIENT_ID);

    // Public endpoint — no auth, no user. Build a barebones app.
    const app = new Hono<AppEnvironment>();
    app.use("*", async (c, next) => {
      c.env = c.env || ({} as any);
      (c.env as any).PUBLIC_URL = "https://app.healthhub.app";
      c.set("db", db as any);
      c.set("locale", "en" as any);
      await next();
    });
    app.route("/share", shareRouter as any);

    const res = await app.request(`/share/${token}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.kind).toBe("record_bundle");
    expect(body.label).toBe("Pre-cardiology visit");
    expect(body.records).toHaveLength(2);
    expect(body.records.map((r: any) => r.id).sort()).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
    ]);
    expect(body.patient.name).toBe("Alice");

    // share_link_views audit row inserted
    const views = db.tables["share_link_views"].rows;
    expect(views.length).toBe(1);
    expect(views[0].linkId).toBe("sl-1");
  });
});

describe("DELETE /share/links/:id — bundle revoke", () => {
  it("flips revoked=true on the bundle", async () => {
    db.seed("share_links", [
      {
        id: "sl-1",
        patientId: PATIENT_ID,
        token: "t1",
        scope: "{}",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        revoked: 0,
        createdBy: PATIENT_USER,
        kind: "record_bundle",
        recordIds: JSON.stringify(["r-1"]),
        createdAt: new Date().toISOString(),
      },
    ]);

    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/share", shareRouter as any);

    const res = await deleteJson(app, "/share/links/sl-1");
    expect(res.status).toBe(200);
    const row = db.tables["share_links"].rows[0];
    // Drizzle `{ mode: "boolean" }` reads/writes booleans — the seed
    // stores `0`, the update writes `true`. MockD1 returns the row
    // after the update verbatim.
    expect(Boolean(row.revoked)).toBe(true);
  });
});
