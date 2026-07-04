// tests/doctor-patient-relationships.test.ts
//
// Phase MTN-1: clinical-context table — same doctor ↔ patient at
// different tenants must yield two active rows (different context).

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import router from "../src/routes/doctor-patient-relationships";
import { MockD1 } from "./_mockDb";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret";

async function build(caller: { id: string; role: string }) {
  const db = new MockD1();
  db.seed("users", { id: caller.id, role: caller.role, name: "X" });
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = { JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    const token = await sign({ sub: caller.id, exp: Math.floor(Date.now() / 1000) + 3600 } as any, TEST_SECRET);
    c.req.raw = new Request(c.req.raw, {
      headers: { ...Object.fromEntries(c.req.raw.headers), Authorization: `Bearer ${token}` },
    });
    await next();
  });
  app.route("/doctor-patient-relationships", router);
  return { app, db };
}

async function req(app: Hono<AppEnvironment>, path: string, body?: any, method = "POST") {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("doctor-patient-relationships route", () => {
  it("creates a hospital-scoped relationship when both are members", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("patients", { id: "pat1", userId: "patientUser" });
    db.seed("hospitalDoctors", { id: "hd1", hospitalId: "h1", doctorId: "doc1", status: "active" });
    db.seed("hospitalPatients", { id: "hp1", hospitalId: "h1", patientId: "pat1", mrn: "X-1", status: "registered" });

    const res = await req(app, "/doctor-patient-relationships", {
      doctorId: "doc1",
      patientId: "pat1",
      contextType: "hospital",
      contextId: "h1",
      relationshipKind: "primary_care",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.contextType).toBe("hospital");
    expect(body.status).toBe("active");
  });

  it("rejects when doctor is not a member of the named hospital", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("patients", { id: "pat1", userId: "patientUser" });
    db.seed("hospitalPatients", { id: "hp1", hospitalId: "h1", patientId: "pat1", mrn: "X-1", status: "registered" });
    // No hospitalDoctors row → guard fails.
    const res = await req(app, "/doctor-patient-relationships", {
      doctorId: "doc1",
      patientId: "pat1",
      contextType: "hospital",
      contextId: "h1",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toContain("not at this hospital");
  });

  it("PATCH ends a relationship (status→ended)", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctorPatientRelationships", {
      id: "dpr1",
      doctorId: "doc1",
      patientId: "pat1",
      contextType: "hospital",
      contextId: "h1",
      status: "active",
    });
    const res = await req(
      app,
      "/doctor-patient-relationships/dpr1",
      { status: "ended" },
      "PATCH"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("ended");
    expect(body.endedAt).toBeTruthy();
  });

  it("DELETE soft-ends without hard-remove", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctorPatientRelationships", {
      id: "dpr1",
      doctorId: "doc1",
      patientId: "pat1",
      contextType: "clinic",
      contextId: "c1",
      status: "active",
    });
    const res = await req(app, "/doctor-patient-relationships/dpr1", undefined, "DELETE");
    expect(res.status).toBe(200);
    const row = (db.tables["doctorPatientRelationships"]?.rows || []).find((r) => r.id === "dpr1");
    expect(row.status).toBe("ended");
    expect(row.endedAt).toBeTruthy();
  });

  it("list groups by context_type", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("users", { id: "u1", name: "Dr A" });
    db.seed("doctorPatientRelationships", [
      { id: "r1", doctorId: "doc1", patientId: "p1", contextType: "hospital", contextId: "h1", status: "active" },
      { id: "r2", doctorId: "doc1", patientId: "p1", contextType: "clinic", contextId: "c1", status: "active" },
    ]);
    const res = await app.request("/doctor-patient-relationships?doctorId=doc1");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as any[];
    const types = new Set(rows.map((r) => r.contextType));
    expect(types.has("hospital")).toBe(true);
    expect(types.has("clinic")).toBe(true);
  });
});