CREATE TABLE `consult_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`from_doctor_id` text NOT NULL,
	`to_doctor_id` text,
	`from_hospital_id` text NOT NULL,
	`to_hospital_id` text NOT NULL,
	`question` text NOT NULL,
	`thread` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`linked_share_request_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_reply_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_share_request_id`) REFERENCES `hospital_share_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cross_hospital_lab_routings` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_order_id` text NOT NULL,
	`from_hospital_id` text NOT NULL,
	`to_hospital_id` text NOT NULL,
	`routed_by_user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`accepted_by_user_id` text,
	`accepted_at` text,
	`completed_at` text,
	`result_share_request_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lab_order_id`) REFERENCES `lab_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`result_share_request_id`) REFERENCES `hospital_share_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cross_hospital_referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`from_hospital_id` text NOT NULL,
	`from_doctor_id` text NOT NULL,
	`to_hospital_id` text NOT NULL,
	`to_specialty` text NOT NULL,
	`reason` text NOT NULL,
	`clinical_summary` text NOT NULL,
	`urgency` text DEFAULT 'routine' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`accepted_by_user_id` text,
	`accepted_at` text,
	`completed_at` text,
	`declined_at` text,
	`declined_reason` text,
	`linked_share_request_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_share_request_id`) REFERENCES `hospital_share_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `discharge_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`admission_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`from_hospital_id` text NOT NULL,
	`to_clinic_id` text,
	`to_hospital_id` text,
	`discharge_summary` text NOT NULL,
	`follow_up_plan` text,
	`shared_at` text,
	`acknowledged_by_user_id` text,
	`acknowledged_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admission_id`) REFERENCES `admissions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_clinic_id`) REFERENCES `clinics`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`acknowledged_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hospital_share_request_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor_user_id` text,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `hospital_share_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hospital_share_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_hospital_id` text NOT NULL,
	`source_hospital_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`scope` text DEFAULT 'full' NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`approved_by_user_id` text,
	`approved_at` text,
	`declined_at` text,
	`declined_reason` text,
	`revoked_at` text,
	`revoked_by_user_id` text,
	`viewed_count` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`requester_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_consult_to` ON `consult_notes` (`to_hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_consult_patient` ON `consult_notes` (`patient_id`);--> statement-breakpoint
CREATE INDEX `idx_xlabr_from` ON `cross_hospital_lab_routings` (`from_hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_xlabr_to` ON `cross_hospital_lab_routings` (`to_hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_xref_to` ON `cross_hospital_referrals` (`to_hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_xref_from` ON `cross_hospital_referrals` (`from_hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_dh_patient` ON `discharge_handoffs` (`patient_id`);--> statement-breakpoint
CREATE INDEX `idx_dh_from` ON `discharge_handoffs` (`from_hospital_id`);--> statement-breakpoint
CREATE INDEX `idx_hsr_events_req` ON `hospital_share_request_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `hospital_share_requests_token_unique` ON `hospital_share_requests` (`token`);--> statement-breakpoint
CREATE INDEX `idx_hsr_requester` ON `hospital_share_requests` (`requester_hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_hsr_source` ON `hospital_share_requests` (`source_hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_hsr_patient` ON `hospital_share_requests` (`patient_id`);