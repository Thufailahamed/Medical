// tests/doctor-portal-queue-mode.test.ts
//
// Round 6 P2: GET /doctor-portal/queue?mode=video (and `?mode=in_person`)
// narrows the queue to a single consultation mode. No mode → unchanged
// "everything for today" behavior.
//
// The route's WHERE clause is built conditionally — we test both the
// filter-on path and the no-filter path so we don't accidentally lock
// the query to one shape.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { MockD1 } from "./_mockDb";
import doctorPortalRouter from "../src/routes/doctor-portal";
import type { AppEnvironment } from "../src/types";

const DOCTOR_USER = "user-doctor-queue-mode";
const DOCTOR_ID = "doctor-queue-mode";
const PATIENT_USER = "user-patient-queue-mode";
const PATIENT_ID = "patient-queue-mode";
const HOSPITAL_ID = "hosp-queue-mode";
const TEST_SECRET = "test-secret-do-not-use-in-prod";
const TODAY = "2026-07-15";

let db: MockD1;
let app: Hono<AppEnvironment>;

async function makeToken(userId: string, role: string) {
  return sign({ sub: userId, role, exp: Math.floor(Date.now() / 1000) + 3600 } as any, TEST_SECRET);
}

async function setupDb() {
  db = new MockD1();
  db.seed("users", [
    { id: DOCTOR_USER, role: "doctor", email: "d@q.local", name: "Doc" },
    { id: PATIENT_USER, role: "patient", email: "p@q.local", name: "Pat" },
  ]);
  db.seed("doctors", [{ id: DOCTOR_ID, userId: DOCTOR_USER, hospitalId: HOSPITAL_ID }]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("hospitals", [{ id: HOSPITAL_ID, name: "Test Hospital" }]);
  // Three appointments for today: 2 video, 1 in-person.
  db.seed("appointments", [
    {
      id: "appt-vid-1",
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      date: TODAY,
      time: "09:00",
      mode: "video",
      status: "confirmed",
    },
    {
      id: "appt-vid-2",
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      date: TODAY,
      time: "10:00",
      mode: "video",
      status: "scheduled",
    },
    {
      id: "appt-ip-1",
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      date: TODAY,
      time: "11:00",
      mode: "in_person",
      status: "confirmed",
    },
  ]);

  app = new Hono<AppEnvironment>();
  const token = await makeToken(DOCTOR_USER, "doctor");
  app.use("*", async (c, next) => {
    c.env = { ...c.env, JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    const req = new Request(c.req.raw, {
      headers: {
        ...Object.fromEntries(c.req.raw.headers.entries()),
        Authorization: `Bearer ${token}`,
      },
    });
    c.req.raw = req;
    await next();
  });
  app.route("/doctor-portal", doctorPortalRouter);
}

beforeEach(setupDb);

describe("GET /doctor-portal/queue — mode filter", () => {
  it("?mode=video returns only video-mode appointments", async () => {
    const res = await app.request(`/doctor-portal/queue?date=${TODAY}&mode=video`);
    if (res.status !== 200) {
      const text = await res.text();
      throw new Error(`expected 200 got ${res.status}: ${text}`);
    }
    const body = (await res.json()) as any;
    expect(body.queue.length).toBe(2);
    for (const item of body.queue) {
      expect(item.mode).toBe("video");
    }
    // The in-person appt is filtered out.
    const ids = body.queue.map((q: any) => q.appointmentId);
    expect(ids).toContain("appt-vid-1");
    expect(ids).toContain("appt-vid-2");
    expect(ids).not.toContain("appt-ip-1");
  });

  it("no mode param returns all appointments for the day (video + in-person)", async () => {
    const res = await app.request(`/doctor-portal/queue?date=${TODAY}`);
    if (res.status !== 200) {
      throw new Error(`expected 200 got ${res.status}`);
    }
    const body = (await res.json()) as any;
    expect(body.queue.length).toBe(3);
    const modes = body.queue.map((q: any) => q.mode).sort();
    expect(modes).toEqual(["in_person", "video", "video"]);
  });

  it("?mode=in_person returns only the in-person row", async () => {
    const res = await app.request(`/doctor-portal/queue?date=${TODAY}&mode=in_person`);
    if (res.status !== 200) {
      throw new Error(`expected 200 got ${res.status}`);
    }
    const body = (await res.json()) as any;
    expect(body.queue.length).toBe(1);
    expect(body.queue[0].appointmentId).toBe("appt-ip-1");
    expect(body.queue[0].mode).toBe("in_person");
  });
});