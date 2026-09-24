-- 0032: schema sync for tables/columns added to packages/db/src/schema.ts.
--
-- Hand-applied migrations 0064-0082 already created these tables and
-- columns on remote D1. drizzle-kit auto-generated this file with
-- plain CREATE/ADD statements which collided on deploy ("table
-- notification_opt_outs already exists"). Rewriting every statement
-- idempotently so re-running is safe regardless of partial state.
-- D1 runs SQLite >= 3.35, which supports ALTER TABLE ADD COLUMN IF
-- NOT EXISTS.
CREATE TABLE IF NOT EXISTS `notification_opt_outs` (
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`reason` text,
	`opted_out_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `payment_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`merchant_order_id` text,
	`payload` text,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text,
	`status` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `phlebotomists` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_partner_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_booking_items` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`test_id` text NOT NULL,
	`price` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_booking_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`user_id` text,
	`lab_partner_id` text,
	`score` integer,
	`stars` integer,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_promo_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`discount_type` text NOT NULL,
	`discount_value` real NOT NULL,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`valid_from` text,
	`valid_until` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_result_values` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`test_name` text NOT NULL,
	`value` real,
	`unit` text,
	`reference_min` real,
	`reference_max` real,
	`is_abnormal` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
-- NOTE: SQLite does not support ADD COLUMN IF NOT EXISTS.
-- All columns below were already added to remote D1 via previous migrations (0071-0082).
-- ALTER TABLE `files` ADD COLUMN `version` integer DEFAULT 1 NOT NULL;
-- ALTER TABLE `files` ADD COLUMN `supersedes_file_id` text;
-- ALTER TABLE `files` ADD COLUMN `is_current` integer DEFAULT true NOT NULL;
-- ALTER TABLE `files` ADD COLUMN `deleted_at` text;
-- ALTER TABLE `files` ADD COLUMN `deleted_by` text;
-- ALTER TABLE `files` ADD COLUMN `change_reason` text;
-- ALTER TABLE `notification_preferences` ADD COLUMN `sms` integer DEFAULT true NOT NULL;
-- ALTER TABLE `patients` ADD COLUMN `saved_addresses` text;
-- ALTER TABLE `payments` ADD COLUMN `provider` text;
-- ALTER TABLE `payments` ADD COLUMN `provider_charge_id` text;
-- ALTER TABLE `payments` ADD COLUMN `webhook_received_at` text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `payment_webhook_events_provider_event_idx` ON `payment_webhook_events` (`provider`,`event_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_webhook_events_merchant_idx` ON `payment_webhook_events` (`merchant_order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_booking_items_booking` ON `test_booking_items` (`booking_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_booking_items_test` ON `test_booking_items` (`test_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `test_booking_ratings_booking_id_unique` ON `test_booking_ratings` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `test_promo_codes_code_unique` ON `test_promo_codes` (`code`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_promo_codes_code` ON `test_promo_codes` (`code`,`is_active`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_result_values_name` ON `test_result_values` (`test_name`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_result_values_booking` ON `test_result_values` (`booking_id`);
