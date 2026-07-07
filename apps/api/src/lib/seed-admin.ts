// @ts-nocheck
// ─── Seed admin user (Phase ADM-1) ──────────────────────────
//
// Idempotent. Inserts one super_admin row if and only if no super_admin
// already exists. Email + password are configurable via env vars so a
// production rotation is possible without changing source.
//
//   ADMIN_EMAIL    — defaults to admin@healthhub.local
//   ADMIN_PASSWORD — defaults to "Admin#12345" (CHANGE FOR PROD)
//
// Run via:
//   bun scripts/seed-admin.ts                 (local)
//   wrangler d1 execute --file=seed-admin.sql  (one-off SQL path)
//
// The SQL form mirrors the JS inserts so ops can choose their tool.

import { and, eq } from "drizzle-orm";
import { users } from "@healthcare/db";
import { hashPassword } from "./crypto";
import { seedSettings } from "./seed-settings";

export async function seedAdmin(db: any, env: any = process.env) {
  const email = env.ADMIN_EMAIL || "admin@healthhub.local";
  const password = env.ADMIN_PASSWORD || "Admin#12345";
  const name = env.ADMIN_NAME || "Platform Admin";

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "super_admin")))
    .limit(1);

  if (existing) {
    return { ok: true, alreadyExisted: true, userId: existing.id };
  }

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    supabaseId: id,
    email,
    name,
    role: "super_admin",
    passwordHash,
    verified: true,
    status: "active",
  });

  // Seed default system_settings on first admin creation only.
  // On subsequent calls the admin already existed; settings may
  // have been edited, so we don't touch them.
  await seedSettings(db, id);

  return { ok: true, alreadyExisted: false, userId: id, email };
}

// Standalone entrypoint: `bun seed-admin.ts` from the api/ workspace.
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  // CLI path — wire up a local Drizzle handle against process.env.DB.
  (async () => {
    const { createDb } = await import("./db");
    const { drizzle } = await import("drizzle-orm/d1");
    // Wrangler's runtime gives us `process.env.DB` as a D1 binding; in a
    // plain Bun process that doesn't exist. The JS entrypoint is therefore
    // mostly for future scripted workflows; the canonical admin seed is
    // the SQL file checked in at apps/api/seed-admin.sql.
    const dbBinding = (process.env as any).DB;
    if (!dbBinding) {
      console.error(
        "[seed-admin] No D1 binding on process.env.DB. Use the SQL file instead:\n" +
          "  wrangler d1 execute healthcare-db --local --file=apps/api/seed-admin.sql",
      );
      process.exit(1);
    }
    const db = createDb(dbBinding);
    const out = await seedAdmin(db);
    console.log("[seed-admin]", out);
  })().catch((err) => {
    console.error("[seed-admin] failed:", err);
    process.exit(1);
  });
}