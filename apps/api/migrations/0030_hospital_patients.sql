-- Migration 0030: hospital_patients table (Phase MTN-1)
--
-- M:N registration. Each row carries the hospital-scoped MRN. The
-- (hospital_id, mrn) pair MUST be unique; the (hospital_id, patient_id)
-- pair MUST be unique. Backfill migration 0036 populates existing rows.

CREATE TABLE `hospital_patients` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`mrn` text NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`discharged_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_patients_mrn_unique` ON `hospital_patients` (`hospital_id`,`mrn`);
--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_patients_pair_unique` ON `hospital_patients` (`hospital_id`,`patient_id`);
--> statement-breakpoint
CREATE INDEX `hospital_patients_patient_status_idx` ON `hospital_patients` (`patient_id`,`status`);
--> statement-breakpoint
CREATE INDEX `hospital_patients_hospital_status_idx` ON `hospital_patients` (`hospital_id`,`status`);