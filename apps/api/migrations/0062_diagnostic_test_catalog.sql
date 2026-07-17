-- Migration 0062: Diagnostic Test Catalog & Home Collection Bookings
-- Adds tables for patient-initiated diagnostic test bookings with
-- home sample collection (Driefcase-style "Book a Test" feature).

-- ─── Diagnostic Test Catalog ──────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostic_test_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK(category IN (
    'blood','urine','stool','saliva','swab','cardiac','diabetes',
    'thyroid','liver','kidney','lipid','vitamin','hormone',
    'cancer_marker','infection','allergy','genetic','imaging','other'
  )),
  description TEXT,
  sample_type TEXT NOT NULL CHECK(sample_type IN (
    'blood','urine','stool','saliva','swab','other'
  )),
  fasting_required INTEGER NOT NULL DEFAULT 0,
  fasting_hours INTEGER NOT NULL DEFAULT 0,
  home_collection_available INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  discount_price REAL,
  lab_partner_id TEXT NOT NULL REFERENCES users(id),
  turnaround_hours INTEGER NOT NULL DEFAULT 24,
  instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_diagnostic_test_catalog_category ON diagnostic_test_catalog(category, is_active);
CREATE INDEX idx_diagnostic_test_catalog_lab_partner ON diagnostic_test_catalog(lab_partner_id, is_active);

-- ─── Test Packages ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price REAL NOT NULL,
  discount_price REAL,
  lab_partner_id TEXT NOT NULL REFERENCES users(id),
  turnaround_hours INTEGER NOT NULL DEFAULT 48,
  instructions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_test_packages_lab_partner ON test_packages(lab_partner_id, is_active);

-- ─── Test Package Items (M:N join) ────────────────────────
CREATE TABLE IF NOT EXISTS test_package_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES test_packages(id),
  test_id TEXT NOT NULL REFERENCES diagnostic_test_catalog(id)
);
CREATE INDEX idx_test_package_items_package ON test_package_items(package_id);
CREATE INDEX idx_test_package_items_test ON test_package_items(test_id);
CREATE UNIQUE INDEX idx_test_package_items_unique ON test_package_items(package_id, test_id);

-- ─── Test Bookings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_bookings (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  lab_partner_id TEXT NOT NULL REFERENCES users(id),
  booking_type TEXT NOT NULL CHECK(booking_type IN ('single_test', 'package')),
  test_id TEXT REFERENCES diagnostic_test_catalog(id),
  package_id TEXT REFERENCES test_packages(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN (
    'pending','confirmed','phlebotomist_assigned',
    'sample_collection_en_route','sample_collected',
    'in_progress','completed','cancelled','rescheduled'
  )),
  scheduled_date TEXT NOT NULL,
  scheduled_time_slot TEXT NOT NULL,
  collection_address TEXT NOT NULL,
  phlebotomist_id TEXT REFERENCES users(id),
  phlebotomist_name TEXT,
  phlebotomist_phone TEXT,
  total_price REAL NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN (
    'pending','paid','refunded','cash_on_collection'
  )),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN (
    'cash','card','online'
  )),
  payment_ref TEXT,
  result_pdf_url TEXT,
  result_summary TEXT,
  result_ready_at TEXT,
  cancellation_reason TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_test_bookings_patient_status ON test_bookings(patient_id, status);
CREATE INDEX idx_test_bookings_date ON test_bookings(scheduled_date);
CREATE INDEX idx_test_bookings_lab_partner_status ON test_bookings(lab_partner_id, status);
CREATE INDEX idx_test_bookings_phlebotomist ON test_bookings(phlebotomist_id, status);
