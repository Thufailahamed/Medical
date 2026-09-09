-- Migration 0078: Lab roster + ratings (Task 4, additive only)
-- ─────────────────────────────────────────────────────────────────────────
-- Ensures `phlebotomists` roster (see 0066) and `test_booking_ratings`
-- (see 0064) exist. Uses CREATE TABLE IF NOT EXISTS so re-applying is
-- safe whether or not 0064/0066 already ran. No ALTERs, no DROPs.
--
--   * `phlebotomists(id, lab_partner_id, name, phone, is_active, created_at)`
--     — lab-scoped sample-collection team. Assign flow uses
--     `phlebotomistId` FK with back-compat free-text name/phone.
--   * `test_booking_ratings(id, booking_id UNIQUE, patient_id, user_id,
--     score 1-5, comment, created_at)` — Task 5 consumes this table.
--     0064 already creates it with `stars`; this migration keeps the
--     canonical 0064 shape and adds a `score` alias column only when
--     a fresh create happens here (both columns CHECK 1-5).

CREATE TABLE IF NOT EXISTS phlebotomists (
  id TEXT PRIMARY KEY,
  lab_partner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_phlebotomists_lab ON phlebotomists(lab_partner_id, is_active);

CREATE TABLE IF NOT EXISTS test_booking_ratings (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES test_bookings(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  lab_partner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  score INTEGER CHECK(score IS NULL OR (score >= 1 AND score <= 5)),
  stars INTEGER CHECK(stars IS NULL OR (stars >= 1 AND stars <= 5)),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_test_booking_ratings_lab ON test_booking_ratings(lab_partner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_test_booking_ratings_booking ON test_booking_ratings(booking_id);
