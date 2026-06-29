// @ts-nocheck

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  pushTokens,
  notificationPreferences,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const pushRouter = new Hono<AppEnvironment>();

// ─── Push token registration ─────────────────────────────
// POST /push-tokens { token, platform }
//   Upserts (userId, token) — re-registering with same token is a no-op.
pushRouter.post("/push-tokens", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const token = String(body?.token || "").trim();
  const platform = String(body?.platform || "android").trim();
  if (!token) return c.json({ error: "token required" }, 400);
  if (!["ios", "android", "web"].includes(platform)) {
    return c.json({ error: "platform must be ios|android|web" }, 400);
  }

  const existing = await db
    .select()
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)))
    .limit(1);
  if (existing.length > 0) {
    return c.json({ ok: true, alreadyRegistered: true });
  }
  await db.insert(pushTokens).values({
    userId,
    token,
    platform,
  } as any);
  return c.json({ ok: true }, 201);
});

// DELETE /push-tokens { token } — unregister a token (sign-out / uninstall).
pushRouter.delete("/push-tokens", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const token = String(body?.token || "").trim();
  if (!token) return c.json({ error: "token required" }, 400);
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  return c.json({ ok: true });
});

// ─── Notification preferences ────────────────────────────
// GET /notification-preferences/me — list current preferences
pushRouter.get("/notification-preferences/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return c.json({ preferences: rows });
});

// PUT /notification-preferences/me
//   Body: { preferences: [{ type, inApp, push }, ...] }
//   Upserts each row.
pushRouter.put("/notification-preferences/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const list = Array.isArray(body?.preferences) ? body.preferences : [];
  const allowed = [
    "medicine",
    "appointment",
    "lab_ready",
    "prescription",
    "insurance",
    "hospital",
    "emergency",
    "vaccination",
    "general",
  ];

  for (const p of list) {
    if (!p || !allowed.includes(p.type)) continue;
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, p.type)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(notificationPreferences)
        .set({ inApp: !!p.inApp, push: !!p.push })
        .where(
          and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.type, p.type)
          )
        );
    } else {
      await db.insert(notificationPreferences).values({
        userId,
        type: p.type,
        inApp: p.inApp !== false,
        push: p.push !== false,
      } as any);
    }
  }
  return c.json({ ok: true });
});

export default pushRouter;