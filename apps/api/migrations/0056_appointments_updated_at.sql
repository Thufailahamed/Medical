-- Doctor Booking (Round 6): add `updated_at` to appointments so the
-- SSE appointment poller can emit on every status / queue / payment
-- mutation. Previously the table had `created_at` only — status
-- flips, queue compactions, and payment confirmations didn't bump a
-- timestamp the poller could subscribe to.
--
-- We use a SQLite trigger so the application code doesn't have to
-- remember to stamp `updated_at` on every `.update(appointments)`
-- call (a load-bearing footgun that's easy to miss in new routes).
-- The trigger fires AFTER UPDATE and is a single statement — cheap
-- enough to run on every appointment mutation including the
-- queue-number compactor in lib/booking.ts.

ALTER TABLE appointments
  ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS appointments_updated_at_idx
  ON appointments(updated_at);

-- Trigger: keep `updated_at` fresh on every UPDATE. We don't filter
-- by `WHEN` because we WANT every appointment UPDATE to bump the
-- cursor (status flips, queue compactor, payment stamps, mode
-- changes, etc.). The Drizzle layer never issues a no-op UPDATE so
-- this fires only when a column actually changes.
CREATE TRIGGER IF NOT EXISTS appointments_set_updated_at
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
  UPDATE appointments
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.id;
END;

-- Backfill: any pre-existing rows already have a meaningful
-- `created_at`. The poller cursor comparison uses string ordering
-- (ISO 8601 UTC) so backfilling with `created_at` keeps historical
-- rows positioned where the poller would naturally have seen them.
UPDATE appointments
  SET updated_at = created_at
  WHERE updated_at = CURRENT_TIMESTAMP;