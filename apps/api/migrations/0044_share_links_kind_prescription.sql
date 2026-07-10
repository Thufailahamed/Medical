-- Migration 0044: extend share_links.kind whitelist to allow prescription_share.
--
-- Migration 0043 introduced the prescription-share-with-doctor flow
-- (apps/api/src/routes/share.ts:141 sets kind="prescription_share" when the
-- patient mints a share for a single prescription). The kind-check triggers
-- created in 0027 only allow ('record_share', 'care_team_invite',
-- 'family_invite') — so every prescription-share mint trips the BEFORE
-- INSERT trigger with 'invalid share_links.kind' and aborts.
--
-- SQLite has no ALTER TRIGGER, so we DROP and recreate the pair with the
-- extended whitelist. The new whitelist is
-- ('record_share', 'care_team_invite', 'family_invite', 'prescription_share').

DROP TRIGGER IF EXISTS `share_links_kind_check_insert`;
DROP TRIGGER IF EXISTS `share_links_kind_check_update`;

CREATE TRIGGER IF NOT EXISTS `share_links_kind_check_insert`
BEFORE INSERT ON `share_links`
FOR EACH ROW
WHEN NEW.kind NOT IN ('record_share', 'care_team_invite', 'family_invite', 'prescription_share')
BEGIN
  SELECT RAISE(ABORT, 'invalid share_links.kind — must be record_share, care_team_invite, family_invite, or prescription_share');
END;

CREATE TRIGGER IF NOT EXISTS `share_links_kind_check_update`
BEFORE UPDATE ON `share_links`
FOR EACH ROW
WHEN NEW.kind NOT IN ('record_share', 'care_team_invite', 'family_invite', 'prescription_share')
BEGIN
  SELECT RAISE(ABORT, 'invalid share_links.kind — must be record_share, care_team_invite, family_invite, or prescription_share');
END;

-- Defensive backfill: any rows that somehow ended up with an unrecognised
-- kind (e.g. rows inserted by a misbehaving tool before the trigger
-- existed) get coerced to 'record_share' so the new triggers don't fire
-- on the migration transaction itself.
UPDATE `share_links`
   SET `kind` = 'record_share'
 WHERE `kind` IS NULL OR `kind` NOT IN ('record_share', 'care_team_invite', 'family_invite', 'prescription_share');
