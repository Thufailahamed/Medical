ALTER TABLE `users` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `approved_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `approved_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `rejected_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `suspended_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `suspended_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `suspended_reason` text;--> statement-breakpoint
CREATE INDEX `users_status_role_idx` ON `users` (`status`,`role`);--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`created_at`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/