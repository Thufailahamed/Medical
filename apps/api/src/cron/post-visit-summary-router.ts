// ─── Post-visit summary cron handler (Round 3 P1) ────────
//
// Wraps `runPostVisitSummaryCron` so Wrangler can call it via a
// scheduled trigger AND it can be invoked manually via HTTP for
// integration tests. Manual invocation requires `x-cron-secret` to
// match `env.CRON_SECRET` (skipped in dev).

import { Hono } from "hono";
import { runPostVisitSummaryCron } from "./post-visit-summary";
import type { AppEnvironment } from "../types";

export const postVisitSummaryRouter = new Hono<AppEnvironment>();

postVisitSummaryRouter.post("/__cron/post-visit-summary", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  if (!isDev) {
    const provided = c.req.header("x-cron-secret") || "";
    if (!cronSecret || provided !== cronSecret) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const db = c.get("db");
  const result = await runPostVisitSummaryCron(c.env, db);
  return c.json({ ok: true, ...result });
});