-- Medicine adherence log
CREATE TABLE IF NOT EXISTS medicine_doses (
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL REFERENCES medicines(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  scheduled_for TEXT NOT NULL,
  taken_at TEXT,
  skipped INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_medicine_doses_patient ON medicine_doses(patient_id);
CREATE INDEX IF NOT EXISTS idx_medicine_doses_medicine ON medicine_doses(medicine_id);

-- Vitals log
CREATE TABLE IF NOT EXISTS vitals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  type TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  secondary_value REAL,
  recorded_at TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_vitals_recorded ON vitals(patient_id, recorded_at);

-- Symptoms log
CREATE TABLE IF NOT EXISTS symptoms (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  symptom TEXT NOT NULL,
  severity TEXT DEFAULT 'mild',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_symptoms_patient ON symptoms(patient_id);

-- Patient notes / journal
CREATE TABLE IF NOT EXISTS patient_notes (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  title TEXT,
  body TEXT NOT NULL,
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_notes_patient ON patient_notes(patient_id);

-- Doctor availability schedule
CREATE TABLE IF NOT EXISTS doctor_availability (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  slot_minutes INTEGER DEFAULT 30,
  active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_doctor_availability_doctor ON doctor_availability(doctor_id);

-- Push tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);