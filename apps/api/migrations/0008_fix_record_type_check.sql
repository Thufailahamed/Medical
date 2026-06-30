-- Phase 2.1: extend the `record_type` CHECK constraint to include the
-- V2 + V2.1 enum values: clinical_note, lab_order, follow_up, other.
--
-- The original CREATE TABLE only allows the 13 V1 values, so every
-- doctor-portal insert (clinical notes, follow-ups, lab orders) and
-- every email-imported record (type='other') has been failing
-- CHECK constraint validation silently. This rebuilds the table with
-- the new constraint and preserves all existing rows.
--
-- SQLite can't ALTER CHECK constraints, so the standard rebuild dance:
-- create new → copy data → drop old → rename. We wrap it in a
-- transaction (D1 supports BEGIN/COMMIT in migrations) so the rebuild
-- is atomic.

BEGIN TRANSACTION;

CREATE TABLE medical_records_new (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  hospital_id TEXT REFERENCES hospitals(id),
  doctor_id TEXT REFERENCES doctors(id),
  record_type TEXT NOT NULL CHECK (record_type IN (
    'lab_report','imaging','prescription','hospital_visit','vaccination',
    'surgery','allergy','insurance','fitness','discharge_summary',
    'medical_certificate','operation_note','invoice',
    -- V2 (clinical notes, follow-ups, lab orders)
    'clinical_note','lab_order','follow_up',
    -- V2.1 (Phase 2.1 — bucket for unclassifiable records)
    'other'
  )),
  title TEXT NOT NULL,
  diagnosis TEXT,
  summary TEXT,
  notes TEXT,
  date TEXT NOT NULL,
  follow_up_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  extracted_data TEXT,
  tags TEXT,
  archived_at TEXT,
  family_member_id TEXT REFERENCES family_members(id)
);

INSERT INTO medical_records_new
SELECT id, patient_id, hospital_id, doctor_id, record_type, title,
       diagnosis, summary, notes, date, follow_up_date, created_at,
       extracted_data, tags, archived_at, family_member_id
FROM medical_records;

DROP TABLE medical_records;

ALTER TABLE medical_records_new RENAME TO medical_records;

-- Re-create indexes that were on the old table.
CREATE INDEX IF NOT EXISTS idx_medical_records_family_member
  ON medical_records(family_member_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_archived_date
  ON medical_records(patient_id, archived_at, date);

COMMIT;