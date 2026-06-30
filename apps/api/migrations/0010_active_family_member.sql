-- ─── 0010: Active family member (Phase 2.3) ─────────────
-- Phase 2.3: server-cached "Acting as …" context. The mobile client
-- also persists this in secureStorage; this column is the durable
-- source of truth so crons / share-link consumers / cross-device
-- sync see the right member without depending on the client.
--
-- Nullable: NULL = no active family member, behaving as the principal
-- patient (the historical default). No backfill needed — existing
-- rows start at NULL and clients opt in by PATCHing.

ALTER TABLE `users` ADD `active_family_member_id` TEXT REFERENCES `family_members`(`id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `users_active_family_member_idx`
  ON `users` (`active_family_member_id`);