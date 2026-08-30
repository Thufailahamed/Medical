-- Migration: notification_opt_outs — per-user channel opt-out
-- One row per (user_id, channel) where channel in ('sms','email','push').
-- Used by sendSmsWithOptOut() to skip sends; written on Twilio 21610 (unsubscribed).

CREATE TABLE IF NOT EXISTS `notification_opt_outs` (
  `user_id` TEXT NOT NULL,
  `channel` TEXT NOT NULL,
  `reason` TEXT,
  `opted_out_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `channel`)
);
