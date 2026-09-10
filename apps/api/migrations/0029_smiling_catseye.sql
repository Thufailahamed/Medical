CREATE TABLE `lab_diagnostic_test_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_si` text,
	`name_ta` text,
	`icon` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lab_diagnostic_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`lab_partner_id` text NOT NULL,
	`test_id` text NOT NULL,
	`price` real NOT NULL,
	`discount_price` real,
	`currency` text DEFAULT 'LKR' NOT NULL,
	`home_collection_available` integer DEFAULT true NOT NULL,
	`lab_collection_available` integer DEFAULT true NOT NULL,
	`turnaround_hours` integer,
	`special_instructions` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`lab_partner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_id`) REFERENCES `diagnostic_test_catalog`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lab_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`lab_name` text NOT NULL,
	`license_number` text NOT NULL,
	`accreditation` text,
	`address` text NOT NULL,
	`city` text,
	`operating_hours` text,
	`bank_name` text,
	`bank_account` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_package_images` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`image_url` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `test_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
/*
 SQLite does not support "Drop not null from column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html
                  https://stackoverflow.com/questions/2083543/modify-a-columns-type-in-sqlite3

 Due to that we don't generate migration automatically and it has to be done manually
*/--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `short_name` text;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `code` text;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `category_id` text REFERENCES lab_diagnostic_test_categories(id);--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `result_interpretation` text;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `reference_info` text;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `currency` text DEFAULT 'LKR' NOT NULL;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `is_bookable` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `is_doctor_orderable` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `lab_collection_available` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `synonyms` text;--> statement-breakpoint
ALTER TABLE `diagnostic_test_catalog` ADD `display_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `operator_orgs` ADD `license_doc_key` text;--> statement-breakpoint
ALTER TABLE `operator_orgs` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `category_id` text REFERENCES lab_diagnostic_test_categories(id);--> statement-breakpoint
ALTER TABLE `test_packages` ADD `preparation` text;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `fasting_required` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `sample_type` text;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `popular` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `display_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `test_packages` ADD `discount_percent` real;--> statement-breakpoint
CREATE UNIQUE INDEX `lab_diagnostic_test_categories_slug_unique` ON `lab_diagnostic_test_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_lab_diag_cat_active` ON `lab_diagnostic_test_categories` (`is_active`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_lab_diag_tests_test` ON `lab_diagnostic_tests` (`test_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_lab_diag_tests_lab` ON `lab_diagnostic_tests` (`lab_partner_id`,`is_active`);--> statement-breakpoint
CREATE UNIQUE INDEX `lab_diagnostic_tests_lab_test_unique` ON `lab_diagnostic_tests` (`lab_partner_id`,`test_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lab_profiles_license_number_unique` ON `lab_profiles` (`license_number`);--> statement-breakpoint
CREATE INDEX `idx_pkg_img` ON `test_package_images` (`package_id`,`display_order`);--> statement-breakpoint
CREATE INDEX `idx_diag_test_catalog_category_id` ON `diagnostic_test_catalog` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_test_packages_featured` ON `test_packages` (`featured`,`is_active`);--> statement-breakpoint
CREATE INDEX `idx_test_packages_category` ON `test_packages` (`category_id`);--> statement-breakpoint
/*
 SQLite does not support "Creating foreign key on existing column" out of the box, we do not generate automatic migration for that, so it has to be done manually
 Please refer to: https://www.techonthenet.com/sqlite/tables/alter_table.php
                  https://www.sqlite.org/lang_altertable.html

 Due to that we don't generate migration automatically and it has to be done manually
*/