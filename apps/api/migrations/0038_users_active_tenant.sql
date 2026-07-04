-- Migration 0038: users.active_tenant_* durable pointer (Phase MTN-1)
--
-- Mirror of `active_family_member_id` for tenant scope. Server-side
-- fallback when the client doesn't send x-active-hospital-id /
-- x-active-clinic-id headers (offline boot, legacy client, cron).
-- Header always wins when present.

ALTER TABLE `users` ADD COLUMN `active_tenant_type` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `active_tenant_id` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_active_tenant_idx` ON `users` (`active_tenant_type`, `active_tenant_id`);