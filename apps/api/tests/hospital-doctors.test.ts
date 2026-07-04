// tests/hospital-doctors.test.ts
//
// Phase MTN-1: hospital_doctors membership lifecycle.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import router from "../src/routes/hospital-doctors";
import { MockD1 } from "./_mockDb";
import type { AppEnvironment } from "../src/types";

const TEST_SECRET = "test-secret";

async function build(hospitalAdminId: string) {
  const db = new MockD1();
  db.seed("users", { id: hospitalAdminId, role: "hospital_admin", name: "Admin" });
  // UNIQUE (hospital_id, doctor_id) in production schema.
  db.setUniqueOn("hospitalDoctors", ["hospitalId", "doctorId"]);
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = { JWT_SECRET: TEST_SECRET } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    const token = await sign({ sub: hospitalAdminId, exp: Math.floor(Date.now() / 1000) + 3600 } as any, TEST_SECRET);
    c.req.raw = new Request(c.req.raw, {
      headers: { ...Object.fromEntries(c.req.raw.headers), Authorization: `Bearer ${token}` },
    });
    await next();
  });
  app.route("/hospital-doctors", router);
  return { app, db };
}

async function req(app: Hono<AppEnvironment>, path: string, body?: any, method = "POST") {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("hospital-doctors route", () => {
  it("admin can add a doctor to their hospital", async () => {
    const { app, db } = await build("admin1");
    db.seed("hospitals", { id: "h1", userId: "admin1", name: "Public Hospital" });
    db.seed("doctors", { id: "doc1", userId: "u1", specialization: "GP" });
    db.seed("users", { id: "u1", name: "Dr Alice" });
    const res = await req(app, "/hospital-doctors", { hospitalId: "h1", doctorId: "doc1", role: "consultant", department: "OPD" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.role).toBe("consultant");
    expect(body.department).toBe("OPD");
  });

  it("non-admin principal gets 403", async () => {
    const { app, db } = await build("stranger");
    db.seed("hospitals", { id: "h1", userId: "other-admin", name: "Other Hospital" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    const res = await req(app, "/hospital-doctors", { hospitalId: "h1", doctorId: "doc1" });
    expect(res.status).toBe(403);
  });

  it("rejects duplicate (hospital, doctor) pair with 409", async () => {
    const { app, db } = await build("admin1");
    db.seed("hospitals", { id: "h1", userId: "admin1" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("hospitalDoctors", { id: "hd1", hospitalId: "h1", doctorId: "doc1", status: "active" });
    const res = await req(app, "/hospital-doctors", { hospitalId: "h1", doctorId: "doc1" });
    expect(res.status).toBe(409);
  });

  it("lists members for the hospital", async () => {
    const { app, db } = await build("admin1");
    db.seed("hospitals", { id: "h1", userId: "admin1" });
    db.seed("doctors", { id: "doc1", userId: "u1" });
    db.seed("users", { id: "u1", name: "Dr X" });
    db.seed("hospitalDoctors", { id: "hd1", hospitalId: "h1", doctorId: "doc1", status: "active", role: "consultant" });
    const res = await app.request("/hospital-doctors?hospitalId=h1");
    expect(res.status).toBe(200);
    const rows = (await res.json()) as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Dr X");
  });

  it("PATCH flips status / role; DELETE soft-leaves", async () => {
    const { app, db } = await build("admin1");
    db.seed("hospitals", { id: "h1", userId: "admin1" });
    db.seed("hospitalDoctors", { id: "hd1", hospitalId: "h1", doctorId: "doc1", status: "active", role: "consultant" });
    const patchRes = await req(app, "/hospital-doctors/hd1", { status: "suspended", role: "visiting" }, "PATCH");
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as any;
    expect(patched.status).toBe("suspended");
    expect(patched.role).toBe("visiting");
    const del = await req(app, "/hospital-doctors/hd1", undefined, "DELETE");
    expect(del.status).toBe(200);
    const row = (db.tables["hospitalDoctors"]?.rows || []).find((r) => r.id === "hd1");
    expect(row.status).toBe("inactive");
    expect(row.leftAt).toBeTruthy();
  });
});