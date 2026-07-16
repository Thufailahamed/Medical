// ─── Pre-visit summary cron (Tier 1 records PR3) ───────────────
//
// Every 10 minutes, scan for confirmed appointments whose visit time
// falls within [now+50m, now+70m] and which haven't been sent yet.
// Stamps `appointments.pre_visit_summary_sent_at` after a successful
// send so the sweep is idempotent across reruns.
//
// Why the 50–70m window: too narrow and we miss slots where the
// doctor opens the appointment card slightly earlier; too wide and
// we double-send when the system clock drifts. 20-minute window is
// the practical sweet spot.

import { sql } from "drizzle-orm";
import type { DB } from "../lib/db";
import { sendPreVisitSummaryEmail } from "../lib/pre-visit-summary";
import { logger } from "../lib/logger";

const LOOKAHEAD_MIN = 50;
const LOOKAHEAD_MAX = 70;
const MAX_BATCH = 50;

type Bindings = {
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PUBLIC_URL?: string;
  EXPO_PUBLIC_PUBLIC_URL?: string;
  AI?: any;
};

export async function runPreVisitSummaryCron(
  env: Bindings,
  db: DB
): Promise<{ scanned: number; sent: number; skipped: number; failed: number }> {
  // Pull candidate appointments. SQLite's date/time concatenation is
  // best-effort: we treat `date || ' ' || time` as a UTC ISO-like
  // string and compare to `datetime('now', '+N minutes')`. We coerce
  // explicitly to avoid surprises with locale-dependent formats.
  const rows = (await db.all(
    sql`SELECT id FROM appointments
        WHERE pre_visit_summary_sent_at IS NULL
          AND status IN ('confirmed', 'scheduled')
          AND datetime(date || ' ' || time) BETWEEN datetime('now', ${`+${LOOKAHEAD_MIN} minutes`}) AND datetime('now', ${`+${LOOKAHEAD_MAX} minutes`})
        ORDER BY datetime(date || ' ' || time) ASC
        LIMIT ${MAX_BATCH}`
  )) as Array<{ id: string }>;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const r = await sendPreVisitSummaryEmail(env, db, row.id);
      if (r.sent) sent++;
      else skipped++;
    } catch (err: any) {
      failed++;
      logger.warn("pre-visit-summary.cron_failed", "exception", {
        appointmentId: row.id,
        error: err?.message,
      });
    }
  }

  logger.info("pre-visit-summary.cron_complete", "done", {
    scanned: rows.length,
    sent,
    skipped,
    failed,
  });
  return { scanned: rows.length, sent, skipped, failed };
}