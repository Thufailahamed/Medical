-- Migration 0033: doctor_patient_relationships table (Phase MTN-1)
--
-- THE heart of the multi-tenant model. Every row pins a doctor-patient
-- clinical relationship to a specific tenant (hospital OR clinic).
-- Replaces the implicit "doctor treats patient" signal that previously
-- lived in appointments/prescriptions/lab_orders/etc. care_team_members
-- stays for patient-driven access grants.
--
-- Drizzle can't emit partial UNIQUE indexes or CHECK constraints for
-- SQLite, so the table is created here as raw SQL with all constraints
-- inline. Mirrors the Drizzle schema in packages/db/src/schema.ts so
-- query planner picks the indexes correctly.

CREATE TABLE `doctor_patient_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`context_type` text NOT NULL CHECK (`context_type` IN ('hospital','clinic')),
	`context_id` text NOT NULL,
	`relationship_kind` text DEFAULT 'consulting' NOT NULL CHECK (`relationship_kind` IN
	  ('primary_care','consulting','covering','referred_to','referred_from','on_call','second_opinion')),
	`status` text DEFAULT 'active' NOT NULL CHECK (`status` IN ('active','ended','transferred')),
	`is_primary` integer DEFAULT 0 NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ended_at` text,
	`referred_by_doctor_id` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referred_by_doctor_id`) REFERENCES `doctor_patient_relationships`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK (`context_type` IS NOT NULL AND `context_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `dpr_doctor_status_idx` ON `doctor_patient_relationships` (`doctor_id`,`status`);
--> statement-breakpoint
CREATE INDEX `dpr_patient_status_idx` ON `doctor_patient_relationships` (`patient_id`,`status`);
--> statement-breakpoint
CREATE INDEX `dpr_context_status_idx` ON `doctor_patient_relationships` (`context_type`,`context_id`,`status`);
--> statement-breakpoint
-- Partial UNIQUE: at most one active row per (doctor, patient, tenant).
-- Multiple 'ended' rows allowed for audit.
CREATE UNIQUE INDEX IF NOT EXISTS `dpr_active_triple_unique`
  ON `doctor_patient_relationships` (`doctor_id`, `patient_id`, `context_type`, `context_id`)
  WHERE `status` = 'active';
--> statement-breakpoint
-- Partial UNIQUE: at most one primary per (patient, tenant) when active.
CREATE UNIQUE INDEX IF NOT EXISTS `dpr_primary_per_context_unique`
  ON `doctor_patient_relationships` (`patient_id`, `context_type`, `context_id`)
  WHERE `is_primary` = 1 AND `status` = 'active';