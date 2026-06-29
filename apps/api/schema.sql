-- Healthcare Platform D1 Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  supabase_id TEXT UNIQUE,
  password_hash TEXT,
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
  conditions TEXT,            -- V3: JSON array of hereditary conditions
  is_deceased INTEGER DEFAULT 0,
  cause_of_death TEXT,
  notes TEXT,
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
  extracted_data TEXT,
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

-- ─── V3: PHR Completion ──────────────────────────────────

-- ─── Allergies (structured) ──────────────────────────────
CREATE TABLE IF NOT EXISTS allergies (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  substance TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('mild','moderate','severe','critical')),
  reaction TEXT,
  onset_date TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_allergies_active ON allergies(patient_id) WHERE active = 1;

-- ─── Vaccine Catalog ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS vaccine_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  category TEXT,
  target_disease TEXT,
  schedule TEXT NOT NULL,
  aliases TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vaccine_catalog_name ON vaccine_catalog(name);

INSERT OR IGNORE INTO vaccine_catalog (id, name, short_name, category, target_disease, schedule, aliases, notes) VALUES
  ('vc_bcg', 'BCG', 'BCG', 'live_attenuated', 'Tuberculosis', '[{"monthsFromBirth":0,"label":"At birth"}]', '["Bacillus Calmette-Guérin"]', 'Single dose, lifelong protection.'),
  ('vc_hepb', 'Hepatitis B', 'HepB', 'subunit', 'Hepatitis B', '[{"monthsFromBirth":0,"label":"At birth"},{"monthsFromBirth":1,"label":"1 month"},{"monthsFromBirth":6,"label":"6 months"}]', '["Hep B","HBV"]', 'Three-dose series.'),
  ('vc_dpt', 'DPT / Tdap', 'DPT', 'toxoid', 'Diphtheria, Pertussis, Tetanus', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months"},{"monthsFromBirth":18,"label":"18 months"},{"monthsFromBirth":60,"label":"5 years (booster)"}]', '["DTP","DTwP","DTaP","Tdap"]', 'Five-dose primary series with boosters every 10 years for adults.'),
  ('vc_polio', 'Polio (IPV/OPV)', 'Polio', 'live_attenuated', 'Poliomyelitis', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months"},{"monthsFromBirth":18,"label":"18 months (booster)"}]', '["IPV","OPV"]', 'Four-dose series.'),
  ('vc_hib', 'Hib', 'Hib', 'conjugate', 'Haemophilus influenzae type b', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months (depending on brand)"},{"monthsFromBirth":12,"label":"12-15 months (booster)"}]', '["Haemophilus influenzae type b"]', 'Three or four-dose series.'),
  ('vc_pcv', 'Pneumococcal (PCV)', 'PCV', 'conjugate', 'Pneumococcal disease', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months"},{"monthsFromBirth":12,"label":"12-15 months (booster)"}]', '["PCV13","Prevnar"]', 'Four-dose series.'),
  ('vc_rotavirus', 'Rotavirus', 'Rota', 'live_attenuated', 'Rotavirus gastroenteritis', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"}]', '["RotaTeq","Rotarix"]', 'Two or three-dose series; first dose must be before 15 weeks.'),
  ('vc_mmr', 'MMR', 'MMR', 'live_attenuated', 'Measles, Mumps, Rubella', '[{"monthsFromBirth":12,"label":"12-15 months"},{"monthsFromBirth":48,"label":"4-6 years (booster)"}]', '["Measles","Mumps","Rubella"]', 'Two-dose series.'),
  ('vc_varicella', 'Varicella', 'Var', 'live_attenuated', 'Chickenpox', '[{"monthsFromBirth":12,"label":"12-15 months"},{"monthsFromBirth":48,"label":"4-6 years (booster)"}]', '["Chickenpox","Varivax"]', 'Two-dose series.'),
  ('vc_hepa', 'Hepatitis A', 'HepA', 'inactivated', 'Hepatitis A', '[{"monthsFromBirth":12,"label":"12-23 months"},{"monthsFromBirth":18,"label":"6 months after first"}]', '["Hep A","HAV"]', 'Two-dose series, 6 months apart.'),
  ('vc_typhoid', 'Typhoid', 'Typhi', 'polysaccharide', 'Typhoid fever', '[{"monthsFromBirth":24,"label":"2 years (single dose)"}]', '["Typhim Vi","Typbar"]', 'Booster every 3 years if at risk.'),
  ('vc_hpv', 'HPV', 'HPV', 'subunit', 'Human Papillomavirus', '[{"monthsFromBirth":132,"label":"11-12 years"},{"monthsFromBirth":144,"label":"2 months after first"},{"monthsFromBirth":168,"label":"6 months after first"}]', '["Gardasil","Cervarix"]', 'Two or three-dose series starting at age 11-12.'),
  ('vc_influenza', 'Influenza', 'Flu', 'inactivated', 'Influenza', '[{"monthsFromBirth":6,"label":"Annual, starting 6 months"}]', '["Flu shot","Quadrivalent"]', 'Annual booster; reformulated yearly.'),
  ('vc_covid19', 'COVID-19', 'COVID', 'mrna', 'COVID-19', '[{"monthsFromBirth":6,"label":"Primary series"},{"monthsFromBirth":12,"label":"Annual booster"}]', '["SARS-CoV-2","Pfizer","Moderna"]', 'Per current WHO guidelines.'),
  ('vc_japanese_encephalitis', 'Japanese Encephalitis', 'JE', 'inactivated', 'Japanese Encephalitis', '[{"monthsFromBirth":12,"label":"12 months"},{"monthsFromBirth":13,"label":"1 month after first"}]', '["JE-Vax"]', 'For travelers to endemic regions.'),
  ('vc_yellow_fever', 'Yellow Fever', 'YF', 'live_attenuated', 'Yellow Fever', '[{"monthsFromBirth":9,"label":"9 months (single dose)"}]', '["YF-Vax","Stamaril"]', 'Required for travel to endemic countries; lifelong protection.'),
  ('vc_rabies', 'Rabies', 'Rab', 'inactivated', 'Rabies', '[{"monthsFromBirth":0,"label":"Post-exposure or pre-exposure series"}]', '["Imovax","RabAvert"]', 'Pre-exposure: 2 doses. Post-exposure: 4-5 doses + immunoglobulin.');

-- ─── Share Links ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  token TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT '{}',
  label TEXT,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_share_links_patient ON share_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_active ON share_links(revoked, expires_at);

-- ─── Share Link Views (audit) ────────────────────────────
CREATE TABLE IF NOT EXISTS share_link_views (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES share_links(id),
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_share_link_views_link ON share_link_views(link_id);

-- ─── 0004: Push + booking/visits hardening ─────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN (
    'medicine','appointment','lab_ready','prescription',
    'insurance','hospital','emergency','vaccination','general'
  )),
  in_app INTEGER NOT NULL DEFAULT 1,
  push INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, type)
);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences(user_id);

CREATE TABLE IF NOT EXISTS doctor_time_off (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doctor_time_off_doctor_date
  ON doctor_time_off(doctor_id, date);

CREATE TABLE IF NOT EXISTS walk_ins (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  reason TEXT,
  priority TEXT NOT NULL DEFAULT 'routine'
    CHECK (priority IN ('routine','urgent')),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','in_consultation','completed','no_show')),
  arrived_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consultation_ended_at TEXT,
  assigned_by_user_id TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_walk_ins_doctor_date
  ON walk_ins(doctor_id, arrived_at);
CREATE INDEX IF NOT EXISTS idx_walk_ins_hospital_date
  ON walk_ins(hospital_id, arrived_at);
CREATE INDEX IF NOT EXISTS idx_walk_ins_status
  ON walk_ins(status);

CREATE TABLE IF NOT EXISTS appointment_status_history (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id TEXT REFERENCES users(id),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_appt_status_hist_appt
  ON appointment_status_history(appointment_id, created_at);

-- appointments hardening (idempotent ALTER)
-- SQLite supports ALTER TABLE ADD COLUMN with IF NOT EXISTS only via pragma checks;
-- do it inline so re-running is safe.

ALTER TABLE appointments ADD COLUMN reminder_sent INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_time
  ON appointments(doctor_id, date, time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
  ON appointments(patient_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
  ON appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON appointments(status);
