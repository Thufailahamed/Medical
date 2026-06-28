import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types";

export function requireRole(...roles: string[]) {
  return async (c: Context<AppEnvironment>, next: Next) => {
    const dbUser = c.get("dbUser");

    if (!dbUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!roles.includes(dbUser.role)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    c.set("userRole", dbUser.role);

    await next();
  };
}
