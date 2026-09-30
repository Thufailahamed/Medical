import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import authRoutes from "../src/routes/auth";
import { hashPassword } from "../src/lib/crypto";
import type { AppEnvironment } from "../src/types";

// Doctor login must mint a full session (no mfaRequired) while
// REQUIRE_DOCTOR_MFA is unset. Guards the removal of doctor 2FA.
describe("doctor login without 2FA", () => {
  it("returns a session JWT directly for a doctor without MFA", async () => {
    const db = new MockD1();
    const app = new Hono<AppEnvironment>();
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

    const passwordHash = await hashPassword("Doctor#12345");
    db.seed("users", [
      {
        id: "doc-login-1",
        email: "doc@login.test",
        role: "doctor",
        status: "active",
        name: "Dr Login",
        passwordHash,
      },
    ]);
    db.seed("doctors", [{ id: "doctor-row-1", userId: "doc-login-1" }]);

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "doc@login.test", password: "Doctor#12345" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.mfaRequired).toBeUndefined();
    expect(body.session?.access_token).toBeTruthy();
    expect(body.user?.role).toBe("doctor");
  });
});
