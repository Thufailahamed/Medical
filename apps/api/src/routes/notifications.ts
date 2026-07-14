// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { notifications, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const notificationsRouter = new Hono<AppEnvironment>();

// ─── Get my notifications ────────────────────────────────
// Caretaker Profiles: caretakers see a union of (a) their own link-state
// notifications and (b) the active principal's notifications. The
// principal's userId is resolved via the active patient row.
notificationsRouter.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const dbUser = c.get("dbUser");

  const userIds = new Set<string>([userId]);

  if (dbUser?.role === "caretaker") {
    const activeId =
      (c.get("activePrincipalPatientId") as string | null) ||
      dbUser?.activePrincipalPatientId ||
      null;
    if (activeId) {
      const [principalPatient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, activeId))
        .limit(1);
      if (principalPatient?.userId) {
        userIds.add(principalPatient.userId);
      }
    }
  }

  const notifs = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.userId, Array.from(userIds)))
    .orderBy(desc(notifications.createdAt));

  return c.json({ notifications: notifs });
});

// ─── Get unread count (DB query, not JS filter) ──────────
// MUST be before /:id/read to avoid route conflict
notificationsRouter.get("/unread-count", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      )
    );

  return c.json({ count: Number(count ?? 0) });
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
