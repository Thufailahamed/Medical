-- Phase Round-5 (Video): patient-requested video mode on the
-- appointment row. Default `in_person` so existing rows are valid
-- without any backfill. CHECK constraint keeps the enum tight at the
-- DB layer — even if the API zod schema drifts, the engine rejects.
ALTER TABLE appointments
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'in_person'
  CHECK (mode IN ('in_person', 'video'));

-- Composite index helps the doctor queue render today's `video` rows
-- quickly (and the patient's "join video visit" eligibility check on
-- mobile, which filters on doctor_id+date+mode). Plain b-tree — the
-- partial-index trick from the teleconsult sessions table isn't needed
-- here because both modes are first-class query targets.
CREATE INDEX appointments_doctor_mode_idx
  ON appointments(doctor_id, mode, date, time);