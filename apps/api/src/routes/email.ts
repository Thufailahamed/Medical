// @ts-nocheck
// Phase 1.4: per-user personal inbox alias management.
//   GET  /patients/me/email-alias         — read current alias
//   PATCH /patients/me/email-alias/rotate — regenerate (anti-leak)
//
// Aliases are `u_<8hex>` strings; the route composes the user-facing
// address `<alias>@<EMAIL_ALIAS_DOMAIN>` from the env binding.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { aliasAddress, generateAlias } from "../lib/alias";
import type { AppEnvironment } from "../types";

const emailRouter = new Hono<AppEnvironment>();

// Up to 5 rotations in case of extremely unlikely collision persistence.
const ROTATE_RETRIES = 5;

emailRouter.get(
  "/patients/me/email-alias",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const [user] = await db
      .select({ emailAlias: users.emailAlias, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const domain = c.env.EMAIL_ALIAS_DOMAIN;

    // Lazy-generate if missing (covers legacy rows where backfill collided
    // and aborted, or rows inserted via paths that bypass auth.ts).
    let alias = user.emailAlias;
    if (!alias) {
      for (let i = 0; i < ROTATE_RETRIES; i++) {
        const candidate = generateAlias();
        try {
          await db
            .update(users)
            .set({ emailAlias: candidate })
            .where(eq(users.id, userId));
          alias = candidate;
          break;
        } catch (err: any) {
          // Unique-index violation → retry with a fresh hash.
          if (i === ROTATE_RETRIES - 1) throw err;
        }
      }
    }

    return c.json({
      alias,
      address: aliasAddress(alias, domain),
      email: user.email,
      domain,
    });
  }
);

emailRouter.patch(
  "/patients/me/email-alias/rotate",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    // Generate + retry on collisions. Migration already backfilled the
    // unique-index so most calls return first try.
    let chosen: string | null = null;
    let lastErr: unknown = null;

    for (let i = 0; i < ROTATE_RETRIES; i++) {
      const candidate = generateAlias();
      try {
        await db
          .update(users)
          .set({ emailAlias: candidate, updatedAt: new Date().toISOString() })
          .where(eq(users.id, userId));
        chosen = candidate;
        break;
      } catch (err: any) {
        lastErr = err;
        // Unique-index collision → retry. SQLite throws via Drizzle as
        // a generic error with message containing "UNIQUE constraint".
      }
    }

    if (!chosen) {
      return c.json(
        { error: "Failed to generate a unique alias after retries" },
        500
      );
    }

    return c.json({
      alias: chosen,
      address: aliasAddress(chosen, c.env.EMAIL_ALIAS_DOMAIN),
    });
  }
);

export default emailRouter;
