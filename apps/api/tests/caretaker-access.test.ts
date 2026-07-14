// tests/caretaker-access.test.ts
//
// Caretaker Profiles — make sure caretakers can actually reach the
// routes they need to manage their principal's data.
//
// Test strategy: lean on the authMiddleware DEV_MODE bypass by
// pre-seeding `dev-user-001` with the role we want for each scenario.
// This sidesteps JWT signing while still exercising the real
// route + auth chain (resolving the dev user, then going through the
// resolvePatientContext / requireRole / active-principal flow).
//
// The active-principal context is injected directly via
// `c.set("activePrincipalPatientId", X)` after reading the request
// header — this mirrors what the real caretaker-context middleware
// does, which we can't easily run here because it touches the D1
// binding that the in-memory mock doesn't satisfy.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import appointmentsRouter from "../src/routes/appointments";
import timelineRouter from "../src/routes/timeline";
import emergencyRouter from "../src/routes/emergency";
import notificationsRouter from "../src/routes/notifications";
import type { AppEnvironment } from "../src/types";

const PRINCIPAL_USER = "user-principal";
const PRINCIPAL_PATIENT = "patient-principal";
const DOCTOR_USER = "user-doctor";
const DOCTOR_ID = "00000000-0000-4000-8000-00000000bbbb";
const HOSPITAL_ID = "00000000-0000-4000-8000-00000000aaaa";

let db: MockD1;

function buildApp() {
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.set("db", db as any);
    c.env = c.env || ({} as any);
    (c.env as any).ENVIRONMENT = "test";
    (c.env as any).DEV_MODE = "true";
    // Mirror caretaker-context middleware: read the header and stamp
    // the context var. The real middleware also writes a durable
    // column on the users table; for these route-level tests the
    // header alone is enough to drive resolvePatientContext.
    const activePrincipalHeader = c.req.header("x-active-principal-patient-id");
    if (activePrincipalHeader) {
      c.set("activePrincipalPatientId", activePrincipalHeader);
    }
    await next();
  });
  app.route("/appointments", appointmentsRouter);
  app.route("/timeline", timelineRouter);
  app.route("/emergency", emergencyRouter);
  app.route("/notifications", notificationsRouter);
  return app;
}

function postJson(
  app: Hono<AppEnvironment>,
  path: string,
  body: any,
  headers: Record<string, string> = {}
) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function del(
  app: Hono<AppEnvironment>,
  path: string,
  headers: Record<string, string> = {}
) {
  return app.request(path, { method: "DELETE", headers });
}

function get(
  app: Hono<AppEnvironment>,
  path: string,
  headers: Record<string, string> = {}
) {
  return app.request(path, { method: "GET", headers });
}

function seedCommon() {
  db.seed("users", [
    { id: PRINCIPAL_USER, role: "patient", name: "Pat", email: "p@test.local" },
    { id: DOCTOR_USER, role: "doctor", name: "Doc", email: "d@test.local" },
  ]);
  db.seed("patients", [{ id: PRINCIPAL_PATIENT, userId: PRINCIPAL_USER }]);
  db.seed("doctors", [{ id: DOCTOR_ID, userId: DOCTOR_USER }]);
  db.seed("hospitals", [{ id: HOSPITAL_ID, name: "Test Hospital" }]);
  db.seed("patientLinks", [
    {
      id: "link-1",
      caretakerUserId: "dev-user-001",
      principalPatientId: PRINCIPAL_PATIENT,
      careRole: "guardian",
      status: "active",
    },
  ]);
}

describe("GET /appointments/me", () => {
  beforeEach(() => {
    db = new MockD1();
    seedCommon();
  });

  it("returns the principal's appointments for a caretaker", async () => {
    db.seed("users", [
      { id: "dev-user-001", role: "caretaker", name: "Care", email: "c@test.local" },
    ]);
    db.seed("appointments", [
      {
        id: "appt-1",
        patientId: PRINCIPAL_PATIENT,
        doctorId: DOCTOR_ID,
        hospitalId: HOSPITAL_ID,
        date: "2026-09-01",
        time: "10:00",
        status: "scheduled",
      },
    ]);
    const app = buildApp();
    db.setWhere("patients", (r) => r.id === PRINCIPAL_PATIENT);
    db.setWhere("appointments", (r) => r.patientId === PRINCIPAL_PATIENT);

    const res = await get(app, "/appointments/me", {
      "x-active-principal-patient-id": PRINCIPAL_PATIENT,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointments).toHaveLength(1);
    expect(body.appointments[0].id).toBe("appt-1");
  });

  it("returns the patient's own appointments (regression)", async () => {
    // dev-user-001 masquerades as the patient for this case. Re-anchor
    // the patients row to dev-user-001 so resolvePatientContext finds
    // it.
    db.seed("users", [
      { id: "dev-user-001", role: "patient", name: "Dev", email: "d@test.local" },
    ]);
    db.seed("patients", [{ id: PRINCIPAL_PATIENT, userId: "dev-user-001" }]);
    db.seed("appointments", [
      {
        id: "appt-self",
        patientId: PRINCIPAL_PATIENT,
        doctorId: DOCTOR_ID,
        hospitalId: HOSPITAL_ID,
        date: "2026-09-01",
        time: "10:00",
        status: "scheduled",
      },
    ]);
    const app = buildApp();
    db.setWhere("patients", (r) => r.userId === "dev-user-001");
    db.setWhere("appointments", (r) => r.patientId === PRINCIPAL_PATIENT);

    const res = await get(app, "/appointments/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointments).toHaveLength(1);
  });
});

describe("POST /appointments — booking for principal as caretaker", () => {
  beforeEach(() => {
    db = new MockD1();
    seedCommon();
    db.seed("users", [
      { id: "dev-user-001", role: "caretaker", name: "Care", email: "c@test.local" },
    ]);
  });

  it("inserts the appointment under the principal's patient id", async () => {
    const app = buildApp();
    db.setWhere("patients", (r) => r.id === PRINCIPAL_PATIENT);
    db.setWhere("appointments", () => false);

    const res = await postJson(
      app,
      "/appointments",
      {
        doctorId: DOCTOR_ID,
        hospitalId: HOSPITAL_ID,
        date: "2026-09-15",
        time: "09:00",
        mode: "in_person",
      },
      { "x-active-principal-patient-id": PRINCIPAL_PATIENT }
    );
    if (res.status !== 201) {
      throw new Error(`expected 201 got ${res.status}: ${await res.text()}`);
    }
    const rows = db.tables["appointments"].rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].patientId).toBe(PRINCIPAL_PATIENT);
    expect(rows[0].status).toBe("scheduled");
  });
});

describe("DELETE /appointments/:id — cancel principal's appointment", () => {
  beforeEach(() => {
    db = new MockD1();
    seedCommon();
    db.seed("users", [
      { id: "dev-user-001", role: "caretaker", name: "Care", email: "c@test.local" },
    ]);
  });

  it("succeeds for caretaker with active principal", async () => {
    db.seed("appointments", [
      {
        id: "appt-cancel",
        patientId: PRINCIPAL_PATIENT,
        doctorId: DOCTOR_ID,
        hospitalId: HOSPITAL_ID,
        date: "2026-09-20",
        time: "11:00",
        status: "scheduled",
        paymentStatus: null,
        paymentAmount: null,
      },
    ]);
    const app = buildApp();
    db.setWhere("patients", (r) => r.id === PRINCIPAL_PATIENT);
    db.setWhere("appointments", (r) => r.id === "appt-cancel");

    const res = await del(app, "/appointments/appt-cancel", {
      "x-active-principal-patient-id": PRINCIPAL_PATIENT,
    });
    expect(res.status).toBe(200);
    const updated = db.tables["appointments"].rows[0];
    expect(updated.status).toBe("cancelled");
  });
});

describe("GET /timeline/me", () => {
  beforeEach(() => {
    db = new MockD1();
    seedCommon();
    db.seed("users", [
      { id: "dev-user-001", role: "caretaker", name: "Care", email: "c@test.local" },
    ]);
  });

  it("returns the principal's events for a caretaker", async () => {
    db.seed("medicalRecords", [
      {
        id: "rec-1",
        patientId: PRINCIPAL_PATIENT,
        title: "Checkup",
        recordType: "consult",
        recordDate: "2026-08-01",
        createdAt: "2026-08-01T00:00:00Z",
      },
    ]);
    const app = buildApp();
    db.setWhere("patients", (r) => r.id === PRINCIPAL_PATIENT);
    db.setWhere("medicalRecords", (r) => r.patientId === PRINCIPAL_PATIENT);

    const res = await get(app, "/timeline/me", {
      "x-active-principal-patient-id": PRINCIPAL_PATIENT,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events.some((e: any) => e.id === "rec-rec-1")).toBe(true);
  });
});

describe("GET /emergency/me", () => {
  beforeEach(() => {
    db = new MockD1();
    seedCommon();
    db.seed("users", [
      { id: "dev-user-001", role: "caretaker", name: "Care", email: "c@test.local" },
    ]);
  });

  it("returns the principal's emergency history for a caretaker", async () => {
    db.seed("emergencies", [
      {
        id: "em-1",
        patientId: PRINCIPAL_PATIENT,
        status: "resolved",
        location: null,
        createdAt: "2026-07-01T00:00:00Z",
      },
    ]);
    const app = buildApp();
    db.setWhere("patients", (r) => r.id === PRINCIPAL_PATIENT);
    db.setWhere("emergencies", (r) => r.patientId === PRINCIPAL_PATIENT);

    const res = await get(app, "/emergency/me", {
      "x-active-principal-patient-id": PRINCIPAL_PATIENT,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.emergencies).toHaveLength(1);
    expect(body.emergencies[0].id).toBe("em-1");
  });
});

describe("POST /emergency/sos — patient-only safety gate", () => {
  beforeEach(() => {
    db = new MockD1();
    seedCommon();
    db.seed("users", [
      { id: "dev-user-001", role: "caretaker", name: "Care", email: "c@test.local" },
    ]);
  });

  it("refuses caretakers with 403", async () => {
    const app = buildApp();
    db.setWhere("patients", (r) => r.id === PRINCIPAL_PATIENT);

    const res = await postJson(
      app,
      "/emergency/sos",
      { latitude: 6.927, longitude: 79.86 },
      { "x-active-principal-patient-id": PRINCIPAL_PATIENT }
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /notifications/me — caretaker union feed", () => {
  beforeEach(() => {
    db = new MockD1();
    seedCommon();
  });

  it("returns caretaker's own + principal's notifications", async () => {
    db.seed("users", [
      { id: "dev-user-001", role: "caretaker", name: "Care", email: "c@test.local" },
    ]);
    db.seed("notifications", [
      {
        id: "n-1",
        userId: "dev-user-001",
        type: "caretaker_link",
        title: "Link state",
        body: "you were linked",
        read: false,
        createdAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "n-2",
        userId: PRINCIPAL_USER,
        type: "appointment",
        title: "Appt booked",
        body: "your mom booked",
        read: false,
        createdAt: "2026-08-02T00:00:00Z",
      },
      {
        id: "n-3",
        userId: "user-someone-else",
        type: "appointment",
        title: "Other",
        body: "should not appear",
        read: false,
        createdAt: "2026-08-03T00:00:00Z",
      },
    ]);
    const app = buildApp();
    db.setWhere("patients", (r) => r.id === PRINCIPAL_PATIENT);

    const res = await get(app, "/notifications/me", {
      "x-active-principal-patient-id": PRINCIPAL_PATIENT,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.notifications.map((n: any) => n.id).sort();
    expect(ids).toEqual(["n-1", "n-2"]);
  });

  it("returns only own notifications for patient role", async () => {
    db.seed("users", [
      { id: "dev-user-001", role: "patient", name: "Dev", email: "d@test.local" },
    ]);
    db.seed("notifications", [
      {
        id: "n-p1",
        userId: "dev-user-001",
        type: "appointment",
        title: "Mine",
        body: "x",
        read: false,
        createdAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "n-p2",
        userId: "user-caretaker-other",
        type: "appointment",
        title: "Other",
        body: "y",
        read: false,
        createdAt: "2026-08-02T00:00:00Z",
      },
    ]);
    const app = buildApp();
    const res = await get(app, "/notifications/me");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications.map((n: any) => n.id)).toEqual(["n-p1"]);
  });
});