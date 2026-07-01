CREATE TABLE `demo_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`clinic_name` text,
	`contact_name` text NOT NULL,
	`contact_role` text,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`nic` text,
	`slmc_registration_no` text,
	`specialty` text,
	`clinic_size` text,
	`message` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drug_allergies_master` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_name` text NOT NULL,
	`family` text NOT NULL,
	`cross_reactives` text
);
--> statement-breakpoint
CREATE TABLE `drug_interactions_master` (
	`id` text PRIMARY KEY NOT NULL,
	`ingredient_a` text NOT NULL,
	`ingredient_b` text NOT NULL,
	`severity` text NOT NULL,
	`mechanism` text,
	`recommendation` text NOT NULL,
	`source` text DEFAULT 'curated',
	`active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `hospital_staff_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`role` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`consumed_by_user_id` text,
	`revoked` integer DEFAULT false NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`consumed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicine_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicine_contraindications` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`condition_name` text NOT NULL,
	`severity` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicine_controlled` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`schedule` text NOT NULL,
	`region` text DEFAULT 'LK',
	`notes` text,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicine_dosage_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicine_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rxnorm_ingredient_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicine_liver_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`child_pugh` text NOT NULL,
	`dose_adjustment` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicine_manufacturers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicine_pregnancy_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`fda_category` text,
	`trimester` text DEFAULT 'all',
	`severity` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicine_renal_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`egfr_min` real,
	`egfr_max` real,
	`dose_adjustment` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicine_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicine_substitutions` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`substitute_id` text NOT NULL,
	`equivalence` text,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`substitute_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicine_therapeutic_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`atc_code` text,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicines_master` (
	`id` text PRIMARY KEY NOT NULL,
	`rxcui` text,
	`generic_name` text NOT NULL,
	`brand_name` text,
	`strength` text,
	`dosage_form_id` text,
	`route_id` text,
	`category_id` text,
	`atc_class_id` text,
	`schedule_class` text,
	`is_generic` integer DEFAULT true,
	`notes` text,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dosage_form_id`) REFERENCES `medicine_dosage_forms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`route_id`) REFERENCES `medicine_routes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `medicine_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`atc_class_id`) REFERENCES `medicine_therapeutic_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicines_master_categories` (
	`medicine_id` text NOT NULL,
	`category_id` text NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `medicine_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicines_master_classes` (
	`medicine_id` text NOT NULL,
	`class_id` text NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `medicine_therapeutic_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicines_master_ingredients` (
	`medicine_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`strength` text,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingredient_id`) REFERENCES `medicine_ingredients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medicines_master_manufacturers` (
	`medicine_id` text NOT NULL,
	`manufacturer_id` text NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `medicine_manufacturers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `patient_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`condition_name` text NOT NULL,
	`icd10` text,
	`onset_date` text,
	`active` integer DEFAULT true,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `patient_medications_history` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`master_medicine_id` text,
	`free_text_name` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`outcome` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`master_medicine_id`) REFERENCES `medicines_master`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prescription_signatures` (
	`id` text PRIMARY KEY NOT NULL,
	`prescription_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`signing_key_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`signature_b64` text NOT NULL,
	`canonical_payload` text NOT NULL,
	`signed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	`revocation_reason` text,
	`signing_public_key` text NOT NULL,
	FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `doctors` ADD `slmc_registration_no` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `slmc_verified_at` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `signing_public_key` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `signing_private_key_enc` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `signing_key_id` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `signing_key_created_at` text;--> statement-breakpoint
ALTER TABLE `doctors` ADD `signing_key_revoked_at` text;--> statement-breakpoint
ALTER TABLE `medicines` ADD `master_medicine_id` text REFERENCES medicines_master(id);--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `signature_id` text REFERENCES prescription_signatures(id);--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `signed_at` text;--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `signed_payload_hash` text;--> statement-breakpoint
ALTER TABLE `share_links` ADD `family_member_id` text REFERENCES family_members(id);--> statement-breakpoint
CREATE INDEX `idx_demo_requests_status_created` ON `demo_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `drug_allergies_ingredient` ON `drug_allergies_master` (`ingredient_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `drug_interactions_pair` ON `drug_interactions_master` (`ingredient_a`,`ingredient_b`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_staff_invites_token_unique` ON `hospital_staff_invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_hospital_staff_invites_hospital` ON `hospital_staff_invites` (`hospital_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_categories_name_unique` ON `medicine_categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_controlled_med_region` ON `medicine_controlled` (`medicine_id`,`region`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_dosage_forms_name_unique` ON `medicine_dosage_forms` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_ingredients_name_unique` ON `medicine_ingredients` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_ingredients_rxnorm_ingredient_id_unique` ON `medicine_ingredients` (`rxnorm_ingredient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_manufacturers_name_unique` ON `medicine_manufacturers` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_routes_name_unique` ON `medicine_routes` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_substitutions_pair` ON `medicine_substitutions` (`medicine_id`,`substitute_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicine_therapeutic_classes_atc_code_unique` ON `medicine_therapeutic_classes` (`atc_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicines_master_rxcui_unique` ON `medicines_master` (`rxcui`);--> statement-breakpoint
CREATE INDEX `idx_medicines_master_generic_name` ON `medicines_master` (`generic_name`);--> statement-breakpoint
CREATE INDEX `idx_medicines_master_brand_name` ON `medicines_master` (`brand_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicines_master_categories_pk` ON `medicines_master_categories` (`medicine_id`,`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicines_master_classes_pk` ON `medicines_master_classes` (`medicine_id`,`class_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicines_master_ingredients_pk` ON `medicines_master_ingredients` (`medicine_id`,`ingredient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `medicines_master_manufacturers_pk` ON `medicines_master_manufacturers` (`medicine_id`,`manufacturer_id`);--> statement-breakpoint
CREATE INDEX `idx_pmh_patient` ON `patient_medications_history` (`patient_id`,`start_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `prescription_signatures_rx` ON `prescription_signatures` (`prescription_id`);--> statement-breakpoint
CREATE INDEX `prescription_signatures_doctor` ON `prescription_signatures` (`doctor_id`,`signed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_doctors_slmc_registration_no` ON `doctors` (`slmc_registration_no`);--> statement-breakpoint
CREATE INDEX `idx_medicines_master_medicine` ON `medicines` (`master_medicine_id`);--> statement-breakpoint
CREATE INDEX `idx_share_links_family_member` ON `share_links` (`family_member_id`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/