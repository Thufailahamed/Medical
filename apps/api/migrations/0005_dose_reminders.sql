-- ─── 0005: Dose reminder deduplication ─────────────────────
-- F1: cron worker (apps/api/src/cron/dose-reminders.ts) fires every 5 min
-- and notifies users of upcoming medicine doses. The `notified_at` column
-- records when a reminder fired for a dose so subsequent cron passes
-- (and any manual /__cron/dose-reminders re-runs) skip the same dose.
--
-- Nullable: null = not yet reminded, ISO timestamp = reminder dispatched.
-- We keep the dose row alive (it still drives streak/adherence) — we just
-- mark "reminder is done" so we never spam the user.

ALTER TABLE `medicine_doses` ADD `notified_at` TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `medicine_doses_due_idx`
  ON `medicine_doses` (`scheduled_for`, `notified_at`);
