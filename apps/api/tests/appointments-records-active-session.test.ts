// tests/appointments-records-active-session.test.ts
//
// Round 6 P1: GET /appointments/:id/records embeds the active teleconsult
// session (status in [requested,ringing,active]) so the mobile
// appointment-detail screen can render the "Join video visit" CTA in a
// single round-trip. NULL when no live session — covers both "doctor
// hasn't opened the room yet" and "the call ended/failed/timed out".
//
// Ownership: the existing route enforces patient OR doctor OR caretaker
// (via resolvePatientContext) on the appointment. We test the patient
// path; the doctor's path uses the same `db.select(teleconsultSessions)`
// query so it inherits the same activeSession semantics.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, getJson } from "./_testApp";
import appointmentsRouter from "../src/routes/appointments";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-records";
const PATIENT_ID = "patient-records";
const DOCTOR_USER = "user-doctor-records";
const DOCTOR_ID = "doctor-records";
const APPT_ID = "appt-records-1";
const SESSION_ID = "tele-records-1";

let db: MockD1;
let baseApp: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Pat", email: "p@r.local" },
    { id: DOCTOR_USER, role: "doctor", name: "Doc", email: "d@r.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [{ id: DOCTOR_ID, userId: DOCTOR_USER }]);
  db.seed("appointments", [
    {
      id: APPT_ID,
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      date: "2026-08-01",
      time: "10:00",
      mode: "video",
      status: "confirmed",
    },
  ]);
  baseApp = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
  baseApp.route("/appointments", appointmentsRouter);
});

describe("GET /appointments/:id/records — activeSession embed", () => {
  it("returns activeSession: null when no teleconsult row exists", async () => {
    // No seeding for teleconsult_sessions — empty table.
    const res = await getJson(baseApp, `/appointments/${APPT_ID}/records`);
    if (res.status !== 200) {
      throw new Error(`expected 200 got ${res.status}`);
    }
    const body = (await res.json()) as any;
    expect(body.activeSession).toBeNull();
    // Sanity: existing payload still returns.
    expect(body.appointment.id).toBe(APPT_ID);
    expect(body.doctor).not.toBeNull();
  });

  it("returns the session row when status is in [requested,ringing,active]", async () => {
    db.seed("teleconsult_sessions", [
      {
        id: SESSION_ID,
        appointmentId: APPT_ID,
        doctorId: DOCTOR_USER,
        patientUserId: PATIENT_USER,
        status: "active",
        roomId: "room-1",
      },
    ]);

    const res = await getJson(baseApp, `/appointments/${APPT_ID}/records`);
    if (res.status !== 200) {
      throw new Error(`expected 200 got ${res.status}`);
    }
    const body = (await res.json()) as any;
    expect(body.activeSession).not.toBeNull();
    expect(body.activeSession.id).toBe(SESSION_ID);
    expect(body.activeSession.status).toBe("active");
    expect(body.activeSession.roomId).toBe("room-1");
  });

  it("excludes ended/failed/timeout sessions (returns null)", async () => {
    db.seed("teleconsult_sessions", [
      {
        id: "tele-ended-1",
        appointmentId: APPT_ID,
        doctorId: DOCTOR_USER,
        patientUserId: PATIENT_USER,
        status: "ended",
        roomId: "room-1",
      },
      {
        id: "tele-failed-1",
        appointmentId: APPT_ID,
        doctorId: DOCTOR_USER,
        patientUserId: PATIENT_USER,
        status: "failed",
        roomId: "room-2",
      },
      {
        id: "tele-timeout-1",
        appointmentId: APPT_ID,
        doctorId: DOCTOR_USER,
        patientUserId: PATIENT_USER,
        status: "timeout",
        roomId: "room-3",
      },
    ]);

    const res = await getJson(baseApp, `/appointments/${APPT_ID}/records`);
    if (res.status !== 200) {
      throw new Error(`expected 200 got ${res.status}`);
    }
    const body = (await res.json()) as any;
    expect(body.activeSession).toBeNull();
  });
});