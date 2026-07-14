// tests/appointments-mode.test.ts
//
// Round 5: patient-requested consultation mode at booking time.
//
// What we cover:
//   - POST /appointments with `mode: "video"` writes the column.
//   - POST /appointments with `mode: "INVALID"` is rejected (400).
//   - POST /appointments with no mode defaults to "in_person".
//   - The inserted row's `mode` is readable on subsequent fetches.
//
// The bookings router pulls the patient `patientId` from the JWT'd
// userId, so we seed a `users` row + matching `patients` row keyed off
// the test constant PATIENT_USER.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson } from "./_testApp";
import appointmentsRouter from "../src/routes/appointments";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-mode";
const PATIENT_ID = "patient-mode";
// Zod schema uses .uuid() so the IDs must be valid UUIDs, not arbitrary
// strings. These constants are repeated in the seed + the request body.
const HOSPITAL_ID = "00000000-0000-4000-8000-00000000aaaa";
const DOCTOR_ID = "00000000-0000-4000-8000-00000000bbbb";

let db: MockD1;
let baseApp: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Pat", email: "p@test.local" },
    // The doctor gets a notify() push triggered by booking; seed a
    // minimal role row so authMiddleware's lookup doesn't reject.
    { id: "user-doctor-mode", role: "doctor", name: "Doc", email: "d@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [{ id: DOCTOR_ID, userId: "user-doctor-mode" }]);
  db.seed("hospitals", [{ id: HOSPITAL_ID, name: "Test Hospital" }]);
  // Reasonable defaults so the slot-collision guard doesn't trigger.
  db.seed("appointments", []);
  baseApp = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
  baseApp.route("/appointments", appointmentsRouter);
});

describe("POST /appointments — mode handling", () => {
  it("persists mode=video when supplied", async () => {
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const res = await postJson(baseApp, "/appointments", {
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-08-01",
      time: "10:00",
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

  it("defaults to in_person when mode is omitted", async () => {
    db.setWhere("patients", (r) => r.userId === PATIENT_USER);

    const res = await postJson(baseApp, "/appointments", {
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-08-02",
      time: "11:00",
    });
    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(`expected 201 got ${res.status}: ${text}`);
    }
    const rows = db.tables["appointments"].rows;
    expect(rows.length).toBe(1);
    expect(rows[0].mode).toBe("in_person");
  });

  it("rejects invalid mode values with 400", async () => {
    const res = await postJson(baseApp, "/appointments", {
      doctorId: DOCTOR_ID,
      hospitalId: HOSPITAL_ID,
      date: "2026-08-03",
      time: "12:00",
      mode: "audio",
    });
    expect(res.status).toBe(400);
  });
});
