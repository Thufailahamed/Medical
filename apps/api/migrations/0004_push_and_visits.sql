-- ─── 0004: Push notifications + booking/visits hardening ─────

-- (push_tokens is created lazily by the Drizzle bootstrap; ensure here.)

-- Notification Preferences (per user, per type)
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

-- Doctor Time Off
CREATE TABLE IF NOT EXISTS doctor_time_off (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  date TEXT NOT NULL,        -- YYYY-MM-DD
  start_time TEXT,           -- HH:MM, NULL = all day
  end_time TEXT,             -- HH:MM, NULL = all day
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doctor_time_off_doctor_date
  ON doctor_time_off(doctor_id, date);

-- Walk-ins (front-desk / OPD)
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

-- Appointment Status History (audit)
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

-- Appointments: reminder + indexes for fast slot/queue lookups
ALTER TABLE appointments ADD COLUMN reminder_sent INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date_time
  ON appointments(doctor_id, date, time);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
  ON appointments(patient_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
  ON appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON appointments(status);