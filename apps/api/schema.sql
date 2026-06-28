-- Healthcare Platform D1 Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  supabase_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient','doctor','hospital_admin','hospital_staff','laboratory','pharmacy','insurance','ambulance','super_admin')),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  nic TEXT,
  photo TEXT,
  verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  blood_group TEXT,
  height REAL,
  weight REAL,
  date_of_birth TEXT,
  gender TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  emergency_contacts TEXT,
  lifestyle TEXT,
  insurance_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  date_of_birth TEXT,
  blood_group TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  phone TEXT,
  managed_by TEXT REFERENCES patients(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  license TEXT,
  address TEXT,
  phone TEXT,
  location TEXT,
  specializations TEXT,
  rating REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  hospital_id TEXT REFERENCES hospitals(id),
  specialization TEXT NOT NULL,
  registration_number TEXT,
  qualification TEXT,
  experience INTEGER,
  consultation_fee REAL,
  available_slots TEXT,
  rating REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  hospital_id TEXT REFERENCES hospitals(id),
  diagnosis TEXT,
  notes TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_records (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  hospital_id TEXT REFERENCES hospitals(id),
  doctor_id TEXT REFERENCES doctors(id),
  record_type TEXT NOT NULL CHECK (record_type IN ('lab_report','imaging','prescription','hospital_visit','vaccination','surgery','allergy','insurance','fitness','discharge_summary','medical_certificate','operation_note','invoice')),
  title TEXT NOT NULL,
  diagnosis TEXT,
  summary TEXT,
  notes TEXT,
  date TEXT NOT NULL,
  follow_up_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  record_id TEXT REFERENCES medical_records(id),
  url TEXT NOT NULL,
  r2_key TEXT,
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  prescription_id TEXT REFERENCES prescriptions(id),
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT,
  timing TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  refill_reminder INTEGER DEFAULT 0,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lab_reports (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  lab_id TEXT NOT NULL REFERENCES users(id),
  record_id TEXT REFERENCES medical_records(id),
  report_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sample_collected','in_progress','completed','cancelled')),
  pdf_url TEXT,
  ai_summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
  queue_number INTEGER,
  waiting_time INTEGER,
  reason TEXT,
  notes TEXT,
  payment_amount REAL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded','insurance')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  provider_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  coverage_type TEXT,
  expiry_date TEXT,
  max_coverage REAL,
  documents TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id TEXT PRIMARY KEY,
  insurance_id TEXT NOT NULL REFERENCES insurance(id),
  hospital_id TEXT REFERENCES hospitals(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  appointment_id TEXT REFERENCES appointments(id),
  amount REAL NOT NULL,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','paid')),
  documents TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('medicine','appointment','lab_ready','prescription','insurance','hospital','emergency','vaccination','general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergencies (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  location TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','responding','resolved','cancelled')),
  nearest_hospital_id TEXT REFERENCES hospitals(id),
  ambulance_id TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── V2: Clinical record types ──────────────────────────
-- Extend medical_records.recordType check to allow V2 types.
-- SQLite cannot ALTER a CHECK constraint in place; recreating the table
-- would be destructive. New types are accepted via the application layer;
-- existing CHECK stays permissive enough (TEXT column without constraint
-- in deployed D1 may differ from CREATE TABLE here). If you need strict
-- enforcement, regenerate from packages/db/src/schema.ts after deploying.

-- ─── V2: Wards (Hospital ops) ────────────────────────────
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

-- ─── V2: Beds ────────────────────────────────────────────
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

-- ─── V2: Bed Assignments ─────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_bed_assignments_active ON bed_assignments(patient_id) WHERE discharged_at IS NULL;

-- ─── V2: Hospital Staff ──────────────────────────────────
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

-- ─── V2: Lab Orders (Doctor → Lab) ───────────────────────
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

-- ─── V2: AI Cache ────────────────────────────────────────
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

-- ─── V2: Chat Sessions (Health Q&A) ──────────────────────
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

-- ─── V2: Chat Messages ───────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
