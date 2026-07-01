-- Migration 0016: SLMC compliance + Request-a-Demo lead capture (Phase 3.1 slice 1)
--
-- Two unrelated changes bundled in one migration because they ship together:
--   1. SLMC registration tracking on doctors (manual-review flag).
--   2. demo_requests table for the .doctor Request-a-Demo form.
--
-- Phase 3.2 will revisit if SLMC publishes a programmatic public-directory
-- API — until then, slmc_verified_at is set by our manual review pass.

-- ─── 1. SLMC columns on doctors ────────────────────────────
-- slmc_registration_no: official SLMC number (digits + optional letter suffix).
-- Unique among non-NULL rows so each doctor has at most one SLMC id.
-- Existing `registration_number` column kept untouched — used for hospital /
-- specialty-board numbers, not SLMC. Avoids a breaking rename.
ALTER TABLE doctors ADD COLUMN slmc_registration_no TEXT;
ALTER TABLE doctors ADD COLUMN slmc_verified_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_slmc_registration_no
  ON doctors(slmc_registration_no) WHERE slmc_registration_no IS NOT NULL;

-- ─── 2. demo_requests ──────────────────────────────────────
-- Public POST, admin read (sales team). No auth on insert — leads are
-- anonymous until the sales team qualifies them. Rate-limit is a TODO
-- for CF Rate Limiting binding.
CREATE TABLE IF NOT EXISTS demo_requests (
  id TEXT PRIMARY KEY,
  clinic_name TEXT,
  contact_name TEXT NOT NULL,
  contact_role TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  nic TEXT,
  slmc_registration_no TEXT,
  specialty TEXT,
  clinic_size TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'qualified' | 'closed'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_demo_requests_status_created
  ON demo_requests(status, created_at);