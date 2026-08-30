-- Migration: payments table — add gateway provider columns
-- Adds `provider`, `provider_charge_id`, `webhook_received_at` for tracking
-- online gateway transactions (PayHere, Stripe) on the existing hospital-billing
-- `payments` table. Existing rows get NULL provider — fine, they're cash/manual.

ALTER TABLE `payments` ADD `provider` TEXT;
--> statement-breakpoint
ALTER TABLE `payments` ADD `provider_charge_id` TEXT;
--> statement-breakpoint
ALTER TABLE `payments` ADD `webhook_received_at` TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payments_provider_idx` ON `payments` (`provider`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payments_charge_idx` ON `payments` (`provider_charge_id`);
