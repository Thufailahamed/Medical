-- Migration 0026: care_team_members active uniqueness
--
-- The base care_team_members table was created by 0011_volatile_ezekiel_stane
-- (drizzle-kit auto-generated from schema.ts). It needs a partial UNIQUE
-- index so that "only one active row per (patient, doctor, role) triple"
-- holds. Revoked rows are kept for audit; re-issuing a revoked row is
-- allowed (old row stays revoked, new row inserts as active).
--
-- Without this index the access middleware's upsertActiveCareTeam helper
-- would need a read-then-write race-guard — the UNIQUE constraint is
-- the second line of defence.

CREATE UNIQUE INDEX IF NOT EXISTS `care_team_active_unique`
  ON `care_team_members` (`patient_id`, `doctor_id`, `role`)
  WHERE status = 'active';