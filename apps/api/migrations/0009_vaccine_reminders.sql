-- ─── 0009: Vaccination reminder dedupe ────────────────────
-- Phase 2.2: cron worker (apps/api/src/cron/vaccination-reminders.ts)
-- fires daily at 09:12 SL (03:42 UTC) and notifies users of upcoming
-- vaccine doses. The `vaccine_reminders` table records which (patient,
-- catalog vaccine, dose-slot) tuples we've already pushed for so
-- subsequent cron passes (and manual /__cron/vaccination-reminders
-- re-runs) don't re-notify.
--
-- One row per (patient × vaccine_catalog × schedule-index) where the
-- slot enters the 30-day reminder window. `reminded_count` lets us
-- cap pushes (early + final) per slot.

CREATE TABLE IF NOT EXISTS `vaccine_reminders` (
  `id` TEXT PRIMARY KEY,
  `patient_id` TEXT NOT NULL REFERENCES `patients`(`id`),
  `vaccine_id` TEXT NOT NULL REFERENCES `vaccine_catalog`(`id`),
  `dose_index` INTEGER NOT NULL,
  `due_date` TEXT NOT NULL,                 -- YYYY-MM-DD local
  `reminder_sent_at` TEXT,                  -- ISO UTC, nullable
  `reminded_count` INTEGER NOT NULL DEFAULT 0,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`patient_id`, `vaccine_id`, `dose_index`)
);

CREATE INDEX IF NOT EXISTS `vaccine_reminders_due_idx`
  ON `vaccine_reminders` (`due_date`, `reminder_sent_at`);

CREATE INDEX IF NOT EXISTS `vaccine_reminders_patient_idx`
  ON `vaccine_reminders` (`patient_id`);