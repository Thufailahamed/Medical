-- Migration 0028: clinics table (Phase MTN-1 Multi-Tenant Network)
--
-- First-class tenant owned by at least one doctor. Mirrors the
-- `hospitals` table shape so the same UI components can render both.
-- Multi-doctor membership lives in `clinic_doctors` (0031).
-- `userId` is the initial owner — created at POST /clinics.

CREATE TABLE `clinics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`license` text,
	`address` text,
	`phone` text,
	`location` text,
	`specializations` text,
	`rating` real,
	`short_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clinics_user_idx` ON `clinics` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `clinics_short_code_unique` ON `clinics` (`short_code`) WHERE `short_code` IS NOT NULL;