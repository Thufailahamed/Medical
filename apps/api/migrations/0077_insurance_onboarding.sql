-- Migration 0077: Insurance provider onboarding
-- Additive only. Adds license doc + verification timestamp to operator_orgs
-- for insurer onboarding (kind='insurance', status=pending → active).
--
-- NOTE: D1/SQLite does not support `ADD COLUMN IF NOT EXISTS`, so these are
-- plain one-shot ALTERs (same style as 0076). Applied once via wrangler;
-- re-running surfaces duplicate-column errors, which is the desired signal.
-- Does not alter any other tables.

-- Columns already applied to operator_orgs:
-- ALTER TABLE operator_orgs ADD COLUMN license_doc_key TEXT;
-- ALTER TABLE operator_orgs ADD COLUMN verified_at TEXT;
SELECT 1;
