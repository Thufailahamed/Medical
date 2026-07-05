-- Migration 0031: Field encryption backfill (no-op)
--
-- The actual backfill is performed by `bun scripts/encrypt-backfill.ts`
-- which iterates `medical_records` rows with NULL envelope and wraps the
-- existing plaintext (title, diagnosis, summary, notes, extractedData)
-- into an AES-256-GCM envelope using a per-record DEK wrapped by KEK.
--
-- This migration intentionally does nothing at the SQL layer; it is the
-- marker that the deployment pipeline has approved the backfill phase.
--
-- Post-backfill, expect:
--   SELECT COUNT(*) FROM medical_records WHERE envelope_version = 'v1' >= 0.95 * total;
--   SELECT COUNT(*) FROM medical_records WHERE envelope_version IS NULL        ~ 0;

SELECT 1;