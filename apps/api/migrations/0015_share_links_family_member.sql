-- Migration 0015: Add family_member_id to share_links table
-- Lets a share link be scoped to one family member so the public
-- bundle (/share/:token) exposes only that member's medicines +
-- records instead of the whole household. Nullable: NULL means
-- "household / principal", preserving today's full-bundle behavior.
ALTER TABLE share_links ADD COLUMN family_member_id TEXT REFERENCES family_members(id);
CREATE INDEX IF NOT EXISTS idx_share_links_family_member ON share_links(family_member_id);