// ─── No-show sweep cron handler ──────────────────────────
//
// Wraps `runNoShowSweep` so Wrangler can call it via the scheduled
// trigger AND it can be invoked manually via HTTP for integration
// tests. Manual invocation requires `x-cron-secret` to match
// `env.CRON_SECRET` (skipped in dev).

import { Hono } from "hono";
import { runNoShowSweep } from "./no-show-sweep";
import type { AppEnvironment } from "../types";

export const noShowSweepRouter = new Hono<AppEnvironment>();

noShowSweepRouter.post("/__cron/no-show-sweep", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  if (!isDev) {
    const provided = c.req.header("x-cron-secret") || "";
    if (!cronSecret || provided !== cronSecret) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const db = c.get("db");
  const result = await runNoShowSweep(db);
  return c.json({ ok: true, ...result });
});
