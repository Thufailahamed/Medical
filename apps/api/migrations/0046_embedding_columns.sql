-- Day 3 #4: duplicate-record detection.
--
-- Add three columns to medical_records to support bge-small embeddings:
--   embedding         TEXT    JSON `{dim, data: number[]}` for Float32 round-trip
--   embedding_model   TEXT    which model produced the vector
--   embedded_at       TEXT    ISO timestamp of when the embedding was written
--
-- NULL is the default state. Existing rows (millions, potentially) get
-- embedded lazily on next upload for the same patient.
ALTER TABLE medical_records ADD COLUMN embedding text;
ALTER TABLE medical_records ADD COLUMN embedding_model text;
ALTER TABLE medical_records ADD COLUMN embedded_at text;