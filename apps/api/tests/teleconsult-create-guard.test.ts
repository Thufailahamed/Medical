// tests/teleconsult-create-guard.test.ts
//
// A no_show / completed / cancelled appointment must never start a
// teleconsult session — the patient didn't attend or the visit is over.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson } from "./_testApp";
import teleconsultRouter from "../src/routes/teleconsult";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-cg";
const PATIENT_ID = "patient-cg";
const DOCTOR_USER = "user-doctor-cg";
const DOCTOR_ID = "doctor-cg";

let db: MockD1;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Pat", email: "p@test.local" },
    { id: DOCTOR_USER, role: "doctor", name: "Doc", email: "d@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [{ id: DOCTOR_ID, userId: DOCTOR_USER }]);
});

function doctorApp() {
  return buildTestApp(db, { id: DOCTOR_USER, role: "doctor" }).then((app) => {
    app.route("/teleconsult", teleconsultRouter);
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("appointments", () => true);
    return app;
  });
}

describe("POST /teleconsult/sessions — appointment status guard", () => {
  for (const status of ["no_show", "completed", "cancelled"]) {
    it(`rejects ${status} appointments with 409`, async () => {
      db.seed("appointments", [
        { id: `apt-${status}`, doctorId: DOCTOR_ID, patientId: PATIENT_ID, status, mode: "video", date: "2026-12-01", time: "10:00" },
      ]);
      const app = await doctorApp();
      const res = await postJson(app, "/teleconsult/sessions", {
        appointmentId: `apt-${status}`,
      });
      expect(res.status).toBe(409);
    });
  }

  it("rejects in_person appointments with 409 (not a video visit)", async () => {
    db.seed("appointments", [
      { id: "apt-ipp", doctorId: DOCTOR_ID, patientId: PATIENT_ID, status: "confirmed", mode: "in_person", date: "2026-12-01", time: "10:00" },
    ]);
    const app = await doctorApp();
    const res = await postJson(app, "/teleconsult/sessions", { appointmentId: "apt-ipp" });
    expect(res.status).toBe(409);
  });
});
