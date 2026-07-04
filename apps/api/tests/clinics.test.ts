// tests/clinics.test.ts
//
// Phase MTN-1: clinic CRUD + ownership + multi-doctor membership.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import clinicsRouter from "../src/routes/clinics";
import { MockD1 } from "./_mockDb";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret";

async function build(user: { id: string; role: string }) {
  const db = new MockD1();
  db.seed("users", { id: user.id, role: user.role, name: "Doc " + user.id });
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = { JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    const token = await sign({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 } as any, TEST_SECRET);
    const req = new Request(c.req.raw, {
      headers: {
        ...Object.fromEntries(c.req.raw.headers.entries()),
        Authorization: `Bearer ${token}`,
      },
    });
    c.req.raw = req;
    await next();
  });
  app.route("/clinics", clinicsRouter);
  return { app, db };
}

async function jsonReq(app: Hono<AppEnvironment>, path: string, body: any, method = "POST") {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("clinics route", () => {
  it("403s when caller is not a doctor", async () => {
    const { app } = await build({ id: "p1", role: "patient" });
    const res = await jsonReq(app, "/clinics", { name: "Test Clinic" });
    expect(res.status).toBe(403);
  });

  it("creates a clinic + auto-inserts owner doctor membership", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    const res = await jsonReq(app, "/clinics", { name: "Sunrise Clinic" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.name).toBe("Sunrise Clinic");
    expect(body.myRole).toBe("owner");
    const cds = db.tables["clinicDoctors"]?.rows || [];
    expect(cds.length).toBe(1);
    expect(cds[0].role).toBe("owner");
    expect(cds[0].ownershipPct).toBe(100);
  });

  it("rejects owner-pct sum over 100", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("doctors", { id: "doc2", userId: "u2" });
    const create = await jsonReq(app, "/clinics", { name: "Joint Clinic" });
    const clinic = await create.json();
    // Already 100% owned by doc1.
    const add = await jsonReq(
      app,
      `/clinics/${clinic.id}/doctors`,
      { doctorId: "doc2", role: "owner", ownershipPct: 50 }
    );
    expect(add.status).toBe(400);
    const body = (await add.json()) as any;
    expect(body.error).toContain("exceed");
  });

  it("registers a patient and assigns an MRN", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("patients", { id: "pat1", userId: "x" });
    const create = await jsonReq(app, "/clinics", { name: "MRN Test" });
    const clinic = await create.json();
    const reg = await jsonReq(
      app,
      `/clinics/${clinic.id}/patients`,
      { patientId: "pat1" }
    );
    expect(reg.status).toBe(201);
    const row = (await reg.json()) as any;
    expect(row.mrn).toMatch(/^[A-Z0-9]{2,6}-\d{6}$/);
  });

  it("non-owner can't add members", async () => {
    const { app, db } = await build({ id: "u1", role: "doctor" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    const created = await (await jsonReq(app, "/clinics", { name: "Private" })).json();
    // Now build as a different doctor
    const db2 = new MockD1();
    db2.seed("users", { id: "u2", role: "doctor" });
    db2.seed("users", { id: "u1", role: "doctor", name: "Owner" });
    db2.seed("doctors", { id: "doc1", userId: "u1" });
    db2.seed("doctors", { id: "doc2", userId: "u2" });
    db2.seed("clinics", { ...created, userId: "u1" });
    const app2 = new Hono<AppEnvironment>();
    app2.use("*", async (c, next) => {
      c.env = { JWT_SECRET: TEST_SECRET } as any;
      c.set("db", db2 as any);
      c.set("locale", "en" as any);
      const token = await sign({ sub: "u2", exp: Math.floor(Date.now() / 1000) + 3600 } as any, TEST_SECRET);
      c.req.raw = new Request(c.req.raw, {
        headers: { ...Object.fromEntries(c.req.raw.headers), Authorization: `Bearer ${token}` },
      });
      await next();
    });
    app2.route("/clinics", clinicsRouter);
    const res = await jsonReq(app2, `/clinics/${created.id}/doctors`, { doctorId: "doc3", role: "associate" });
    expect(res.status).toBe(403);
  });
});