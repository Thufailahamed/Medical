-- Migration 0058: pre-visit summary delivery tracking.
--
-- Tier 1 records PR3: Doctor Pre-visit Summary — when an appointment is
-- confirmed, a cron fires ~1h before the visit and sends the doctor an
-- email summarising the patient's allergies, active meds, recent visits,
-- and chronic conditions. Stamping these columns on the appointment
-- gives us idempotency (cron won't re-send) + delivery audit.
--
-- Both columns nullable: NULL means "not yet sent" (initial state on all
-- rows after this migration; cron backfills within the next run).

ALTER TABLE `appointments` ADD COLUMN `pre_visit_summary_sent_at` TEXT;
ALTER TABLE `appointments` ADD COLUMN `pre_visit_summary_sent_via` TEXT;
  -- 'email' | 'push' | 'both' — today only 'email' is wired; push
  -- lands when expo-server-sdk is added. Schema reserved up-front to
  -- avoid a follow-up migration.

-- Partial index: only confirmed + upcoming + not-yet-sent rows are
-- scanned by the cron. Stale rows fall out of the index automatically
-- once `pre_visit_summary_sent_at` is non-NULL.
CREATE INDEX IF NOT EXISTS `idx_appointments_pre_visit_cron`
  ON `appointments`(`status`, `date`, `time`)
  WHERE `pre_visit_summary_sent_at` IS NULL;