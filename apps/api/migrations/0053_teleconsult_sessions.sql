-- In-App Video Teleconsultation (Migration 0053)
--
-- Adds the `teleconsult_sessions` table backing the WebRTC video room.
-- Signaling lives in a Cloudflare Durable Object (TeleconsultRoom); this
-- table is the durable state + audit ledger:
--   - Doctor creates a row when they tap "Start video visit" on the
--     queue/appointments row (status = 'requested').
--   - First peer WebSocket connect flips status to 'ringing'/'active'
--     and also flips appointments.status to 'in_progress'.
--   - Either side ends the call (or both peers disappear → DO times
--     out after 60s) → status = 'ended' | 'failed' | 'timeout' with
--     duration_sec + signaling_msg_count stamped.
--
-- Multiple sessions per appointment are allowed (rescheduled calls,
-- dropped attempts) but the partial unique index keeps at most one
-- *live* (requested|ringing|active) row per appointment at a time.
--
-- Idempotent: every CREATE uses IF NOT EXISTS per the convention in
-- 0051_qr_health_id.sql — D1 / SQLite don't run multi-statement DDL
-- transactions atomically.

CREATE TABLE IF NOT EXISTS teleconsult_sessions (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id TEXT NOT NULL REFERENCES users(id),
  patient_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','ringing','active','ended','failed','timeout')),
  room_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  ended_at TEXT,
  duration_sec INTEGER,
  signaling_msg_count INTEGER NOT NULL DEFAULT 0,
  ice_restart_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK (duration_sec IS NULL OR duration_sec >= 0)
);

CREATE INDEX IF NOT EXISTS teleconsult_sessions_appt_idx
  ON teleconsult_sessions (appointment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS teleconsult_sessions_doctor_recent_idx
  ON teleconsult_sessions (doctor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS teleconsult_sessions_patient_recent_idx
  ON teleconsult_sessions (patient_user_id, created_at DESC);

-- Partial unique index — at most one live row per appointment.
-- Issuing a fresh session in the same slot revokes the prior row
-- in a single write so a stuck/zombie room can't block new attempts.
CREATE UNIQUE INDEX IF NOT EXISTS teleconsult_sessions_one_live_per_appt
  ON teleconsult_sessions (appointment_id)
  WHERE status IN ('requested','ringing','active');