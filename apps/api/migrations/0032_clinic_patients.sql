-- Migration 0032: clinic_patients table (Phase MTN-1)
--
-- Patient registered at a clinic. Mirrors hospital_patients semantics.
-- MRN unique per clinic; (clinic_id, patient_id) unique.

CREATE TABLE `clinic_patients` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`mrn` text NOT NULL,
	`status` text DEFAULT 'registered' NOT NULL,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`discharged_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clinic_patients_mrn_unique` ON `clinic_patients` (`clinic_id`,`mrn`);
--> statement-breakpoint
CREATE UNIQUE INDEX `clinic_patients_pair_unique` ON `clinic_patients` (`clinic_id`,`patient_id`);
--> statement-breakpoint
CREATE INDEX `clinic_patients_patient_status_idx` ON `clinic_patients` (`patient_id`,`status`);
--> statement-breakpoint
CREATE INDEX `clinic_patients_clinic_status_idx` ON `clinic_patients` (`clinic_id`,`status`);