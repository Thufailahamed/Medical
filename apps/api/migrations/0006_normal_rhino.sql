CREATE TABLE IF NOT EXISTS `vaccine_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`vaccine_id` text NOT NULL,
	`dose_index` integer NOT NULL,
	`due_date` text NOT NULL,
	`reminder_sent_at` text,
	`reminded_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vaccine_id`) REFERENCES `vaccine_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wa_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`wa_user_id` text NOT NULL,
	`state` text DEFAULT 'welcome' NOT NULL,
	`locale` text DEFAULT 'en',
	`pending_nic_hash` text,
	`pending_nic_plain` text,
	`pending_dob` text,
	`otp_code_hash` text,
	`otp_expires_at` text,
	`otp_attempts` integer DEFAULT 0 NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wa_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`direction` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`body` text,
	`raw` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `wa_conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `share_links` ADD `kind` text DEFAULT 'record_share' NOT NULL;--> statement-breakpoint
ALTER TABLE `share_links` ADD `consumed_at` text;--> statement-breakpoint
ALTER TABLE `share_links` ADD `redeemed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `active_family_member_id` text REFERENCES family_members(id);--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_locale` text;--> statement-breakpoint
ALTER TABLE `vaccine_catalog` ADD `name_si` text;--> statement-breakpoint
ALTER TABLE `vaccine_catalog` ADD `name_ta` text;--> statement-breakpoint
ALTER TABLE `vaccine_catalog` ADD `target_disease_si` text;--> statement-breakpoint
ALTER TABLE `vaccine_catalog` ADD `target_disease_ta` text;--> statement-breakpoint
CREATE INDEX `wa_conversations_user_idx` ON `wa_conversations` (`wa_user_id`);--> statement-breakpoint
CREATE INDEX `wa_conversations_state_idx` ON `wa_conversations` (`state`);--> statement-breakpoint
CREATE INDEX `wa_messages_conversation_idx` ON `wa_messages` (`conversation_id`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/