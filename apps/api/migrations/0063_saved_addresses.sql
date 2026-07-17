-- Migration 0063: Add saved addresses to patients
-- Stores a JSON array of addresses for home collection bookings.
-- Shape: [{ id, label, line1, line2, city, district, lat, lng, contactPhone, isDefault }]

ALTER TABLE patients ADD COLUMN saved_addresses TEXT;
