-- 0083: gateway-neutral payment columns — payments.lk replaces PayHere.
-- SQLite RENAME COLUMN carries the unique index on payhere_order_id along.

ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_order_id` TO `gateway_order_id`;
ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_payment_id` TO `gateway_payment_id`;
ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_status_code` TO `gateway_status_code`;
ALTER TABLE `appointment_payments` RENAME COLUMN `payhere_method` TO `gateway_method`;
