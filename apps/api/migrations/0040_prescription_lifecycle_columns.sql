-- Migration 0040: Phase E-Rx — prescription lifecycle columns.
-- The cancel/dispense routes (and withStatusGuard, which always sets
-- updated_at) were writing columns that never existed on the table,
-- so cancelling or dispensing a prescription failed at runtime.
ALTER TABLE prescriptions ADD COLUMN cancelled_at text;
ALTER TABLE prescriptions ADD COLUMN cancellation_reason text;
ALTER TABLE prescriptions ADD COLUMN dispensed_at text;
ALTER TABLE prescriptions ADD COLUMN updated_at text;
