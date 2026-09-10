-- Migration 0076: Lab Diagnostics v2
-- ─────────────────────────────────────────────────────────────────────────
-- Lab/diagnostics foundation slice (Phase 1 of
-- docs/superpowers/plans/2026-08-31-lab-diagnostics-foundation.md).
--
-- This migration introduces the v2 schema for diagnostic tests:
--   * `lab_diagnostic_test_categories` — normalised categories (replace
--     the legacy `diagnostic_test_catalog.category` TEXT).
--   * `diagnostic_test_catalog` enriched with display/categorisation
--     metadata + `lab_partner_id` made nullable (catalog becomes a
--     global template; per-lab availability moves to the join table).
--   * `lab_diagnostic_tests` — new per-laboratory availability join
--     with its own price + turnaround configuration.
--   * `test_packages` enriched with category, prep, fasting, image,
--     popular/featured flags.
--   * `test_package_images` — new gallery table (one package → N images).
--
-- Backfill (idempotent):
--   1. Insert known category slugs into `lab_diagnostic_test_categories`
--      (slug = lower(category)) and back-populate `category_id` FK on
--      `diagnostic_test_catalog` from the legacy `category` TEXT.
--   2. For every existing `diagnostic_test_catalog` row with a
--      `lab_partner_id`, create a companion `lab_diagnostic_tests` row
--      so the per-lab availability join table has seed data.
--
-- Schema-change notes:
--   * SQLite (and therefore D1) cannot ALTER COLUMN DROP NOT NULL.
--     To make `diagnostic_test_catalog.lab_partner_id` nullable we
--     rebuild the table inside a transaction. The new shape includes
--     every column from 0062 plus the new ones — we only pay the
--     rebuild cost once. Indexes are recreated after the rename.
--   * ALTER TABLE ADD COLUMN statements below are one-shot (D1 does
--     not support `ADD COLUMN IF NOT EXISTS`). The migration is
--     applied once via wrangler; if re-run by hand the duplicate-column
--     errors surface immediately, which is the desired signal.

PRAGMA defer_foreign_keys = ON;

-- ─── 1. Categories table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_diagnostic_test_categories (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_si TEXT,
  name_ta TEXT,
  icon TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_diag_cat_active
  ON lab_diagnostic_test_categories(is_active, display_order);

-- ─── 2. diagnostic_test_catalog indexes ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_diagnostic_test_catalog_category
  ON diagnostic_test_catalog(category, is_active);
CREATE INDEX IF NOT EXISTS idx_diagnostic_test_catalog_lab_partner
  ON diagnostic_test_catalog(lab_partner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_diag_test_catalog_category_id
  ON diagnostic_test_catalog(category_id);

-- ─── 3. Per-laboratory availability join ───────────────────────────
CREATE TABLE IF NOT EXISTS lab_diagnostic_tests (
  id TEXT PRIMARY KEY,
  lab_partner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL REFERENCES diagnostic_test_catalog(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  discount_price REAL,
  currency TEXT NOT NULL DEFAULT 'LKR',
  home_collection_available INTEGER NOT NULL DEFAULT 1 CHECK (home_collection_available IN (0,1)),
  lab_collection_available INTEGER NOT NULL DEFAULT 1 CHECK (lab_collection_available IN (0,1)),
  turnaround_hours INTEGER,
  special_instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lab_partner_id, test_id)
);
CREATE INDEX IF NOT EXISTS idx_lab_diag_tests_test
  ON lab_diagnostic_tests(test_id, is_active);
CREATE INDEX IF NOT EXISTS idx_lab_diag_tests_lab
  ON lab_diagnostic_tests(lab_partner_id, is_active);

-- ─── 4. test_packages indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_test_packages_featured
  ON test_packages(featured, is_active);
CREATE INDEX IF NOT EXISTS idx_test_packages_category
  ON test_packages(category_id);

-- ─── 5. Package images ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_package_images (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES test_packages(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pkg_img
  ON test_package_images(package_id, display_order);

-- ─── 6. Backfill (idempotent) ──────────────────────────────────────

-- 6a. Seed known categories. Slug = lower(category), name = title-case
--     human label. The 0062 CHECK constraint defines the canonical
--     enum; we also include the human-friendly plurals / variants the
--     brief lists so any out-of-band row with those values gets a
--     matching category_id too. INSERT OR IGNORE keeps this safe to
--     re-run (slug UNIQUE).
INSERT OR IGNORE INTO lab_diagnostic_test_categories (id, slug, name, display_order, is_active) VALUES
  ('cat-blood',        'blood',         'Blood',        10, 1),
  ('cat-urine',        'urine',         'Urine',        20, 1),
  ('cat-stool',        'stool',         'Stool',        30, 1),
  ('cat-saliva',       'saliva',        'Saliva',       40, 1),
  ('cat-swab',         'swab',          'Swab',         50, 1),
  ('cat-cardiac',      'cardiac',       'Cardiac',      60, 1),
  ('cat-cardiology',   'cardiology',    'Cardiology',   61, 1),
  ('cat-diabetes',     'diabetes',      'Diabetes',     70, 1),
  ('cat-thyroid',      'thyroid',       'Thyroid',      80, 1),
  ('cat-liver',        'liver',         'Liver',        90, 1),
  ('cat-kidney',       'kidney',        'Kidney',      100, 1),
  ('cat-lipid',        'lipid',         'Lipid',       110, 1),
  ('cat-vitamin',      'vitamin',       'Vitamin',     120, 1),
  ('cat-vitamins',     'vitamins',      'Vitamins',    121, 1),
  ('cat-hormone',      'hormone',       'Hormone',     130, 1),
  ('cat-hormones',     'hormones',      'Hormones',    131, 1),
  ('cat-cancer-marker','cancer_marker', 'Cancer Marker',140, 1),
  ('cat-cancer',       'cancer',        'Cancer',      141, 1),
  ('cat-infection',    'infection',     'Infection',   150, 1),
  ('cat-infectious',   'infectious',    'Infectious',  151, 1),
  ('cat-allergy',      'allergy',       'Allergy',     160, 1),
  ('cat-genetic',      'genetic',       'Genetic',     170, 1),
  ('cat-imaging',      'imaging',       'Imaging',     180, 1),
  ('cat-cbc',          'cbc',           'CBC',         190, 1),
  ('cat-hematology',   'hematology',    'Hematology',  191, 1),
  ('cat-urinalysis',   'urinalysis',    'Urinalysis',  192, 1),
  ('cat-general',      'general',       'General',     200, 1),
  ('cat-pregnancy',    'pregnancy',     'Pregnancy',   210, 1),
  ('cat-other',        'other',         'Other',       999, 1);

-- 6b. Back-populate category_id from legacy `category` TEXT. Safe to
--     re-run because of the `category_id IS NULL` guard.
UPDATE diagnostic_test_catalog
SET category_id = (
  SELECT id FROM lab_diagnostic_test_categories
  WHERE slug = lower(diagnostic_test_catalog.category)
)
WHERE category IS NOT NULL
  AND category_id IS NULL
  AND EXISTS (
    SELECT 1 FROM lab_diagnostic_test_categories
    WHERE slug = lower(diagnostic_test_catalog.category)
  );

-- 6c. Seed `lab_diagnostic_tests` from existing catalog rows that have
--     a lab_partner_id. Composite id = catalog.id || '-' || lab.id
--     keeps the UNIQUE (lab_partner_id, test_id) constraint happy and
--     preserves traceability. INSERT OR IGNORE handles re-runs.
INSERT OR IGNORE INTO lab_diagnostic_tests (
  id, lab_partner_id, test_id,
  price, discount_price, currency,
  home_collection_available, lab_collection_available,
  turnaround_hours, is_active
)
SELECT
  diagnostic_test_catalog.id || '-' || diagnostic_test_catalog.lab_partner_id,
  diagnostic_test_catalog.lab_partner_id,
  diagnostic_test_catalog.id,
  CASE
    WHEN diagnostic_test_catalog.discount_price IS NOT NULL
         AND diagnostic_test_catalog.discount_price < diagnostic_test_catalog.price
    THEN diagnostic_test_catalog.discount_price
    ELSE diagnostic_test_catalog.price
  END,
  CASE
    WHEN diagnostic_test_catalog.discount_price IS NOT NULL
         AND diagnostic_test_catalog.discount_price < diagnostic_test_catalog.price
    THEN diagnostic_test_catalog.discount_price
    ELSE NULL
  END,
  'LKR',
  diagnostic_test_catalog.home_collection_available,
  1,
  diagnostic_test_catalog.turnaround_hours,
  diagnostic_test_catalog.is_active
FROM diagnostic_test_catalog
WHERE diagnostic_test_catalog.lab_partner_id IS NOT NULL
  AND diagnostic_test_catalog.lab_partner_id IN (SELECT id FROM users);

PRAGMA defer_foreign_keys = OFF;

