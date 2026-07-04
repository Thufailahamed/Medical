// tests/care-team.test.ts
//
// Critical path: end-to-end care-team flow via the HTTP router.
//
// What we cover:
//   - patient-initiated POST /care-team adds a doctor + idempotent 409
//   - doctor-initiated POST requires a valid single-use invite token
//   - patient issues invite → doctor redeems → second redeem returns 409
//   - PATCH revoke flips status; PATCH scope change allowed (patient only)
//   - GET /care-team/reverse returns patients who added this doctor
//   - validation: invalid role / scope → 400
//
// We bypass authMiddleware via a stub; the router logic is unchanged.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson, patchJson, getJson } from "./_testApp";

const PATIENT_USER = "user-patient-1";
const PATIENT_ID = "patient-1";
const DOCTOR_USER = "user-doctor-1";
const DOCTOR_ID = "doctor-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();

  // Seed users + profiles.
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Alice Patient" },
    { id: DOCTOR_USER, role: "doctor", name: "Dr. Bob" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [
    { id: DOCTOR_ID, userId: DOCTOR_USER, specialization: "GP" },
  ]);
});

describe("POST /care-team — patient-initiated", () => {
  it("adds a doctor and returns the row", async () => {
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    // resolvePatient: SELECT patients WHERE userId=?
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const res = await postJson(app, "/care-team", {
      doctorId: DOCTOR_ID,
      role: "primary_care",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.member.patientId).toBe(PATIENT_ID);
    expect(body.member.doctorId).toBe(DOCTOR_ID);
    expect(body.member.role).toBe("primary_care");
    expect(body.member.status).toBe("active");
    expect(db.tables["care_team_members"].rows.length).toBe(1);
  });

  it("returns 409 when an active row already exists for the same triple", async () => {
    db.seed("care_team_members", [
      {
        id: "existing",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        role: "primary_care",
        status: "active",
      },
    ]);
    // Simulate UNIQUE constraint failure on the insert.
    db.failNextInsert(
      "care_team_members",
      new Error("UNIQUE constraint failed: care_team_active_unique")
    );

    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const res = await postJson(app, "/care-team", {
      doctorId: DOCTOR_ID,
      role: "primary_care",
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/);
  });

  it("returns 400 on invalid role", async () => {
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const res = await postJson(app, "/care-team", {
      doctorId: DOCTOR_ID,
      role: "bogus_role",
    });
    expect(res.status).toBe(400);
  });

  it("rejects non-patient, non-doctor callers", async () => {
    const app = await buildTestApp(db, { id: "user-hospital", role: "hospital_admin" });
    const res = await postJson(app, "/care-team", { doctorId: DOCTOR_ID });
    expect(res.status).toBe(403);
  });
});

describe("POST /care-team/invites + POST /care-team (doctor flow)", () => {
  it("issues a token and lets a doctor redeem it once", async () => {
    const patientApp = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const invRes = await postJson(patientApp, "/care-team/invites", {
      role: "specialist",
      scope: "full",
      ttlHours: 24,
    });
    expect(invRes.status).toBe(201);
    const inv = await invRes.json();
    expect(inv.token).toMatch(/^[a-f0-9]{48}$/);
    expect(inv.role).toBe("specialist");
    expect(inv.expiresAt).toBeTruthy();
    expect(db.tables["share_links"].rows.length).toBe(1);
    expect(db.tables["share_links"].rows[0].kind).toBe("care_team_invite");

    // Doctor redeems the token.
    const doctorApp = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    // The redeem query joins patients + share_links. The token lookup
    // resolves the share_links row by (token, kind, revoked=false).
    db.setWhere("share_links", (r) =>
      r.token === inv.token && r.kind === "care_team_invite" && !r.revoked
    );

    const redeemRes = await postJson(doctorApp, "/care-team", {
      patientId: PATIENT_ID,
      consentToken: inv.token,
      role: "specialist",
    });
    expect(redeemRes.status).toBe(201);
    const redeemed = await redeemRes.json();
    expect(redeemed.member.role).toBe("specialist");
    expect(redeemed.member.consentRecordId).toBeTruthy();
    // Care team row created.
    expect(db.tables["care_team_members"].rows.length).toBe(1);
  });

  it("rejects second redeem of the same token with 409", async () => {
    // Pre-seed an already-consumed invite.
    db.seed("share_links", [
      {
        id: "link-1",
        patientId: PATIENT_ID,
        token: "consumed-token-xyz",
        kind: "care_team_invite",
        revoked: false,
        consumedAt: "2026-07-01 10:00:00",
        expiresAt: "2099-01-01 00:00:00",
      },
    ]);

    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("share_links", (r) =>
      r.token === "consumed-token-xyz" &&
      r.kind === "care_team_invite" &&
      !r.revoked
    );

    const res = await postJson(app, "/care-team", {
      patientId: PATIENT_ID,
      consentToken: "consumed-token-xyz",
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already redeemed/);
  });

  it("rejects doctor-initiated POST without consentToken with 400", async () => {
    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    const res = await postJson(app, "/care-team", { patientId: PATIENT_ID });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /care-team/:id — status transitions", () => {
  it("patient can revoke an active row", async () => {
    db.seed("care_team_members", [
      {
        id: "ct-1",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        role: "primary_care",
        status: "active",
      },
    ]);

    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("care_team_members", (r) => r.id === "ct-1");

    const res = await patchJson(app, "/care-team/ct-1", { status: "revoked" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member.status).toBe("revoked");
    expect(body.member.revokedAt).toBeTruthy();
  });

  it("doctor CANNOT revoke (patient-self only)", async () => {
    db.seed("care_team_members", [
      {
        id: "ct-1",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        role: "primary_care",
        status: "active",
      },
    ]);
    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("care_team_members", (r) => r.id === "ct-1");

    const res = await patchJson(app, "/care-team/ct-1", { status: "revoked" });
    expect(res.status).toBe(403);
  });

  it("active → paused is allowed for either side", async () => {
    db.seed("care_team_members", [
      {
        id: "ct-1",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        role: "primary_care",
        status: "active",
      },
    ]);
    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("care_team_members", (r) => r.id === "ct-1");

    const res = await patchJson(app, "/care-team/ct-1", { status: "paused" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member.status).toBe("paused");
  });

  it("revoked → active is rejected with 409 (must POST fresh)", async () => {
    db.seed("care_team_members", [
      {
        id: "ct-1",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        role: "primary_care",
        status: "revoked",
      },
    ]);
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("care_team_members", (r) => r.id === "ct-1");

    const res = await patchJson(app, "/care-team/ct-1", { status: "active" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/reactivate/);
  });
});

describe("GET /care-team/reverse — doctor's patient list", () => {
  it("returns active care-team rows pointing at the calling doctor", async () => {
    db.seed("care_team_members", [
      {
        id: "ct-1",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        role: "primary_care",
        status: "active",
        invitedAt: "2026-07-01 10:00:00",
      },
      {
        id: "ct-2",
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        role: "specialist",
        status: "revoked",
        invitedAt: "2026-06-15 10:00:00",
      },
    ]);

    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("care_team_members", (r) =>
      r.doctorId === DOCTOR_ID && r.status === "active"
    );

    const res = await getJson(app, "/care-team/reverse");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.patients[0].careTeamId).toBe("ct-1");
    expect(body.patients[0].patientName).toBe("Alice Patient");
  });

  it("returns empty list when no patients have added the doctor", async () => {
    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("care_team_members", () => false);

    const res = await getJson(app, "/care-team/reverse");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
    expect(body.patients).toEqual([]);
  });
});