-- 0081: document security hardening — indexes for authz/audit lookups.
-- Non-destructive: CREATE INDEX IF NOT EXISTS only. No column drops.
-- Fixes: files(record_id) full scans, audit_logs full scans, token expiry scans.

CREATE INDEX IF NOT EXISTS `idx_files_record_id` ON `files` (`record_id`);
CREATE INDEX IF NOT EXISTS `idx_files_r2_key` ON `files` (`r2_key`);

CREATE INDEX IF NOT EXISTS `idx_audit_user_created` ON `audit_logs` (`user_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_audit_resource` ON `audit_logs` (`resource`, `resource_id`);

CREATE INDEX IF NOT EXISTS `idx_file_download_tokens_expiry` ON `file_download_tokens` (`expires_at`);
CREATE INDEX IF NOT EXISTS `idx_file_download_tokens_file` ON `file_download_tokens` (`file_id`);

CREATE INDEX IF NOT EXISTS `idx_share_links_token` ON `share_links` (`token`);
CREATE INDEX IF NOT EXISTS `idx_share_links_patient` ON `share_links` (`patient_id`);

CREATE INDEX IF NOT EXISTS `idx_medical_records_patient_date` ON `medical_records` (`patient_id`, `date`);
CREATE INDEX IF NOT EXISTS `idx_medical_records_patient_type` ON `medical_records` (`patient_id`, `record_type`);
