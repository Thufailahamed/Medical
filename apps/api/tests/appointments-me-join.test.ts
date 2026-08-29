// tests/appointments-me-join.test.ts
//
// GET /appointments/me must carry the doctor and hospital NAMES, not
// just their ids — the patient portal's upcoming-appointment card
// renders "Dr. Perera · Asiri Central" and cannot resolve ids itself.
//
// The join is additive: this test also pins that every pre-existing
// key survives, because the mobile app reads the same endpoint.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, getJson } from "./_testApp";
import appointmentsRouter from "../src/routes/appointments";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-join";
const PATIENT_ID = "patient-join";
const DOCTOR_USER = "user-doctor-join";
const DOCTOR_ID = "doctor-join";
const HOSPITAL_ID = "hospital-join";

let db: MockD1;
let app: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Alex", email: "a@test.local" },
    { id: DOCTOR_USER, role: "doctor", name: "Dr. Perera", email: "d@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [
    { id: DOCTOR_ID, userId: DOCTOR_USER, specialization: "Cardiology" },
  ]); // userId seeded with JS key
  db.seed("hospitals", [{ id: HOSPITAL_ID, name: "Asiri Central" }]);
  db.seed("appointments", [
    {
      id: "apt-1",
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-09-10",
      time: "10:00",
      status: "confirmed",
      mode: "in_person",
      reason: "Follow-up",
    },
  ]);

  app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
  app.route("/appointments", appointmentsRouter);
});

describe("GET /appointments/me", () => {
  it("returns the doctor name, specialization and hospital name", async () => {
    db.setWhere("patients", (r: any) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r: any) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.appointments).toHaveLength(1);

    const row = body.appointments[0];
    console.log("ROW", JSON.stringify(row));
    expect(row.doctorName).toBe("Dr. Perera");
    expect(row.doctorSpecialization).toBe("Cardiology");
    expect(row.hospitalName).toBe("Asiri Central");
  });

  it("preserves every pre-existing key so the mobile app keeps working", async () => {
    db.setWhere("patients", (r: any) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r: any) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    const row = ((await res.json()) as any).appointments[0];

    expect(row.id).toBe("apt-1");
    expect(row.doctorId).toBe(DOCTOR_ID);
    expect(row.hospitalId).toBe(HOSPITAL_ID);
    expect(row.date).toBe("2026-09-10");
    expect(row.time).toBe("10:00");
    expect(row.status).toBe("confirmed");
    expect(row.mode).toBe("in_person");
    expect(row.reason).toBe("Follow-up");
    expect(row.recordCount).toBe(0);
  });

  it("returns null names rather than dropping the row when the doctor is missing", async () => {
    db = new MockD1();
    db.seed("users", [
      { id: PATIENT_USER, role: "patient", name: "Alex", email: "a@test.local" },
    ]);
    db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
    db.seed("doctors", []);
    db.seed("hospitals", [{ id: HOSPITAL_ID, name: "Asiri Central" }]);
    db.seed("appointments", [
      {
        id: "apt-2",
        patientId: PATIENT_ID,
        doctorId: "doctor-deleted",
        hospitalId: HOSPITAL_ID,
        date: "2026-09-11",
        time: "11:00",
        status: "scheduled",
        mode: "in_person",
        reason: null,
      },
    ]);
    app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/appointments", appointmentsRouter);

    db.setWhere("patients", (r: any) => r.userId === PATIENT_USER);

    const res = await getJson(app, "/appointments/me");
    const rows = ((await res.json()) as any).appointments;

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("apt-2");
    expect(rows[0].doctorName).toBeNull();
    expect(rows[0].doctorSpecialization).toBeNull();
    expect(rows[0].hospitalName).toBe("Asiri Central");
  });
});