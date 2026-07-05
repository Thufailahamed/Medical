-- Migration 0030: Granular per-purpose consent + QR ephemeral tokens
--   - `consent_grants`: per-purpose, per-recipient, per-record scope, revocable.
--   - `qr_access_tokens`: ephemeral tokens that replace the static QR payload.
--
-- Existing `share_links` and `care_team_members` stay for one release as
-- legacy aliases. New writer goes through `consent_grants`.

CREATE TABLE IF NOT EXISTS consent_grants (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  family_member_id TEXT,
  granted_to_user_id TEXT,
  granted_to_token TEXT,
  purpose TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by_user_id TEXT,
  consent_record_id TEXT,
  granted_at TEXT NOT NULL,
  granted_by_user_id TEXT NOT NULL,
  label TEXT
);
CREATE INDEX IF NOT EXISTS idx_consent_grants_patient
  ON consent_grants(patient_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_consent_grants_grantee
  ON consent_grants(granted_to_user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_consent_grants_token
  ON consent_grants(granted_to_token);

CREATE TABLE IF NOT EXISTS qr_access_tokens (
  token TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  family_member_id TEXT,
  encrypted_payload TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  max_scans INTEGER NOT NULL DEFAULT 5,
  scans_json TEXT NOT NULL DEFAULT '[]',
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qr_access_tokens_patient
  ON qr_access_tokens(patient_id, expires_at);