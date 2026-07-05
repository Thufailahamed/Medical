CREATE TABLE `consent_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`family_member_id` text,
	`granted_to_user_id` text,
	`granted_to_token` text,
	`purpose` text NOT NULL,
	`scope_json` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`consent_record_id` text,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`granted_by_user_id` text NOT NULL,
	`label` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`family_member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `document_dicom_metadata` (
	`file_id` text PRIMARY KEY NOT NULL,
	`study_instance_uid` text,
	`series_instance_uid` text,
	`sop_instance_uid` text,
	`modality` text,
	`body_part` text,
	`study_date` text,
	`manufacturer` text,
	`metadata_json` text,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dsar_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text,
	`completed_at` text,
	`cancelled_at` text,
	`notes` text,
	`result_url` text,
	`result_expires_at` text,
	`approver_user_id` text
);
--> statement-breakpoint
CREATE TABLE `file_download_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`issued_by_user_id` text NOT NULL,
	`recipient_user_id` text,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`ip` text,
	`user_agent` text,
	`audit_action` text,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `qr_access_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`family_member_id` text,
	`encrypted_payload` text NOT NULL,
	`expires_at` text NOT NULL,
	`max_scans` integer DEFAULT 5 NOT NULL,
	`scans_json` text DEFAULT '[]' NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`family_member_id`) REFERENCES `family_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `record_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`encrypted_payload_snapshot` text,
	`edited_by_user_id` text,
	`edited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`diff_summary` text,
	FOREIGN KEY (`record_id`) REFERENCES `medical_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `medical_records` ADD `kind` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `encrypted_payload` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `encrypted_payload_kek_id` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `encrypted_payload_dek_wrapped` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `iv` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `auth_tag` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `envelope_version` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `schema_version` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `rehashed_at` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `prev_record_hash` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `locked_by_user_id` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `locked_until` text;--> statement-breakpoint
ALTER TABLE `messages_conversations` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `record_revisions_record_number_unique` ON `record_revisions` (`record_id`,`revision_number`);