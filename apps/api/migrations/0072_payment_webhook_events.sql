-- Migration: payment_webhook_events — webhook idempotency
-- Inserts one row per (provider, event_id) UNIQUE. Used by tryRecordWebhook()
-- to stop replay attacks + duplicate processing from PayHere/Stripe.

CREATE TABLE IF NOT EXISTS `payment_webhook_events` (
  `id` TEXT PRIMARY KEY,
  `provider` TEXT NOT NULL,
  `event_id` TEXT NOT NULL,
  `merchant_order_id` TEXT,
  `payload` TEXT,
  `received_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` TEXT,
  `status` TEXT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `payment_webhook_events_provider_event_idx`
  ON `payment_webhook_events` (`provider`, `event_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `payment_webhook_events_merchant_idx`
  ON `payment_webhook_events` (`merchant_order_id`);
