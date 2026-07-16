// tests/appointments-telemedicine.test.ts
//
// Doctor Booking (Round 6): video-mode booking gated on
// `doctors.telemedicine_enabled`.
//
// What we cover:
//   - POST /appointments with `mode: "video"` against a doctor that
//     has the flag returns 409 reason: "telemedicine_unavailable".
//   - Same request against a doctor with the flag enabled returns 201.
//   - POST /appointments with `mode: "in_person"` is unaffected by
//     the flag (in-person always allowed).

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson } from "./_testApp";
import appointmentsRouter from "../src/routes/appointments";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-tm";
const PATIENT_ID = "patient-tm";
const HOSPITAL_ID = "00000000-0000-4000-8000-0000000000aa";
const DOCTOR_ID = "00000000-0000-4000-8000-0000000000bb";

let db: MockD1;
let baseApp: Hono<AppEnvironment>;

async function seedDoctor(telemedicineEnabled: boolean) {
  db.seed("doctors", [
    {
      id: DOCTOR_ID,
      userId: "user-doctor-tm",
      telemedicineEnabled,
    } as any,
  ]);
}

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Pat", email: "p@test.local" },
    { id: "user-doctor-tm", role: "doctor", name: "Doc", email: "d@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("hospitals", [{ id: HOSPITAL_ID, name: "Test Hospital" }]);
  db.seed("appointments", []);
  baseApp = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
  baseApp.route("/appointments", appointmentsRouter);
});

describe("POST /appointments — telemedicine gating", () => {
  it("rejects mode=video with 409 when doctor.telemedicineEnabled=false", async () => {
    await seedDoctor(false);
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("doctors", (r) => r.id === DOCTOR_ID);

    const res = await postJson(baseApp, "/appointments", {
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-08-10",
      time: "09:00",
      mode: "video",
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.reason).toBe("telemedicine_unavailable");

    // No row inserted on rejection.
    expect(db.tables["appointments"].rows.length).toBe(0);
  });

  it("accepts mode=video with 201 when doctor.telemedicineEnabled=true", async () => {
    await seedDoctor(true);
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("doctors", (r) => r.id === DOCTOR_ID);

    const res = await postJson(baseApp, "/appointments", {
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-08-11",
      time: "09:30",
      mode: "video",
    });
    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(`expected 201 got ${res.status}: ${text}`);
    }
    const rows = db.tables["appointments"].rows;
    expect(rows.length).toBe(1);
    expect(rows[0].mode).toBe("video");
  });

  it("accepts mode=in_person regardless of telemedicineEnabled", async () => {
    await seedDoctor(false);
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);
    db.setWhere("doctors", (r) => r.id === DOCTOR_ID);

    const res = await postJson(baseApp, "/appointments", {
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-08-12",
      time: "10:00",
      mode: "in_person",
    });
    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(`expected 201 got ${res.status}: ${text}`);
    }
    expect(db.tables["appointments"].rows[0].mode).toBe("in_person");
  });
});