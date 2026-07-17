-- Migration 0066: Phlebotomists
-- Lab partners manage their phlebotomist team for home sample collection.

CREATE TABLE IF NOT EXISTS phlebotomists (
  id TEXT PRIMARY KEY,
  lab_partner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_phlebotomists_lab ON phlebotomists(lab_partner_id, is_active);
