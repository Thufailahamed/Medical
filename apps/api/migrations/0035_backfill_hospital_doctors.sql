-- Migration 0035: backfill hospital_doctors from doctors.hospital_id
--
-- Every existing doctor row with a non-NULL `hospital_id` becomes an
-- active `hospital_doctors` row. Idempotent: re-running on an already-
-- backfilled DB no-ops because the pair_unique index rejects duplicates.

INSERT INTO `hospital_doctors` (
	`id`, `hospital_id`, `doctor_id`, `department`, `role`,
	`status`, `joined_at`, `left_at`, `notes`, `created_at`, `updated_at`
)
SELECT
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
	  substr(lower(hex(randomblob(2))),2) || '-' ||
	  substr('89ab', abs(random()) % 4 + 1, 1) ||
	  substr(lower(hex(randomblob(2))),2) || '-' ||
	  lower(hex(randomblob(6))),
	d.`hospital_id`,
	d.`id`,
	NULL,
	'consultant',
	'active',
	COALESCE(d.`created_at`, CURRENT_TIMESTAMP),
	NULL,
	NULL,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM `doctors` d
WHERE d.`hospital_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `hospital_doctors` hd
     WHERE hd.`hospital_id` = d.`hospital_id`
       AND hd.`doctor_id` = d.`id`
  );