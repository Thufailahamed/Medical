-- Migration 0037: backfill doctor_patient_relationships from evidence
--
-- Walks every clinical signal we have for a doctor-patient pair at a
-- specific hospital and synthesizes an active consulting
-- relationship row. Idempotent: re-running on a backfilled DB no-ops
-- because the partial UNIQUE on the active triple rejects duplicates.
--
-- Only hospital-scoped signals are backfilled here (the existing data
-- model has no clinic-scoped records). Clinic relationships start
-- empty — created by the new POST /doctor-patient-relationships flow.

INSERT INTO `doctor_patient_relationships` (
	`id`, `doctor_id`, `patient_id`,
	`context_type`, `context_id`,
	`relationship_kind`, `status`, `is_primary`,
	`started_at`, `ended_at`, `referred_by_doctor_id`, `notes`,
	`created_at`, `updated_at`
)
SELECT DISTINCT
	lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
	  substr(lower(hex(randomblob(2))),2) || '-' ||
	  substr('89ab', abs(random()) % 4 + 1, 1) ||
	  substr(lower(hex(randomblob(2))),2) || '-' ||
	  lower(hex(randomblob(6))),
	ev.`doctor_id`,
	ev.`patient_id`,
	'hospital',
	ev.`hospital_id`,
	'consulting',
	'active',
	0,
	ev.`first_seen`,
	NULL,
	NULL,
	NULL,
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM (
	SELECT `doctor_id`, `patient_id`, `hospital_id`, MIN(`ts`) AS `first_seen`
	FROM (
		SELECT `doctor_id`, `patient_id`, `hospital_id`, `scheduled_for` AS `ts`
		  FROM `appointments` WHERE `hospital_id` IS NOT NULL
		UNION ALL
		SELECT `doctor_id`, `patient_id`, `hospital_id`, `issued_at` AS `ts`
		  FROM `prescriptions` WHERE `hospital_id` IS NOT NULL
		UNION ALL
		SELECT lo.`doctor_id`, lo.`patient_id`, lo.`hospital_id`, lo.`ordered_at` AS `ts`
		  FROM `lab_orders` lo WHERE lo.`hospital_id` IS NOT NULL
		UNION ALL
		SELECT `doctor_id`, `patient_id`, `hospital_id`, `date` AS `ts`
		  FROM `medical_records` WHERE `hospital_id` IS NOT NULL
		UNION ALL
		SELECT `doctor_id`, `patient_id`, `hospital_id`, `checked_in_at` AS `ts`
		  FROM `walk_ins` WHERE `hospital_id` IS NOT NULL
	)
	GROUP BY `doctor_id`, `patient_id`, `hospital_id`
) ev
WHERE NOT EXISTS (
	SELECT 1 FROM `doctor_patient_relationships` dpr
	 WHERE dpr.`doctor_id` = ev.`doctor_id`
	   AND dpr.`patient_id` = ev.`patient_id`
	   AND dpr.`context_type` = 'hospital'
	   AND dpr.`context_id` = ev.`hospital_id`
	   AND dpr.`status` = 'active'
);