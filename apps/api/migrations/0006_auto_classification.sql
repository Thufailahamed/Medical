-- Phase 2.1: trilingual smart search via FTS5.
--
-- SQLite enforces recordType enum at the application (Drizzle) layer,
-- not at the column level, so no ALTER is needed for adding 'other'.
-- The FTS virtual table is the real DB-level change.

CREATE VIRTUAL TABLE IF NOT EXISTS `medical_records_fts` USING fts5(
  `recordId` UNINDEXED,
  `title`,
  `diagnosis`,
  `summary`,
  `notes`,
  `extracted_text`,
  tokenize = 'unicode61 remove_diacritics 2'
);