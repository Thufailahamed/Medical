import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import authRoutes from "../src/routes/auth";
import type { AppEnvironment } from "../src/types";

let db: MockD1;
let app: Hono<AppEnvironment>;

beforeEach(() => {
  db = new MockD1();
  app = new Hono<AppEnvironment>();

  // Mock config + db injection
  app.use("*", async (c, next) => {
    c.env = {
      DEV_MODE: "true",
      ENVIRONMENT: "development",
      JWT_SECRET: "test-secret-do-not-use-in-prod",
    } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    await next();
  });

  app.route("/auth", authRoutes);
});

describe("POST /auth/login-by-phone", () => {
  it("returns 400 on invalid Sri Lankan number prefix", async () => {
    const res = await app.request("/auth/login-by-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "123456789" }), // invalid SL prefix
    });
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe("Validation failed");
  });

  it("returns 401 anti-enumeration on unregistered number", async () => {
    const res = await app.request("/auth/login-by-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0771234567" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error).toBe("Invalid credentials");
  });

  it("sends OTP and returns devCode in development mode for registered user", async () => {
    // Seed registered user
    db.seed("users", [
      { id: "user-123", phone: "+94771234567", role: "patient", name: "Alice Test" }
    ]);
    db.setWhere("users", (r) => r.phone === "+94771234567");

    const res = await app.request("/auth/login-by-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "0771234567" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.otpSent).toBe(true);
    expect(body.userId).toBe("user-123");
    expect(body.devCode).toBeDefined();
  });
});

describe("POST /auth/verify-otp", () => {
  it("verifies the OTP and issues a JWT token", async () => {
    // Seed user + OTP
    db.seed("users", [
      { id: "user-123", phone: "+94771234567", role: "patient", name: "Alice Test" }
    ]);
    
    // We need to generate a valid hash matching the code.
    const { hashSecret } = await import("../src/lib/crypto");
    const code = "123456";
    const codeHash = await hashSecret(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.seed("otp_codes", [
      {
        id: "otp-id-123",
        userId: "user-123",
        channel: "mobile",
        target: "+94771234567",
        codeHash,
        expiresAt,
        attempts: 0,
        consumedAt: null,
      }
    ]);

    db.setWhere("otp_codes", (r) => r.userId === "user-123" && r.consumedAt === null);
    db.setWhere("users", (r) => r.id === "user-123");

    const res = await app.request("/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user-123",
        channel: "mobile",
        code: "123456",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.verified).toBe(true);
    expect(body.session.access_token).toBeDefined();
  });

  it("rejects invalid OTP code", async () => {
    // Seed user + OTP
    db.seed("users", [
      { id: "user-123", phone: "+94771234567", role: "patient", name: "Alice Test" }
    ]);
    
    const { hashSecret } = await import("../src/lib/crypto");
    const codeHash = await hashSecret("123456");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.seed("otp_codes", [
      {
        id: "otp-id-123",
        userId: "user-123",
        channel: "mobile",
        target: "+94771234567",
        codeHash,
        expiresAt,
        attempts: 0,
        consumedAt: null,
      }
    ]);

    db.setWhere("otp_codes", (r) => r.userId === "user-123" && r.consumedAt === null);
    db.setWhere("users", (r) => r.id === "user-123");

    const res = await app.request("/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user-123",
        channel: "mobile",
        code: "000000", // bad code
      }),
    });

    expect(res.status).toBe(401);
  });
});
