-- Phase IMG-2: PACS pull integration tables.
--
-- Each hospital can configure one or more DICOMweb endpoints to poll.
-- Credentials (HTTP Basic username/password) are envelope-encrypted with
-- the same KEK-encrypted JSON shape used by doctors.signing_private_key_enc.
-- The KEK id is denormalised into `kek_version` so a future rotation
-- script can find rows to rewrap without scanning ciphertext.
--
-- Sync cursor: one row per (integration, patient MRN) so each patient
-- can advance independently — a sync skip after StudyDate=20260615 for
-- patient A never blocks patient B from being picked up fresh.

CREATE TABLE `hospital_pacs_integrations` (
  `id` text PRIMARY KEY NOT NULL,
  `hospital_id` text NOT NULL,
  `name` text NOT NULL,
  `base_url` text NOT NULL,
  `username_enc` text NOT NULL,
  `password_enc` text NOT NULL,
  `kek_version` text NOT NULL,
  `enabled` integer NOT NULL DEFAULT 1,
  `sync_interval_minutes` integer NOT NULL DEFAULT 60,
  `last_sync_at` text,
  `last_sync_attempt_at` text,
  `last_sync_status` text NOT NULL DEFAULT 'idle',
  `last_sync_error` text,
  `consecutive_failures` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX IF NOT EXISTS `hospital_pacs_integrations_hospital_idx`
  ON `hospital_pacs_integrations` (`hospital_id`);

CREATE INDEX IF NOT EXISTS `hospital_pacs_integrations_due_idx`
  ON `hospital_pacs_integrations` (`enabled`, `last_sync_at`);

CREATE TABLE `hospital_pacs_sync_cursors` (
  `id` text PRIMARY KEY NOT NULL,
  `integration_id` text NOT NULL,
  `patient_mrn` text NOT NULL,
  `last_study_date` text,
  `last_pulled_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`integration_id`) REFERENCES `hospital_pacs_integrations`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `hospital_pacs_cursors_pair_unique`
  ON `hospital_pacs_sync_cursors` (`integration_id`, `patient_mrn`);

CREATE INDEX IF NOT EXISTS `hospital_pacs_cursors_integration_idx`
  ON `hospital_pacs_sync_cursors` (`integration_id`);
