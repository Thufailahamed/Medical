// @ts-nocheck

import { and, eq } from "drizzle-orm";
import { notifications, pushTokens, notificationPreferences } from "@healthcare/db";

// Best-effort Expo Push API sender. Never throws — DB insert succeeds even
// if push fails. Per Expo docs we batch by 100 with `Accept: application/json`.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type NotificationType =
  | "medicine"
  | "appointment"
  | "lab_ready"
  | "prescription"
  | "insurance"
  | "hospital"
  | "emergency"
  | "vaccination"
  | "general"
  | "hospital_request"
  | "teleconsult";

export type NotifyInput = {
  db: any;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  // Override push toggle for system-critical (e.g. emergency). Default false.
  forcePush?: boolean;
};

/**
 * Inserts a notification row for the user, then dispatches a push to all
 * registered tokens for the user if their preferences allow it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const { db, userId, type, title, body, data, forcePush } = input;

  // 1. Resolve preferences (default = enabled).
  let inApp = true;
  let push = !!forcePush;
  try {
    const [pref] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, type)
        )
      )
      .limit(1);
    if (pref) {
      inApp = (pref as any).inApp !== false;
      push = push || (pref as any).push !== false;
    } else if (!forcePush) {
      push = true; // default opt-in
    }
  } catch {
    // preferences table may not exist in dev; default to insert + push.
    inApp = true;
    push = !!forcePush ? true : true;
  }

  // 2. Insert DB row.
  if (inApp) {
    try {
      await db.insert(notifications).values({
        userId,
        type,
        title,
        body,
        data: data ? JSON.stringify(data) : null,
      } as any);
    } catch (err) {
      console.error("notify insert failed:", err);
    }
  }

  // 3. Dispatch push (best-effort, never throws).
  if (push) {
    try {
      const tokens = await db
        .select()
        .from(pushTokens)
        .where(eq(pushTokens.userId, userId));
      if (tokens.length === 0) return;
      await sendExpoPush(
        tokens.map((t: any) => ({
          to: t.token,
          title,
          body,
          data: data || {},
          sound: "default",
        }))
      );
    } catch (err) {
      console.error("push dispatch failed:", err);
    }
  }
}

async function sendExpoPush(messages: any[]): Promise<void> {
  // Chunk to 100 per Expo spec.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.error("Expo push request failed:", err);
    }
  }
}