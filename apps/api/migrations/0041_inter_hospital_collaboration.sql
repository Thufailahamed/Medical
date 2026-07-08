-- Migration 0041: Phase HOS-14 — Inter-hospital collaboration
--   6 new tables for hospital-to-hospital record sharing, referrals,
--   lab order routing, doctor consult notes, and discharge handoffs.

CREATE TABLE IF NOT EXISTS hospital_share_requests (
  id TEXT PRIMARY KEY,
  requester_hospital_id TEXT NOT NULL,
  source_hospital_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  requested_by_user_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'full',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  approved_by_user_id TEXT,
  approved_at TEXT,
  declined_at TEXT,
  declined_reason TEXT,
  revoked_at TEXT,
  revoked_by_user_id TEXT,
  viewed_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hsr_requester
  ON hospital_share_requests(requester_hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_hsr_source
  ON hospital_share_requests(source_hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_hsr_patient
  ON hospital_share_requests(patient_id);

CREATE TABLE IF NOT EXISTS hospital_share_request_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  actor_user_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hsr_events_req
  ON hospital_share_request_events(request_id, created_at);

CREATE TABLE IF NOT EXISTS cross_hospital_referrals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  from_hospital_id TEXT NOT NULL,
  from_doctor_id TEXT NOT NULL,
  to_hospital_id TEXT NOT NULL,
  to_specialty TEXT NOT NULL,
  reason TEXT NOT NULL,
  clinical_summary TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'routine',
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_by_user_id TEXT,
  accepted_at TEXT,
  completed_at TEXT,
  declined_at TEXT,
  declined_reason TEXT,
  linked_share_request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_xref_to
  ON cross_hospital_referrals(to_hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_xref_from
  ON cross_hospital_referrals(from_hospital_id, status);

CREATE TABLE IF NOT EXISTS cross_hospital_lab_routings (
  id TEXT PRIMARY KEY,
  lab_order_id TEXT NOT NULL,
  from_hospital_id TEXT NOT NULL,
  to_hospital_id TEXT NOT NULL,
  routed_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_by_user_id TEXT,
  accepted_at TEXT,
  completed_at TEXT,
  result_share_request_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_xlabr_from
  ON cross_hospital_lab_routings(from_hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_xlabr_to
  ON cross_hospital_lab_routings(to_hospital_id, status);

CREATE TABLE IF NOT EXISTS consult_notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  from_doctor_id TEXT NOT NULL,
  to_doctor_id TEXT,
  from_hospital_id TEXT NOT NULL,
  to_hospital_id TEXT NOT NULL,
  question TEXT NOT NULL,
  thread TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',
  linked_share_request_id TEXT,
  created_at TEXT NOT NULL,
  last_reply_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_consult_to
  ON consult_notes(to_hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_consult_patient
  ON consult_notes(patient_id);

CREATE TABLE IF NOT EXISTS discharge_handoffs (
  id TEXT PRIMARY KEY,
  admission_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  from_hospital_id TEXT NOT NULL,
  to_clinic_id TEXT,
  to_hospital_id TEXT,
  discharge_summary TEXT NOT NULL,
  follow_up_plan TEXT,
  shared_at TEXT,
  acknowledged_by_user_id TEXT,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dh_patient
  ON discharge_handoffs(patient_id);
CREATE INDEX IF NOT EXISTS idx_dh_from
  ON discharge_handoffs(from_hospital_id);
