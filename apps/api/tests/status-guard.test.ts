// tests/status-guard.test.ts
//
// Critical path: idempotent backfill of care_team_members rows.
//
// The contract: every appointment / prescription / lab order / walk-in
// / messaging thread creation calls upsertActiveCareTeam. The DB has a
// partial UNIQUE index (patient_id, doctor_id, role) WHERE status='active'
// — duplicate active rows are rejected. Our helper catches the unique
// error and returns inserted:false so callers don't crash.
//
// What we test:
//   1. fresh insert succeeds and returns {inserted:true, id}
//   2. duplicate (same triple) returns {inserted:false}
//   3. different role on same (patient, doctor) creates a SECOND row
//   4. non-unique insert errors (e.g. NULL FK) propagate up

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "./_mockDb";
import { upsertActiveCareTeam } from "../src/lib/status-guard";

const PATIENT = "patient-1";
const DOCTOR = "doctor-1";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
});

describe("upsertActiveCareTeam", () => {
  it("inserts a fresh row and returns inserted:true", async () => {
    const r = await upsertActiveCareTeam(db, {
      patientId: PATIENT,
      doctorId: DOCTOR,
      role: "primary_care",
    });
    expect(r.inserted).toBe(true);
    expect(r.id).toBeTruthy();
    expect(db.tables["care_team_members"].rows.length).toBe(1);
    expect(db.tables["care_team_members"].rows[0].status).toBe("active");
    expect(db.tables["care_team_members"].rows[0].role).toBe("primary_care");
  });

  it("returns inserted:false on duplicate (same triple)", async () => {
    db.seed("care_team_members", [
      {
        id: "existing",
        patientId: PATIENT,
        doctorId: DOCTOR,
        role: "primary_care",
        status: "active",
      },
    ]);
    // Simulate Drizzle throwing on the partial UNIQUE constraint.
    db.failNextInsert(
      "care_team_members",
      new Error("UNIQUE constraint failed: care_team_active_unique")
    );

    const r = await upsertActiveCareTeam(db, {
      patientId: PATIENT,
      doctorId: DOCTOR,
      role: "primary_care",
    });
    expect(r.inserted).toBe(false);
    expect(r.id).toBeUndefined();
    // Existing row still wins — no overwrite.
    expect(db.tables["care_team_members"].rows.length).toBe(1);
    expect(db.tables["care_team_members"].rows[0].id).toBe("existing");
  });

  it("allows different role on same (patient, doctor) pair", async () => {
    db.seed("care_team_members", [
      {
        id: "primary",
        patientId: PATIENT,
        doctorId: DOCTOR,
        role: "primary_care",
        status: "active",
      },
    ]);
    // No failNextInsert — different role doesn't violate partial UNIQUE.
    const r = await upsertActiveCareTeam(db, {
      patientId: PATIENT,
      doctorId: DOCTOR,
      role: "specialist",
    });
    expect(r.inserted).toBe(true);
    expect(db.tables["care_team_members"].rows.length).toBe(2);
    const roles = db.tables["care_team_members"].rows
      .map((r) => r.role)
      .sort();
    expect(roles).toEqual(["primary_care", "specialist"]);
  });

  it("propagates non-unique errors (e.g. NOT NULL violation)", async () => {
    db.failNextInsert(
      "care_team_members",
      new Error("NOT NULL constraint failed: care_team_members.patient_id")
    );

    await expect(
      upsertActiveCareTeam(db, {
        patientId: PATIENT,
        doctorId: DOCTOR,
        role: "primary_care",
      })
    ).rejects.toThrow(/NOT NULL/);
  });

  it("records invitedByUserId when supplied", async () => {
    const INVITER = "user-inviter";
    const r = await upsertActiveCareTeam(db, {
      patientId: PATIENT,
      doctorId: DOCTOR,
      role: "primary_care",
      invitedByUserId: INVITER,
    });
    expect(r.inserted).toBe(true);
    expect(db.tables["care_team_members"].rows[0].invitedByUserId).toBe(INVITER);
  });
});