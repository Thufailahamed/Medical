-- ─── 0005: Dose reminder deduplication ─────────────────────
-- F1: cron worker (apps/api/src/cron/dose-reminders.ts) fires every 5 min
-- and notifies users of upcoming medicine doses. The `notified_at` column
-- records when a reminder fired for a dose so subsequent cron passes
-- (and any manual /__cron/dose-reminders re-runs) skip the same dose.
--
-- History: the original 0005 was applied to REMOTE D1 out-of-band (see
-- 0002_peaceful_nuke.sql for the journal reconciliation of that drift).
-- Remote's d1_migrations already records 0005 as applied, so this file is
-- only re-applied to LOCAL D1 by the deploy script. There, the ALTER is
-- needed (local doesn't yet have the column) and the CREATE INDEX is
-- idempotent.
--
-- On remote: re-running is blocked by the d1_migrations row, so the
-- duplicate-column error cannot trigger. On local: the ALTER succeeds
-- (column is new), then CREATE INDEX IF NOT EXISTS runs.
--
-- Nullable: null = not yet reminded, ISO timestamp = reminder dispatched.

ALTER TABLE `medicine_doses` ADD `notified_at` TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `medicine_doses_due_idx`
  ON `medicine_doses` (`scheduled_for`, `notified_at`);