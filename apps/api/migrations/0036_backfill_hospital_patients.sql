-- Migration 0036: backfill hospital_patients from clinical evidence
--
-- Derives hospital membership from the earliest clinical signal we
-- have for each patient. Priority:
--   1. bed_assignments  (most explicit "patient admitted to hospital")
--   2. walk_ins          (check-in at OPD)
--   3. appointments      (booking at a specific hospital)
--   4. medical_records.hospital_id (legacy single-tenant)
--
-- MRN format: HSP-<hospital_id_first8>-<seq>. The seq is assigned via
-- row_number() over (hospital_id, registered_at) to be stable on
-- re-runs. Duplicates blocked by pair_unique index.

INSERT INTO `hospital_patients` (
	`id`, `hospital_id`, `patient_id`, `mrn`,
	`status`, `registered_at`, `discharged_at`, `notes`,
	`created_at`, `updated_at`
)
SELECT
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
	  substr(lower(hex(randomblob(2))),2) || '-' ||
	  substr('89ab', abs(random()) % 4 + 1, 1) ||
	  substr(lower(hex(randomblob(2))),2) || '-' ||
	  lower(hex(randomblob(6))),
	ev.`hospital_id`,
	ev.`patient_id`,
	'HSP-' || substr(ev.`hospital_id`, 1, 8) || '-' ||
	  printf('%06d', ev.`seq`),
	'registered',
	ev.`first_seen`,
	NULL,
	NULL,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM (
	SELECT
		`patient_id`,
		`hospital_id`,
		MIN(`first_seen`) AS `first_seen`,
		ROW_NUMBER() OVER (PARTITION BY `hospital_id` ORDER BY MIN(`first_seen`)) AS `seq`
	FROM (
		-- 1. bed assignments (most explicit)
		SELECT ba.`patient_id`, ba.`hospital_id`, ba.`assigned_at` AS `first_seen`
		  FROM `bed_assignments` ba
		 WHERE ba.`hospital_id` IS NOT NULL
		UNION ALL
		-- 2. walk-ins (OPD check-in)
		SELECT w.`patient_id`, w.`hospital_id`, w.`checked_in_at` AS `first_seen`
		  FROM `walk_ins` w
		 WHERE w.`hospital_id` IS NOT NULL
		UNION ALL
		-- 3. appointments
		SELECT a.`patient_id`, a.`hospital_id`, a.`scheduled_for` AS `first_seen`
		  FROM `appointments` a
		 WHERE a.`hospital_id` IS NOT NULL
		UNION ALL
		-- 4. legacy medical_records.hospital_id
		SELECT mr.`patient_id`, mr.`hospital_id`, mr.`date` AS `first_seen`
		  FROM `medical_records` mr
		 WHERE mr.`hospital_id` IS NOT NULL
	)
	GROUP BY `patient_id`, `hospital_id`
) ev
WHERE NOT EXISTS (
	SELECT 1 FROM `hospital_patients` hp
	 WHERE hp.`hospital_id` = ev.`hospital_id`
	   AND hp.`patient_id` = ev.`patient_id`
);