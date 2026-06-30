-- ─── 0012: Vaccine catalog localization (Phase 2.2.2) ──────────
-- Phase 2.2.2: fill `name_si`, `name_ta`, `target_disease_si`, and
-- `target_disease_ta` on every `vaccine_catalog` row. The vaccination
-- cron (Phase 2.2.1) already prefers these columns for users whose
-- `preferred_locale` is `si` / `ta`; without this seed every notification
-- still falls back to English.
--
-- Translations follow the Sri Lanka National Immunization Programme
-- terminology (EPI) and standard WHO Sinhala / Tamil transliterations.
-- Disease names are likewise localized, except a few acronyms that
-- remain English in clinical usage (e.g. HPV, MMR, PCV, DPT).
--
-- Idempotent: safe to re-run; UPDATEs are unconditioned on existing row.

-- ─── Updated localizations ─────────────────────────────────

-- Childhood EPI staples ─────────────────────────────────────
UPDATE `vaccine_catalog` SET
  `name_si` = 'බීසීජී (BCG)',
  `name_ta` = 'பிசிஜி (BCG)',
  `target_disease_si` = 'ක්ෂය රෝගය',
  `target_disease_ta` = 'காசநோய்'
WHERE `id` = 'vc_bcg';

UPDATE `vaccine_catalog` SET
  `name_si` = 'පොලියෝ (IPV/OPV)',
  `name_ta` = 'போலியோ (IPV/OPV)',
  `target_disease_si` = 'පොලියෝ මයිලයිටිස්',
  `target_disease_ta` = 'போலியோமைலிடிஸ்'
WHERE `id` = 'vc_polio';

UPDATE `vaccine_catalog` SET
  `name_si` = 'DPT / Tdap',
  `name_ta` = 'DPT / Tdap',
  `target_disease_si` = 'ඩිප්තීරියා, පර්ටුසිස්, ටැටනස්',
  `target_disease_ta` = 'டிப்தீரியா, பெர்டுசிஸ், டெட்டனஸ்'
WHERE `id` = 'vc_dpt';

UPDATE `vaccine_catalog` SET
  `name_si` = 'මීසල්, රුබෙල්ලා, පාම්පික්ස් (MMR)',
  `name_ta` = 'மீசல்ஸ், ருபெல்லா, பம்ப்ஸ் (MMR)',
  `target_disease_si` = 'මීසල්, මම්ප්ස්, රුබෙල්ලා',
  `target_disease_ta` = 'மீசல்ஸ், பன்றிக்காய்ச்சல், ருபெல்லா'
WHERE `id` = 'vc_mmr';

UPDATE `vaccine_catalog` SET
  `name_si` = 'හිබ් (Hib)',
  `name_ta` = 'ஹிப் (Hib)',
  `target_disease_si` = 'හිමොෆිලස් ඉන්ෆ්ලුවෙන්සා ටයිප් b',
  `target_disease_ta` = 'ஹிமோபிலஸ் இன்ஃப்ளுயன்சா வகை b'
WHERE `id` = 'vc_hib';

UPDATE `vaccine_catalog` SET
  `name_si` = 'නියුමොකොකල් (PCV)',
  `name_ta` = 'நிமோகாக்கல் (PCV)',
  `target_disease_si` = 'නියුමොකොකල් රෝග',
  `target_disease_ta` = 'நிமோகாக்கல் நோய்'
WHERE `id` = 'vc_pcv';

UPDATE `vaccine_catalog` SET
  `name_si` = 'ෂිගල',
  `name_ta` = 'சிகலைட்டு',
  `target_disease_si` = 'ටයිෆොයිඩ් උණ',
  `target_disease_ta` = 'டைபாய்டு காய்ச்சல்'
WHERE `id` = 'vc_typhoid';

UPDATE `vaccine_catalog` SET
  `name_si` = 'වැරිසෙල්ලා',
  `name_ta` = 'வரிசெல்லா',
  `target_disease_si` = 'චිකන්පොක්ස්',
  `target_disease_ta` = 'சிக்கன்போக்ஸ்'
WHERE `id` = 'vc_varicella';

UPDATE `vaccine_catalog` SET
  `name_si` = 'හෙපටයිටිස් B',
  `name_ta` = 'ஹெபடைடிஸ் B',
  `target_disease_si` = 'හෙපටයිටිස් B',
  `target_disease_ta` = 'ஹெபடைடிஸ் B'
WHERE `id` = 'vc_hepb';

UPDATE `vaccine_catalog` SET
  `name_si` = 'හෙපටයිටිස් A',
  `name_ta` = 'ஹெபடைடிஸ் A',
  `target_disease_si` = 'හෙපටයිටිස් A',
  `target_disease_ta` = 'ஹெபடைடிஸ் A'
WHERE `id` = 'vc_hepa';

UPDATE `vaccine_catalog` SET
  `name_si` = 'රොටාවයිරස්',
  `name_ta` = 'ரோட்டாவைரஸ்',
  `target_disease_si` = 'රොටාවයිරස් ආන්ත්‍ර උණ',
  `target_disease_ta` = 'ரோட்டாவைரஸ் குடல் அழற்சி'
WHERE `id` = 'vc_rotavirus';

UPDATE `vaccine_catalog` SET
  `name_si` = 'ජපන් එන්සෙෆලයිටිස්',
  `name_ta` = 'ஜப்பானிய என்செபாலிடிஸ்',
  `target_disease_si` = 'ජපන් එන්සෙෆලයිටිස්',
  `target_disease_ta` = 'ஜப்பானிய என்செபாலிடிஸ்'
WHERE `id` = 'vc_japanese_encephalitis';

UPDATE `vaccine_catalog` SET
  `name_si` = 'වස උණ',
  `name_ta` = 'மஞ்சள் காய்ச்சல்',
  `target_disease_si` = 'වස උණ',
  `target_disease_ta` = 'மஞ்சள் காய்ச்சல்'
WHERE `id` = 'vc_yellow_fever';

UPDATE `vaccine_catalog` SET
  `name_si` = 'වැලි උණ',
  `name_ta` = 'ரேபிஸ்',
  `target_disease_si` = 'වැලි උණ',
  `target_disease_ta` = 'ரேபிஸ்'
WHERE `id` = 'vc_rabies';

-- Adolescent / adult vaccines ──────────────────────────────
UPDATE `vaccine_catalog` SET
  `name_si` = 'HPV',
  `name_ta` = 'HPV',
  `target_disease_si` = 'මිනිස් පැපිලෝමා වයිරස්',
  `target_disease_ta` = 'மனித பாப்பிலோமா வைரஸ்'
WHERE `id` = 'vc_hpv';

UPDATE `vaccine_catalog` SET
  `name_si` = 'ඉන්ෆ්ලුවෙන්සා',
  `name_ta` = 'இன்ஃப்ளுயன்சா',
  `target_disease_si` = 'ඉන්ෆ්ලුවෙන්සා',
  `target_disease_ta` = 'இன்ஃப்ளுயன்சா'
WHERE `id` = 'vc_influenza';

UPDATE `vaccine_catalog` SET
  `name_si` = 'COVID-19',
  `name_ta` = 'COVID-19',
  `target_disease_si` = 'COVID-19',
  `target_disease_ta` = 'COVID-19'
WHERE `id` = 'covid19';
