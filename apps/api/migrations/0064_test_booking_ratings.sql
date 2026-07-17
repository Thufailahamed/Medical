-- Migration 0064: Test Booking Ratings
-- Patients rate their lab/phlebotomist experience after sample collection.

CREATE TABLE IF NOT EXISTS test_booking_ratings (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES test_bookings(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  lab_partner_id TEXT NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_test_booking_ratings_lab ON test_booking_ratings(lab_partner_id, created_at);
