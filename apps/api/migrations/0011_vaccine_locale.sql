-- ─── 0011: Vaccine + user locale (Phase 2.2.1) ──────────
-- Phase 2.2.1: localized vaccination push notifications. The cron
-- worker needs (a) the user's preferred locale and (b) the vaccine's
-- localized name + disease, neither of which exist in DB today.
--
-- Strategy: add `preferred_locale` to users (the durable locale the
-- mobile client PATCHes on change), and `name_si` / `name_ta` plus
-- `target_disease_si` / `target_disease_ta` columns to vaccine_catalog.
-- English stays in the existing `name` / `target_disease` columns.
--
-- Mobile → server sync: locale-store change → PATCH /me/locale.

ALTER TABLE `users` ADD `preferred_locale` TEXT;
--> statement-breakpoint
-- `en` | `si` | `ta`. Falls back to 'en' when NULL.

ALTER TABLE `vaccine_catalog` ADD `name_si` TEXT;
--> statement-breakpoint
ALTER TABLE `vaccine_catalog` ADD `name_ta` TEXT;
--> statement-breakpoint
ALTER TABLE `vaccine_catalog` ADD `target_disease_si` TEXT;
--> statement-breakpoint
ALTER TABLE `vaccine_catalog` ADD `target_disease_ta` TEXT;
