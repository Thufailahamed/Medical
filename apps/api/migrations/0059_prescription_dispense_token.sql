-- Migration 0059: single-use redemption binding for e-prescriptions.
--
-- E-Rx Phase: bind one signed prescription to one dispense event.
-- The sign route mints a random 32-byte base64url `dispense_token`
-- and embeds it in the signed PDF's QR URL as `?t=<token>`. The
-- pharmacy dispense route atomically consumes it in the same UPDATE
-- that flips status → dispensed (guard clauses on both
-- `dispense_token` = input AND `dispense_token_consumed_at` IS NULL),
-- so a QR photocopy presented at two pharmacies yields one dispensed
-- row + one 409 `token_consumed`.
--
-- Legacy Rx (signed before this migration) have NULL token. The
-- pharmacy dispense route returns 400 `dispense_token_required` for
-- any Rx without a token → forces re-issue for the small soft-launch
-- fleet (<5 doctors). Wholly fine; documented at:
--   apps/api/src/routes/signature.ts (POST /sign)
--   apps/api/src/routes/pharmacy.ts (POST /:id/dispense)
--
-- The partial UNIQUE index allows multiple NULLs (drafts + legacy
-- signed Rx) while preventing any two signed Rx from sharing a token.

ALTER TABLE `prescriptions` ADD `dispense_token` TEXT;
--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `dispense_token_consumed_at` TEXT;
--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `dispensed_by_user_id` TEXT REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `dispensed_by_pharmacy_name` TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_prescriptions_dispense_token`
  ON `prescriptions`(`dispense_token`)
  WHERE `dispense_token` IS NOT NULL;
