-- 0082: file versioning + soft-delete + retention.
-- Non-destructive ADD COLUMN only (nullable, defaults safe for existing rows).

ALTER TABLE `files` ADD COLUMN `version` INTEGER DEFAULT 1;
ALTER TABLE `files` ADD COLUMN `supersedes_file_id` TEXT;
ALTER TABLE `files` ADD COLUMN `is_current` INTEGER DEFAULT 1;
ALTER TABLE `files` ADD COLUMN `deleted_at` TEXT;
ALTER TABLE `files` ADD COLUMN `deleted_by` TEXT;
ALTER TABLE `files` ADD COLUMN `change_reason` TEXT;

CREATE INDEX IF NOT EXISTS `idx_files_record_current` ON `files` (`record_id`, `is_current`);
CREATE INDEX IF NOT EXISTS `idx_files_deleted` ON `files` (`deleted_at`);
