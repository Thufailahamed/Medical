// @ts-nocheck

import { and, eq } from "drizzle-orm";
import { notifications, pushTokens, notificationPreferences, users } from "@healthcare/db";
import { sendSmsWithOptOut } from "./sms";

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
  // Required to enable SMS channel — when provided, SMS sends if preference allows.
  env?: any;
};

/**
 * Inserts a notification row for the user, then dispatches a push to all
 * registered tokens for the user if their preferences allow it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const { db, userId, type, title, body, data, forcePush, env } = input;

  // 1. Resolve preferences (default = enabled).
  let inApp = true;
  let push = !!forcePush;
  let sms = false;
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
      // sms column added by migration 0074; treat absence as default-on
      sms = (pref as any).sms !== false;
    } else if (!forcePush) {
      push = true; // default opt-in
      sms = true;
    }
  } catch {
    // preferences table may not exist in dev; default to insert + push.
    inApp = true;
    push = !!forcePush ? true : true;
    sms = true;
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
      if (tokens.length > 0) {
        await sendExpoPush(
          tokens.map((t: any) => ({
            to: t.token,
            title,
            body,
            data: data || {},
            sound: "default",
          }))
        );
      }
    } catch (err) {
      console.error("push dispatch failed:", err);
    }
  }

  // 4. SMS channel (only if env provided + preference allows + user has phone).
  if (env && sms && body) {
    try {
      const [user] = await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.phone) {
        await sendSmsWithOptOut(env, userId, user.phone, body, db);
      }
    } catch (err) {
      console.error("sms dispatch failed:", err);
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