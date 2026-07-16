// ─── Pre-visit summary cron handler (Tier 1 records PR3) ────────
//
// Same shape as post-visit-summary-router: a secret-gated POST that
// fires the sweep manually. Wrangler's scheduled trigger is the
// production path; this exists so integration tests + manual ops
// can run it on demand.

import { Hono } from "hono";
import { runPreVisitSummaryCron } from "./pre-visit-summary";
import type { AppEnvironment } from "../types";

export const preVisitSummaryRouter = new Hono<AppEnvironment>();

preVisitSummaryRouter.post("/__cron/pre-visit-summary", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  if (!isDev) {
    const provided = c.req.header("x-cron-secret") || "";
    if (!cronSecret || provided !== cronSecret) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const db = c.get("db");
  const result = await runPreVisitSummaryCron(c.env, db);
  return c.json({ ok: true, ...result });
});