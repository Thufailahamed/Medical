-- Migration: notification push delivery tracking
-- Adds columns for tracking Expo Push ticket + delivery status so the
-- push-receipts cron can poll https://exp.host/--/api/v2/push/getReceipts
-- and clean up dead tokens (DeviceNotRegistered).

ALTER TABLE `notifications` ADD `expo_ticket` TEXT;
--> statement-breakpoint
ALTER TABLE `notifications` ADD `status` TEXT DEFAULT 'sent';
--> statement-breakpoint
ALTER TABLE `notifications` ADD `delivered_at` TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_ticket_idx` ON `notifications` (`expo_ticket`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_status_idx` ON `notifications` (`status`);
