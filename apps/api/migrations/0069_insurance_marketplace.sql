-- Migration 0069: Health Insurance Marketplace
-- Adds provider catalog, plans, enrollments, dependents, E-cards,
-- premium invoices, and reimbursement claims with documents + messages.
-- Reuses `operator_orgs` (kind='insurance') + `users.role='insurance'`.
--
-- Table names use `insurance_marketplace_*` prefix for claim/doc/message
-- to avoid clash with the legacy `insurance_claims` patient-policy table
-- (apps/api/src/routes/insurance.ts → packages/db insuranceClaims).

CREATE TABLE IF NOT EXISTS insurance_providers (
  id TEXT PRIMARY KEY,
  operator_org_id TEXT NOT NULL REFERENCES operator_orgs(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  tagline TEXT,
  description TEXT,
  regulator_license TEXT,
  claim_settlement_ratio_pct REAL,
  cashless_hospital_count INTEGER,
  website_url TEXT,
  support_phone TEXT,
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insurance_providers_published_idx
  ON insurance_providers(is_published, rating_avg);

CREATE TABLE IF NOT EXISTS insurance_plans (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES insurance_providers(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK(plan_type IN (
    'individual','family_floater','senior','critical_illness',
    'cancer','dental','maternity'
  )),
  coverage_summary_lkr REAL NOT NULL,
  coverage_details_json TEXT,
  monthly_premium_lkr REAL NOT NULL,
  annual_premium_lkr REAL NOT NULL,
  annual_discount_pct REAL DEFAULT 0,
  deductible_lkr REAL DEFAULT 0,
  copay_pct REAL DEFAULT 0,
  co_payment_cap_lkr REAL DEFAULT 0,
  waiting_period_days INTEGER DEFAULT 30,
  pre_existing_waiting_days INTEGER DEFAULT 365,
  network_hospital_count INTEGER DEFAULT 0,
  key_features_json TEXT,
  exclusions_json TEXT,
  term_months INTEGER NOT NULL DEFAULT 12,
  is_published INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, slug)
);
CREATE INDEX IF NOT EXISTS insurance_plans_published_idx
  ON insurance_plans(provider_id, is_published);
CREATE INDEX IF NOT EXISTS insurance_plans_type_idx
  ON insurance_plans(plan_type, is_published);

CREATE TABLE IF NOT EXISTS insurance_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES insurance_plans(id),
  provider_id TEXT NOT NULL REFERENCES insurance_providers(id),
  policy_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'payment_pending' CHECK(status IN (
    'quote_pending','payment_pending','active','grace',
    'lapsed','cancelled','expired'
  )),
  billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly','annual')),
  premium_amount_lkr REAL NOT NULL,
  coverage_amount_lkr REAL NOT NULL,
  start_date TEXT,
  end_date TEXT,
  next_premium_due_at TEXT,
  last_premium_paid_at TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(kyc_status IN ('pending','verified','rejected')),
  nominee_name TEXT,
  nominee_relation TEXT,
  nominee_dob TEXT,
  dependents_json TEXT,
  payment_id TEXT,
  cancelled_at TEXT,
  cancelled_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insurance_enrollments_user_status_idx
  ON insurance_enrollments(user_id, status);
CREATE INDEX IF NOT EXISTS insurance_enrollments_provider_status_idx
  ON insurance_enrollments(provider_id, status);
CREATE INDEX IF NOT EXISTS insurance_enrollments_next_due_idx
  ON insurance_enrollments(next_premium_due_at, status);

CREATE TABLE IF NOT EXISTS insurance_dependent_members (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES insurance_enrollments(id),
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  nic_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insurance_dependents_enrollment_idx
  ON insurance_dependent_members(enrollment_id);

CREATE TABLE IF NOT EXISTS insurance_premium_invoices (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES insurance_enrollments(id),
  cycle TEXT NOT NULL CHECK(cycle IN ('monthly','annual')),
  amount_lkr REAL NOT NULL,
  due_at TEXT NOT NULL,
  paid_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK(status IN ('open','paid','failed','expired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insurance_invoices_enrollment_status_idx
  ON insurance_premium_invoices(enrollment_id, status);
CREATE INDEX IF NOT EXISTS insurance_invoices_due_status_idx
  ON insurance_premium_invoices(due_at, status);

CREATE TABLE IF NOT EXISTS insurance_ecards (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL UNIQUE REFERENCES insurance_enrollments(id),
  card_number TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_until TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS insurance_ecards_token_idx
  ON insurance_ecards(qr_token);

CREATE TABLE IF NOT EXISTS insurance_marketplace_claims (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES insurance_enrollments(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  provider_id TEXT NOT NULL REFERENCES insurance_providers(id),
  incurring_facility TEXT,
  treatment_type TEXT NOT NULL CHECK(treatment_type IN (
    'hospitalization','day_care','opd','dental','diagnostic','maternity'
  )),
  admission_date TEXT,
  discharge_date TEXT,
  diagnosis TEXT,
  amount_requested_lkr REAL NOT NULL,
  amount_approved_lkr REAL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft','submitted','under_review','more_info_needed',
    'approved','rejected','paid'
  )),
  insurer_remarks TEXT,
  patient_remarks TEXT,
  reviewed_by_user_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  paid_at TEXT,
  transaction_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insurance_mkt_claims_enrollment_status_idx
  ON insurance_marketplace_claims(enrollment_id, status);
CREATE INDEX IF NOT EXISTS insurance_mkt_claims_user_idx
  ON insurance_marketplace_claims(user_id, status);
CREATE INDEX IF NOT EXISTS insurance_mkt_claims_provider_status_idx
  ON insurance_marketplace_claims(provider_id, status);

CREATE TABLE IF NOT EXISTS insurance_marketplace_claim_docs (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES insurance_marketplace_claims(id),
  kind TEXT NOT NULL CHECK(kind IN (
    'bill','discharge_summary','prescription','lab_report','id_proof','other'
  )),
  file_key TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insurance_mkt_claim_docs_claim_idx
  ON insurance_marketplace_claim_docs(claim_id);

CREATE TABLE IF NOT EXISTS insurance_marketplace_claim_messages (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES insurance_marketplace_claims(id),
  sender_user_id TEXT NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK(sender_role IN ('patient','operator')),
  body TEXT NOT NULL,
  attachment_file_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS insurance_mkt_claim_messages_claim_idx
  ON insurance_marketplace_claim_messages(claim_id, created_at);