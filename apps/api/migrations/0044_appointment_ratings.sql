-- Round 3 P1: post-visit rating + email summary.
--
-- One row per completed appointment. The unique index on
-- `appointment_id` enforces idempotency for the patient POST handler
-- (UPSERT semantics). `stars` is constrained 1-5 server-side; the
-- application rejects out-of-range writes BEFORE they reach SQLite,
-- so we omit a CHECK.
CREATE TABLE IF NOT EXISTS appointment_ratings (
  id text PRIMARY KEY,
  appointment_id text NOT NULL,
  patient_id text NOT NULL,
  doctor_id text NOT NULL,
  stars integer NOT NULL,
  comment text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_appointment_ratings_doctor_created
  ON appointment_ratings(doctor_id, created_at);

-- Two stamp columns on `appointments` to make the email + rating
-- flows idempotent. The cron + the inline status-flip both write
-- `summary_email_sent_at`; whichever wins, the other sees the stamp
-- and skips. `rating_prompted_at` is informational — incremented the
-- first time we show the rating CTA on the patient's appointment
-- detail screen.
ALTER TABLE appointments ADD COLUMN summary_email_sent_at text;
ALTER TABLE appointments ADD COLUMN rating_prompted_at text;
