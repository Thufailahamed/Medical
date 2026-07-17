-- Migration 0065: Test Result Values
-- Structured lab results for trend tracking (e.g., HbA1c every 3 months).

CREATE TABLE IF NOT EXISTS test_result_values (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES test_bookings(id),
  test_name TEXT NOT NULL,
  value REAL,
  unit TEXT,
  reference_min REAL,
  reference_max REAL,
  is_abnormal INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_test_result_values_name ON test_result_values(test_name, created_at);
CREATE INDEX idx_test_result_values_booking ON test_result_values(booking_id);
