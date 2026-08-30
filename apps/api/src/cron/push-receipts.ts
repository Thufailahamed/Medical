import { Hono } from "hono";
import { pollReceipts } from "../lib/notifications";
import type { AppEnvironment } from "../types";

/**
 * Push receipt polling cron. Runs every 5 minutes (same slot as
 * dose-reminders + pre-visit-summary).
 *
 * Polls Expo Push receipts for tickets stored on notifications.expo_ticket
 * and updates status (`delivered`/`failed`). Cleans up dead push_tokens
 * on `DeviceNotRegistered`.
 *
 * Requires migration 0075 (notifications.expo_ticket + status columns).
 */
export const pushReceiptsRouter = new Hono<AppEnvironment>();

pushReceiptsRouter.post("/__cron/push-receipts", async (c) => {
  const result = await pollReceipts(c.env.DB, c.env);
  return c.json({ ok: true, ...result });
});
