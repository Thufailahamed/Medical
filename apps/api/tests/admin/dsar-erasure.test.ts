// tests/admin/dsar-erasure.test.ts
//
// Covers the new admin-gated erasure contract (P1, plan item #8):
//
//   1. POST /dsar/erasure no longer runs anonymisation inline.
//      The row is created with status="queued" and the patient gets
//      a 202 so the client knows it's still pending approval.
//   2. Admin approve → admin complete (with resultUrl) triggers
//      anonymisePatient() and stamps status="completed".
//
// What's deliberately not tested: the synchronous erasure path that
// existed before P1 — the route no longer exposes it.

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { dsarRequests, patients, users, medicalRecords } from "@healthcare/db";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import dsarRouter from "../../src/routes/dsar";
import adminRouter from "../../src/routes/admin";
import { MockD1 } from "../_mockDb";
import { issueStepUpToken } from "../../src/middleware/stepup";

const PATIENT_ID = "p-1";
const PATIENT_USER = "user-1";
const ADMIN_ID = "admin-1";
const TEST_SECRET = "test-secret-do-not-use-in-prod";

type AppEnv = { Bindings: any; Variables: any };

async function makeToken(userId: string): Promise<string> {
  return sign(
    {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    } as any,
    TEST_SECRET,
  );
}

async function buildPatientApp(db: MockD1, user: { id: string; role: string }) {
  db.seed("users", [
    { id: user.id, role: user.role, email: `${user.id}@test.local`, name: "Test " + user.id },
  ]);
  const app = new Hono<AppEnv>();
  const token = await makeToken(user.id);
  app.use("*", async (c, next) => {
    c.env = { ...c.env, JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    // Re-inject Authorization so authMiddleware takes the JWT path.
    const req = new Request(c.req.raw, {
      headers: {
        ...Object.fromEntries(c.req.raw.headers.entries()),
        Authorization: `Bearer ${token}`,
      },
    });
    c.req.raw = req;
    await next();
  });
  app.route("/dsar", dsarRouter);
  return app;
}

function buildAdminApp(db: MockD1) {
  db.seed("users", [
    {
      id: ADMIN_ID,
      role: "super_admin",
      status: "active",
      email: "admin@test.local",
      name: "Test Admin",
    },
  ]);
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.env = { ...c.env, JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    c.set("user", { id: ADMIN_ID, role: "super_admin", status: "active" } as any);
    c.set("userId", ADMIN_ID as any);
    c.set("dbUser", { id: ADMIN_ID, role: "super_admin", status: "active" } as any);
    c.set("aud", "admin" as any);
    await next();
  });
  app.route("/admin", adminRouter);
  return app;
}

beforeEach(() => {
  // Each test gets a fresh seed by reassigning the singletons below.
});

describe("DSAR erasure is admin-gated (P1)", () => {
  it("queues an erasure without auto-executing anonymisation", async () => {
    const db = new MockD1();
    db.seed("users", [{ id: PATIENT_USER, role: "patient", email: "u@x", name: "Pat" }]);
    db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER, fullName: "Original", phone: "0771234567", nic: "912345678V" }]);
    db.seed("medicalRecords", [
      { id: "r1", patientId: PATIENT_ID, recordType: "consultation", title: "Visit 1", date: "2026-01-01" },
    ]);

    const app = await buildPatientApp(db, { id: PATIENT_USER, role: "patient" });
    const res = await app.request("/dsar/erasure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Please erase me" }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as any;
    expect(body.status).toBe("queued");

    // Patient row still has its PII — admin hasn't run the erasure.
    const [pRow] = await db.select().from(patients).where(eq(patients.id, PATIENT_ID));
    expect((pRow as any).fullName).toBe("Original");
    expect((pRow as any).phone).toBe("0771234567");
    expect((pRow as any).nic).toBe("912345678V");

    // A dsar_requests row was created in queued state.
    const [reqRow] = await db.select().from(dsarRequests).where(eq(dsarRequests.id, body.id));
    expect((reqRow as any).status).toBe("queued");
  });

  it("admin approve + complete triggers anonymisation on an erasure request", async () => {
    const db = new MockD1();
    db.seed("users", [{ id: PATIENT_USER, role: "patient", email: "u@x", name: "Pat", fullName: "Pat" }]);
    db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER, fullName: "Original", phone: "0771234567", nic: "912345678V" }]);
    db.seed("medicalRecords", [
      { id: "r1", patientId: PATIENT_ID, recordType: "consultation", title: "Visit 1", date: "2026-01-01" },
    ]);
    // Pre-existing queued erasure request as if the patient filed it earlier.
    db.seed("dsarRequests", [
      {
        id: "req-erasure-1",
        userId: PATIENT_USER,
        purpose: "erasure",
        status: "queued",
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        completedAt: null,
        resultUrl: null,
        resultExpiresAt: null,
        notes: null,
      },
    ]);

    const adminApp = buildAdminApp(db);
    // Approve
    const approveRes = await adminApp.request("/admin/dsar/req-erasure-1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(approveRes.status).toBe(200);

    // Complete — set the resultUrl the operator wants to point to.
    const completeRes = await adminApp.request("/admin/dsar/req-erasure-1/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultUrl: "https://files.healthhub.app/dsar/erasure-receipt.pdf" }),
    });
    expect(completeRes.status).toBe(200);

    // Patient PII is tombstoned.
    const [pRow] = await db.select().from(patients).where(eq(patients.id, PATIENT_ID));
    expect((pRow as any).fullName).toBe("[erased]");
    expect((pRow as any).phone).toBeNull();
    expect((pRow as any).nic).toBeNull();

    // User row tombstoned too.
    const [uRow] = await db.select().from(users).where(eq(users.id, PATIENT_USER));
    expect((uRow as any).fullName).toBe("[erased]");
    expect((uRow as any).phone).toBeNull();
    expect((uRow as any).email).toBeNull();

    // DSAR row stamped completed with the operator-supplied URL.
    const [reqRow] = await db.select().from(dsarRequests).where(eq(dsarRequests.id, "req-erasure-1"));
    expect((reqRow as any).status).toBe("completed");
    expect((reqRow as any).resultUrl).toBe("https://files.healthhub.app/dsar/erasure-receipt.pdf");

    // Medical records are preserved (referential integrity — see
    // anonymisePatient's comments).
    const recs = await db.select().from(medicalRecords).where(eq(medicalRecords.patientId, PATIENT_ID));
    expect(recs.length).toBe(1);
  });

  it("admin complete without erasure purpose is the same old behavior", async () => {
    const db = new MockD1();
    db.seed("users", [{ id: PATIENT_USER, role: "patient", email: "u@x", name: "Pat", fullName: "Pat" }]);
    db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER, fullName: "Original", phone: "0771234567" }]);
    db.seed("dsarRequests", [
      {
        id: "req-export-1",
        userId: PATIENT_USER,
        purpose: "export",
        status: "approved",
        requestedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        completedAt: null,
        resultUrl: null,
        resultExpiresAt: null,
        notes: null,
      },
    ]);

    const adminApp = buildAdminApp(db);
    const completeRes = await adminApp.request("/admin/dsar/req-export-1/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultUrl: "https://files.healthhub.app/dsar/export.zip" }),
    });
    expect(completeRes.status).toBe(200);

    // Export doesn't touch PII.
    const [pRow] = await db.select().from(patients).where(eq(patients.id, PATIENT_ID));
    expect((pRow as any).fullName).toBe("Original");
  });
});
