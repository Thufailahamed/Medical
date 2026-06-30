CREATE TABLE `otp_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`channel` text NOT NULL,
	`target` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `nic_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `date_of_birth` text;