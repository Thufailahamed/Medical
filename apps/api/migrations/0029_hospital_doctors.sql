-- Migration 0029: hospital_doctors table (Phase MTN-1)
--
-- M:N membership replacing the implicit single-FK `doctors.hospital_id`
-- role. One row per (hospital, doctor) pair. Status changes in-place —
-- no row duplication. Soft-leave sets `left_at` and flips status to
-- 'inactive'.

CREATE TABLE `hospital_doctors` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`department` text,
	`role` text DEFAULT 'consultant' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`left_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_doctors_pair_unique` ON `hospital_doctors` (`hospital_id`,`doctor_id`);
--> statement-breakpoint
CREATE INDEX `hospital_doctors_hospital_status_idx` ON `hospital_doctors` (`hospital_id`,`status`);
--> statement-breakpoint
CREATE INDEX `hospital_doctors_doctor_status_idx` ON `hospital_doctors` (`doctor_id`,`status`);