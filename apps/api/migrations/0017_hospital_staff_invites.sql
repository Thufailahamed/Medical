-- Phase 3.1 slice 3: hospital staff invites.
-- Admin generates a token, shares the deep link, recipient creates
-- an account (or signs in), server consumes the token and links
-- hospital_staff.userId to the recipient's users.id so the existing
-- access layer at apps/api/src/lib/access.ts:108-131 keeps working.

CREATE TABLE IF NOT EXISTS hospital_staff_invites (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  role TEXT NOT NULL,            -- nurse / receptionist / technician / manager / housekeeping / security
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_by_user_id TEXT REFERENCES users(id),
  revoked INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hospital_staff_invites_token ON hospital_staff_invites(token);
CREATE INDEX IF NOT EXISTS idx_hospital_staff_invites_hospital ON hospital_staff_invites(hospital_id, created_at DESC);
