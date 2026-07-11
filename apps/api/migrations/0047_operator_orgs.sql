-- Phase ADM-2: per-operator org scoping.
-- insurance/ambulance users belong to an operator_org. super_admin may
-- have operatorOrgId NULL (cross-org view). insuranceClaims.insuranceId
-- and ambulance_dispatches.operatorOrgId scope operator reads.

CREATE TABLE IF NOT EXISTS operator_orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('insurance', 'ambulance')),
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN operator_org_id TEXT REFERENCES operator_orgs(id);

CREATE INDEX IF NOT EXISTS users_operator_org_idx ON users(operator_org_id);
CREATE INDEX IF NOT EXISTS operator_orgs_kind_idx ON operator_orgs(kind);

-- Ambulance dispatches (minimal shape; real flow wires into emergencies +
-- ETA + assignment in a follow-up migration).
CREATE TABLE IF NOT EXISTS ambulance_dispatches (
  id TEXT PRIMARY KEY,
  operator_org_id TEXT NOT NULL REFERENCES operator_orgs(id),
  patient_id TEXT REFERENCES patients(id),
  pickup_address TEXT NOT NULL,
  destination_address TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'acknowledged', 'enroute', 'completed', 'cancelled')),
  assigned_user_id TEXT REFERENCES users(id),
  notes TEXT,
  acknowledged_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ambulance_dispatches_org_status_idx
  ON ambulance_dispatches(operator_org_id, status);