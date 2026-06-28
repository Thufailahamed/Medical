import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { users } from "@healthcare/db";
import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types";

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
      .where(eq(users.supabaseId, DEV_USER.id))
      .limit(1);

    if (!dbUser) {
      const [created] = await db
        .insert(users)
        .values({
          supabaseId: DEV_USER.id,
          email: DEV_USER.email,
          name: "Dev User",
          role: "patient",
        })
        .returning();
      dbUser = created;
    }

    // Create a minimal mock Supabase client
    const supabase = createClient(
      c.env.SUPABASE_URL || "https://placeholder.supabase.co",
      c.env.SUPABASE_ANON_KEY || "placeholder"
    );

    c.set("supabase", supabase);
    c.set("user", DEV_USER as any);
    c.set("userId", dbUser.id);
    c.set("dbUser", dbUser);
    await next();
    return;
  }

  // ── Normal auth ────────────────────────────────────────
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  // Map Supabase user to D1 user
  const db = c.get("db");
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, user.id))
    .limit(1);

  if (!dbUser) {
    return c.json({ error: "User not found in database" }, 401);
  }

  c.set("supabase", supabase);
  c.set("user", user);
  c.set("userId", dbUser.id); // D1 user ID, not Supabase ID
  c.set("dbUser", dbUser);

  await next();
}
