// tests/access.test.ts
//
// Critical path: doctor↔patient access control.
//
// These tests are the line of defence against accidentally exposing
// patient PHI to the wrong doctor. The rules under test:
//
//   - patient always self-access (no DB row needed beyond ownership)
//   - doctor needs ONE of:
//       active care_team_members row
//       | appointment
//       | prescription
//       | lab order
//       | medical record
//       | walk-in
//       | active messaging thread
//   - hospital_staff needs a record at their hospital
//
// Mock DB implements the chainable Drizzle surface we use; predicate
// matching is registered by the test before each call (see _mockDb.ts).

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "./_mockDb";
import {
  accessiblePatientsFor,
  canAccessPatient,
} from "../src/lib/access";

const PATIENT_A = "patient-aaa";
const PATIENT_B = "patient-bbb";
const PATIENT_LOCKED = "patient-locked";
const DOCTOR_X = "doctor-xxx";
const DOCTOR_Y = "doctor-yyy";
const STAFF_Z = "staff-zzz";

const USER_DOCTOR_X = "user-doctor-x";
const USER_DOCTOR_Y = "user-doctor-y";
const USER_PATIENT_A = "user-patient-a";
const USER_PATIENT_B = "user-patient-b";
const USER_PATIENT_LOCKED = "user-patient-locked";
const USER_STAFF_Z = "user-staff-z";
const HOSPITAL_1 = "hospital-1";
const HOSPITAL_2 = "hospital-2";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();

  // users
  db.seed("users", [
    { id: USER_DOCTOR_X, role: "doctor" },
    { id: USER_DOCTOR_Y, role: "doctor" },
    { id: USER_PATIENT_A, role: "patient" },
    { id: USER_PATIENT_B, role: "patient" },
    { id: USER_PATIENT_LOCKED, role: "patient" },
    { id: USER_STAFF_Z, role: "hospital_staff" },
  ]);

  // doctors
  db.seed("doctors", [
    { id: DOCTOR_X, userId: USER_DOCTOR_X, hospitalId: HOSPITAL_1 },
    { id: DOCTOR_Y, userId: USER_DOCTOR_Y, hospitalId: HOSPITAL_2 },
  ]);

  // patients
  db.seed("patients", [
    { id: PATIENT_A, userId: USER_PATIENT_A },
    { id: PATIENT_B, userId: USER_PATIENT_B },
    { id: PATIENT_LOCKED, userId: USER_PATIENT_LOCKED },
  ]);
});

describe("canAccessPatient — patient self-access", () => {
  it("allows patient to access their own record", async () => {
    // canAccessPatient first queries patients by id (no predicate needed —
    // our mock returns all rows when no where-predicate is registered, so
    // we don't register one here).
    const r = await canAccessPatient(db, USER_PATIENT_A, "patient", PATIENT_A);
    expect(r.allowed).toBe(true);
    expect(r.patient?.id).toBe(PATIENT_A);
  });

  it("denies patient accessing another patient", async () => {
    const r = await canAccessPatient(db, USER_PATIENT_A, "patient", PATIENT_B);
    expect(r.allowed).toBe(false);
  });
});

describe("canAccessPatient — doctor via care_team_members", () => {
  it("allows doctor with active care-team row", async () => {
    db.seed("care_team_members", [
      {
        id: "ctm-1",
        patientId: PATIENT_A,
        doctorId: DOCTOR_X,
        status: "active",
        scope: "full",
      },
    ]);
    db.setWhere("care_team_members", (r) =>
      r.patientId === PATIENT_A && r.doctorId === DOCTOR_X && r.status === "active"
    );
    const r = await canAccessPatient(db, USER_DOCTOR_X, "doctor", PATIENT_A);
    expect(r.allowed).toBe(true);
    expect(r.scope).toBe("full");
  });

  it("denies doctor with paused care-team row", async () => {
    db.seed("care_team_members", [
      {
        id: "ctm-1",
        patientId: PATIENT_A,
        doctorId: DOCTOR_X,
        status: "paused",
        scope: "full",
      },
    ]);
    db.setWhere("care_team_members", (r) =>
      r.patientId === PATIENT_A && r.doctorId === DOCTOR_X && r.status === "active"
    );
    const r = await canAccessPatient(db, USER_DOCTOR_X, "doctor", PATIENT_A);
    expect(r.allowed).toBe(false);
  });

  it("denies doctor with revoked care-team row", async () => {
    db.seed("care_team_members", [
      {
        id: "ctm-1",
        patientId: PATIENT_A,
        doctorId: DOCTOR_X,
        status: "revoked",
        scope: "full",
      },
    ]);
    db.setWhere("care_team_members", (r) =>
      r.patientId === PATIENT_A && r.doctorId === DOCTOR_X && r.status === "active"
    );
    const r = await canAccessPatient(db, USER_DOCTOR_X, "doctor", PATIENT_A);
    expect(r.allowed).toBe(false);
  });
});

describe("canAccessPatient — doctor via legacy evidence", () => {
  it("allows doctor via appointment", async () => {
    db.seed("appointments", [{ id: "a1", patientId: PATIENT_A, doctorId: DOCTOR_X }]);
    db.setWhere("care_team_members", () => false);
    db.setWhere("appointments", (r) =>
      r.patientId === PATIENT_A && r.doctorId === DOCTOR_X
    );
    const r = await canAccessPatient(db, USER_DOCTOR_X, "doctor", PATIENT_A);
    expect(r.allowed).toBe(true);
  });

  it("allows doctor via prescription", async () => {
    db.seed("prescriptions", [{ id: "rx1", patientId: PATIENT_A, doctorId: DOCTOR_X }]);
    db.setWhere("care_team_members", () => false);
    db.setWhere("appointments", () => false);
    db.setWhere("prescriptions", (r) =>
      r.patientId === PATIENT_A && r.doctorId === DOCTOR_X
    );
    const r = await canAccessPatient(db, USER_DOCTOR_X, "doctor", PATIENT_A);
    expect(r.allowed).toBe(true);
  });

  it("allows doctor via medical record", async () => {
    db.seed("medical_records", [
      { id: "m1", patientId: PATIENT_A, doctorId: DOCTOR_X },
    ]);
    db.setWhere("care_team_members", () => false);
    db.setWhere("appointments", () => false);
    db.setWhere("prescriptions", () => false);
    db.setWhere("labOrders", () => false);
    db.setWhere("medical_records", (r) =>
      r.patientId === PATIENT_A && r.doctorId === DOCTOR_X
    );
    const r = await canAccessPatient(db, USER_DOCTOR_X, "doctor", PATIENT_A);
    expect(r.allowed).toBe(true);
  });

  it("denies doctor with no relationship whatsoever", async () => {
    // All predicates reject everything.
    db.setWhere("care_team_members", () => false);
    db.setWhere("appointments", () => false);
    db.setWhere("prescriptions", () => false);
    db.setWhere("labOrders", () => false);
    db.setWhere("medical_records", () => false);
    db.setWhere("walk_ins", () => false);
    db.setWhere("messages_conversations", () => false);
    db.setWhere("share_links", () => false);
    const r = await canAccessPatient(db, USER_DOCTOR_X, "doctor", PATIENT_A);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/no relationship/);
  });

  it("denies doctor without doctor profile", async () => {
    db.setWhere("care_team_members", () => false);
    db.setWhere("appointments", () => false);
    db.setWhere("prescriptions", () => false);
    db.setWhere("labOrders", () => false);
    db.setWhere("medical_records", () => false);
    db.setWhere("walk_ins", () => false);
    db.setWhere("messages_conversations", () => false);
    db.setWhere("share_links", () => false);
    const r = await canAccessPatient(db, "user-no-doctor-row", "doctor", PATIENT_A);
    expect(r.allowed).toBe(false);
  });
});

describe("canAccessPatient — hospital staff", () => {
  it("allows staff to see patient with record at their hospital", async () => {
    db.seed("hospital_staff", [
      { id: "hs-1", userId: USER_STAFF_Z, hospitalId: HOSPITAL_1 },
    ]);
    db.seed("medical_records", [
      { id: "m1", patientId: PATIENT_A, hospitalId: HOSPITAL_1 },
    ]);
    db.setWhere("hospital_staff", (r) => r.userId === USER_STAFF_Z);
    db.setWhere("medical_records", (r) =>
      r.patientId === PATIENT_A && r.hospitalId === HOSPITAL_1
    );
    const r = await canAccessPatient(db, USER_STAFF_Z, "hospital_staff", PATIENT_A);
    expect(r.allowed).toBe(true);
  });

  it("denies staff when record is at a different hospital", async () => {
    db.seed("hospital_staff", [
      { id: "hs-1", userId: USER_STAFF_Z, hospitalId: HOSPITAL_1 },
    ]);
    db.seed("medical_records", [
      { id: "m1", patientId: PATIENT_A, hospitalId: HOSPITAL_2 },
    ]);
    db.setWhere("hospital_staff", (r) => r.userId === USER_STAFF_Z);
    db.setWhere("medical_records", (r) =>
      r.patientId === PATIENT_A && r.hospitalId === HOSPITAL_1
    );
    const r = await canAccessPatient(db, USER_STAFF_Z, "hospital_staff", PATIENT_A);
    expect(r.allowed).toBe(false);
  });
});

describe("accessiblePatientsFor — doctor union set", () => {
  it("returns union of all evidence tables + care team, deduped", async () => {
    // Same patient reachable via 3 evidence paths — must dedupe to 1 id.
    db.seed("care_team_members", [
      { id: "ct-1", patientId: PATIENT_A, doctorId: DOCTOR_X, status: "active" },
      { id: "ct-2", patientId: PATIENT_B, doctorId: DOCTOR_X, status: "active" },
    ]);
    db.seed("appointments", [{ id: "a1", patientId: PATIENT_A, doctorId: DOCTOR_X }]);
    db.seed("prescriptions", [{ id: "rx1", patientId: PATIENT_B, doctorId: DOCTOR_X }]);
    db.seed("walk_ins", [{ id: "w1", patientId: PATIENT_LOCKED, doctorId: DOCTOR_X }]);

    // The helper makes 7 Promise.all queries. Our mock processes the
    // `where` chain in declaration order — each predicate is consumed
    // exactly once via _resolveWhere. We register one predicate per
    // table; the builder picks it up on `.where()`.
    db.setWhere("appointments", (r) => r.doctorId === DOCTOR_X);
    db.setWhere("prescriptions", (r) => r.doctorId === DOCTOR_X);
    db.setWhere("labOrders", (r) => r.doctorId === DOCTOR_X);
    db.setWhere("medical_records", (r) => r.doctorId === DOCTOR_X);
    db.setWhere("walk_ins", (r) => r.doctorId === DOCTOR_X);
    db.setWhere("messages_conversations", (r) => r.doctorId === DOCTOR_X);
    db.setWhere(
      "care_team_members",
      (r) => r.doctorId === DOCTOR_X && r.status === "active"
    );

    const ids = await accessiblePatientsFor(db, USER_DOCTOR_X, "doctor");
    expect(ids.sort()).toEqual([PATIENT_A, PATIENT_B, PATIENT_LOCKED].sort());
  });

  it("excludes revoked care-team rows from accessible set", async () => {
    db.seed("care_team_members", [
      { id: "ct-1", patientId: PATIENT_A, doctorId: DOCTOR_X, status: "revoked" },
    ]);
    db.setWhere("appointments", () => false);
    db.setWhere("prescriptions", () => false);
    db.setWhere("labOrders", () => false);
    db.setWhere("medical_records", () => false);
    db.setWhere("walk_ins", () => false);
    db.setWhere("messages_conversations", () => false);
    db.setWhere(
      "care_team_members",
      (r) => r.doctorId === DOCTOR_X && r.status === "active"
    );

    const ids = await accessiblePatientsFor(db, USER_DOCTOR_X, "doctor");
    expect(ids).toEqual([]);
  });

  it("returns only self for a patient role", async () => {
    const ids = await accessiblePatientsFor(db, USER_PATIENT_A, "patient");
    expect(ids).toEqual([PATIENT_A]);
  });

  it("returns empty for unknown role", async () => {
    const ids = await accessiblePatientsFor(db, USER_STAFF_Z, "hospital_staff");
    expect(ids).toEqual([]);
  });
});