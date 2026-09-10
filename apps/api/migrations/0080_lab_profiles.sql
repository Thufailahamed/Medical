-- Migration 0080: lab_profiles for laboratory onboarding.
-- Additive only. One row per laboratory user, created at POST /auth/register.
CREATE TABLE IF NOT EXISTS lab_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lab_name TEXT NOT NULL,
  license_number TEXT NOT NULL UNIQUE,
  accreditation TEXT,
  address TEXT NOT NULL,
  city TEXT,
  operating_hours TEXT,
  bank_name TEXT,
  bank_account TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_lab_profiles_license ON lab_profiles(license_number);

