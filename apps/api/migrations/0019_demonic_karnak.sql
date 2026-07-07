CREATE TABLE `admin_passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text,
	`device_name` text DEFAULT 'Passkey' NOT NULL,
	`last_used_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `doctor_verification_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`doctor_id` text NOT NULL,
	`uploaded_by_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`decision_note` text,
	`decided_by_user_id` text,
	`decided_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_passkeys_credential_id_unique` ON `admin_passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `admin_passkeys_user_idx` ON `admin_passkeys` (`user_id`);--> statement-breakpoint
CREATE INDEX `doctor_verification_docs_doctor_idx` ON `doctor_verification_docs` (`doctor_id`,`created_at`);