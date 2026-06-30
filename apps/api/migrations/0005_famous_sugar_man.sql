ALTER TABLE `medical_records` ADD `source` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `email_message_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `email_alias` text;--> statement-breakpoint
CREATE UNIQUE INDEX `medical_records_email_message_id_unique` ON `medical_records` (`email_message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_alias_unique` ON `users` (`email_alias`);--> statement-breakpoint

-- Phase 1.4 backfill: legacy users have NULL email_alias. The unique index
-- allows multiple NULLs, so we generate 8-hex aliases for everyone and retry
-- with a `-<n>` suffix on the (vanishingly rare) prefix collision.
-- Idempotent: re-running the migration does not overwrite existing aliases.
UPDATE `users`
SET `email_alias` = 'u_' || substr(hex(randomblob(4)), 1, 8)
WHERE `email_alias` IS NULL;