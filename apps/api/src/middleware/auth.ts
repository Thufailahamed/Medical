import { eq } from "drizzle-orm";
import { users } from "@healthcare/db";
import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types";
import { verifyToken } from "../lib/crypto";

const DEV_USER = {
  id: "dev-user-001",
  email: "dev@healthhub.local",
  user_metadata: { name: "Dev User" },
};

export async function authMiddleware(c: Context<AppEnvironment>, next: Next) {
  // ── Dev mode bypass ────────────────────────────────────
  if (c.env.DEV_MODE === "true") {
    const db = c.get("db");

    // Ensure dev user exists in D1
    let [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, DEV_USER.id))
      .limit(1);

    if (!dbUser) {
      const [created] = await db
        .insert(users)
        .values({
          id: DEV_USER.id,
          email: DEV_USER.email,
          name: "Dev User",
          role: "patient",
        } as any)
        .returning();
      dbUser = created;
    }

    c.set("user", DEV_USER as any);
    c.set("userId", dbUser.id);
    c.set("dbUser", dbUser);
    await next();
    return;
  }

  // ── Normal JWT auth ──────────────────────────────────────
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];
  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const decoded = await verifyToken(token, secret);

  if (!decoded || !decoded.sub) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const userId = decoded.sub;

  // Map JWT sub to D1 user
  const db = c.get("db");
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!dbUser) {
    return c.json({ error: "User not found in database" }, 401);
  }

  c.set("user", { id: dbUser.id, email: dbUser.email, role: dbUser.role } as any);
  c.set("userId", dbUser.id); // D1 user ID
  c.set("dbUser", dbUser);

  await next();
}
