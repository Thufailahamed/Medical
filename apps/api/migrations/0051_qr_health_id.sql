-- QR-Code Check-in & Dispensing (Migration 0051)
--
-- Mirrors packages/db/src/schema.ts additions for `qr_access_tokens`
-- (purpose, scopes, createdByUserId, hospitalId, lastIssuedAt,
-- rotationSeconds) + the new `portal_scan_events` table.
--
-- Idempotent: every ADD COLUMN is a separate statement (D1 + SQLite
-- don't support multi-column ADD COLUMN with IF NOT EXISTS in one
-- shot) and every CREATE uses IF NOT EXISTS.
--
-- The partial-unique index on (patient_id, purpose) WHERE
-- revoked_at IS NULL keeps at most one *live* token per slot. New
-- issuance in the same slot revokes the prior row in a single write
-- so a stolen old QR can never be scanned again.

ALTER TABLE qr_access_tokens ADD COLUMN purpose TEXT NOT NULL DEFAULT 'emergency';
ALTER TABLE qr_access_tokens ADD COLUMN scopes TEXT;
ALTER TABLE qr_access_tokens ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
ALTER TABLE qr_access_tokens ADD COLUMN hospital_id TEXT REFERENCES hospitals(id);
ALTER TABLE qr_access_tokens ADD COLUMN last_issued_at TEXT;
ALTER TABLE qr_access_tokens ADD COLUMN rotation_seconds INTEGER DEFAULT 30;

-- Partial unique index — only one live (non-revoked) token per
-- (patient_id, purpose) at a time. Issuing a fresh token in the same
-- slot revokes the prior row in a single write.
CREATE UNIQUE INDEX IF NOT EXISTS qr_access_tokens_pat_purpose_idx
  ON qr_access_tokens (patient_id, purpose)
  WHERE revoked_at IS NULL;

-- Future cron sweeper can expire rows by expires_at cheaply.
CREATE INDEX IF NOT EXISTS qr_access_tokens_expiry_idx
  ON qr_access_tokens (expires_at);

CREATE TABLE IF NOT EXISTS portal_scan_events (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  scanned_by_user_id TEXT NOT NULL REFERENCES users(id),
  portal_role TEXT NOT NULL,
  purpose TEXT NOT NULL,
  hospital_id TEXT REFERENCES hospitals(id),
  success INTEGER NOT NULL,
  reason TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS portal_scan_events_time_idx
  ON portal_scan_events (created_at);

CREATE INDEX IF NOT EXISTS portal_scan_events_patient_idx
  ON portal_scan_events (patient_id, created_at);