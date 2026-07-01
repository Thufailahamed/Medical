CREATE TABLE IF NOT EXISTS d1_migrations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO d1_migrations (id, name, applied_at) VALUES
(1, '0001_v1_features.sql', '2026-06-29 06:17:50'),
(2, '0002_v2_features.sql', '2026-06-29 06:17:51'),
(3, '0003_phr_complete.sql', '2026-06-29 14:02:54'),
(4, '0004_push_and_visits.sql', '2026-06-29 14:02:55'),
(5, '0001_vengeful_revanche.sql', '2026-06-29 18:12:52'),
(7, '0002_peaceful_nuke.sql', '2026-06-30 07:53:08'),
(8, '0005_dose_reminders.sql', '2026-06-30 07:54:06'),
(9, '0003_flat_sugar_man.sql', '2026-06-30 14:27:57'),
(10, '0004_known_sersi.sql', '2026-06-30 14:47:37'),
(11, '0005_famous_sugar_man.sql', '2026-06-30 17:10:33'),
(12, '0006_sour_bloodstorm.sql', '2026-06-30 17:10:34'),
(13, '0006_auto_classification.sql', '2026-06-30 17:10:34'),
(14, '0007_backfill_fts.sql', '2026-06-30 17:10:34'),
(15, '0008_fix_record_type_check.sql', '2026-06-30 17:16:08'),
(16, '0009_vaccine_reminders.sql', '2026-06-30 17:16:09'),
(17, '0006_normal_rhino.sql', '2026-07-01 06:28:14'),
(18, '0010_active_family_member.sql', '2026-07-01 06:28:53'),
(19, '0011_vaccine_locale.sql', '2026-07-01 06:28:53'),
(20, '0012_vaccine_catalog_translations.sql', '2026-07-01 06:28:54'),
(21, '0013_family_invite.sql', '2026-07-01 06:28:55');
