-- Migration 0028: Vitals expansion
--   - Add `context` column to vitals (resting / fasting / post_meal / etc.)
--   - Document the type-enum extension (text column has no DB-level constraint;
--     Drizzle validates new types at the application layer).
--   - Index for series queries by patient+type+recorded_at.

-- ALTER TABLE vitals ADD COLUMN context TEXT; -- (Already exists in remote database)

-- New series queries filter by patient + type + time; existing
-- `idx_vitals_recorded` covers (patient_id, recorded_at). Add a
-- type-prefix variant so the /vitals/me/series endpoint is fast even
-- with thousands of readings.
CREATE INDEX IF NOT EXISTS idx_vitals_patient_type_recorded
  ON vitals(patient_id, type, recorded_at);
