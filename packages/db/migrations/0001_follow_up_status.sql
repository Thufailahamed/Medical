-- Migration: add follow_up status column to medical_records
-- Adds a `status` field defaulting to 'pending' so existing follow-up
-- records remain valid. Future follow-ups can be marked 'completed' or
-- 'cancelled' via /doctor-portal/follow-ups/:id/status.

ALTER TABLE `medical_records` ADD `status` TEXT DEFAULT 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `medical_records_follow_up_status_idx`
  ON `medical_records` (`follow_up_date`, `status`);