-- Migration 0027: share_links.kind enum check constraint
--
-- Phase 1 care team: care_team_invite rows ride the existing
-- share_links table. Without this constraint a typo like
-- 'careteam_inivte' would silently work and break the doctor-
-- initiated join flow. CHECK constraint at the DB layer makes
-- the contract explicit and rejects bad writes immediately.
--
-- The Drizzle schema declares kind as plain text — Drizzle has
-- no CHECK builder for SQLite, so we enforce here as raw SQL.

-- SQLite supports CHECK constraints added via table recreation
-- in older versions, but for tables created in 0001+ we use
-- the safe additive form: a TRIGGER that rejects bad inserts.
--
-- (Why not ALTER TABLE ADD CONSTRAINT? SQLite still doesn't
-- support adding a CHECK to an existing column — that's the
-- platform constraint, not ours. Triggers give us the same
-- guarantee with a CREATE-only migration.)
CREATE TRIGGER IF NOT EXISTS `share_links_kind_check_insert`
BEFORE INSERT ON `share_links`
FOR EACH ROW
WHEN NEW.kind NOT IN ('record_share', 'care_team_invite', 'family_invite')
BEGIN
  SELECT RAISE(ABORT, 'invalid share_links.kind — must be record_share, care_team_invite, or family_invite');
END;

CREATE TRIGGER IF NOT EXISTS `share_links_kind_check_update`
BEFORE UPDATE ON `share_links`
FOR EACH ROW
WHEN NEW.kind NOT IN ('record_share', 'care_team_invite', 'family_invite')
BEGIN
  SELECT RAISE(ABORT, 'invalid share_links.kind — must be record_share, care_team_invite, or family_invite');
END;

-- Backfill: any existing rows with NULL or unexpected values get
-- coerced to 'record_share' so the triggers don't fire on rows
-- the migration creates. Defensive — new code never writes NULL.
UPDATE `share_links`
   SET `kind` = 'record_share'
 WHERE `kind` IS NULL OR `kind` NOT IN ('record_share', 'care_team_invite', 'family_invite');