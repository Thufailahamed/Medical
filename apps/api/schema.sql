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
