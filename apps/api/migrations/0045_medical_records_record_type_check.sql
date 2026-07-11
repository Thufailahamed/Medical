-- Migration 0045: enforce full record_type whitelist on medical_records.
--
-- schema.sql:96 declares a CHECK constraint that omits four record
-- types the application code writes: `clinical_note`, `follow_up`,
-- `lab_order`, and `vaccination`. Migration 0008 was supposed to fix
-- this but is a no-op (comment: "Already applied manually via
-- scratch/rebuild.sql"). On a fresh D1 the CHECK constraint rejects
-- any INSERT with those values — clinical-note saves, lab-order
-- mirrors, follow-up rows, and vaccination records all blow up at
-- runtime. The Drizzle schema (packages/db/src/schema.ts:272-294)
-- declares 17 valid types; the live CHECK only allows 13.
--
-- SQLite can't ALTER a CHECK constraint, but it can DROP and
-- recreate a trigger-based check. We install BEFORE INSERT/UPDATE
-- triggers that mirror the Drizzle enum. This is additive — existing
-- rows pass the new check (their values are already in the union).
--
-- NOTE: this migration does NOT drop the original CHECK constraint
-- baked into the table definition. On a brand-new DB created from
-- schema.sql the original CHECK is the first gate; on a DB where the
-- CHECK was loosened in flight, the triggers below are the only gate.
-- Either way the application code will accept every valid type.

CREATE TRIGGER IF NOT EXISTS `medical_records_record_type_check_insert`
BEFORE INSERT ON `medical_records`
FOR EACH ROW
WHEN NEW.record_type NOT IN (
  'lab_report',
  'imaging',
  'prescription',
  'hospital_visit',
  'vaccination',
  'surgery',
  'allergy',
  'insurance',
  'fitness',
  'discharge_summary',
  'medical_certificate',
  'operation_note',
  'invoice',
  'clinical_note',
  'lab_order',
  'follow_up',
  'other'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid medical_records.record_type');
END;

CREATE TRIGGER IF NOT EXISTS `medical_records_record_type_check_update`
BEFORE UPDATE ON `medical_records`
FOR EACH ROW
WHEN NEW.record_type NOT IN (
  'lab_report',
  'imaging',
  'prescription',
  'hospital_visit',
  'vaccination',
  'surgery',
  'allergy',
  'insurance',
  'fitness',
  'discharge_summary',
  'medical_certificate',
  'operation_note',
  'invoice',
  'clinical_note',
  'lab_order',
  'follow_up',
  'other'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid medical_records.record_type');
END;