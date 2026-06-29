-- V3: PHR Completion — allergies, vaccines, share links, family hereditary
-- Mirrors apps/api/schema.sql. Idempotent for CREATE; ALTER TABLE ADD COLUMN
-- is one-shot (safe to re-run only when columns missing — D1 is dev-stage).

-- ─── Extend family_members (hereditary conditions) ────────
ALTER TABLE family_members ADD COLUMN conditions TEXT;
ALTER TABLE family_members ADD COLUMN is_deceased INTEGER DEFAULT 0;
ALTER TABLE family_members ADD COLUMN cause_of_death TEXT;
ALTER TABLE family_members ADD COLUMN notes TEXT;

-- ─── Allergies (structured) ──────────────────────────────
CREATE TABLE IF NOT EXISTS allergies (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  substance TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('mild','moderate','severe','critical')),
  reaction TEXT,
  onset_date TEXT,
  notes TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_allergies_patient ON allergies(patient_id);
CREATE INDEX IF NOT EXISTS idx_allergies_active ON allergies(patient_id) WHERE active = 1;

-- ─── Vaccine Catalog (WHO/EPI basics) ────────────────────
CREATE TABLE IF NOT EXISTS vaccine_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  category TEXT,
  target_disease TEXT,
  -- JSON array of { monthsFromBirth, label }
  schedule TEXT NOT NULL,
  -- Common brand names
  aliases TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vaccine_catalog_name ON vaccine_catalog(name);

-- ─── Seed vaccine catalog ─────────────────────────────────
INSERT OR IGNORE INTO vaccine_catalog (id, name, short_name, category, target_disease, schedule, aliases, notes) VALUES
  ('vc_bcg', 'BCG', 'BCG', 'live_attenuated', 'Tuberculosis', '[{"monthsFromBirth":0,"label":"At birth"}]', '["Bacillus Calmette-Guérin"]', 'Single dose, lifelong protection.'),
  ('vc_hepb', 'Hepatitis B', 'HepB', 'subunit', 'Hepatitis B', '[{"monthsFromBirth":0,"label":"At birth"},{"monthsFromBirth":1,"label":"1 month"},{"monthsFromBirth":6,"label":"6 months"}]', '["Hep B","HBV"]', 'Three-dose series.'),
  ('vc_dpt', 'DPT / Tdap', 'DPT', 'toxoid', 'Diphtheria, Pertussis, Tetanus', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months"},{"monthsFromBirth":18,"label":"18 months"},{"monthsFromBirth":60,"label":"5 years (booster)"}]', '["DTP","DTwP","DTaP","Tdap"]', 'Five-dose primary series with boosters every 10 years for adults.'),
  ('vc_polio', 'Polio (IPV/OPV)', 'Polio', 'live_attenuated', 'Poliomyelitis', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months"},{"monthsFromBirth":18,"label":"18 months (booster)"}]', '["IPV","OPV"]', 'Four-dose series.'),
  ('vc_hib', 'Hib', 'Hib', 'conjugate', 'Haemophilus influenzae type b', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months (depending on brand)"},{"monthsFromBirth":12,"label":"12-15 months (booster)"}]', '["Haemophilus influenzae type b"]', 'Three or four-dose series.'),
  ('vc_pcv', 'Pneumococcal (PCV)', 'PCV', 'conjugate', 'Pneumococcal disease', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"},{"monthsFromBirth":6,"label":"6 months"},{"monthsFromBirth":12,"label":"12-15 months (booster)"}]', '["PCV13","Prevnar"]', 'Four-dose series.'),
  ('vc_rotavirus', 'Rotavirus', 'Rota', 'live_attenuated', 'Rotavirus gastroenteritis', '[{"monthsFromBirth":2,"label":"2 months"},{"monthsFromBirth":4,"label":"4 months"}]', '["RotaTeq","Rotarix"]', 'Two or three-dose series; first dose must be before 15 weeks.'),
  ('vc_mmr', 'MMR', 'MMR', 'live_attenuated', 'Measles, Mumps, Rubella', '[{"monthsFromBirth":12,"label":"12-15 months"},{"monthsFromBirth":48,"label":"4-6 years (booster)"}]', '["Measles","Mumps","Rubella"]', 'Two-dose series.'),
  ('vc_varicella', 'Varicella', 'Var', 'live_attenuated', 'Chickenpox', '[{"monthsFromBirth":12,"label":"12-15 months"},{"monthsFromBirth":48,"label":"4-6 years (booster)"}]', '["Chickenpox","Varivax"]', 'Two-dose series.'),
  ('vc_hepa', 'Hepatitis A', 'HepA', 'inactivated', 'Hepatitis A', '[{"monthsFromBirth":12,"label":"12-23 months"},{"monthsFromBirth":18,"label":"6 months after first"}]', '["Hep A","HAV"]', 'Two-dose series, 6 months apart.'),
  ('vc_typhoid', 'Typhoid', 'Typhi', 'polysaccharide', 'Typhoid fever', '[{"monthsFromBirth":24,"label":"2 years (single dose)"}]', '["Typhim Vi","Typbar"]', 'Booster every 3 years if at risk.'),
  ('vc_hpv', 'HPV', 'HPV', 'subunit', 'Human Papillomavirus', '[{"monthsFromBirth":132,"label":"11-12 years"},{"monthsFromBirth":144,"label":"2 months after first"},{"monthsFromBirth":168,"label":"6 months after first"}]', '["Gardasil","Cervarix"]', 'Two or three-dose series starting at age 11-12.'),
  ('vc_influenza', 'Influenza', 'Flu', 'inactivated', 'Influenza', '[{"monthsFromBirth":6,"label":"Annual, starting 6 months"}]', '["Flu shot","Quadrivalent"]', 'Annual booster; reformulated yearly.'),
  ('covid19', 'COVID-19', 'COVID', 'mrna', 'COVID-19', '[{"monthsFromBirth":6,"label":"Primary series"},{"monthsFromBirth":12,"label":"Annual booster"}]', '["SARS-CoV-2","Pfizer","Moderna"]', 'Per current WHO guidelines.'),
  ('vc_japanese_encephalitis', 'Japanese Encephalitis', 'JE', 'inactivated', 'Japanese Encephalitis', '[{"monthsFromBirth":12,"label":"12 months"},{"monthsFromBirth":13,"label":"1 month after first"}]', '["JE-Vax"]', 'For travelers to endemic regions.'),
  ('vc_yellow_fever', 'Yellow Fever', 'YF', 'live_attenuated', 'Yellow Fever', '[{"monthsFromBirth":9,"label":"9 months (single dose)"}]', '["YF-Vax","Stamaril"]', 'Required for travel to endemic countries; lifelong protection.'),
  ('vc_rabies', 'Rabies', 'Rab', 'inactivated', 'Rabies', '[{"monthsFromBirth":0,"label":"Post-exposure or pre-exposure series"}]', '["Imovax","RabAvert"]', 'Pre-exposure: 2 doses. Post-exposure: 4-5 doses + immunoglobulin.');

-- ─── Share Links (time-limited doctor access) ─────────────
CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  token TEXT NOT NULL UNIQUE,
  -- JSON: { types?: string[], fromDate?: string, toDate?: string, recordIds?: string[] }
  scope TEXT NOT NULL DEFAULT '{}',
  label TEXT,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_share_links_patient ON share_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_active ON share_links(revoked, expires_at);

-- ─── Share Link Views (audit trail) ───────────────────────
CREATE TABLE IF NOT EXISTS share_link_views (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES share_links(id),
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_share_link_views_link ON share_link_views(link_id);
-- ─── V3: extracted data column on medical records ──
ALTER TABLE medical_records ADD COLUMN extracted_data TEXT;
