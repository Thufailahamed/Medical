-- Doctor Booking: telemedicine opt-in flag.
-- Patients can request `mode=video` only when the doctor has explicitly
-- enabled video consultations. Default 0 keeps existing doctors in
-- in-person-only mode; an admin or seed script flips the flag for
-- doctors who already do video.
--
-- Partial unique-style index helps the doctor-search endpoint
-- (`?telemedicine=1`) scan only enabled rows — full table is small
-- today but the partial index keeps the lookup O(matches) instead of
-- O(all-doctors).
ALTER TABLE doctors
  ADD COLUMN telemedicine_enabled INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS doctors_telemedicine_enabled_idx
  ON doctors(telemedicine_enabled)
  WHERE telemedicine_enabled = 1;