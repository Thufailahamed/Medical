-- Migration 0068: Test Promo Codes
-- Discount codes for diagnostic test bookings.

CREATE TABLE IF NOT EXISTS test_promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
  discount_value REAL NOT NULL,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TEXT,
  valid_until TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_test_promo_codes_code ON test_promo_codes(code, is_active);
