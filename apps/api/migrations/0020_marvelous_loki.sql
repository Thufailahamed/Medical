CREATE TABLE `admission_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`admission_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`recorded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`admission_id`) REFERENCES `admissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `admissions` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`admitted_by_user_id` text NOT NULL,
	`admitting_doctor_id` text,
	`admission_type` text DEFAULT 'planned' NOT NULL,
	`ward_id` text,
	`bed_id` text,
	`admitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`discharged_at` text,
	`discharged_by_user_id` text,
	`status` text DEFAULT 'admitted' NOT NULL,
	`reason` text,
	`diagnosis_at_admission` text,
	`discharge_diagnosis` text,
	`discharge_condition` text,
	`discharge_instructions` text,
	`follow_up_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`admitted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`name` text NOT NULL,
	`head_doctor_id` text,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit_price_lkr` real DEFAULT 0 NOT NULL,
	`amount_lkr` real DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`ref_record_id` text,
	`ref_prescription_id` text,
	`ref_lab_order_id` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`hospital_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`admission_id` text,
	`appointment_id` text,
	`walk_in_id` text,
	`visit_type` text DEFAULT 'opd' NOT NULL,
	`invoice_number` text NOT NULL,
	`subtotal_lkr` real DEFAULT 0 NOT NULL,
	`tax_lkr` real DEFAULT 0 NOT NULL,
	`discount_lkr` real DEFAULT 0 NOT NULL,
	`total_lkr` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_at` text,
	`due_at` text,
	`notes` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_lkr` real NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`reference` text,
	`received_by_user_id` text NOT NULL,
	`paid_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notes` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `hospital_staff` ADD `department_id` text;--> statement-breakpoint
CREATE INDEX `admission_notes_admission_idx` ON `admission_notes` (`admission_id`);--> statement-breakpoint
CREATE INDEX `admissions_hospital_status_idx` ON `admissions` (`hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `admissions_patient_status_idx` ON `admissions` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `departments_hospital_idx` ON `departments` (`hospital_id`);--> statement-breakpoint
CREATE INDEX `invoice_line_items_invoice_idx` ON `invoice_line_items` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `invoices_hospital_status_idx` ON `invoices` (`hospital_id`,`status`);--> statement-breakpoint
CREATE INDEX `invoices_patient_status_idx` ON `invoices` (`patient_id`,`status`);--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);