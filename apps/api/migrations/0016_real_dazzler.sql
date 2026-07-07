CREATE INDEX `lab_orders_patient_doctor_idx` ON `lab_orders` (`patient_id`,`doctor_id`);--> statement-breakpoint
CREATE INDEX `prescriptions_patient_doctor_idx` ON `prescriptions` (`patient_id`,`doctor_id`);--> statement-breakpoint
CREATE INDEX `prescriptions_doctor_date_idx` ON `prescriptions` (`doctor_id`,`date`);--> statement-breakpoint
CREATE INDEX `walk_ins_patient_doctor_idx` ON `walk_ins` (`patient_id`,`doctor_id`);--> statement-breakpoint
CREATE INDEX `walk_ins_doctor_status_idx` ON `walk_ins` (`doctor_id`,`status`);