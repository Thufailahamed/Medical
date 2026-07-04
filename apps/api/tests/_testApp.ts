// tests/_testApp.ts
//
// Build a Hono app with the real care-team router mounted. The router
// has its own authMiddleware which we satisfy by signing a JWT with a
// fixed test secret, attaching it as `Authorization: Bearer …`, and
// seeding a matching `users` row in the mock DB so authMiddleware's
// "map JWT sub → D1 user" lookup resolves.
//
// Why not stub authMiddleware directly: the route logic is unchanged
// either way, but going through the real middleware catches bugs
// where the route reads `c.get("dbUser")` or `c.get("userRole")`
// inconsistently.

import { Hono } from "hono";
import { sign } from "hono/jwt";
import careTeamRouter from "../src/routes/care-team";
import type { AppEnvironment } from "../src/types";
import type { MockD1 } from "./_mockDb";

const TEST_SECRET = "test-secret-do-not-use-in-prod";

type TestUser = {
  id: string;
  role: string;
};

async function makeToken(userId: string): Promise<string> {
  return sign(
    {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1h
    } as any,
    TEST_SECRET
  );
}

export async function buildTestApp(db: MockD1, user?: TestUser) {
  const app = new Hono<AppEnvironment>();

  // Pre-seed the user row so authMiddleware's lookup succeeds.
  if (user) {
    db.seed("users", [
      {
        id: user.id,
        role: user.role,
        email: `${user.id}@test.local`,
        name: "Test " + user.id,
      },
    ]);
  }

  // Stub: provide env + db for the route + its middleware.
  app.use("*", async (c, next) => {
    c.env = c.env || ({} as any);
    (c.env as any).JWT_SECRET = TEST_SECRET;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    if (user) {
      const token = await makeToken(user.id);
      // Re-inject Authorization header so authMiddleware takes the
      // JWT path (not the dev bypass).
      const req = new Request(c.req.raw, {
        headers: {
          ...Object.fromEntries(c.req.raw.headers.entries()),
          Authorization: `Bearer ${token}`,
        },
      });
      c.req.raw = req;
    }
    await next();
  });

  app.route("/care-team", careTeamRouter);
  return app;
}

// ─── Convenient assertion helpers ──────────────────────────
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

export async function getJson(app: Hono<AppEnvironment>, path: string) {
  return app.request(path, { method: "GET" });
}