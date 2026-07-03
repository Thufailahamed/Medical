CREATE TABLE `doctor_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`amount_lkr` real NOT NULL,
	`event_count` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reference` text,
	`paid_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `doctor_revenue_events` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`patient_id` text,
	`amount_lkr` real NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`payout_id` text,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payout_id`) REFERENCES `doctor_payouts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `doctor_rx_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`name` text NOT NULL,
	`diagnosis` text,
	`medicines_json` text NOT NULL,
	`notes` text,
	`specialty` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_role` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `messages_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`patient_id` text NOT NULL,
	`last_message_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_message_preview` text,
	`last_message_sender` text,
	`doctor_unread` integer DEFAULT 0 NOT NULL,
	`patient_unread` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `doctor_payouts_doctor_idx` ON `doctor_payouts` (`doctor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `doctor_revenue_events_doctor_occurred_idx` ON `doctor_revenue_events` (`doctor_id`,`occurred_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_revenue_events_source_idx` ON `doctor_revenue_events` (`doctor_id`,`source_kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `doctor_rx_templates_doctor_idx` ON `doctor_rx_templates` (`doctor_id`,`use_count`);--> statement-breakpoint
CREATE INDEX `messages_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_conversations_doctor_patient_idx` ON `messages_conversations` (`doctor_id`,`patient_id`);--> statement-breakpoint
CREATE INDEX `messages_conversations_doctor_recent_idx` ON `messages_conversations` (`doctor_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `messages_conversations_patient_recent_idx` ON `messages_conversations` (`patient_id`,`last_message_at`);