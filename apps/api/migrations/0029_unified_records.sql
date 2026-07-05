-- Migration 0029: Unified records + envelope encryption + tamper-evidence
--   - Extends `medical_records` with envelope-crypto columns, kind alias,
--     hash chain, break-glass lockdown.
--   - Adds `record_revisions` for audit-grade history.
--   - Adds `document_dicom_metadata` for imaging (DICOM tags).
--   - Adds `file_download_tokens` for short-lived presigned downloads.
--   - Adds `dsar_requests` for data-subject access requests (job table).
--
-- This migration is non-destructive: every column is nullable or has a
-- default. Existing rows are unchanged. Backfill of plaintext into
-- envelopes is performed by `bun scripts/encrypt-backfill.ts` after this
-- migration runs; safe to deploy and backfill independently.

-- Unified record columns
ALTER TABLE medical_records ADD COLUMN kind TEXT;
ALTER TABLE medical_records ADD COLUMN encrypted_payload TEXT;
ALTER TABLE medical_records ADD COLUMN encrypted_payload_kek_id TEXT;
ALTER TABLE medical_records ADD COLUMN encrypted_payload_dek_wrapped TEXT;
ALTER TABLE medical_records ADD COLUMN iv TEXT;
ALTER TABLE medical_records ADD COLUMN auth_tag TEXT;
ALTER TABLE medical_records ADD COLUMN envelope_version TEXT;
ALTER TABLE medical_records ADD COLUMN schema_version TEXT;
ALTER TABLE medical_records ADD COLUMN rehashed_at TEXT;
ALTER TABLE medical_records ADD COLUMN prev_record_hash TEXT;
ALTER TABLE medical_records ADD COLUMN locked_by_user_id TEXT;
ALTER TABLE medical_records ADD COLUMN locked_until TEXT;

-- Hash-chain index for tamper-evidence queries
CREATE INDEX IF NOT EXISTS idx_medical_records_chain
  ON medical_records(patient_id, created_at, prev_record_hash);

-- Per-record revision history
CREATE TABLE IF NOT EXISTS record_revisions (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  encrypted_payload_snapshot TEXT,
  edited_by_user_id TEXT,
  edited_at TEXT NOT NULL,
  diff_summary TEXT,
  UNIQUE(record_id, revision_number)
);
CREATE INDEX IF NOT EXISTS idx_record_revisions_record
  ON record_revisions(record_id, revision_number);

-- DICOM metadata for imaging attachments
CREATE TABLE IF NOT EXISTS document_dicom_metadata (
  file_id TEXT PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  study_instance_uid TEXT,
  series_instance_uid TEXT,
  sop_instance_uid TEXT,
  modality TEXT,
  body_part TEXT,
  study_date TEXT,
  manufacturer TEXT,
  metadata_json TEXT
);

-- Short-lived presigned download tokens
CREATE TABLE IF NOT EXISTS file_download_tokens (
  token TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  issued_by_user_id TEXT NOT NULL,
  recipient_user_id TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  ip TEXT,
  user_agent TEXT,
  audit_action TEXT
);
CREATE INDEX IF NOT EXISTS idx_file_download_tokens_expiry
  ON file_download_tokens(expires_at);

-- DSAR job queue
CREATE TABLE IF NOT EXISTS dsar_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL, -- export|erasure|rectification
  status TEXT NOT NULL,  -- queued|approved|processing|completed|cancelled|failed
  requested_at TEXT NOT NULL,
  approved_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  notes TEXT,
  result_url TEXT,
  result_expires_at TEXT,
  approver_user_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_dsar_requests_user
  ON dsar_requests(user_id, status, requested_at);