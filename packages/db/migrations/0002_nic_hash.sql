-- Migration: NIC identity layer (Phase 1.2)
-- Adds nic_hash column for bcrypt-hashed NIC at rest. Plain NIC stays for
-- last-mile display only. Indexes nic_hash for login lookup; NIC itself
-- becomes optional (uniqueness kept for legacy rows, no further inserts
-- without hash).
ALTER TABLE users ADD COLUMN nic_hash text;
CREATE UNIQUE INDEX users_nic_hash_unique ON users(nic_hash) WHERE nic_hash IS NOT NULL;
CREATE INDEX users_nic_hash_idx ON users(nic_hash);

-- OTP table for soft verification (mobile/email second factor).
-- 6-digit numeric code, bcrypt-hashed, 5-minute TTL, single-use.
CREATE TABLE otp_codes (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id),
  channel text NOT NULL,           -- 'mobile' | 'email'
  target text NOT NULL,           -- masked destination e.g. '+94****4567'
  code_hash text NOT NULL,
  expires_at text NOT NULL,        -- ISO 8601
  consumed_at text,                -- ISO 8601 when used
  attempts integer NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX otp_codes_user_id_idx ON otp_codes(user_id);
CREATE INDEX otp_codes_target_idx ON otp_codes(target);
