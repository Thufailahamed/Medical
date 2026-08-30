-- Migration: notification_preferences — add sms channel toggle
-- Default 1 (opt-in) so existing rows continue receiving SMS.

ALTER TABLE `notification_preferences` ADD `sms` INTEGER NOT NULL DEFAULT 1;
