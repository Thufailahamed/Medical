CREATE TABLE IF NOT EXISTS `ai_counters` (
	`scope` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ambulance_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_org_id` text NOT NULL,
	`patient_id` text,
	`pickup_address` text NOT NULL,
	`destination_address` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`assigned_user_id` text,
	`notes` text,
	`acknowledged_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`operator_org_id`) REFERENCES `operator_orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `appointment_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount_lkr` real NOT NULL,
	`currency` text DEFAULT 'LKR' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payhere_order_id` text NOT NULL,
	`payhere_payment_id` text,
	`payhere_status_code` text,
	`payhere_method` text,
	`raw_notify` text,
	`failure_reason` text,
	`refunded_amount_lkr` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `appointment_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`stars` integer NOT NULL,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `caretaker_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`principal_patient_id` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`caretaker_name` text NOT NULL,
	`care_role` text DEFAULT 'other' NOT NULL,
	`channel` text NOT NULL,
	`contact_target` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked` integer DEFAULT false,
	`consumed_at` text,
	`redeemed_by_user_id` text,
	`otp_attempts` integer DEFAULT 0 NOT NULL,
	`locked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`principal_patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `caretaker_marketplace_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`marketplace_profile_id` text NOT NULL,
	`caretaker_user_id` text NOT NULL,
	`patient_user_id` text NOT NULL,
	`patient_message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_at` text,
	`link_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`marketplace_profile_id`) REFERENCES `caretaker_marketplace_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`caretaker_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`link_id`) REFERENCES `patient_links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `caretaker_marketplace_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`caretaker_user_id` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`languages` text DEFAULT '[]' NOT NULL,
	`care_roles_offered` text DEFAULT '[]' NOT NULL,
	`district` text DEFAULT '' NOT NULL,
	`hourly_rate_lkr` integer,
	`experience_years` integer DEFAULT 0,
	`is_available` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`caretaker_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `caretaker_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`caretaker_user_id` text NOT NULL,
	`document_type` text NOT NULL,
	`document_file_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	`decided_by_user_id` text,
	`decision_note` text,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`revoked_reason` text,
	FOREIGN KEY (`caretaker_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `diagnostic_test_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`sample_type` text NOT NULL,
	`fasting_required` integer DEFAULT false NOT NULL,
	`fasting_hours` integer DEFAULT 0 NOT NULL,
	`home_collection_available` integer DEFAULT true NOT NULL,
	`price` real NOT NULL,
	`discount_price` real,
	`lab_partner_id` text NOT NULL,
	`turnaround_hours` integer DEFAULT 24 NOT NULL,
	`instructions` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lab_partner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `discharge_events` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`admission_date` text,
	`discharge_date` text,
	`primary_diagnosis` text,
	`secondary_diagnoses` text,
	`procedures` text,
	`medications_given` text,
	`follow_up_instructions` text,
	`follow_up_date` text,
	`hospital_name` text,
	`attending_doctor` text,
	`raw_text` text,
	`extraction_confidence` real,
	`model_version` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `medical_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `hospital_pacs_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`username_enc` text NOT NULL,
	`password_enc` text NOT NULL,
	`kek_version` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sync_interval_minutes` integer DEFAULT 60 NOT NULL,
	`last_sync_at` text,
	`last_sync_attempt_at` text,
	`last_sync_status` text DEFAULT 'idle' NOT NULL,
	`last_sync_error` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `hospital_pacs_sync_cursors` (
	`id` text PRIMARY KEY NOT NULL,
	`integration_id` text NOT NULL,
	`patient_mrn` text NOT NULL,
	`last_study_date` text,
	`last_pulled_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`integration_id`) REFERENCES `hospital_pacs_integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `imaging_findings` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`modality` text NOT NULL,
	`body_part` text,
	`study_date` text,
	`findings` text,
	`impression` text,
	`recommendations` text,
	`radiologist_name` text,
	`critical` integer DEFAULT false NOT NULL,
	`raw_text` text,
	`extraction_confidence` real,
	`model_version` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `medical_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_dependent_members` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`name` text NOT NULL,
	`relation` text NOT NULL,
	`dob` text,
	`gender` text,
	`nic_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `insurance_enrollments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_ecards` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`card_number` text NOT NULL,
	`qr_token` text NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`valid_until` text NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `insurance_enrollments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`policy_number` text,
	`status` text DEFAULT 'payment_pending' NOT NULL,
	`billing_cycle` text NOT NULL,
	`premium_amount_lkr` real NOT NULL,
	`coverage_amount_lkr` real NOT NULL,
	`start_date` text,
	`end_date` text,
	`next_premium_due_at` text,
	`last_premium_paid_at` text,
	`kyc_status` text DEFAULT 'pending' NOT NULL,
	`nominee_name` text,
	`nominee_relation` text,
	`nominee_dob` text,
	`dependents_json` text,
	`payment_id` text,
	`cancelled_at` text,
	`cancelled_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `insurance_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `insurance_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_marketplace_claim_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_key` text NOT NULL,
	`file_name` text,
	`content_type` text,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `insurance_marketplace_claims`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_marketplace_claim_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`sender_role` text NOT NULL,
	`body` text NOT NULL,
	`attachment_file_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `insurance_marketplace_claims`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_marketplace_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`incurring_facility` text,
	`treatment_type` text NOT NULL,
	`admission_date` text,
	`discharge_date` text,
	`diagnosis` text,
	`amount_requested_lkr` real NOT NULL,
	`amount_approved_lkr` real,
	`status` text DEFAULT 'draft' NOT NULL,
	`insurer_remarks` text,
	`patient_remarks` text,
	`reviewed_by_user_id` text,
	`reviewed_at` text,
	`paid_at` text,
	`transaction_ref` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `insurance_enrollments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`provider_id`) REFERENCES `insurance_providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`plan_type` text NOT NULL,
	`coverage_summary_lkr` real NOT NULL,
	`coverage_details_json` text,
	`monthly_premium_lkr` real NOT NULL,
	`annual_premium_lkr` real NOT NULL,
	`annual_discount_pct` real DEFAULT 0,
	`deductible_lkr` real DEFAULT 0,
	`copay_pct` real DEFAULT 0,
	`co_payment_cap_lkr` real DEFAULT 0,
	`waiting_period_days` integer DEFAULT 30,
	`pre_existing_waiting_days` integer DEFAULT 365,
	`network_hospital_count` integer DEFAULT 0,
	`key_features_json` text,
	`exclusions_json` text,
	`term_months` integer DEFAULT 12 NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `insurance_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_premium_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`cycle` text NOT NULL,
	`amount_lkr` real NOT NULL,
	`due_at` text NOT NULL,
	`paid_at` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`payment_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `insurance_enrollments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `insurance_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_org_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`tagline` text,
	`description` text,
	`regulator_license` text,
	`claim_settlement_ratio_pct` real,
	`cashless_hospital_count` integer,
	`website_url` text,
	`support_phone` text,
	`rating_avg` real DEFAULT 0,
	`rating_count` integer DEFAULT 0,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`operator_org_id`) REFERENCES `operator_orgs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lab_test_results` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`lab_report_id` text,
	`test_name` text NOT NULL,
	`loinc_code` text,
	`value` real,
	`value_text` text,
	`unit` text,
	`ref_range_low` real,
	`ref_range_high` real,
	`ref_range_text` text,
	`flag` text DEFAULT 'unknown' NOT NULL,
	`collected_at` text,
	`reported_at` text,
	`raw_text` text,
	`page_hint` integer,
	`extraction_confidence` real,
	`model_version` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `medical_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lab_report_id`) REFERENCES `lab_reports`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `operator_orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`contact_email` text,
	`contact_phone` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `patient_links` (
	`id` text PRIMARY KEY NOT NULL,
	`caretaker_user_id` text NOT NULL,
	`principal_patient_id` text NOT NULL,
	`care_role` text DEFAULT 'other' NOT NULL,
	`invite_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`invited_by_user_id` text,
	`invited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`revoked_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`caretaker_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`principal_patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invite_id`) REFERENCES `caretaker_invites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `portal_scan_events` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`patient_id` text NOT NULL,
	`scanned_by_user_id` text NOT NULL,
	`portal_role` text NOT NULL,
	`purpose` text NOT NULL,
	`hospital_id` text,
	`success` integer NOT NULL,
	`reason` text,
	`ip` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scanned_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prescription_items` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`dosage` text,
	`frequency` text,
	`timing` text,
	`duration_days` integer,
	`refills` integer,
	`prescriber_name` text,
	`prescribed_date` text,
	`raw_text` text,
	`extraction_confidence` real,
	`model_version` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `medical_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `teleconsult_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`doctor_id` text NOT NULL,
	`patient_user_id` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`room_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text,
	`ended_at` text,
	`duration_sec` integer,
	`signaling_msg_count` integer DEFAULT 0 NOT NULL,
	`ice_restart_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`whereby_room_url` text,
	`whereby_host_room_url` text,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`doctor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`lab_partner_id` text NOT NULL,
	`booking_type` text NOT NULL,
	`test_id` text,
	`package_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_date` text NOT NULL,
	`scheduled_time_slot` text NOT NULL,
	`collection_address` text NOT NULL,
	`phlebotomist_id` text,
	`phlebotomist_name` text,
	`phlebotomist_phone` text,
	`total_price` real NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text DEFAULT 'cash' NOT NULL,
	`payment_ref` text,
	`result_pdf_url` text,
	`result_summary` text,
	`result_ready_at` text,
	`cancellation_reason` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lab_partner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`test_id`) REFERENCES `diagnostic_test_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`package_id`) REFERENCES `test_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`phlebotomist_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_package_items` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`test_id` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `test_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`test_id`) REFERENCES `diagnostic_test_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `test_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`discount_price` real,
	`lab_partner_id` text NOT NULL,
	`turnaround_hours` integer DEFAULT 48 NOT NULL,
	`instructions` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lab_partner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vaccination_doses` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`catalog_id` text,
	`vaccine_name` text NOT NULL,
	`dose_number` integer,
	`date` text,
	`provider` text,
	`batch_number` text,
	`site` text,
	`raw_text` text,
	`extraction_confidence` real,
	`model_version` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`record_id`) REFERENCES `medical_records`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`catalog_id`) REFERENCES `vaccine_catalog`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- ALTER TABLE `appointments` ADD `mode` text DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
-- ALTER TABLE `appointments` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
-- ALTER TABLE `appointments` ADD `summary_email_sent_at` text;--> statement-breakpoint
-- ALTER TABLE `appointments` ADD `rating_prompted_at` text;--> statement-breakpoint
-- ALTER TABLE `appointments` ADD `pre_visit_summary_sent_at` text;--> statement-breakpoint
-- ALTER TABLE `appointments` ADD `pre_visit_summary_sent_via` text;--> statement-breakpoint
-- ALTER TABLE `audit_logs` ADD `actor_user_id` text REFERENCES users(id);--> statement-breakpoint
-- ALTER TABLE `doctors` ADD `telemedicine_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- ALTER TABLE `medical_records` ADD `embedding` text;--> statement-breakpoint
-- ALTER TABLE `medical_records` ADD `embedding_model` text;--> statement-breakpoint
-- ALTER TABLE `medical_records` ADD `embedded_at` text;--> statement-breakpoint
-- ALTER TABLE `medical_records` ADD `extracted_data_status` text;--> statement-breakpoint
-- ALTER TABLE `medical_records` ADD `extracted_at` text;--> statement-breakpoint
-- ALTER TABLE `prescriptions` ADD `dispense_token` text;--> statement-breakpoint
-- ALTER TABLE `prescriptions` ADD `dispense_token_consumed_at` text;--> statement-breakpoint
-- ALTER TABLE `prescriptions` ADD `dispensed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
-- ALTER TABLE `prescriptions` ADD `dispensed_by_pharmacy_name` text;--> statement-breakpoint
-- ALTER TABLE `qr_access_tokens` ADD `purpose` text DEFAULT 'emergency' NOT NULL;--> statement-breakpoint
-- ALTER TABLE `qr_access_tokens` ADD `scopes` text;--> statement-breakpoint
-- ALTER TABLE `qr_access_tokens` ADD `created_by_user_id` text REFERENCES users(id);--> statement-breakpoint
-- ALTER TABLE `qr_access_tokens` ADD `hospital_id` text REFERENCES hospitals(id);--> statement-breakpoint
-- ALTER TABLE `qr_access_tokens` ADD `last_issued_at` text;--> statement-breakpoint
-- ALTER TABLE `qr_access_tokens` ADD `rotation_seconds` integer DEFAULT 30;--> statement-breakpoint
-- ALTER TABLE `share_links` ADD `prescription_id` text;--> statement-breakpoint
-- ALTER TABLE `share_links` ADD `record_ids` text;--> statement-breakpoint
-- ALTER TABLE `users` ADD `active_principal_patient_id` text REFERENCES patients(id);--> statement-breakpoint
-- ALTER TABLE `users` ADD `operator_org_id` text;--> statement-breakpoint
-- ALTER TABLE `users` ADD `last_login_at` text;--> statement-breakpoint
-- ALTER TABLE `walk_ins` ADD `origin` text DEFAULT 'manual';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `appointment_payments_payhere_order_id_unique` ON `appointment_payments` (`payhere_order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `appointment_payments_appointment_idx` ON `appointment_payments` (`appointment_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `appointment_payments_user_idx` ON `appointment_payments` (`user_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `appointment_ratings_appointment_id_unique` ON `appointment_ratings` (`appointment_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_appointment_ratings_doctor_created` ON `appointment_ratings` (`doctor_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `caretaker_invites_token_unique` ON `caretaker_invites` (`token`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caretaker_invites_principal` ON `caretaker_invites` (`principal_patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caretaker_invites_contact` ON `caretaker_invites` (`channel`,`contact_target`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caretaker_marketplace_inquiries_caretaker` ON `caretaker_marketplace_inquiries` (`caretaker_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caretaker_marketplace_inquiries_patient` ON `caretaker_marketplace_inquiries` (`patient_user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `caretaker_marketplace_profiles_caretaker_user_id_unique` ON `caretaker_marketplace_profiles` (`caretaker_user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caretaker_marketplace_profiles_district` ON `caretaker_marketplace_profiles` (`district`,`is_available`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caretaker_verifications_caretaker` ON `caretaker_verifications` (`caretaker_user_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_caretaker_verifications_status` ON `caretaker_verifications` (`status`,`submitted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `diagnostic_test_catalog_slug_unique` ON `diagnostic_test_catalog` (`slug`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diagnostic_test_catalog_category` ON `diagnostic_test_catalog` (`category`,`is_active`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diagnostic_test_catalog_lab_partner` ON `diagnostic_test_catalog` (`lab_partner_id`,`is_active`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_discharge_events_patient_date` ON `discharge_events` (`patient_id`,`discharge_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_discharge_events_record` ON `discharge_events` (`record_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hospital_pacs_integrations_hospital_idx` ON `hospital_pacs_integrations` (`hospital_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hospital_pacs_integrations_due_idx` ON `hospital_pacs_integrations` (`enabled`,`last_sync_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `hospital_pacs_cursors_pair_unique` ON `hospital_pacs_sync_cursors` (`integration_id`,`patient_mrn`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hospital_pacs_cursors_integration_idx` ON `hospital_pacs_sync_cursors` (`integration_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_imaging_findings_patient_date` ON `imaging_findings` (`patient_id`,`study_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_imaging_findings_record` ON `imaging_findings` (`record_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_imaging_findings_critical` ON `imaging_findings` (`critical`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_dependents_enrollment_idx` ON `insurance_dependent_members` (`enrollment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `insurance_ecards_enrollment_id_unique` ON `insurance_ecards` (`enrollment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `insurance_ecards_card_number_unique` ON `insurance_ecards` (`card_number`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `insurance_ecards_qr_token_unique` ON `insurance_ecards` (`qr_token`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_ecards_token_idx` ON `insurance_ecards` (`qr_token`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `insurance_enrollments_policy_number_unique` ON `insurance_enrollments` (`policy_number`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_enrollments_user_status_idx` ON `insurance_enrollments` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_enrollments_provider_status_idx` ON `insurance_enrollments` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_enrollments_next_due_idx` ON `insurance_enrollments` (`next_premium_due_at`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_mkt_claim_docs_claim_idx` ON `insurance_marketplace_claim_docs` (`claim_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_mkt_claim_messages_claim_idx` ON `insurance_marketplace_claim_messages` (`claim_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_mkt_claims_enrollment_status_idx` ON `insurance_marketplace_claims` (`enrollment_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_mkt_claims_user_idx` ON `insurance_marketplace_claims` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_mkt_claims_provider_status_idx` ON `insurance_marketplace_claims` (`provider_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `insurance_plans_provider_slug_unique` ON `insurance_plans` (`provider_id`,`slug`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_plans_published_idx` ON `insurance_plans` (`provider_id`,`is_published`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_plans_type_idx` ON `insurance_plans` (`plan_type`,`is_published`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_invoices_enrollment_status_idx` ON `insurance_premium_invoices` (`enrollment_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_invoices_due_status_idx` ON `insurance_premium_invoices` (`due_at`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `insurance_providers_slug_unique` ON `insurance_providers` (`slug`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `insurance_providers_published_idx` ON `insurance_providers` (`is_published`,`rating_avg`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_lab_test_results_patient_test_reported` ON `lab_test_results` (`patient_id`,`test_name`,`reported_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_lab_test_results_record` ON `lab_test_results` (`record_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_lab_test_results_lab_report` ON `lab_test_results` (`lab_report_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_lab_test_results_confidence` ON `lab_test_results` (`extraction_confidence`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uniq_patient_links_active` ON `patient_links` (`caretaker_user_id`,`principal_patient_id`) WHERE status = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_patient_links_caretaker_status` ON `patient_links` (`caretaker_user_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_patient_links_principal_status` ON `patient_links` (`principal_patient_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_patient_links_invite` ON `patient_links` (`invite_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `portal_scan_events_time_idx` ON `portal_scan_events` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `portal_scan_events_patient_idx` ON `portal_scan_events` (`patient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prescription_items_patient_date` ON `prescription_items` (`patient_id`,`prescribed_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prescription_items_record` ON `prescription_items` (`record_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_prescription_items_name` ON `prescription_items` (`patient_id`,`name`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teleconsult_sessions_appt_idx` ON `teleconsult_sessions` (`appointment_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teleconsult_sessions_doctor_recent_idx` ON `teleconsult_sessions` (`doctor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `teleconsult_sessions_patient_recent_idx` ON `teleconsult_sessions` (`patient_user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `teleconsult_sessions_one_live_per_appt` ON `teleconsult_sessions` (`appointment_id`) WHERE status IN ('requested','ringing','active');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_bookings_patient_status` ON `test_bookings` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_bookings_date` ON `test_bookings` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_bookings_lab_partner_status` ON `test_bookings` (`lab_partner_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_bookings_phlebotomist` ON `test_bookings` (`phlebotomist_id`,`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_package_items_package` ON `test_package_items` (`package_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_package_items_test` ON `test_package_items` (`test_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_test_package_items_unique` ON `test_package_items` (`package_id`,`test_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `test_packages_slug_unique` ON `test_packages` (`slug`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_test_packages_lab_partner` ON `test_packages` (`lab_partner_id`,`is_active`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vaccination_doses_patient_vaccine_date` ON `vaccination_doses` (`patient_id`,`vaccine_name`,`date`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vaccination_doses_record` ON `vaccination_doses` (`record_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_vaccination_doses_catalog` ON `vaccination_doses` (`catalog_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `appointments_doctor_mode_idx` ON `appointments` (`doctor_id`,`mode`,`date`,`time`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_medical_records_extract_status` ON `medical_records` (`extracted_data_status`,`record_type`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `qr_access_tokens_pat_purpose_idx` ON `qr_access_tokens` (`patient_id`,`purpose`) WHERE "qr_access_tokens"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `qr_access_tokens_expiry_idx` ON `qr_access_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_share_links_prescription` ON `share_links` (`prescription_id`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/