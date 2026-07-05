CREATE TABLE `marketing_waitlist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'patient' NOT NULL,
	`source` text,
	`referrer` text,
	`user_agent` text,
	`invited_at` text,
	`invited_slot` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `vitals` ADD `context` text;--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_waitlist_email_unique` ON `marketing_waitlist` (`email`);--> statement-breakpoint
CREATE INDEX `idx_marketing_waitlist_pending` ON `marketing_waitlist` (`invited_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_marketing_waitlist_source` ON `marketing_waitlist` (`source`,`created_at`);