-- Phase 2.1: backfill `medical_records_fts` from existing medical_records.
-- Run once after 0006_auto_classification.sql. Existing rows that were
-- written before the FTS virtual table existed are now seeded into the
-- search index so `GET /medical-records/me/search` returns them.
--
-- Safe to re-run: the INSERT OR REPLACE pattern via DELETE+INSERT means
-- re-applying this migration is idempotent (the DELETE matches no rows
-- the second time because we just inserted them, so the net effect is a
-- no-op refresh).

INSERT INTO medical_records_fts (recordId, title, diagnosis, summary, notes, extracted_text)
SELECT
  id,
  COALESCE(title, ''),
  COALESCE(diagnosis, ''),
  COALESCE(summary, ''),
  COALESCE(notes, ''),
  ''
FROM medical_records
WHERE NOT EXISTS (
  SELECT 1 FROM medical_records_fts WHERE medical_records_fts.recordId = medical_records.id
);