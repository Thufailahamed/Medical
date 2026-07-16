-- Migration 0057: extend share_links to support `record_bundle` kind.
--
-- Tier 1 records: share-pack feature lets a patient mint a single share
-- link that bundles N specific medical records (instead of coarse-grained
-- `scope: "all" | "recent6m"`). Recipients get a flat list of the chosen
-- records via the existing public GET /share/:token endpoint.
--
-- (a) The kind whitelist lives only in SQLite triggers (0027 + 0044). Add
--     `record_bundle` so POST /share/links with `recordIds` does not trip
--     BEFORE INSERT. SQLite has no ALTER TRIGGER so we DROP + recreate
--     both triggers (mirror the 0044 pattern).
-- (b) New nullable column `record_ids` (JSON array of medical_records.id).
--     Stored as TEXT — D1/SQLite has no native JSON type. The
--     `record_bundle` branch in apps/api/src/routes/share.ts:GET /:token
--     parses it. Empty/NULL = no bundle (legacy record_share rows).

DROP TRIGGER IF EXISTS `share_links_kind_check_insert`;
DROP TRIGGER IF EXISTS `share_links_kind_check_update`;

CREATE TRIGGER IF NOT EXISTS `share_links_kind_check_insert`
BEFORE INSERT ON `share_links`
FOR EACH ROW
WHEN NEW.kind NOT IN ('record_share', 'care_team_invite', 'family_invite', 'prescription_share', 'record_bundle')
BEGIN
  SELECT RAISE(ABORT, 'invalid share_links.kind — must be record_share, care_team_invite, family_invite, prescription_share, or record_bundle');
END;

CREATE TRIGGER IF NOT EXISTS `share_links_kind_check_update`
BEFORE UPDATE ON `share_links`
FOR EACH ROW
WHEN NEW.kind NOT IN ('record_share', 'care_team_invite', 'family_invite', 'prescription_share', 'record_bundle')
BEGIN
  SELECT RAISE(ABORT, 'invalid share_links.kind — must be record_share, care_team_invite, family_invite, prescription_share, or record_bundle');
END;

-- Defensive backfill (same pattern as 0044:39). Any unrecognised kinds
-- that pre-existed get coerced to 'record_share' so the new triggers do
-- not abort the migration transaction itself.
UPDATE `share_links`
   SET `kind` = 'record_share'
 WHERE `kind` IS NULL OR `kind` NOT IN ('record_share', 'care_team_invite', 'family_invite', 'prescription_share', 'record_bundle');

-- Bundle payload column. JSON array of medical_records.id (max 50 — enforced
-- in Zod at apps/api/src/lib/validators.ts). NULL for legacy kinds.
ALTER TABLE `share_links` ADD COLUMN `record_ids` TEXT;

-- Partial index: only `record_bundle` rows are useful to query by patient
-- AND non-revoked/expired. Smaller index, faster scans.
CREATE INDEX IF NOT EXISTS `idx_share_links_bundle_patient`
  ON `share_links`(`patient_id`, `kind`, `revoked`)
  WHERE `kind` = 'record_bundle';
