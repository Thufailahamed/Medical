// tests/teleconsult-participant.test.ts
//
// Regression: doctors were locked out of their own sessions with
// `403 Not a participant` on GET /sessions/:id, POST :id/start,
// POST :id/end and POST :id/ws-ticket.
//
// Root cause: the route inserts `doctorId = users.id` (see POST /sessions
// and the FK `teleconsult_sessions.doctor_id → users.id`), but
// `resolveParticipant` compared `doctors.id === session.doctorId`
// (`doctors.id` is never equal to `users.id`).
//
// These tests seed the REAL shape (`doctorId = <users.id>`) and assert the
// owning doctor is recognised as a participant.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson, getJson, patchJson } from "./_testApp";
import teleconsultRouter from "../src/routes/teleconsult";
import doctorPortalRouter from "../src/routes/doctor-portal";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-1";
const PATIENT_ID = "patient-1";
const DOCTOR_USER = "user-doctor-1";
const DOCTOR_ID = "doctor-1";
const APPT_ID = "appt-1";

let db: MockD1;
let baseApp: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Alice", email: "a@test.local" },
    { id: DOCTOR_USER, role: "doctor", name: "Dr. Bob", email: "b@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [{ id: DOCTOR_ID, userId: DOCTOR_USER }]);
  db.seed("appointments", [
    {
      id: APPT_ID,
      doctorId: DOCTOR_ID,
      patientId: PATIENT_ID,
      status: "confirmed",
      mode: "video",
      date: "2026-07-13",
      time: "10:00",
    },
  ]);
  // REAL shape: doctorId stores the users.id, not doctors.id.
  db.seed("teleconsultSessions", [
    {
      id: "sess-real",
      appointmentId: APPT_ID,
      doctorId: DOCTOR_USER,
      patientUserId: PATIENT_USER,
      status: "requested",
      roomId: "realroom00001",
      wherebyRoomUrl: "https://example.whereby.com/realroom00001",
      wherebyHostRoomUrl: "https://example.whereby.com/realroom00001?roomKey=host",
    },
  ]);
  baseApp = await buildTestApp(db);
  baseApp.route("/teleconsult", teleconsultRouter);
});

function doctorApp() {
  return buildTestApp(db, { id: DOCTOR_USER, role: "doctor" }).then((app) => {
    app.route("/teleconsult", teleconsultRouter);
    db.setWhere("teleconsultSessions", (r) => r.id === "sess-real");
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("appointments", (r) => r.id === APPT_ID);
    return app;
  });
}

describe("doctor participant identity (real data shape)", () => {
  it("GET /sessions/:id recognises the owning doctor", async () => {
    const app = await doctorApp();
    const res = await getJson(app, "/teleconsult/sessions/sess-real");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.you.role).toBe("doctor");
    expect(body.you.userId).toBe(DOCTOR_USER);
  });

  it("POST /sessions/:id/start flips requested → ringing for the owning doctor", async () => {
    const app = await doctorApp();
    const res = await postJson(app, "/teleconsult/sessions/sess-real/start", {});
    expect(res.status).toBe(200);
    expect(db.tables["teleconsultSessions"].rows[0].status).toBe("ringing");
  });

  it("POST /sessions/:id/end succeeds for the owning doctor", async () => {
    const app = await doctorApp();
    const res = await postJson(app, "/teleconsult/sessions/sess-real/end", {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ended");
  });

  it("POST /sessions/:id/ws-ticket mints a ticket for the owning doctor", async () => {
    const app = await doctorApp();
    const res = await postJson(app, "/teleconsult/sessions/sess-real/ws-ticket", {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket).toBeTruthy();
  });
});

describe("video-mode guard on session creation", () => {
  it("409s when the appointment is not a video visit", async () => {
    db.seed("appointments", [
      {
        id: "appt-ip",
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        status: "confirmed",
        mode: "in_person",
        date: "2026-07-13",
        time: "11:00",
      },
    ]);
    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    app.route("/teleconsult", teleconsultRouter);
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("appointments", (r) => r.id === "appt-ip");
    db.setWhere("patients", (r) => r.id === PATIENT_ID);

    const res = await postJson(app, "/teleconsult/sessions", { appointmentId: "appt-ip" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("appointment_not_video");
  });
});

describe("caretaker joins on behalf of a principal", () => {
  const CARETAKER_USER = "user-caretaker-1";
  const PRINCIPAL_PATIENT = "patient-principal-1";

  beforeEach(async () => {
    db.seed("users", [{ id: CARETAKER_USER, role: "caretaker", name: "Cathy" }]);
    db.seed("patients", [{ id: PRINCIPAL_PATIENT, userId: "user-principal-1" }]);
    db.seed("patientLinks", [
      { id: "link-1", caretakerUserId: CARETAKER_USER, principalPatientId: PRINCIPAL_PATIENT, status: "active" },
    ]);
    // Re-point the live session at the principal's user.
    db.tables["teleconsultSessions"].rows[0].patientUserId = "user-principal-1";
  });

  it("GET /sessions/:id recognises the linked caretaker", async () => {
    const app = await buildTestApp(db, { id: CARETAKER_USER, role: "caretaker" });
    app.route("/teleconsult", teleconsultRouter);
    db.setWhere("teleconsultSessions", (r) => r.id === "sess-real");
    db.setWhere("doctors", () => false);

    const res = await getJson(app, "/teleconsult/sessions/sess-real");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.you.role).toBe("patient");
    expect(body.you.viaCaretaker).toBe(true);
  });

  it("GET /sessions/me/active returns the principal session to the caretaker", async () => {
    const app = await buildTestApp(db, { id: CARETAKER_USER, role: "caretaker" });
    app.route("/teleconsult", teleconsultRouter);

    const res = await getJson(app, "/teleconsult/sessions/me/active");
    const body = await res.json();
    expect(body.session?.id).toBe("sess-real");
  });

  it("unlinked caretakers still get 403", async () => {
    db.seed("users", [{ id: "user-stranger-ct", role: "caretaker", name: "Stranger" }]);
    const app = await buildTestApp(db, { id: "user-stranger-ct", role: "caretaker" });
    app.route("/teleconsult", teleconsultRouter);
    db.setWhere("teleconsultSessions", (r) => r.id === "sess-real");
    db.setWhere("doctors", () => false);

    const res = await getJson(app, "/teleconsult/sessions/sess-real");
    expect(res.status).toBe(403);
  });
});

describe("GET /sessions/by-room/:roomId", () => {
  it("resolves a live room for the patient", async () => {
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/teleconsult", teleconsultRouter);
    db.setWhere("doctors", () => false);
    db.setWhere("appointments", (r) => r.id === APPT_ID);

    const res = await getJson(app, "/teleconsult/sessions/by-room/realroom00001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe("sess-real");
    expect(body.you.role).toBe("patient");
    expect(body.iceServers.length).toBeGreaterThan(0);
  });

  it("404s for unknown rooms", async () => {
    const app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
    app.route("/teleconsult", teleconsultRouter);

    const res = await getJson(app, "/teleconsult/sessions/by-room/doesnotexist0");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /doctor-portal/profile telemedicine toggle", () => {
  it("flips telemedicineEnabled for the calling doctor", async () => {
    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    app.route("/doctor-portal", doctorPortalRouter);
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);

    const res = await patchJson(app, "/doctor-portal/profile", { telemedicineEnabled: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.doctor.telemedicineEnabled).toBe(true);
    expect(db.tables["doctors"].rows[0].telemedicineEnabled).toBe(true);
  });

  it("400s on non-boolean flag", async () => {
    const app = await buildTestApp(db, { id: DOCTOR_USER, role: "doctor" });
    app.route("/doctor-portal", doctorPortalRouter);
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);

    const res = await patchJson(app, "/doctor-portal/profile", { telemedicineEnabled: "yes" });
    expect(res.status).toBe(400);
  });
});
