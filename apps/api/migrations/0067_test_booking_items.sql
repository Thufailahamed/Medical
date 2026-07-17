-- Migration 0067: Test Booking Items
-- Supports multi-test bookings (cart). A single booking can include
-- multiple tests from the same lab partner.

CREATE TABLE IF NOT EXISTS test_booking_items (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES test_bookings(id),
  test_id TEXT NOT NULL REFERENCES diagnostic_test_catalog(id),
  price REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_test_booking_items_booking ON test_booking_items(booking_id);
CREATE INDEX idx_test_booking_items_test ON test_booking_items(test_id);
