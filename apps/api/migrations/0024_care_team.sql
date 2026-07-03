-- Migration 0024: care_team_members
--
-- Phase 1 of the doctor↔patient enterprise architecture. The previous
-- data model had no explicit doctor↔patient relationship table — every
-- access check union-queried appointments, prescriptions, lab orders
-- and medical records. That worked for one doctor / one patient, but
-- could not express:
--   - "Specialist invited by primary care for a second opinion"
--   - "Patient revokes a doctor's access" (no central state to flip)
--   - "Family view consent window" (e.g. spouse acting on behalf)
--   - "Covering doctor during leave"
-- This table is the single source of truth. The existing FKs from
-- appointments / prescriptions / lab orders / medical records /
-- walk_ins / messages_conversations continue to function as evidence;
-- the access middleware consults care_team_members FIRST for the
-- primary decision.
--
-- Active uniqueness: only one active row per (patient, doctor, role)
-- triple. Revoked rows are kept for audit and can be re-issued via
-- INSERT with a new id (the old row's UNIQUE constraint ignores it
-- because status='revoked' is filtered out by the partial index).

CREATE TABLE `care_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`role` text NOT NULL,
	`scope` text DEFAULT 'full' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`invited_by_user_id` text,
	`invited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`consent_record_id` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_team_active_unique` ON `care_team_members` (`patient_id`, `doctor_id`, `role`) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX `care_team_doctor_status_idx` ON `care_team_members` (`doctor_id`, `status`);
--> statement-breakpoint
CREATE INDEX `care_team_patient_status_idx` ON `care_team_members` (`patient_id`, `status`);