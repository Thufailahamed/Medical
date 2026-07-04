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
CREATE TABLE `doctor_patient_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`context_type` text NOT NULL,
	`context_id` text NOT NULL,
	`relationship_kind` text DEFAULT 'consulting' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ended_at` text,
	`referred_by_doctor_id` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`referred_by_doctor_id`) REFERENCES `doctor_patient_relationships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
ALTER TABLE `care_team_members` ADD `context_type` text;--> statement-breakpoint
ALTER TABLE `care_team_members` ADD `context_id` text;--> statement-breakpoint
ALTER TABLE `care_team_members` ADD `relationship_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `active_tenant_type` text;--> statement-breakpoint
ALTER TABLE `users` ADD `active_tenant_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `clinic_doctors_pair_unique` ON `clinic_doctors` (`clinic_id`,`doctor_id`);--> statement-breakpoint
CREATE INDEX `clinic_doctors_clinic_status_idx` ON `clinic_doctors` (`clinic_id`,`status`);--> statement-breakpoint
CREATE INDEX `clinic_doctors_doctor_status_idx` ON `clinic_doctors` (`doctor_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `clinic_patients_mrn_unique` ON `clinic_patients` (`clinic_id`,`mrn`);--> statement-breakpoint
CREATE UNIQUE INDEX `clinic_patients_pair_unique` ON `clinic_patients` (`clinic_id`,`patient_id`);--> statement-breakpoint
CREATE INDEX `clinic_patients_patient_status_idx` ON `clinic_patients` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `clinic_patients_clinic_status_idx` ON `clinic_patients` (`clinic_id`,`status`);--> statement-breakpoint
CREATE INDEX `dpr_doctor_status_idx` ON `doctor_patient_relationships` (`doctor_id`,`status`);--> statement-breakpoint
CREATE INDEX `dpr_patient_status_idx` ON `doctor_patient_relationships` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `dpr_context_status_idx` ON `doctor_patient_relationships` (`context_type`,`context_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_doctors_pair_unique` ON `hospital_doctors` (`hospital_id`,`doctor_id`);--> statement-breakpoint
CREATE INDEX `hospital_doctors_hospital_status_idx` ON `hospital_doctors` (`hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `hospital_doctors_doctor_status_idx` ON `hospital_doctors` (`doctor_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_patients_mrn_unique` ON `hospital_patients` (`hospital_id`,`mrn`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_patients_pair_unique` ON `hospital_patients` (`hospital_id`,`patient_id`);--> statement-breakpoint
CREATE INDEX `hospital_patients_patient_status_idx` ON `hospital_patients` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `hospital_patients_hospital_status_idx` ON `hospital_patients` (`hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `users_active_tenant_idx` ON `users` (`active_tenant_type`,`active_tenant_id`);