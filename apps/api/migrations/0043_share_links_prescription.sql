-- Round 3 P1: prescription-share-with-doctor.
--
-- Adds a `prescription_id` column to `share_links` so a patient can
-- mint a 7-day opaque URL that exposes a single prescription (rendered
-- as a signed PDF, no auth required, audit-logged on view). The
-- `kind` discriminator is set to "prescription_share" at mint time;
-- the public GET /share/:token + GET /share/:token/prescription.pdf
-- routes branch on `kind` to choose the right payload.
--
-- Nullable: the column is only set for prescription-scoped shares.
-- Existing record-share rows are unaffected.
ALTER TABLE share_links ADD COLUMN prescription_id text;

CREATE INDEX IF NOT EXISTS idx_share_links_prescription
  ON share_links(prescription_id);
