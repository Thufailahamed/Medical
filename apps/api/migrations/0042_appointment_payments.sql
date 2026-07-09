-- Phase 5: PayHere online payments for appointments.
-- Separate from the existing `payments` table which is hospital billing
-- (cash/card/wallet received by staff). This table tracks online gateway
-- transactions initiated by the patient, with PayHere-specific metadata.

CREATE TABLE `appointment_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount_lkr` real NOT NULL,
	`currency` text DEFAULT 'LKR' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payhere_order_id` text NOT NULL UNIQUE,
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
CREATE INDEX `appointment_payments_appointment_idx` ON `appointment_payments` (`appointment_id`);
--> statement-breakpoint
CREATE INDEX `appointment_payments_user_idx` ON `appointment_payments` (`user_id`, `status`);
--> statement-breakpoint
-- Ensure only one *active* (non-failed) payment attempt per appointment at a time.
-- A new initiate() call with the same appointment+pending order will reuse it.
CREATE UNIQUE INDEX `appointment_payments_unique_active`
  ON `appointment_payments` (`appointment_id`)
  WHERE `status` = 'pending';