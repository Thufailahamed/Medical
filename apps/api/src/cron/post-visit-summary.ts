// ─── Post-visit summary cron (Round 3 P1) ────────────────
//
// Hourly sweep that catches any appointment that flipped to "completed"
// in the last 24h but never received a summary email. The inline trigger
// in /doctor-portal/appointments/:id/status is the primary path; this
// cron is the safety net for cron-disabled environments, retry-after-
// failure cases, and cold-start invocations.
//
// Schedule: hourly, off the :00 spike (configurable in wrangler.toml).

import { sql } from "drizzle-orm";
import type { DB } from "../lib/db";
import { sendVisitSummaryEmail } from "../lib/post-visit-summary";
import { logger } from "../lib/logger";

const SWEEP_WINDOW_HOURS = 24;

type Bindings = {
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PUBLIC_URL?: string;
  EXPO_PUBLIC_PUBLIC_URL?: string;
};

export async function runPostVisitSummaryCron(
  env: Bindings,
  db: DB
): Promise<{ scanned: number; sent: number; skipped: number; failed: number }> {
  // Pull candidate appointments. We approximate "completed within the
  // last 24h" via `summary_email_sent_at IS NULL` plus a hard cut on
  // `created_at` (we don't store `completed_at`, so the most-recent
  // created_at is the only durable signal we have without another
  // column).
  const rows = (await db.all(
    sql`SELECT id FROM appointments
        WHERE status = 'completed'
          AND summary_email_sent_at IS NULL
          AND datetime(created_at) >= datetime('now', ${`-${SWEEP_WINDOW_HOURS} hours`})
        ORDER BY created_at DESC
        LIMIT 200`
  )) as Array<{ id: string }>;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const r = await sendVisitSummaryEmail(env, db, row.id);
      if (r.sent) sent++;
      else skipped++;
    } catch (err: any) {
      failed++;
      logger.warn("post-visit-summary.cron_failed", "exception", {
        appointmentId: row.id,
        error: err?.message,
      });
    }
  }

  logger.info("post-visit-summary.cron_complete", "done", {
    scanned: rows.length,
    sent,
    skipped,
    failed,
  });
  return { scanned: rows.length, sent, skipped, failed };
}