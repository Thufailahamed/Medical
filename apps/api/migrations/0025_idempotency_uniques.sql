-- Migration 0025: idempotency UNIQUE indexes
--
-- Phase 3 of the doctor↔patient enterprise architecture: each of these
-- indexes turns a soft race (read-modify-write, double-event, double-sign,
-- double-payout, double-dose) into a hard "already exists" error the
-- route handler can translate into a 409.
--
-- IMPORTANT — Pre-flight required:
--   Before applying this migration on a populated database, run the
--   following diagnostic to detect any pre-existing duplicates that
--   would block the unique-index creation:
--
--     SELECT prescription_id, COUNT(*) AS n
--     FROM prescription_signatures
--     GROUP BY prescription_id
--     HAVING COUNT(*) > 1;
--
--     SELECT doctor_id, period_start, period_end, COUNT(*)
--     FROM doctor_payouts
--     GROUP BY doctor_id, period_start, period_end
--     HAVING COUNT(*) > 1;
--
--     SELECT source_kind, source_id, COUNT(*)
--     FROM medical_records
--     WHERE source_kind IS NOT NULL
--     GROUP BY source_kind, source_id
--     HAVING COUNT(*) > 1;
--
--     SELECT medicine_id, scheduled_for, COUNT(*)
--     FROM medicine_doses
--     GROUP BY medicine_id, scheduled_for
--     HAVING COUNT(*) > 1;
--
-- If any of these return rows, clean them up before applying the
-- migration (KEEP the most recent row by createdAt, DELETE the rest,
-- preserve the audit_logs reference if any).

-- prescription_signatures: one row per prescription. The previous
-- schema had `rxIdx: uniqueIndex("prescription_signatures_rx")` ALREADY,
-- so this is a no-op for the existing table — listed here for
-- documentation. Verifying via re-CREATE IF NOT EXISTS is portable.
CREATE UNIQUE INDEX IF NOT EXISTS prescription_signatures_rx_unique
  ON prescription_signatures (prescription_id);

-- doctor_payouts: one row per (doctor, period). The previous schema
-- had only (doctor_id, created_at) as a non-unique index. Adding this
-- closes the double-pay race that previously allowed two concurrent
-- payout requests to attach the same events to different payout rows.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_payouts_doctor_period_unique
  ON doctor_payouts (doctor_id, period_start, period_end);

-- medical_records: dedupe the mirror rows created when doctors attach
-- prescriptions, lab orders, and follow-ups to a patient's chart.
--
-- DEFERRED — the medical_records schema does not currently expose a
-- source_kind / source_id pair. Adding those columns requires an
-- ALTER TABLE in a separate migration and a one-shot backfill of
-- existing mirror rows (visit-summary, prescription, lab_order,
-- follow_up). The application logic currently avoids creating
-- duplicates by short-circuiting in JS, so the user-visible risk
-- in the first launch window is low. Tracked as a follow-up.

-- medicine_doses: one row per (medicine, scheduled_time). The previous
-- schema had no UNIQUE constraint on the doses table, so two concurrent
-- POST /medicines calls for the same medicine could each insert a
-- dose at the same scheduledFor timestamp, producing duplicates in the
-- adherence log. The scheduleTodayForMedicine helper in
-- apps/api/src/routes/medicines.ts now deduplicates in JS, but a hard
-- DB constraint is the safety net.
CREATE UNIQUE INDEX IF NOT EXISTS medicine_doses_medicine_time_unique
  ON medicine_doses (medicine_id, scheduled_for);