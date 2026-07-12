-- Caretaker Profiles: patient_links + caretaker_invites tables,
-- users.active_principal_patient_id column.
--
-- Mirrors the in-app Drizzle schema definitions in
-- packages/db/src/schema.ts. Idempotent: every CREATE uses IF NOT EXISTS.

ALTER TABLE users ADD COLUMN active_principal_patient_id TEXT REFERENCES patients(id);

CREATE TABLE IF NOT EXISTS patient_links (
  id TEXT PRIMARY KEY,
  caretaker_user_id TEXT NOT NULL REFERENCES users(id),
  principal_patient_id TEXT NOT NULL REFERENCES patients(id),
  care_role TEXT NOT NULL DEFAULT 'other',
  invite_id TEXT REFERENCES caretaker_invites(id),
  status TEXT NOT NULL DEFAULT 'active',
  invited_by_user_id TEXT REFERENCES users(id),
  invited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  revoked_at TEXT,
  revoked_by_user_id TEXT REFERENCES users(id),
  revoked_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique index: only one active link per (caretaker, principal).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_patient_links_active
  ON patient_links (caretaker_user_id, principal_patient_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_patient_links_caretaker_status
  ON patient_links (caretaker_user_id, status);

CREATE INDEX IF NOT EXISTS idx_patient_links_principal_status
  ON patient_links (principal_patient_id, status);

CREATE INDEX IF NOT EXISTS idx_patient_links_invite
  ON patient_links (invite_id);

CREATE TABLE IF NOT EXISTS caretaker_invites (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  principal_patient_id TEXT NOT NULL REFERENCES patients(id),
  invited_by_user_id TEXT NOT NULL REFERENCES users(id),
  caretaker_name TEXT NOT NULL,
  care_role TEXT NOT NULL DEFAULT 'other',
  channel TEXT NOT NULL,
  contact_target TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  consumed_at TEXT,
  redeemed_by_user_id TEXT REFERENCES users(id),
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_caretaker_invites_principal
  ON caretaker_invites (principal_patient_id, created_at);

CREATE INDEX IF NOT EXISTS idx_caretaker_invites_contact
  ON caretaker_invites (channel, contact_target);
