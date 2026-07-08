// tests/admin/_adminTestApp.ts
//
// Build a Hono app with the real /admin router mounted. We stub the
// auth middleware so we can drive requests as a specific role without
// re-implementing JWT signing here.
//
// The admin router's `requireAdmin` reads `c.get("dbUser")` — we set
// it directly so a non-admin request fails at the gate and a
// super_admin request passes.

import { Hono } from "hono";
import adminRouter from "../../src/routes/admin";
import adminBulkRouter from "../../src/routes/admin-bulk";
import adminExportRouter from "../../src/routes/admin-export";
import adminWebauthnRouter from "../../src/routes/admin-webauthn";
import adminImpersonateRouter from "../../src/routes/admin-impersonate";
import adminHealthRouter from "../../src/routes/admin-health";
import { issueStepUpToken } from "../../src/middleware/stepup";
import type { AppEnvironment } from "../../src/types";
import type { MockD1 } from "../_mockDb";

export type AdminUser = {
  id: string;
  role: string;
  status?: string;
  email?: string;
  name?: string;
};

export function buildAdminApp(db: MockD1, user?: AdminUser) {
  const app = new Hono<AppEnvironment>();

  // Seed the user row so any `users` lookup succeeds.
  if (user) {
    db.seed("users", [
      {
        id: user.id,
        role: user.role,
        status: user.status ?? "active",
        email: user.email ?? `${user.id}@test.local`,
        name: user.name ?? "Test " + user.id,
      },
    ]);
  }

  const TEST_JWT_SECRET = "test-secret-do-not-use-in-prod";

  // In-memory R2 stub. The real R2 binding in production is
  // configured per-Worker, but tests don't have one. We provide
  // put/createPresignedUrl stubs so the SLMC upload + download
  // endpoints can run.
  const r2Store = new Map<string, { body: ArrayBuffer; contentType: string }>();
  const mockR2 = {
    async put(key: string, body: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      r2Store.set(key, { body, contentType: opts?.httpMetadata?.contentType ?? "application/octet-stream" });
    },
    async createPresignedUrl(key: string) {
      return `https://r2.test.local/${encodeURIComponent(key)}?sig=test`;
    },
    get(key: string) {
      return r2Store.get(key);
    },
  };

  app.use("*", async (c, next) => {
    c.env = { ...c.env, JWT_SECRET: TEST_JWT_SECRET, R2: mockR2 as any } as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    // Skip authMiddleware and pre-populate dbUser so requireAdmin sees it.
    if (user) {
      c.set("user", user as any);
      c.set("userId", user.id as any);
      c.set("dbUser", user as any);
      // Tests bypass real JWT signing — mark the audience as "admin"
      // so `requireAdmin`'s audience gate doesn't reject.
      c.set("aud", "admin" as any);
    }
    await next();
  });

  app.route("/admin", adminRouter);
  app.route("/admin/bulk", adminBulkRouter);
  app.route("/admin/export", adminExportRouter);
  app.route("/admin/webauthn", adminWebauthnRouter);
  app.route("/admin/impersonate", adminImpersonateRouter);
  app.route("/admin/health", adminHealthRouter);
  return app;
}

/**
 * Mint a step-up token bound to the current admin. Helper for tests
 * that need to pass through `requirePasskeyFresh`. Defaults to a
 * 5-minute TTL.
 */
export function stepUpTokenFor(user: AdminUser): string {
  // Build a minimal Context-like to call issueStepUpToken. Easiest
  // path: call the underlying HMAC routine directly. To keep this
  // dependency-free, we re-import the function and supply a stub env.
  const { createHmac } = require("node:crypto") as typeof import("node:crypto");
  const exp = Math.floor(Date.now() / 1000) + 300;
  const payload = JSON.stringify({ userId: user.id, exp });
  const mac = createHmac("sha256", TEST_SECRET).update(payload).digest();
  const b64 = (b: Buffer) => b.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64(Buffer.from(payload))}.${b64(mac)}`;
}

const TEST_SECRET = "test-secret-do-not-use-in-prod";

export async function get(app: Hono<AppEnvironment>, path: string, headers: Record<string, string> = {}) {
  return app.request(path, { method: "GET", headers });
}

export async function postJson(
  app: Hono<AppEnvironment>,
  path: string,
  body: any,
  headers: Record<string, string> = {},
) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export async function patchJson(
  app: Hono<AppEnvironment>,
  path: string,
  body: any,
  headers: Record<string, string> = {},
) {
  return app.request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

export async function del(app: Hono<AppEnvironment>, path: string, headers: Record<string, string> = {}) {
  return app.request(path, { method: "DELETE", headers });
}