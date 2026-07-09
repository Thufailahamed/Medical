CREATE TABLE `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`patient_id` text,
	`model` text NOT NULL,
	`cached_hit` integer DEFAULT false NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `email_pii` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone_pii` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nic_pii` text;