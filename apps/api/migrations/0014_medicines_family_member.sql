-- Migration: Add family_member_id to medicines table
-- Allows medicines to be tagged for specific family members,
-- matching the pattern used by medical_records.family_member_id.

ALTER TABLE medicines ADD COLUMN family_member_id TEXT REFERENCES family_members(id);
CREATE INDEX IF NOT EXISTS idx_medicines_family_member ON medicines(family_member_id);
