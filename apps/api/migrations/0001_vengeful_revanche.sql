ALTER TABLE `medical_records` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `medical_records` ADD `family_member_id` text REFERENCES family_members(id);--> statement-breakpoint
CREATE INDEX `idx_medical_records_family_member` ON `medical_records` (`family_member_id`);--> statement-breakpoint
CREATE INDEX `idx_medical_records_patient_archived_date` ON `medical_records` (`patient_id`,`archived_at`,`date`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/