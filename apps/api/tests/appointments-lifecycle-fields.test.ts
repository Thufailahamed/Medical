// tests/appointments-lifecycle-fields.test.ts
//
// GET /appointments/me must stamp derived lifecycle fields (startsAt,
// isPast, isLive, bucket) so clients stop doing their own date-string
// math (the "old sessions show as Coming up" bug).

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, getJson } from "./_testApp";
import appointmentsRouter from "../src/routes/appointments";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-lc";
const PATIENT_ID = "patient-lc";

let db: MockD1;
let app: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Lex", email: "l@test.local" },
    { id: "user-doc-lc", role: "doctor", name: "Dr. L", email: "dl@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [{ id: "doctor-lc", userId: "user-doc-lc" }]);
  db.seed("hospitals", [{ id: "hosp-lc", name: "Test Hospital" }]);

  // Far-future rows so autoExpireAppointments (15-min grace) leaves them alone.
  db.seed("appointments", [
    {
      id: "apt-future",
      patientId: PATIENT_ID,
      doctorId: "doctor-lc",
      hospitalId: "hosp-lc",
      date: "2027-01-10",
      time: "10:00",
      status: "confirmed",
      mode: "in_person",
    },
    {
      id: "apt-done",
      patientId: PATIENT_ID,
      doctorId: "doctor-lc",
      hospitalId: "hosp-lc",
      date: "2027-01-05",
      time: "09:00",
      status: "completed",
      mode: "video",
    },
  ]);

  app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
  app.route("/appointments", appointmentsRouter);
});

describe("GET /appointments/me — lifecycle fields", () => {
  it("stamps startsAt/isPast/isLive/bucket on every row", async () => {
    db.setWhere("patients", (r: any) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r: any) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    const future = body.appointments.find((a: any) => a.id === "apt-future");
    expect(typeof future.startsAt).toBe("number");
    expect(future.startsAt).toBe(
      new Date("2027-01-10T10:00:00+05:30").getTime()
    );
    expect(future.isPast).toBe(false);
    expect(future.isLive).toBe(false);
    expect(future.bucket).toBe("upcoming");

    const done = body.appointments.find((a: any) => a.id === "apt-done");
    expect(done.bucket).toBe("completed");
    expect(done.isLive).toBe(false);
  });

  it("keeps every pre-existing key intact", async () => {
    db.setWhere("patients", (r: any) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r: any) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    const row = ((await res.json()) as any).appointments[0];
    expect(row.id).toBeTruthy();
    expect(row.date).toBeTruthy();
    expect(row.status).toBeTruthy();
    expect(typeof row.recordCount).toBe("number");
  });
});
