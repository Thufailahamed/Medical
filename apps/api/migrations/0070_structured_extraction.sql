-- Migration 0070: Structured extraction
-- Convert uploaded medical documents (PDFs, images) into typed, queryable
-- child rows per `medical_records` row. Distinct from the existing
-- `lab_partner` test_booking flow (0062-0067) — those are the in-house
-- diagnostic-booking tables; this migration covers the *general PHR upload*
-- pipeline where a patient drops a lab PDF, discharge summary, prescription
-- scan, imaging report, or vaccination card into their locker.
--
-- Adds 5 child tables + 2 columns on `medical_records`:
--   lab_test_results, imaging_findings, discharge_events,
--   vaccination_doses, prescription_items
--   medical_records.extracted_data_status, medical_records.extracted_at
--
-- All child rows FK back to `medical_records.id` (CASCADE on delete)
-- and `patients.id` (denormalised for trend queries that don't need the
-- parent record join). Status on the parent row is the single source of
-- truth for backfill idempotency.

-- ─── Parent-row extension ─────────────────────────────────
ALTER TABLE medical_records ADD COLUMN extracted_data_status TEXT
  CHECK (extracted_data_status IN ('pending','completed','failed','skipped'));
ALTER TABLE medical_records ADD COLUMN extracted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_medical_records_extract_status
  ON medical_records(extracted_data_status, record_type, created_at);

-- ─── lab_test_results ─────────────────────────────────────
-- One row per test item extracted from a lab report PDF/image.
-- Numeric values go in `value` (REAL); non-numeric ("Positive", "Negative",
-- "Reactive") go in `value_text`. `flag` is normalised server-side from
-- the LLM signal + a numeric-vs-range check; we never trust the LLM
-- alone for `critical` — that requires a downstream safety review.
CREATE TABLE IF NOT EXISTS lab_test_results (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  lab_report_id TEXT REFERENCES lab_reports(id) ON DELETE SET NULL,
  test_name TEXT NOT NULL,
  loinc_code TEXT,
  value REAL,
  value_text TEXT,
  unit TEXT,
  ref_range_low REAL,
  ref_range_high REAL,
  ref_range_text TEXT,
  flag TEXT NOT NULL DEFAULT 'unknown'
    CHECK (flag IN ('normal','low','high','critical','abnormal','unknown')),
  collected_at TEXT,
  reported_at TEXT,
  raw_text TEXT,
  page_hint INTEGER,
  extraction_confidence REAL,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lab_test_results_patient_test_reported
  ON lab_test_results(patient_id, test_name, reported_at);
CREATE INDEX idx_lab_test_results_record ON lab_test_results(record_id);
CREATE INDEX idx_lab_test_results_lab_report ON lab_test_results(lab_report_id);
CREATE INDEX idx_lab_test_results_confidence
  ON lab_test_results(extraction_confidence);

-- ─── imaging_findings ─────────────────────────────────────
-- Structured fields parsed from a radiology report (X-ray, CT, MRI, US).
-- `critical` is set ONLY when both (a) the LLM flags the finding as
-- urgent and (b) a keyword from the safety whitelist is present in
-- `raw_text` or `findings` — never on LLM signal alone.
CREATE TABLE IF NOT EXISTS imaging_findings (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  modality TEXT NOT NULL,
  body_part TEXT,
  study_date TEXT,
  findings TEXT,
  impression TEXT,
  recommendations TEXT,
  radiologist_name TEXT,
  critical INTEGER NOT NULL DEFAULT 0,
  raw_text TEXT,
  extraction_confidence REAL,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_imaging_findings_patient_date
  ON imaging_findings(patient_id, study_date);
CREATE INDEX idx_imaging_findings_record ON imaging_findings(record_id);
CREATE INDEX idx_imaging_findings_critical ON imaging_findings(critical);

-- ─── discharge_events ─────────────────────────────────────
-- One row per discharge summary. Procedures + medications given are
-- stored as JSON arrays (TEXT) — typed columns would explode the
-- schema; we keep them parseable via json_each when needed.
CREATE TABLE IF NOT EXISTS discharge_events (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  admission_date TEXT,
  discharge_date TEXT,
  primary_diagnosis TEXT,
  secondary_diagnoses TEXT,
  procedures TEXT,
  medications_given TEXT,
  follow_up_instructions TEXT,
  follow_up_date TEXT,
  hospital_name TEXT,
  attending_doctor TEXT,
  raw_text TEXT,
  extraction_confidence REAL,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_discharge_events_patient_date
  ON discharge_events(patient_id, discharge_date);
CREATE INDEX idx_discharge_events_record ON discharge_events(record_id);

-- ─── vaccination_doses ───────────────────────────────────
-- One row per dose on a vaccination card. `catalog_id` is fuzzy-matched
-- to vaccine_catalog by the existing `/ai/ocr/vaccination-card` flow.
CREATE TABLE IF NOT EXISTS vaccination_doses (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  catalog_id TEXT REFERENCES vaccine_catalog(id) ON DELETE SET NULL,
  vaccine_name TEXT NOT NULL,
  dose_number INTEGER,
  date TEXT,
  provider TEXT,
  batch_number TEXT,
  site TEXT,
  raw_text TEXT,
  extraction_confidence REAL,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_vaccination_doses_patient_vaccine_date
  ON vaccination_doses(patient_id, vaccine_name, date);
CREATE INDEX idx_vaccination_doses_record ON vaccination_doses(record_id);
CREATE INDEX idx_vaccination_doses_catalog ON vaccination_doses(catalog_id);

-- ─── prescription_items ──────────────────────────────────
-- Mirror for prescription PDFs that came in via the *upload* path
-- (NOT the e-Rx / doctor's-prescription flow — those still write to
-- the canonical `medicines` + `prescriptions` tables). This table
-- keeps historical photo/PDF prescriptions queryable for trend
-- purposes without polluting the active-medicines list.
CREATE TABLE IF NOT EXISTS prescription_items (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  timing TEXT,
  duration_days INTEGER,
  refills INTEGER,
  prescriber_name TEXT,
  prescribed_date TEXT,
  raw_text TEXT,
  extraction_confidence REAL,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_prescription_items_patient_date
  ON prescription_items(patient_id, prescribed_date);
CREATE INDEX idx_prescription_items_record ON prescription_items(record_id);
CREATE INDEX idx_prescription_items_name ON prescription_items(patient_id, name);
