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

  app.use("*", async (c, next) => {
    c.env = c.env || ({} as any);
    c.set("db", db as any);
    c.set("locale", "en" as any);
    // Skip authMiddleware and pre-populate dbUser so requireAdmin sees it.
    if (user) {
      c.set("user", user as any);
      c.set("userId", user.id as any);
      c.set("dbUser", user as any);
    }
    await next();
  });

  app.route("/admin", adminRouter);
  app.route("/admin/bulk", adminBulkRouter);
  return app;
}

export async function get(app: Hono<AppEnvironment>, path: string) {
  return app.request(path, { method: "GET" });
}

export async function postJson(app: Hono<AppEnvironment>, path: string, body: any) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchJson(app: Hono<AppEnvironment>, path: string, body: any) {
  return app.request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function del(app: Hono<AppEnvironment>, path: string) {
  return app.request(path, { method: "DELETE" });
}