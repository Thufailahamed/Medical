// tests/auth-approval.test.ts
//
// Phase ADM-1: registration + login gating for gated roles.
//
//   - POST /auth/register with role=doctor → 202 + requiresApproval
//   - POST /auth/register with role=patient → 200/201 + JWT (unchanged)
//   - POST /auth/login with a pending doctor → 403 + code=account_pending
//   - POST /auth/login with suspended doctor → 403 + code=account_suspended
//   - POST /auth/login with rejected doctor → 403 + code=account_rejected

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import authRoutes from "../src/routes/auth";
import { hashPassword } from "../src/lib/crypto";
import type { AppEnvironment } from "../src/types";

let db: MockD1;
let app: Hono<AppEnvironment>;
let passwordHash: string;

async function buildApp() {
  db = new MockD1();
  app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = {
      DEV_MODE: "false",
      ENVIRONMENT: "test",
      JWT_SECRET: "test-secret-do-not-use-in-prod",
    } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    await next();
  });
  app.route("/auth", authRoutes);
  passwordHash = await hashPassword("right");
}

beforeEach(async () => {
  await buildApp();
});

async function post(path: string, body: any) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /auth/register — gating", () => {
  it("returns 202 + requiresApproval for a doctor registration", async () => {
    const res = await post("/auth/register", {
      email: "doc@test.local",
      password: "Secret123!",
      name: "Dr. Test",
      role: "doctor",
      doctorProfile: { specialization: "Cardiology" },
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.requiresApproval).toBe(true);
    expect(body.user.status).toBe("pending");
    // No JWT for gated roles.
    expect(body.session).toBeUndefined();
  });

  it("returns 201 with JWT for a patient registration (unchanged)", async () => {
    const res = await post("/auth/register", {
      email: "pat@test.local",
      password: "Secret123!",
      name: "Pat Test",
      role: "patient",
      nic: "903653456V",
      dob: "1990-12-31",
    });
    if (res.status !== 201) {
      const body = await res.json();
      console.error("UNEXPECTED:", res.status, JSON.stringify(body, null, 2));
    }
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session?.access_token).toBeTruthy();
  });

  it("gates hospital_admin registrations as well", async () => {
    const res = await post("/auth/register", {
      email: "hosp@test.local",
      password: "Secret123!",
      name: "Hosp Admin",
      role: "hospital_admin",
    });
    expect(res.status).toBe(202);
    expect((await res.json()).requiresApproval).toBe(true);
  });
});

describe("POST /auth/login — status gate", () => {
  async function seedUser(overrides: Record<string, any>) {
    db.seed("users", [
      {
        id: "user-x",
        email: "x@test.local",
        role: "doctor",
        status: "active",
        passwordHash,
        ...overrides,
      },
    ]);
    db.setWhere("users", (r) => r.email === "x@test.local");
  }

  it("rejects pending doctor with 403 + code=account_pending", async () => {
    await seedUser({ status: "pending" });
    const res = await post("/auth/login", { email: "x@test.local", password: "right" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("account_pending");
  });

  it("rejects suspended doctor with 403 + code=account_suspended", async () => {
    await seedUser({ status: "suspended", suspendedReason: "ToS violation" });
    const res = await post("/auth/login", { email: "x@test.local", password: "right" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("account_suspended");
    expect(body.reason).toBe("ToS violation");
  });

  it("rejects rejected doctor with 403 + code=account_rejected", async () => {
    await seedUser({ status: "rejected", rejectionReason: "SLMC unverifiable" });
    const res = await post("/auth/login", { email: "x@test.local", password: "right" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("account_rejected");
  });
});