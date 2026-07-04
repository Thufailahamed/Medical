-- Migration 0031: clinic_doctors table (Phase MTN-1)
--
-- Multi-doctor clinic membership (locked decision: clinic can admit
-- multiple doctors). One row per (clinic, doctor) pair. The active
-- partial UNIQUE on (clinic_id, doctor_id, role) WHERE status='active'
-- enforces role exclusivity — a doctor can hold at most one active
-- role per clinic. Re-roling requires ending the old row.

CREATE TABLE `clinic_doctors` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`ownership_pct` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`left_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clinic_doctors_pair_unique` ON `clinic_doctors` (`clinic_id`,`doctor_id`);
--> statement-breakpoint
CREATE INDEX `clinic_doctors_clinic_status_idx` ON `clinic_doctors` (`clinic_id`,`status`);
--> statement-breakpoint
CREATE INDEX `clinic_doctors_doctor_status_idx` ON `clinic_doctors` (`doctor_id`,`status`);