-- Migration 0034: extend care_team_members with tenant context (Phase MTN-1)
--
-- Adds three nullable columns to the existing table. NULL is the legacy
-- default = global access grant (existing semantics). New POST flows
-- can pin a grant to a specific hospital/clinic via (contextType,
-- contextId), and optionally link to the doctor_patient_relationships
-- row that drove the grant.

ALTER TABLE `care_team_members` ADD COLUMN `context_type` text;
--> statement-breakpoint
ALTER TABLE `care_team_members` ADD COLUMN `context_id` text;
--> statement-breakpoint
ALTER TABLE `care_team_members` ADD COLUMN `relationship_id` text REFERENCES `doctor_patient_relationships`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `care_team_context_idx` ON `care_team_members` (`context_type`, `context_id`, `status`);