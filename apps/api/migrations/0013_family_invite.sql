-- ─── 0013: Family invite link (Phase 2.3.1) ──────────────
-- Phase 2.3.1: piggyback family invites on `share_links` with a `kind`
-- discriminator. New columns:
--   - kind: TEXT NOT NULL DEFAULT 'record_share'. 'family_invite' for invites.
--   - consumed_at: TEXT (NULL for record-share). Set on first acceptance.
--   - redeemed_by_user_id: TEXT FK -> users.id (NULL until acceptance).
-- Existing rows stay `kind='record_share'` and are unaffected.
--
-- The `family_invite` rows reuse `scope` as JSON to carry the proposed
-- `{ name, relationship }` so the accept endpoint can create the
-- `family_members` row without an additional fetch.
--
-- GET /share/:token (record-share bundle) is now `kind` gated; family
-- invites resolve through GET /family/invites/:token.

ALTER TABLE `share_links` ADD `kind` TEXT NOT NULL DEFAULT 'record_share';
--> statement-breakpoint

ALTER TABLE `share_links` ADD `consumed_at` TEXT;
--> statement-breakpoint

ALTER TABLE `share_links` ADD `redeemed_by_user_id` TEXT REFERENCES `users`(`id`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `share_links_kind_idx` ON `share_links` (`kind`);