-- V2: Healthcare providers — clinical workflows + AI module
-- Mirrors apps/api/schema.sql. Idempotent (uses IF NOT EXISTS).

-- ─── Wards ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wards (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('general','icu','pediatric','maternity','surgical','emergency')),
  capacity INTEGER NOT NULL,
  floor INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wards_hospital ON wards(hospital_id);

-- ─── Beds ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  ward_id TEXT NOT NULL REFERENCES wards(id),
  bed_number TEXT NOT NULL,
  status TEXT DEFAULT 'available' NOT NULL CHECK (status IN ('available','occupied','cleaning','maintenance','reserved')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);

-- ─── Bed Assignments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS bed_assignments (
  id TEXT PRIMARY KEY,
  bed_id TEXT NOT NULL REFERENCES beds(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  discharged_at TEXT,
  assigned_by TEXT REFERENCES users(id),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_bed ON bed_assignments(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_assignments_patient ON bed_assignments(patient_id);

-- ─── Hospital Staff ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS hospital_staff (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  user_id TEXT REFERENCES users(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('nurse','receptionist','technician','manager','housekeeping','security')),
  shift TEXT DEFAULT 'morning' NOT NULL CHECK (shift IN ('morning','evening','night','rotating')),
  phone TEXT,
  email TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hospital_staff_hospital ON hospital_staff(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hospital_staff_role ON hospital_staff(role);

-- ─── Lab Orders ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_orders (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  hospital_id TEXT REFERENCES hospitals(id),
  tests TEXT NOT NULL,
  priority TEXT DEFAULT 'routine' NOT NULL CHECK (priority IN ('routine','urgent','stat')),
  status TEXT DEFAULT 'ordered' NOT NULL CHECK (status IN ('ordered','sample_collected','in_progress','completed','cancelled')),
  notes TEXT,
  ordered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  result_url TEXT,
  result_summary TEXT
);
CREATE INDEX IF NOT EXISTS idx_lab_orders_doctor ON lab_orders(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);

-- ─── AI Cache ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('summary','lab_explain','drug_interaction','chat','ocr')),
  input_hash TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ttl_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_cache(kind, input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_ttl ON ai_cache(ttl_at);

-- ─── Chat Sessions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  patient_id TEXT REFERENCES patients(id),
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_patient ON chat_sessions(patient_id);

-- ─── Chat Messages ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);