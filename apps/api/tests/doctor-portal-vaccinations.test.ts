// tests/doctor-portal-vaccinations.test.ts
//
// P1 bundle 2 — vaccinations write path on the doctor portal.
// The route was previously stubbed on the web side (`toast.info("coming soon")`)
// because there was no backend endpoint. Now `POST /doctor-portal/vaccinations`
// lets a doctor record a vaccination on behalf of a patient.

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { medicalRecords, vaccineCatalog } from "@healthcare/db";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import doctorPortalRouter from "../src/routes/doctor-portal";
import { MockD1 } from "./_mockDb";

const DOCTOR_USER = "doc-user-1";
const DOCTOR_ID = "doc-1";
const PATIENT_USER = "pat-user-1";
const PATIENT_ID = "pat-1";
const HOSPITAL_ID = "hosp-1";
const TEST_SECRET = "test-secret-do-not-use-in-prod";

type AppEnv = { Bindings: any; Variables: any };

async function makeToken(userId: string, role: string): Promise<string> {
  return sign(
    {
      sub: userId,
      role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    TEST_SECRET,
  );
}

async function buildApp(db: MockD1) {
  db.seed("users", [
    { id: DOCTOR_USER, role: "doctor", email: "doc@test.local", name: "Dr. Test" },
    { id: PATIENT_USER, role: "patient", email: "pat@test.local", name: "Pat" },
  ]);
  db.seed("doctors", [
    { id: DOCTOR_ID, userId: DOCTOR_USER, hospitalId: HOSPITAL_ID, specialization: "GP" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER, fullName: "Pat" }]);
  // Prior appointment gives the doctor access per canAccessPatient.
  db.seed("appointments", [
    {
      id: "appt-1",
      patientId: PATIENT_ID,
      doctorId: DOCTOR_ID,
      status: "completed",
      scheduledAt: "2026-01-01T10:00:00Z",
    },
  ]);

  const app = new Hono<AppEnv>();
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
  return app;
}

describe("POST /doctor-portal/vaccinations", () => {
  let db: MockD1;
  beforeEach(() => {
    db = new MockD1();
  });

  it("records a vaccination referencing an existing catalog row", async () => {
    db.seed("vaccine_catalog", [
      {
        id: "vc-bcg",
        name: "BCG",
        shortName: "BCG",
        schedule: "[]",
        targetDisease: "Tuberculosis",
      },
    ]);
    const app = await buildApp(db);

    const res = await app.request("/doctor-portal/vaccinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        vaccineId: "vc-bcg",
        doseNumber: 1,
        administeredAt: "2026-02-01",
        provider: "Dr. Test",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.vaccination).toBeTruthy();
    expect(body.vaccination.recordType).toBe("vaccination");
    expect(body.vaccination.title).toBe("BCG");
    expect(body.vaccination.recordDate).toBe("2026-02-01");
    expect(body.vaccination.hospitalId).toBe(HOSPITAL_ID);

    // Row is queryable from the table directly.
    const rows = await db.select().from(medicalRecords).where(eq(medicalRecords.patientId, PATIENT_ID));
    expect(rows.length).toBe(1);
    expect((rows[0] as any).recordType).toBe("vaccination");
  });

  it("accepts a free-text vaccineName when no catalog match", async () => {
    const app = await buildApp(db);

    const res = await app.request("/doctor-portal/vaccinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: PATIENT_ID,
        vaccineName: "Experimental Vaccine X",
        doseNumber: 1,
        administeredAt: "2026-02-01",
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.vaccination.title).toBe("Experimental Vaccine X");
    expect(body.vaccination.description).toBe("Dose 1");
  });

  it("rejects requests missing patientId with 400", async () => {
    const app = await buildApp(db);
    const res = await app.request("/doctor-portal/vaccinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaccineName: "BCG" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects requests for a patient the doctor has no relationship with", async () => {
    const app = await buildApp(db);
    const res = await app.request("/doctor-portal/vaccinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "pat-unrelated",
        vaccineName: "BCG",
      }),
    });
    expect(res.status).toBe(403);
  });
});