// @ts-nocheck
// ─── Admin impersonation (Phase ADM-4) ────────────────────────
//
// Mints a short-TTL JWT for a target user so an admin can reproduce
// a user's experience without sharing their password. The token
// carries:
//   • aud: "admin" so it can be used by the admin web client only
//   • impersonatedBy: admin.id so audit rows reveal the real actor
//   • impName: admin.name for UI banner display
//
// Mobile endpoints reject `aud !== "mobile"` tokens, so the
// impersonation token cannot be replayed against mobile APIs even if
// leaked. The admin's own session remains intact — the token lives
// separately in client storage and is cleared when the session ends.
//
// `requirePasskeyFresh` is enforced on every state change.

import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { users } from "@healthcare/db";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import { requirePasskeyFresh } from "../middleware/stepup";
import { generateToken } from "../lib/crypto";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const IMPERSONATION_TTL_SECONDS = 15 * 60; // 15 minutes

const startSchema = z.object({
  userId: z.string().min(1),
});

const impersonateRouter = new Hono<AppEnvironment>();

impersonateRouter.use("*", requireAdmin);

impersonateRouter.post("/start", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const actor = c.get("adminActor");
  const body = await c.req.json().catch(() => ({}));
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  if (parsed.data.userId === actor?.id) {
    return c.json({ error: "You cannot impersonate yourself" }, 400);
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);
  if (!target) return c.json({ error: "Target user not found" }, 404);

  if (target.role === "super_admin") {
    // Don't allow impersonating another admin — they can sign in
    // themselves and would just gain confusing "who am I?" trail.
    return c.json({ error: "Cannot impersonate another admin" }, 409);
  }

  const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_SECONDS * 1000).toISOString();

  const token = await generateToken(
    target.id,
    secret,
    {
      impersonatedBy: actor?.id ?? null,
      impName: actor?.name ?? null,
      // Mirror common role claims so downstream handlers that read
      // from JWT (instead of DB) still see the right role.
      role: target.role,
    },
    { aud: "admin", ttlSeconds: IMPERSONATION_TTL_SECONDS },
  );

  await recordAdminAction(c, {
    action: "impersonate_start",
    resource: "user",
    resourceId: target.id,
    details: {
      targetEmail: target.email,
      targetRole: target.role,
      expiresAt,
    },
  });

  return c.json({
    token,
    expiresAt,
    targetUser: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
    },
  });
});

impersonateRouter.post("/end", requirePasskeyFresh, async (c) => {
  const actor = c.get("adminActor");
  // We don't track the active impersonation token server-side — the
  // client just stops using it. We log the end explicitly so the
  // audit trail shows every session, including short ones.
  await recordAdminAction(c, {
    action: "impersonate_end",
    resource: "user",
    resourceId: c.get("userId") ?? null,
    details: { endedAt: new Date().toISOString() },
  });
  return c.json({ ok: true, actor: { id: actor?.id, name: actor?.name } });
});

impersonateRouter.get("/whoami", async (c) => {
  const impersonatedBy = c.get("impersonatedBy");
  if (!impersonatedBy) return c.json({ actingAs: null });

  const db = c.get("db");
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, c.get("userId") as string))
    .limit(1);
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.id, impersonatedBy))
    .limit(1);

  return c.json({
    actingAs: target
      ? { id: target.id, name: target.name, email: target.email, role: target.role }
      : null,
    impersonatedBy: admin
      ? { id: admin.id, name: admin.name, email: admin.email }
      : null,
    impName: c.get("impName") ?? null,
  });
});

export default impersonateRouter;