import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { notifications } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const notificationsRouter = new Hono<AppEnvironment>();

// ─── Get my notifications ────────────────────────────────
notificationsRouter.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const notifs = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId));

  return c.json({ notifications: notifs });
});

// ─── Get unread count (DB query, not JS filter) ──────────
// MUST be before /:id/read to avoid route conflict
notificationsRouter.get("/unread-count", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const all = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      )
    );

  return c.json({ count: all.length });
});

// ─── Mark all as read ────────────────────────────────────
// MUST be before /:id/read to avoid route conflict
notificationsRouter.put("/read-all", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId));

  return c.json({ message: "All notifications marked as read" });
});

// ─── Mark as read ────────────────────────────────────────
notificationsRouter.put("/:id/read", authMiddleware, async (c) => {
  const notifId = c.req.param("id");
  const userId = c.get("userId");
  const db = c.get("db");

  // Ownership check
  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notifId),
        eq(notifications.userId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: "Notification not found" }, 404);
  }

  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notifId))
    .returning();

  return c.json({ notification: updated });
});

export default notificationsRouter;
