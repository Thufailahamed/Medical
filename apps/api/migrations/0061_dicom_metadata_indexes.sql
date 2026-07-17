-- Phase IMG-1: indexes for DICOM metadata queries.
-- The document_dicom_metadata table was added in an earlier migration but
-- never indexed; the new /imaging/studies endpoints group by
-- StudyInstanceUID + SeriesInstanceUID, so a covering index keeps
-- patient vault reads sub-100ms at 10k+ studies.

CREATE INDEX IF NOT EXISTS document_dicom_metadata_study_idx
  ON document_dicom_metadata (study_instance_uid);

CREATE INDEX IF NOT EXISTS document_dicom_metadata_series_idx
  ON document_dicom_metadata (study_instance_uid, series_instance_uid);

CREATE INDEX IF NOT EXISTS document_dicom_metadata_modality_idx
  ON document_dicom_metadata (modality);
