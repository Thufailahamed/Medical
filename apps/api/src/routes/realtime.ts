// @ts-nocheck

// GET /realtime — Server-Sent Events stream for the logged-in user.
//
// Pushes any newly-inserted notifications (and a heartbeat every ~15s so
// proxies don't drop the connection). The client-side `useRealtime` hook
// opens the stream and invalidates React Query on each event.
//
// This is a polling-style SSE: every 2s we SELECT unseen notifications
// for the user and emit them. Marking a notification as read happens
// via the existing /notifications/:id/read endpoint, so we don't
// duplicate that logic here. Cloudflare Workers + D1 can't easily
// fan-out a real pub/sub without Durable Objects, and a 2s poll keeps
// the implementation trivial + correct.

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { and, eq, gt } from "drizzle-orm";
import { notifications } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const realtimeRouter = new Hono<AppEnvironment>();
realtimeRouter.use("*", authMiddleware);

const POLL_MS = 2000;
const HEARTBEAT_MS = 15000;

realtimeRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  let closed = false;
  // Track IDs we've already pushed to this client so reconnects
  // don't re-emit the entire history. Cleared on connection close.
  const seen = new Set<string>();
  // Cursor (last seen id) for the poll query. Starts at empty string
  // so the first poll returns the most recent row.
  let cursor = "";

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "hello",
      data: JSON.stringify({ userId, at: new Date().toISOString() }),
    });

    let lastHeartbeat = Date.now();

    while (!closed) {
      try {
        const where = cursor
          ? and(eq(notifications.userId, userId), gt(notifications.id, cursor))
          : eq(notifications.userId, userId);

        const rows: Array<{
          id: string;
          type: string;
          title: string;
          body: string;
          data: string | null;
          read: number | boolean | null;
          createdAt: string;
        }> = await db
          .select()
          .from(notifications)
          .where(where as any)
          .orderBy(notifications.id)
          .limit(50);

        for (const row of rows) {
          if (closed) break;
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          cursor = row.id;
          await stream.writeSSE({
            id: row.id,
            event: "notification",
            data: JSON.stringify({
              id: row.id,
              type: row.type,
              title: row.title,
              body: row.body,
              data: row.data ? safeParse(row.data) : null,
              read: !!row.read,
              createdAt: row.createdAt,
            }),
          });
        }
      } catch (err) {
        // Don't kill the stream on a transient DB blip — log + back off.
        console.error("/realtime poll error:", err);
      }

      // Periodic heartbeat so proxies don't drop the connection.
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_MS) {
        try {
          await stream.writeSSE({ event: "ping", data: String(now) });
          lastHeartbeat = now;
        } catch {
          closed = true;
          break;
        }
      }

      await sleepWithCancel(POLL_MS, () => closed);
    }
  });
});

function sleepWithCancel(ms: number, isClosed: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isClosed() || Date.now() - start >= ms) return resolve();
      setTimeout(tick, Math.min(200, ms));
    };
    tick();
  });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default realtimeRouter;
