import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  supabaseId: text("supabase_id").unique(),
  passwordHash: text("password_hash"),
  role: text("role", {
    enum: [
      "patient",
      "doctor",
      "hospital_admin",
      "hospital_staff",
      "laboratory",
      "pharmacy",
      "insurance",
      "ambulance",
      "super_admin",
      "caretaker",
    ],
  }).notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  // P1 bundle 3: PII cipher columns. Set on user create/update by
  // `apps/api/src/lib/pii-cipher.ts`. Plaintext kept for legacy login
  // paths until a migration sweeps values into the cipher columns.
  // Wire format: `pii:v1:<kekId>:<ivB64>:<cipherB64>:<tagB64>`.
  emailPii: text("email_pii"),
  phonePii: text("phone_pii"),
  name: text("name").notNull(),
  nic: text("nic"),
  nicPii: text("nic_pii"),
  // Phase 1.2: bcrypt hash of NIC for soft-verification login. Plain NIC
  // stays in this row for last-mile display only; queries against an
  // unauthenticated caller never read it.
  nicHash: text("nic_hash"),
  dateOfBirth: text("date_of_birth"),
  // Phase 1.2a: how strongly we verified the NIC. "format" passed
  // structural validation (regex + year + day-of-year + female offset);
  // "format+dob" additionally matched the user-supplied DOB against the
  // DOB encoded in the NIC. NULL for legacy rows / no-NIC users.
  nicVerificationLevel: text("nic_verification_level"),
  photo: text("photo"),
  verified: integer("verified", { mode: "boolean" }).default(false),
  // Phase 1.4: per-user personal inbox alias for email-to-record ingestion.
  // Format: `u_<8hex>@records.<domain>`. Generated eagerly on user create;
  // backfilled for legacy rows by migration 0006.
  emailAlias: text("email_alias"),
  // Phase 2.3: server-cached "Acting as …" context. NULL = principal
  // patient (historical default). Set via PATCH /family/active; read by
  // the family-context middleware to scope list filters + POST defaults.
  // Mobile also persists this in secureStorage for offline-first boot.
  // Note: `as any` cast on the references callback breaks a TS inference
  // cycle — `users → familyMembers → patients → users` — that TS can't
  // resolve via the lazy-callback pattern alone.
  activeFamilyMemberId: text("active_family_member_id").references(
    ((): any => familyMembers.id)
  ),
  // Caretaker Profiles: durable active-principal pointer. NULL for
  // non-caretaker users. Set via PATCH /caretaker/me/active-principal;
  // read by the caretaker-context middleware to scope list filters +
  // POST defaults (mirror of activeFamilyMemberId).
  activePrincipalPatientId: text("active_principal_patient_id").references(
    (): any => patients.id
  ),
  // Phase 2.2.1: durable locale preference. Mobile PATCHes this on
  // every locale change so crons + share-link consumers see the right
  // language without relying on a per-request Accept-Language header.
  // NULL = "en" (the safe default for legacy rows).
  preferredLocale: text("preferred_locale"),
  // Phase MTN-1 (Multi-Tenant Network): server-side durable active-tenant
  // pointer. Mirror of `activeFamilyMemberId` for hospital/clinic scope.
  // Mobile PATCHes both header (per-request) and column (durable). Header
  // wins when present; otherwise the column is consulted. NULL = no
  // active tenant (header-less or legacy client).
  activeTenantType: text("active_tenant_type", {
    enum: ["hospital", "clinic"],
  }),
  activeTenantId: text("active_tenant_id"),
  // Phase ADM-1: account lifecycle state.
  //   pending   — registered for a gated role; awaiting super_admin approval
  //   active    — approved + able to log in (default for legacy rows)
  //   suspended — temporarily disabled by an admin; can be unsuspended
  //   rejected  — application denied; cannot re-register with same identity
  status: text("status", {
    enum: ["pending", "active", "suspended", "rejected"],
  })
    .notNull()
    .default("active"),
  approvedByUserId: text("approved_by_user_id").references((): any => users.id),
  approvedAt: text("approved_at"),
  rejectedAt: text("rejected_at"),
  rejectionReason: text("rejection_reason"),
  suspendedByUserId: text("suspended_by_user_id").references((): any => users.id),
  suspendedAt: text("suspended_at"),
  suspendedReason: text("suspended_reason"),
  // Phase ADM-2: scope insurance/ambulance operators to their org.
  // super_admin may leave this NULL for cross-org view.
  operatorOrgId: text("operator_org_id"),
  // Phase ADM-3: track last successful login. Set by /auth/login +
  // /login-by-nic + /verify-otp when the JWT is minted. NULL for
  // legacy rows that never logged in post-deploy.
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
},
(t) => ({
  emailAliasUnique: uniqueIndex("users_email_alias_unique").on(t.emailAlias),
  activeTenantIdx: index("users_active_tenant_idx").on(
    t.activeTenantType,
    t.activeTenantId
  ),
  // Phase ADM-1: approvals queue + admin filters scan by (status, role).
  statusRoleIdx: index("users_status_role_idx").on(t.status, t.role),
  createdAtIdx: index("users_created_at_idx").on(t.createdAt),
}));

// ─── OTP codes (Phase 1.2) ────────────────────────────────
// 6-digit numeric code, bcrypt-hashed at rest. Used by /auth/send-otp and
// /auth/verify-otp. Single-use, 5-minute TTL.
export const otpCodes = sqliteTable("otp_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  channel: text("channel", { enum: ["mobile", "email"] }).notNull(),
  target: text("target").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Patients ────────────────────────────────────────────
export const patients = sqliteTable("patients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  bloodGroup: text("blood_group"),
  height: real("height"),
  weight: real("weight"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  allergies: text("allergies"), // JSON array
  medicalConditions: text("medical_conditions"), // JSON array
  emergencyContacts: text("emergency_contacts"), // JSON array
  lifestyle: text("lifestyle"), // JSON: { smoking, alcohol, exercise }
  insuranceId: text("insurance_id"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Family Members ──────────────────────────────────────
export const familyMembers = sqliteTable("family_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  name: text("name").notNull(),
  relationship: text("relationship").notNull(), // father, mother, child, grandparent
  dateOfBirth: text("date_of_birth"),
  bloodGroup: text("blood_group"),
  allergies: text("allergies"),
  medicalConditions: text("medical_conditions"),
  phone: text("phone"),
  isManagedBy: text("managed_by").references(() => patients.id), // for children managed by parents
  // V3: hereditary tracking
  conditions: text("conditions"), // JSON array of condition strings
  isDeceased: integer("is_deceased", { mode: "boolean" }).default(false),
  causeOfDeath: text("cause_of_death"),
  notes: text("notes"),
  // Phase 2.3.3: family-member privacy lock. When true, the principal's
  // family-context queries (medical records, vitals, medicines, vaccinations)
  // return a [locked] placeholder for records tagged to this member. The
  // member themselves can still switch into their own FM context and read
  // everything — the lock is from the *principal's view*, not the member's.
  // `lockedBy` records which user (always the principal today, but column
  // future-proofs for member-self-locking via their own account) flipped
  // the switch. `lockedAt` is the timestamp.
  isLocked: integer("is_locked", { mode: "boolean" }).default(false),
  lockedBy: text("locked_by").references((): any => users.id),
  lockedAt: text("locked_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Hospitals ───────────────────────────────────────────
export const hospitals = sqliteTable("hospitals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  license: text("license"),
  address: text("address"),
  phone: text("phone"),
  location: text("location"), // JSON: { lat, lng }
  specializations: text("specializations"), // JSON array
  rating: real("rating"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Doctors ─────────────────────────────────────────────
export const doctors = sqliteTable(
  "doctors",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    hospitalId: text("hospital_id").references(() => hospitals.id),
    specialization: text("specialization").notNull(),
    registrationNumber: text("registration_number"),
    qualification: text("qualification"),
    experience: integer("experience"), // years
    consultationFee: real("consultation_fee"),
    availableSlots: text("available_slots"), // JSON array
    rating: real("rating"),
    // Doctor Booking (Round 6): opt-in flag for video consultations.
    // When 0, `POST /appointments` rejects `mode=video` with 409
    // `reason: telemedicine_unavailable` and the mobile mode chooser
    // hides the video card. Default 0 so existing doctors stay
    // in-person-only until an admin or seed script opts them in.
    telemedicineEnabled: integer("telemedicine_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    // Phase 3.1: SLMC compliance. `slmc_registration_no` is the official
    // Sri Lanka Medical Council number; `slmc_verified_at` is set by our
    // manual review pass (NULL until verified). No external API exists
    // yet — until SLMC publishes one, verification is a flag, not a call.
    slmcRegistrationNo: text("slmc_registration_no"),
    slmcVerifiedAt: text("slmc_verified_at"),
    // Phase E-Rx 6: RSA-2048 signing keypair, generated server-side on first
    // sign attempt (see `apps/api/src/lib/signing.ts`). `signing_public_key`
    // is the SPKI PEM plaintext (served by GET /verify). `signing_private_key_enc`
    // wraps the PKCS#8 PEM with AES-256-GCM using the Workers Secret
    // DOCTOR_KEY_KEK as the KEK; format `v1:<iv_b64>:<ct_b64>` where ct
    // includes the appended auth tag. `signing_key_id` is a UUIDv4 generated
    // alongside — used as a rotation handle. Historical `prescription_signatures`
    // denormalise the public key on the signature row, so old keys may be
    // rotated without invalidating prior signatures.
    signingPublicKey: text("signing_public_key"),
    signingPrivateKeyEnc: text("signing_private_key_enc"),
    signingKeyId: text("signing_key_id"),
    signingKeyCreatedAt: text("signing_key_created_at"),
    signingKeyRevokedAt: text("signing_key_revoked_at"),
    // Phase MFA (Round 2 P0): TOTP-based second factor for doctors.
    // `mfaSecretEnc` is the AES-256-GCM ciphertext of the otplib base32
    // secret, wrapped under env.MFA_SECRET_KEK. `mfaEnabled` flips 0→1
    // only after the user verifies their first TOTP token. Recovery
    // codes are SHA-256(pepper + code) hashes, comma-separated; used
    // codes are kept in `mfaRecoveryUsedCodes` for one-time semantics.
    mfaSecretEnc: text("mfa_secret_enc"),
    mfaEnabled: integer("mfa_enabled").default(0).notNull(),
    mfaRecoveryCodesHash: text("mfa_recovery_codes_hash"),
    mfaRecoveryUsedCodes: text("mfa_recovery_used_codes"),
    mfaEnrolledAt: text("mfa_enrolled_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    // Partial unique — multiple NULL rows are allowed (only verified /
    // pending doctors have a number).
    slmcRegistrationNoUnique: uniqueIndex(
      "idx_doctors_slmc_registration_no"
    ).on(t.slmcRegistrationNo),
  })
);

// ─── Medical Records ─────────────────────────────────────
export const medicalRecords = sqliteTable(
  "medical_records",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    hospitalId: text("hospital_id").references(() => hospitals.id),
    doctorId: text("doctor_id").references(() => doctors.id),
    recordType: text("record_type", {
      enum: [
        "lab_report",
        "imaging",
        "prescription",
        "hospital_visit",
        "vaccination",
        "surgery",
        "allergy",
        "insurance",
        "fitness",
        "discharge_summary",
        "medical_certificate",
        "operation_note",
        "invoice",
        "clinical_note",
        "lab_order",
        "follow_up",
        // Phase 2.1: bucket for AI-unclassifiable records (e.g. binary
        // images awaiting a vision model, or low-confidence inferences).
        // User can manually override via PATCH /medical-records/:id.
        "other",
      ],
    }).notNull(),
    title: text("title").notNull(),
    diagnosis: text("diagnosis"),
    summary: text("summary"),
    notes: text("notes"),
    extractedData: text("extracted_data"), // V3: JSON for OCR / AI extraction
    date: text("date").notNull(),
    followUpDate: text("follow_up_date"),
    status: text("status", {
      enum: ["pending", "completed", "cancelled"],
    }).default("pending"),
    // V4: manageability + searchability
    tags: text("tags"), // JSON array of lowercase strings
    archivedAt: text("archived_at"), // ISO timestamp; NULL = active
    familyMemberId: text("family_member_id").references(() => familyMembers.id),
    // Phase 1.4: how this record entered the locker.
    //   "user_upload" | "doctor" | "email-alias" | "email-from"
    source: text("source"),
    // Phase 1.4: dedupe key for CF Email Routing retries. NULL for non-email
    // records. Unique index rejects duplicate inserts from the same event.
    emailMessageId: text("email_message_id"),
    // Phase v3: unified envelope + tamper-evidence chain
    kind: text("kind"), // registry key (e.g. "lab_report") — added in 0029
    encryptedPayload: text("encrypted_payload"),
    encryptedPayloadKekId: text("encrypted_payload_kek_id"),
    encryptedPayloadDekWrapped: text("encrypted_payload_dek_wrapped"),
    iv: text("iv"),
    authTag: text("auth_tag"),
    envelopeVersion: text("envelope_version"),
    schemaVersion: text("schema_version"),
    rehashedAt: text("rehashed_at"),
    prevRecordHash: text("prev_record_hash"),
    lockedByUserId: text("locked_by_user_id"),
    lockedUntil: text("locked_until"),
    // Day 3 #4: embedding blob for duplicate-record detection. Stored
    // as JSON `{dim, data: number[]}` (Float32 → number[]). NULL until
    // the upload pipeline runs the bge-small embedder.
    embedding: text("embedding"),
    embeddingModel: text("embedding_model"),
    embeddedAt: text("embedded_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    familyMemberIdx: index("idx_medical_records_family_member").on(
      t.familyMemberId
    ),
    patientArchivedDateIdx: index(
      "idx_medical_records_patient_archived_date"
    ).on(t.patientId, t.archivedAt, t.date),
    emailMessageIdUnique: uniqueIndex(
      "medical_records_email_message_id_unique"
    ).on(t.emailMessageId),
  })
);

// ─── Files (Medical Attachments) ─────────────────────────
export const files = sqliteTable("files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordId: text("record_id").references(() => medicalRecords.id), // nullable for standalone uploads
  url: text("url").notNull(),
  r2Key: text("r2_key"), // R2 object key
  type: text("type").notNull(), // pdf, image, mri, ct, xray, dicom, audio, video
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Medicines ───────────────────────────────────────────
export const medicines = sqliteTable(
  "medicines",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    prescriptionId: text("prescription_id").references(() => prescriptions.id),
    name: text("name").notNull(),
    dosage: text("dosage").notNull(),
    frequency: text("frequency"), // once daily, twice daily, etc.
    timing: text("timing"), // before food, after food
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    refillReminder: integer("refill_reminder", { mode: "boolean" }).default(false),
    notes: text("notes"),
    active: integer("active", { mode: "boolean" }).default(true),
    familyMemberId: text("family_member_id").references(() => familyMembers.id),
    // Phase E-Rx 1: optional FK into `medicines_master`. Nullable — every
    // existing free-text row stays valid; back-fill is a separate script
    // and out of scope here. The lookup path is `name` (free-text) for
    // back-compat; new prescriptions can use the master link for safety
    // checks + autocomplete.
    masterMedicineId: text("master_medicine_id").references(
      (): any => medicinesMaster.id
    ),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    familyMemberIdx: index("idx_medicines_family_member").on(t.familyMemberId),
    masterMedicineIdx: index("idx_medicines_master_medicine").on(
      t.masterMedicineId
    ),
  })
);

// ─── Prescriptions ───────────────────────────────────────
export const prescriptions = sqliteTable("prescriptions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  hospitalId: text("hospital_id").references(() => hospitals.id),
  diagnosis: text("diagnosis"),
  notes: text("notes"),
  date: text("date").notNull(),
  // Phase E-Rx 6: lifecycle. Default "draft" — only the /sign endpoint may
  // flip to "signed"; a future pharmacy claim would flip to "dispensed".
  status: text("status", {
    enum: ["draft", "signed", "cancelled", "dispensed"],
  })
    .notNull()
    .default("draft"),
  // Lazy `(): any => ...` breaks the forward-reference cycle with
  // `prescriptionSignatures` (defined below). Same pattern as
  // `users.activeFamilyMemberId` above.
  signatureId: text("signature_id").references(
    (): any => prescriptionSignatures.id
  ),
  signedAt: text("signed_at"),
  signedPayloadHash: text("signed_payload_hash"),
  // Phase E-Rx 8: lifecycle timestamps written by the cancel/dispense
  // routes + withStatusGuard (which always touches updated_at).
  cancelledAt: text("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  dispensedAt: text("dispensed_at"),
  updatedAt: text("updated_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  // E-Rx one-time-use redemption (migration 0059). Sign route mints a
  // 32-byte base64url `dispense_token` and embeds it in the signed
  // PDF's QR URL. Pharmacy dispense atomically consumes it in the same
  // UPDATE that flips status → dispensed (guard clauses on both
  // `dispense_token` = input AND `dispense_token_consumed_at` IS NULL),
  // so a QR photocopy presented at a second pharmacy 409s with
  // `token_consumed`. See apps/api/src/routes/signature.ts (/sign,
  // /verify) + apps/api/src/routes/pharmacy.ts (dispense).
  dispenseToken: text("dispense_token"),
  dispenseTokenConsumedAt: text("dispense_token_consumed_at"),
  // Pharmacy operator who consumed the token (FK → users.id). Role
  // check at the route layer confirms role='pharmacy'.
  dispensedByUserId: text("dispensed_by_user_id").references(
    (): any => users.id
  ),
  // Denormalised pharmacy display name for the public /verify surface.
  // Saved at consume time so /verify/<id> doesn't need to join users
  // + a (non-existent) pharmacies table to render the redemption line.
  dispensedByPharmacyName: text("dispensed_by_pharmacy_name"),
}, (t) => ({
  patientDoctorIdx: index("prescriptions_patient_doctor_idx").on(t.patientId, t.doctorId),
  doctorDateIdx: index("prescriptions_doctor_date_idx").on(t.doctorId, t.date),
}));

// ─── Lab Reports ─────────────────────────────────────────
export const labReports = sqliteTable("lab_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  labId: text("lab_id")
    .notNull()
    .references(() => users.id),
  recordId: text("record_id").references(() => medicalRecords.id),
  reportType: text("report_type").notNull(),
  status: text("status", {
    enum: ["pending", "sample_collected", "in_progress", "completed", "cancelled"],
  }).default("pending"),
  pdfUrl: text("pdf_url"),
  aiSummary: text("ai_summary"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Appointments ────────────────────────────────────────
export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  hospitalId: text("hospital_id")
    .notNull()
    .references(() => hospitals.id),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status", {
    enum: ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"],
  }).default("scheduled"),
  queueNumber: integer("queue_number"),
  waitingTime: integer("waiting_time"), // minutes
  reason: text("reason"),
  notes: text("notes"),
  paymentAmount: real("payment_amount"),
  paymentStatus: text("payment_status", {
    enum: ["pending", "paid", "refunded", "insurance"],
  }).default("pending"),
  reminderSent: integer("reminder_sent", { mode: "boolean" }).default(false),
  // Round 5: patient-requested consultation mode. Drives (a) which
  // "Join video visit" CTA surfaces on the mobile appointment screens
  // and (b) the doctor's queue pill. Backed by a CHECK in
  // migrations/0054_appointments_mode.sql. Drizzle enum mirrors DB.
  mode: text("mode", { enum: ["in_person", "video"] })
    .notNull()
    .default("in_person"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  // Round 6: bumped by the `appointments_set_updated_at` SQLite
  // trigger on every UPDATE. Drives the SSE appointment poller's
  // cursor (see apps/api/src/routes/realtime.ts). Without this, the
  // poller couldn't catch status flips / queue compactor / payment
  // confirmations because `created_at` only changes on insert.
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  // Round 3 P1: post-visit summary email + 1-tap rating. `summaryEmailSentAt`
  // is stamped by both the inline trigger (doctor-portal status flip)
  // and the hourly cron — whichever wins, the other sees the stamp and
  // skips. `ratingPromptedAt` is informational: incremented the first
  // time the patient sees the rating CTA on the appointment detail.
  summaryEmailSentAt: text("summary_email_sent_at"),
  ratingPromptedAt: text("rating_prompted_at"),
  // Tier 1 records PR3: pre-visit summary delivery tracking. The cron
  // (apps/api/src/cron/pre-visit-summary.ts) scans appointments whose
  // window is ~1h ahead and stamps `preVisitSummarySentAt` after a
  // successful send. `preVisitSummarySentVia` records the channel so
  // we can tell 'email' from 'push' later without re-deriving.
  preVisitSummarySentAt: text("pre_visit_summary_sent_at"),
  preVisitSummarySentVia: text("pre_visit_summary_sent_via"),
}, (t) => ({
  doctorDateTimeIdx: index("appointments_doctor_date_time_idx").on(
    t.doctorId,
    t.date,
    t.time
  ),
  patientDateIdx: index("appointments_patient_date_idx").on(t.patientId, t.date),
  doctorDateIdx: index("appointments_doctor_date_idx").on(t.doctorId, t.date),
  // Round 5: filter "today's video appointments" cheaply on both the
  // doctor portal queue and the patient's "join video visit" CTA check.
  doctorModeIdx: index("appointments_doctor_mode_idx").on(
    t.doctorId,
    t.mode,
    t.date,
    t.time
  ),
}));

// ─── Appointment Ratings (Round 3 P1) ────────────────────
// One row per completed appointment. UPSERT semantics in the POST handler
// keyed on `appointment_id` so the patient can edit their rating once.
// Stars are 1-5; the application layer validates before insert.
export const appointmentRatings = sqliteTable(
  "appointment_ratings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    appointmentId: text("appointment_id").notNull(),
    patientId: text("patient_id").notNull(),
    doctorId: text("doctor_id").notNull(),
    stars: integer("stars").notNull(),
    comment: text("comment"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    appointmentUnique: uniqueIndex(
      "appointment_ratings_appointment_id_unique"
    ).on(t.appointmentId),
    doctorCreatedIdx: index("idx_appointment_ratings_doctor_created").on(
      t.doctorId,
      t.createdAt
    ),
  })
);

// ─── Teleconsult Sessions (Round 4: in-app video) ────────
// One row per video call. Doctor creates from an appointment (status
// `requested`), flips to `ringing` when the doctor opens the room,
// then `active` once the first peer WebSocket connects (which also
// flips the appointment `status` to `in_progress`). Either side can
// end the call; if both peers disconnect the DO times out the room
// after 60s and stamps `status = 'timeout'`.
//
// Multiple sessions per appointment are allowed (rescheduled calls,
// dropped attempts), but the partial unique index below ensures at
// most ONE live row per appointment at any time.
export const teleconsultSessions = sqliteTable(
  "teleconsult_sessions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => users.id),
    // patient user id (NOT patients.id) — denormalized so the WS auth
    // path can verify "is this peer the right participant" without a
    // join. The doctor-side row fetch joins patients.id separately.
    patientUserId: text("patient_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", {
      enum: ["requested", "ringing", "active", "ended", "failed", "timeout"],
    })
      .notNull()
      .default("requested"),
    // The roomId is also the DO instance name (TeleconsultRoom.idFromName
    // → namespace.get). Independent of `id` so a row can be re-created
    // against the same appointment without colliding prior rooms.
    roomId: text("room_id").notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    durationSec: integer("duration_sec"),
    signalingMsgCount: integer("signaling_msg_count").notNull().default(0),
    iceRestartCount: integer("ice_restart_count").notNull().default(0),
    lastError: text("last_error"),
    wherebyRoomUrl: text("whereby_room_url"),
    wherebyHostRoomUrl: text("whereby_host_room_url"),
  },
  (t) => ({
    apptIdx: index("teleconsult_sessions_appt_idx").on(t.appointmentId, t.createdAt),
    doctorRecentIdx: index("teleconsult_sessions_doctor_recent_idx").on(t.doctorId, t.createdAt),
    patientRecentIdx: index("teleconsult_sessions_patient_recent_idx").on(t.patientUserId, t.createdAt),
    // At most one live row per appointment (requested | ringing | active).
    // Partial unique index — D1 supports it via `WHERE`.
    oneLivePerAppt: uniqueIndex("teleconsult_sessions_one_live_per_appt").on(
      t.appointmentId
    ).where(sql`status IN ('requested','ringing','active')`),
  }),
);

// ─── Insurance ───────────────────────────────────────────
export const insurance = sqliteTable("insurance", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  providerName: text("provider_name").notNull(),
  policyNumber: text("policy_number").notNull(),
  coverageType: text("coverage_type"),
  expiryDate: text("expiry_date"),
  maxCoverage: real("max_coverage"),
  documents: text("documents"), // JSON array of file URLs
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Insurance Claims ────────────────────────────────────
export const insuranceClaims = sqliteTable("insurance_claims", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  insuranceId: text("insurance_id")
    .notNull()
    .references(() => insurance.id),
  hospitalId: text("hospital_id").references(() => hospitals.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  amount: real("amount").notNull(),
  status: text("status", {
    enum: ["submitted", "under_review", "approved", "rejected", "paid"],
  }).default("submitted"),
  documents: text("documents"), // JSON array
  notes: text("notes"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Notifications ───────────────────────────────────────
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type", {
    enum: [
      "medicine",
      "appointment",
      "lab_ready",
      "prescription",
      "insurance",
      "hospital",
      "emergency",
      "vaccination",
      "general",
      // Phase ADM-1: super_admin notifications for new gated-role
      // applications awaiting approval.
      "account_pending_review",
      "tenant_pending_review",
      "hospital_request",
    ],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: text("data"), // JSON: additional payload
  read: integer("read", { mode: "boolean" }).default(false),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Emergency ───────────────────────────────────────────
export const emergencies = sqliteTable("emergencies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  location: text("location").notNull(), // JSON: { lat, lng }
  status: text("status", {
    enum: ["active", "responding", "resolved", "cancelled"],
  }).default("active"),
  nearestHospitalId: text("nearest_hospital_id").references(() => hospitals.id),
  ambulanceId: text("ambulance_id").references(() => users.id),
  notes: text("notes"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Medicine Doses (adherence log) ──────────────────────
export const medicineDoses = sqliteTable("medicine_doses", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  medicineId: text("medicine_id")
    .notNull()
    .references(() => medicines.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  scheduledFor: text("scheduled_for").notNull(), // ISO timestamp
  takenAt: text("taken_at"), // ISO timestamp; null if skipped
  skipped: integer("skipped", { mode: "boolean" }).default(false),
  notes: text("notes"),
  // F1: set by dose-reminders cron after the reminder notification is
  // dispatched. null = not yet reminded. Used as the dedup flag so the
  // 5-min cron doesn't re-notify on the next pass.
  notifiedAt: text("notified_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Vitals (longitudinal health metrics) ────────────────
export const vitals = sqliteTable("vitals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  type: text("type", {
    enum: [
      "blood_pressure",
      "blood_sugar",
      "weight",
      "height",
      "heart_rate",
      "temperature",
      "spo2",
      "cholesterol",
      "respiratory_rate",
      "hrv_rmssd",
      "body_fat_pct",
      "waist_circumference",
      "hip_circumference",
      "pain_scale",
      "peak_flow",
    ],
  }).notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  // For BP (systolic/diastolic pair)
  secondaryValue: real("secondary_value"),
  // Surrounding context (e.g. fasting, post-meal, post-exercise) — affects
  // classification thresholds. Free text for flexibility, app layer validates
  // against the VITAL_CONTEXTS enum in @healthcare/shared/vitals.
  context: text("context"),
  recordedAt: text("recorded_at").notNull(),
  source: text("source").default("manual"), // manual, device, imported, apple_health, google_fit
  notes: text("notes"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Symptoms Log ────────────────────────────────────────
export const symptoms = sqliteTable("symptoms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  symptom: text("symptom").notNull(),
  severity: text("severity", {
    enum: ["mild", "moderate", "severe"],
  }).default("mild"),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  notes: text("notes"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Patient Notes (free-text journal) ───────────────────
export const patientNotes = sqliteTable("patient_notes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  title: text("title"),
  body: text("body").notNull(),
  pinned: integer("pinned", { mode: "boolean" }).default(false),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Doctor Availability (working hours + slots) ─────────
export const doctorAvailability = sqliteTable("doctor_availability", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "17:00"
  slotMinutes: integer("slot_minutes").default(30),
  active: integer("active", { mode: "boolean" }).default(true),
});

// ─── Push Tokens (FCM/APNs registration) ────────────────
export const pushTokens = sqliteTable("push_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull(),
  platform: text("platform", { enum: ["ios", "android", "web"] }).notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Notification Preferences (per user per type) ────────
export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type", {
    enum: [
      "medicine",
      "appointment",
      "lab_ready",
      "prescription",
      "insurance",
      "hospital",
      "emergency",
      "vaccination",
      "general",
      "hospital_request",
    ],
  }).notNull(),
  inApp: integer("in_app", { mode: "boolean" }).default(true).notNull(),
  push: integer("push", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Doctor Time Off (vacation / sick / conference) ─────
export const doctorTimeOff = sqliteTable("doctor_time_off", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time"), // HH:MM, null = all day
  endTime: text("end_time"), // HH:MM, null = all day
  reason: text("reason"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Walk-ins (front-desk check-in, OPD) ────────────────
export const walkIns = sqliteTable("walk_ins", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  hospitalId: text("hospital_id")
    .notNull()
    .references(() => hospitals.id),
  reason: text("reason"),
  priority: text("priority", { enum: ["routine", "urgent"] })
    .default("routine")
    .notNull(),
  status: text("status", {
    enum: ["waiting", "in_consultation", "completed", "no_show"],
  })
    .default("waiting")
    .notNull(),
  arrivedAt: text("arrived_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  consultationEndedAt: text("consultation_ended_at"),
  assignedByUserId: text("assigned_by_user_id").references(() => users.id),
  notes: text("notes"),
  // QR-Code Check-in: stamps where this walk-in came from. Mobile
  // filters the realtime stream to `origin === "qr_scan"` for the
  // "you're checked in" toast. Manual front-desk entries leave it
  // null.
  origin: text("origin", { enum: ["manual", "qr_scan"] }).default("manual"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (t) => ({
  patientDoctorIdx: index("walk_ins_patient_doctor_idx").on(t.patientId, t.doctorId),
  doctorStatusIdx: index("walk_ins_doctor_status_idx").on(t.doctorId, t.status),
}));

// ─── Appointment Status History (audit) ─────────────────
export const appointmentStatusHistory = sqliteTable(
  "appointment_status_history",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedByUserId: text("changed_by_user_id").references(() => users.id),
    reason: text("reason"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }
);

// ─── Password Reset Tokens ───────────────────────────────
export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Audit Log ───────────────────────────────────────────
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  // Caretaker Profiles: actor_user_id records the human who actually
  // performed the action when it differs from `userId` (which remains
  // the data subject). E.g. caretaker writes a medicine on behalf of a
  // principal → userId = principal.userId, actorUserId = caretaker.userId.
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  details: text("details"), // JSON
  ip: text("ip"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V2: Wards (Hospital ops) ─────────────────────────────
export const wards = sqliteTable("wards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hospitalId: text("hospital_id")
    .notNull()
    .references(() => hospitals.id),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["general", "icu", "pediatric", "maternity", "surgical", "emergency"],
  }).notNull(),
  capacity: integer("capacity").notNull(),
  floor: integer("floor"),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V2: Beds ─────────────────────────────────────────────
export const beds = sqliteTable("beds", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  wardId: text("ward_id")
    .notNull()
    .references(() => wards.id),
  bedNumber: text("bed_number").notNull(),
  status: text("status", {
    enum: ["available", "occupied", "cleaning", "maintenance", "reserved"],
  })
    .default("available")
    .notNull(),
  notes: text("notes"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V2: Bed Assignments ─────────────────────────────────
export const bedAssignments = sqliteTable("bed_assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  bedId: text("bed_id")
    .notNull()
    .references(() => beds.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  assignedAt: text("assigned_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  dischargedAt: text("discharged_at"),
  assignedBy: text("assigned_by").references(() => users.id),
  notes: text("notes"),
});

// ─── V2: Hospital Staff ──────────────────────────────────
export const hospitalStaff = sqliteTable("hospital_staff", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hospitalId: text("hospital_id")
    .notNull()
    .references(() => hospitals.id),
  userId: text("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  role: text("role", {
    enum: ["nurse", "receptionist", "technician", "manager", "housekeeping", "security"],
  }).notNull(),
  shift: text("shift", {
    enum: ["morning", "evening", "night", "rotating"],
  })
    .default("morning")
    .notNull(),
  phone: text("phone"),
  email: text("email"),
  // HOS-6: optional department assignment. Departments themselves
  // are added below as a new table.
  departmentId: text("department_id"),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Phase 3.1 slice 3: hospital staff invites ────────────
// Token-based onboarding. Admin generates a row, shares the deep
// link, recipient registers (or signs in), server consumes the
// token and links hospitalStaff.userId to the recipient's users.id.
// Mirror the family-invite pattern (apps/api/src/routes/family-invites.ts).
export const hospitalStaffInvites = sqliteTable(
  "hospital_staff_invites",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    role: text("role", {
      enum: ["nurse", "receptionist", "technician", "manager", "housekeeping", "security"],
    }).notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    consumedByUserId: text("consumed_by_user_id").references(() => users.id),
    revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    hospitalIdx: index("idx_hospital_staff_invites_hospital").on(
      t.hospitalId,
      t.createdAt
    ),
  })
);

// ─── V2: Lab Orders (Doctor → Lab) ───────────────────────
export const labOrders = sqliteTable("lab_orders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  doctorId: text("doctor_id")
    .notNull()
    .references(() => doctors.id),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  hospitalId: text("hospital_id").references(() => hospitals.id),
  tests: text("tests").notNull(), // JSON array of test names/codes
  priority: text("priority", {
    enum: ["routine", "urgent", "stat"],
  })
    .default("routine")
    .notNull(),
  status: text("status", {
    enum: [
      "ordered",
      "sample_collected",
      "in_progress",
      "completed",
      "cancelled",
    ],
  })
    .default("ordered")
    .notNull(),
  notes: text("notes"),
  orderedAt: text("ordered_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  completedAt: text("completed_at"),
  resultUrl: text("result_url"),
  resultSummary: text("result_summary"),
}, (t) => ({
  patientDoctorIdx: index("lab_orders_patient_doctor_idx").on(t.patientId, t.doctorId),
}));

// ─── V2: AI Cache ────────────────────────────────────────
export const aiCache = sqliteTable("ai_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  kind: text("kind", {
    enum: [
      "summary",
      "lab_explain",
      "drug_interaction",
      "chat",
      "ocr",
      "clinical_note_summary",
      "lab_trend",
      "soap_draft",
      "suggest_record_type",
      "pre_visit_summary",
    ],
  }).notNull(),
  inputHash: text("input_hash").notNull(),
  output: text("output").notNull(), // JSON
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  ttlAt: text("ttl_at").notNull(),
});

// ─── P1: AI Call Telemetry ──────────────────────────────
//
// One row per AI invocation. Tracks who called which model, latency,
// cached-hit status, and any error message. No token counts — Workers
// AI doesn't surface them through the binding today. Drives:
//   - per-user spend caps (aggregate latencyMs × model weight)
//   - audit ("why did Dr. X's summary fire?" → grep aiCalls.userId)
//   - rate-limit analytics
// Retention: 30 days. Cron purge lives outside this PR.
export const aiCalls = sqliteTable("ai_calls", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  kind: text("kind", {
    enum: [
      "summary",
      "lab_explain",
      "drug_interaction",
      "chat",
      "ocr",
      "classify",
      "lab_trend",
      "soap_draft",
      "suggest_record_type",
      "pre_visit_summary",
    ],
  }).notNull(),
  userId: text("user_id").references(() => users.id),
  patientId: text("patient_id").references(() => patients.id),
  model: text("model").notNull(),
  cachedHit: integer("cached_hit", { mode: "boolean" }).notNull().default(false),
  latencyMs: integer("latency_ms").notNull().default(0),
  status: text("status", { enum: ["ok", "error", "timeout", "fallback"] })
    .notNull()
    .default("ok"),
  errorMessage: text("error_message"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V2: Chat Sessions (Health Q&A) ──────────────────────
export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  patientId: text("patient_id").references(() => patients.id),
  title: text("title").notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V2: Chat Messages ───────────────────────────────────
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .notNull()
    .references(() => chatSessions.id),
  role: text("role", {
    enum: ["user", "assistant", "system"],
  }).notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V3: Allergies (structured) ───────────────────────────
export const allergies = sqliteTable("allergies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  substance: text("substance").notNull(),
  severity: text("severity", {
    enum: ["mild", "moderate", "severe", "critical"],
  }).notNull(),
  reaction: text("reaction"),
  onsetDate: text("onset_date"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V3: Vaccine Catalog (WHO/EPI reference) ─────────────
export const vaccineCatalog = sqliteTable("vaccine_catalog", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  shortName: text("short_name"),
  category: text("category"),
  targetDisease: text("target_disease"),
  schedule: text("schedule").notNull(), // JSON array of { monthsFromBirth, label }
  aliases: text("aliases"), // JSON array
  notes: text("notes"),
  // Phase 2.2.1: localized names + target disease. English stays in
  // the original columns; cron picks based on users.preferredLocale.
  // Nullable for backward compatibility with the seeded catalog.
  nameSi: text("name_si"),
  nameTa: text("name_ta"),
  targetDiseaseSi: text("target_disease_si"),
  targetDiseaseTa: text("target_disease_ta"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Phase 2.2: Vaccination reminder dedupe ──────────────
// One row per (patient × catalog vaccine × schedule-index) once a slot
// enters the 30-day reminder window. Cron worker stamps
// `reminderSentAt` + increments `remindedCount` so we don't double-push
// across runs. Capped at 2 pushes per slot (early + final).
export const vaccineReminders = sqliteTable("vaccine_reminders", {
  id: text("id").primaryKey(),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  vaccineId: text("vaccine_id")
    .notNull()
    .references(() => vaccineCatalog.id),
  doseIndex: integer("dose_index").notNull(),
  dueDate: text("due_date").notNull(),
  reminderSentAt: text("reminder_sent_at"),
  remindedCount: integer("reminded_count").notNull().default(0),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V3: Share Links (time-limited doctor access) ───────
// Phase 2.3.1: `kind` discriminates record-share vs family-invite so the
// table can host both without a parallel table. `consumedAt` + `redeemedByUserId`
// are invite-only lifecycle fields (NULL for record-share rows).
export const shareLinks = sqliteTable(
  "share_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    token: text("token").notNull().unique(),
    scope: text("scope").notNull().default("{}"),
    label: text("label"),
    expiresAt: text("expires_at").notNull(),
    revoked: integer("revoked", { mode: "boolean" }).default(false),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastViewedAt: text("last_viewed_at"),
    // Phase 2.3.1: invite discriminator + lifecycle.
    kind: text("kind").notNull().default("record_share"),
    consumedAt: text("consumed_at"),
    redeemedByUserId: text("redeemed_by_user_id").references(
      (): any => users.id
    ),
    // Phase 2.3: scope a share link to one family member. NULL = household
    // / principal (today's full-bundle behavior). Set = the public bundle
    // exposes only that member's medicines + records. See GET /share/:token.
    familyMemberId: text("family_member_id").references(
      (): any => familyMembers.id
    ),
    // Round 3 P1: prescription-share-with-doctor. When `kind` is
    // "prescription_share" this column carries the prescriptionId
    // the link exposes; the public GET /share/:token +
    // /share/:token/prescription.pdf routes render the signed PDF.
    prescriptionId: text("prescription_id"),
    // Tier 1 records: share-pack. When `kind` is "record_bundle" this
    // column carries the JSON array of medical_records.id that the
    // public GET /share/:token route exposes (max 50 — Zod-enforced).
    // NULL for legacy kinds. Schema-0057.
    recordIds: text("record_ids"),
  },
  (t) => ({
    familyMemberIdx: index("idx_share_links_family_member").on(
      t.familyMemberId
    ),
    prescriptionIdx: index("idx_share_links_prescription").on(
      t.prescriptionId
    ),
  })
);

// ─── V3: Share Link Views (audit trail) ─────────────────
export const shareLinkViews = sqliteTable("share_link_views", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  linkId: text("link_id")
    .notNull()
    .references(() => shareLinks.id),
  viewedAt: text("viewed_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

// ─── Phase 3.1: Request-a-Demo lead capture ──────────────
// Public POST from the .doctor Request-a-Demo form (or the mobile
// /auth/request-demo screen). Admin read for the sales team. No auth
// on insert — leads are anonymous until qualified. Rate-limit is a
// TODO for CF Rate Limiting binding.
export const demoRequests = sqliteTable(
  "demo_requests",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    clinicName: text("clinic_name"),
    contactName: text("contact_name").notNull(),
    contactRole: text("contact_role"),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    nic: text("nic"),
    slmcRegistrationNo: text("slmc_registration_no"),
    specialty: text("specialty"),
    clinicSize: text("clinic_size"),
    message: text("message"),
    status: text("status").notNull().default("new"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    statusCreatedIdx: index("idx_demo_requests_status_created").on(
      t.status,
      t.createdAt
    ),
  })
);

// ─── Marketing-site waitlist ────────────────────────────
//
// Public POST from the marketing landing page (no auth).
// Captures the email + role for the private-beta rollout.
//
// We keep this separate from `demo_requests` on purpose —
// the waitlist is a top-of-funnel consumer capture with no
// qualified lead context (no clinic, no SLMC, no message),
// while demo_requests is a sales-pipeline table. Conflating
// them in the admin would mean sales deals mixed in with
// "I just want to try the app" noise.
//
// Application normalises email to lowercase + trim before
// insert; the unique index enforces canonical form. A duplicate
// POST returns 200 (already on the list), not 409 — the form
// always shows a friendly success.
export const marketingWaitlist = sqliteTable(
  "marketing_waitlist",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    role: text("role").notNull().default("patient"),
    source: text("source"),
    referrer: text("referrer"),
    userAgent: text("user_agent"),
    invitedAt: text("invited_at"),
    invitedSlot: integer("invited_slot"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    emailUnique: uniqueIndex("marketing_waitlist_email_unique").on(t.email),
    pendingIdx: index("idx_marketing_waitlist_pending").on(
      t.invitedAt,
      t.createdAt
    ),
    sourceIdx: index("idx_marketing_waitlist_source").on(t.source, t.createdAt),
  })
);

// ─── Phase 1.3: WhatsApp onboarding (state machine) ──────
// One active conversation per WhatsApp phone number. State moves
// forward through the NIC + DOB + OTP registration flow until `done`,
// at which point `userId` is wired up and the user can switch to the
// mobile app. Stale rows (older than 24h in a non-done state) can be
// safely overwritten by the webhook handler — see whatsapp.ts.
export const waConversations = sqliteTable(
  "wa_conversations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    // E.164 from Meta webhook: e.g. "94771234567". Unique on the latest
    // active conversation per number.
    waUserId: text("wa_user_id").notNull(),
    state: text("state", {
      enum: ["welcome", "lang", "nic", "dob", "otp", "done", "abandoned"],
    })
      .notNull()
      .default("welcome"),
    locale: text("locale", { enum: ["en", "si", "ta"] }).default("en"),
    // Pending NIC + DOB captured during the flow. NIC stored as a bcrypt
    // hash (same pattern as users.nicHash) — never in plain text.
    pendingNicHash: text("pending_nic_hash"),
    // Plain NIC (uppercase) cached temporarily so stepDob can cross-check
    // the supplied date of birth against the DOB encoded in the NIC.
    // Cleared on every state transition out of `done` and on conversation
    // reset. Stored encrypted at the column level is overkill here since
    // the row is per-user-transient — same access pattern as `users.nic`.
    pendingNicPlain: text("pending_nic_plain"),
    pendingDob: text("pending_dob"),
    // OTP second-factor. Hashed at rest; 5-minute TTL, max 5 attempts.
    otpCodeHash: text("otp_code_hash"),
    otpExpiresAt: text("otp_expires_at"),
    otpAttempts: integer("otp_attempts").notNull().default(0),
    // Set once `state` reaches "done". Subsequent messages from this
    // phone number are answered with a "you already registered, open the
    // app" reply.
    userId: text("user_id").references((): any => users.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    waUserIdx: index("wa_conversations_user_idx").on(t.waUserId),
    stateIdx: index("wa_conversations_state_idx").on(t.state),
  })
);

// Audit log for both inbound and outbound messages. Outbound rows are
// useful when triaging "what did the bot say to this user?".
export const waMessages = sqliteTable(
  "wa_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => waConversations.id),
    direction: text("direction", { enum: ["inbound", "outbound"] }).notNull(),
    // Mirrors Meta webhook "type": text | interactive (button/list) |
    // button (template quick-reply). Stored so replays / debugging work.
    messageType: text("message_type").notNull().default("text"),
    body: text("body"),
    // Raw payload from Meta webhook OR outbound API response. JSON blob.
    raw: text("raw"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    conversationIdx: index("wa_messages_conversation_idx").on(t.conversationId),
  })
);

// ════════════════════════════════════════════════════════════
// E-Rx Phase 1: Master Medicine Database
// ════════════════════════════════════════════════════════════
// Centralised canonical catalogue. Replaces the in-memory
// `apps/api/src/data/medicines-catalog.ts` + per-row free-text names on
// `medicines`. Backward-compatible: `medicines.name` stays NOT NULL,
// `medicines.master_medicine_id` is a nullable FK.

// ─── Reference / lookup tables ─────────────────────────────
export const medicineManufacturers = sqliteTable("medicine_manufacturers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  country: text("country"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const medicineCategories = sqliteTable("medicine_categories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const medicineTherapeuticClasses = sqliteTable(
  "medicine_therapeutic_classes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    atcCode: text("atc_code").unique(),
    name: text("name").notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }
);

export const medicineDosageForms = sqliteTable("medicine_dosage_forms", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const medicineRoutes = sqliteTable("medicine_routes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const medicineIngredients = sqliteTable("medicine_ingredients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  rxnormIngredientId: text("rxnorm_ingredient_id").unique(),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Master Medicine rows ──────────────────────────────────
export const medicinesMaster = sqliteTable(
  "medicines_master",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    rxcui: text("rxcui").unique(),
    genericName: text("generic_name").notNull(),
    brandName: text("brand_name"),
    strength: text("strength"),
    dosageFormId: text("dosage_form_id").references(
      (): any => medicineDosageForms.id
    ),
    routeId: text("route_id").references((): any => medicineRoutes.id),
    categoryId: text("category_id").references(
      (): any => medicineCategories.id
    ),
    atcClassId: text("atc_class_id").references(
      (): any => medicineTherapeuticClasses.id
    ),
    scheduleClass: text("schedule_class"),
    isGeneric: integer("is_generic", { mode: "boolean" }).default(true),
    notes: text("notes"),
    active: integer("active", { mode: "boolean" }).default(true),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    genericNameIdx: index("idx_medicines_master_generic_name").on(
      t.genericName
    ),
    brandNameIdx: index("idx_medicines_master_brand_name").on(t.brandName),
  })
);

export const medicinesMasterManufacturers = sqliteTable(
  "medicines_master_manufacturers",
  {
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    manufacturerId: text("manufacturer_id")
      .notNull()
      .references((): any => medicineManufacturers.id),
  },
  (t) => ({
    pk: uniqueIndex("medicines_master_manufacturers_pk").on(
      t.medicineId,
      t.manufacturerId
    ),
  })
);

export const medicinesMasterIngredients = sqliteTable(
  "medicines_master_ingredients",
  {
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    ingredientId: text("ingredient_id")
      .notNull()
      .references((): any => medicineIngredients.id),
    strength: text("strength"),
  },
  (t) => ({
    pk: uniqueIndex("medicines_master_ingredients_pk").on(
      t.medicineId,
      t.ingredientId
    ),
  })
);

export const medicinesMasterCategories = sqliteTable(
  "medicines_master_categories",
  {
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    categoryId: text("category_id")
      .notNull()
      .references((): any => medicineCategories.id),
  },
  (t) => ({
    pk: uniqueIndex("medicines_master_categories_pk").on(
      t.medicineId,
      t.categoryId
    ),
  })
);

export const medicinesMasterClasses = sqliteTable(
  "medicines_master_classes",
  {
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    classId: text("class_id")
      .notNull()
      .references((): any => medicineTherapeuticClasses.id),
  },
  (t) => ({
    pk: uniqueIndex("medicines_master_classes_pk").on(
      t.medicineId,
      t.classId
    ),
  })
);

// ─── Clinical safety tables (per medicine) ─────────────────
export const medicineSubstitutions = sqliteTable(
  "medicine_substitutions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    substituteId: text("substitute_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    equivalence: text("equivalence"),
  },
  (t) => ({
    pair: uniqueIndex("medicine_substitutions_pair").on(
      t.medicineId,
      t.substituteId
    ),
  })
);

export const medicineContraindications = sqliteTable(
  "medicine_contraindications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    conditionName: text("condition_name").notNull(),
    severity: text("severity", {
      enum: ["minor", "moderate", "severe"],
    }).notNull(),
    notes: text("notes"),
  }
);

export const medicinePregnancyWarnings = sqliteTable(
  "medicine_pregnancy_warnings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    fdaCategory: text("fda_category"),
    trimester: text("trimester", {
      enum: ["all", "1", "2", "3"],
    }).default("all"),
    severity: text("severity", {
      enum: ["minor", "moderate", "severe"],
    }).notNull(),
    notes: text("notes"),
  }
);

export const medicineRenalAdjustments = sqliteTable(
  "medicine_renal_adjustments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    egfrMin: real("egfr_min"),
    egfrMax: real("egfr_max"),
    doseAdjustment: text("dose_adjustment").notNull(),
    notes: text("notes"),
  }
);

export const medicineLiverAdjustments = sqliteTable(
  "medicine_liver_adjustments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    childPugh: text("child_pugh", { enum: ["A", "B", "C"] }).notNull(),
    doseAdjustment: text("dose_adjustment").notNull(),
    notes: text("notes"),
  }
);

export const medicineControlled = sqliteTable(
  "medicine_controlled",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    medicineId: text("medicine_id")
      .notNull()
      .references((): any => medicinesMaster.id),
    schedule: text("schedule").notNull(),
    region: text("region").default("LK"),
    notes: text("notes"),
  },
  (t) => ({
    medRegion: uniqueIndex("medicine_controlled_med_region").on(
      t.medicineId,
      t.region
    ),
  })
);

// ════════════════════════════════════════════════════════════
// E-Rx Phase 3: Drug Interaction + Allergy Master
// ════════════════════════════════════════════════════════════
// Replaces the in-memory `DRUG_INTERACTIONS` array in
// `apps/api/src/lib/ai.ts` (12 curated entries) and the
// `CLASS_GROUPS` block in `apps/api/src/routes/medicines.ts`.
// DB-backed so safety rules can be reviewed/extended without
// shipping new code.

export const drugInteractionsMaster = sqliteTable(
  "drug_interactions_master",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ingredientA: text("ingredient_a").notNull(),
    ingredientB: text("ingredient_b").notNull(),
    severity: text("severity", {
      enum: ["minor", "moderate", "severe"],
    }).notNull(),
    mechanism: text("mechanism"),
    recommendation: text("recommendation").notNull(),
    source: text("source").default("curated"),
    active: integer("active", { mode: "boolean" }).default(true),
  },
  (t) => ({
    pair: uniqueIndex("drug_interactions_pair").on(
      t.ingredientA,
      t.ingredientB
    ),
  })
);

export const drugAllergiesMaster = sqliteTable(
  "drug_allergies_master",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ingredientName: text("ingredient_name").notNull(),
    family: text("family").notNull(),
    crossReactives: text("cross_reactives"),
  },
  (t) => ({
    ingredient: uniqueIndex("drug_allergies_ingredient").on(
      t.ingredientName
    ),
  })
);

// ─── Patient clinical context (structured for safety check) ─
export const patientConditions = sqliteTable("patient_conditions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  patientId: text("patient_id")
    .notNull()
    .references(() => patients.id),
  conditionName: text("condition_name").notNull(),
  icd10: text("icd10"),
  onsetDate: text("onset_date"),
  active: integer("active", { mode: "boolean" }).default(true),
  notes: text("notes"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const patientMedicationsHistory = sqliteTable(
  "patient_medications_history",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    masterMedicineId: text("master_medicine_id").references(
      (): any => medicinesMaster.id
    ),
    freeTextName: text("free_text_name").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
    outcome: text("outcome"),
    notes: text("notes"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    patientIdx: index("idx_pmh_patient").on(t.patientId, t.startDate),
  })
);

// ════════════════════════════════════════════════════════════
// E-Rx Phase 6: Prescription Signatures
// ════════════════════════════════════════════════════════════
// One row per prescription. `signing_public_key` is denormalised
// from `doctors.signing_public_key` at sign time so verification
// works even after the doctor rotates their keypair.

export const prescriptionSignatures = sqliteTable(
  "prescription_signatures",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    prescriptionId: text("prescription_id")
      .notNull()
      .references((): any => prescriptions.id),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    signingKeyId: text("signing_key_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    signatureB64: text("signature_b64").notNull(),
    canonicalPayload: text("canonical_payload").notNull(),
    signedAt: text("signed_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    revokedAt: text("revoked_at"),
    revocationReason: text("revocation_reason"),
    signingPublicKey: text("signing_public_key").notNull(),
  },
  (t) => ({
    rxIdx: uniqueIndex("prescription_signatures_rx").on(t.prescriptionId),
    doctorIdx: index("prescription_signatures_doctor").on(
      t.doctorId,
      t.signedAt
    ),
  })
);

// ════════════════════════════════════════════════════════════
// Doctor Portal Expansion: messages, earnings, rx templates
// ════════════════════════════════════════════════════════════

// ─── Doctor ↔ Patient Messages ────────────────────────────
// `messages_conversations` is a 1:1 thread per (doctor, patient). One
// row per pair, upserted on either side starting a chat. Unread
// counters live on the row so the inbox list doesn't recount
// messages every render.
export const messagesConversations = sqliteTable(
  "messages_conversations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    lastMessageAt: text("last_message_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastMessagePreview: text("last_message_preview"),
    lastMessageSender: text("last_message_sender"), // "doctor" | "patient"
    doctorUnread: integer("doctor_unread").notNull().default(0),
    patientUnread: integer("patient_unread").notNull().default(0),
    // "open" = patient can reply; "closed" = doctor has ended the thread.
    status: text("status").notNull().default("open"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    doctorPatientUnique: uniqueIndex(
      "messages_conversations_doctor_patient_idx"
    ).on(t.doctorId, t.patientId),
    doctorRecentIdx: index("messages_conversations_doctor_recent_idx").on(
      t.doctorId,
      t.lastMessageAt
    ),
    patientRecentIdx: index("messages_conversations_patient_recent_idx").on(
      t.patientId,
      t.lastMessageAt
    ),
  })
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text("conversation_id")
      .notNull()
      .references((): any => messagesConversations.id, { onDelete: "cascade" }),
    senderRole: text("sender_role", {
      enum: ["doctor", "patient"],
    }).notNull(),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    conversationCreatedIdx: index("messages_conversation_created_idx").on(
      t.conversationId,
      t.createdAt
    ),
  })
);

// ─── Doctor Earnings + Payouts ─────────────────────────────
// `doctor_revenue_events` is one row per billable visit (created in
// API when appointment/walk-in flips to `completed`). The unique
// index on (doctor, source_kind, source_id) makes the insert
// idempotent so retries from the API don't double-count.
export const doctorRevenueEvents = sqliteTable(
  "doctor_revenue_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    sourceKind: text("source_kind", {
      enum: ["appointment", "walkin"],
    }).notNull(),
    sourceId: text("source_id").notNull(),
    patientId: text("patient_id").references(() => patients.id),
    amountLkr: real("amount_lkr").notNull(),
    occurredAt: text("occurred_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    payoutId: text("payout_id").references((): any => doctorPayouts.id),
  },
  (t) => ({
    doctorOccurredIdx: index("doctor_revenue_events_doctor_occurred_idx").on(
      t.doctorId,
      t.occurredAt
    ),
    sourceUnique: uniqueIndex("doctor_revenue_events_source_idx").on(
      t.doctorId,
      t.sourceKind,
      t.sourceId
    ),
  })
);

export const doctorPayouts = sqliteTable(
  "doctor_payouts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    periodStart: text("period_start").notNull(), // YYYY-MM-DD
    periodEnd: text("period_end").notNull(),
    amountLkr: real("amount_lkr").notNull(),
    eventCount: integer("event_count").notNull(),
    status: text("status", {
      enum: ["pending", "paid", "failed"],
    })
      .notNull()
      .default("pending"),
    reference: text("reference"),
    paidAt: text("paid_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    doctorIdx: index("doctor_payouts_doctor_idx").on(
      t.doctorId,
      t.createdAt
    ),
  })
);

// ─── Doctor Rx Templates ──────────────────────────────────
// Saved prescription templates. `medicines_json` is a JSON-encoded
// array of MedicineEntry rows from the prescription composer (slots,
// dosage, duration, etc.). `use_count` ranks the picker by frequency.
export const doctorRxTemplates = sqliteTable(
  "doctor_rx_templates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    name: text("name").notNull(),
    diagnosis: text("diagnosis"),
    medicinesJson: text("medicines_json").notNull(),
    notes: text("notes"),
    specialty: text("specialty"),
    useCount: integer("use_count").notNull().default(0),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    doctorIdx: index("doctor_rx_templates_doctor_idx").on(
      t.doctorId,
      t.useCount
    ),
  })
);

// ════════════════════════════════════════════════════════════
// Doctor↔Patient Enterprise Architecture: care team table
// ════════════════════════════════════════════════════════════
// Migration 0024. Single source of truth for "doctor X has access to
// patient Y". The earlier union of appointments / prescriptions /
// lab_orders / medical_records / walk_ins / messages_conversations
// still works as evidence (e.g. to auto-populate rows on first
// interaction), but the access middleware consults care_team_members
// FIRST.
//
// `role` covers the relationship semantics:
//   primary_care   — patient's main doctor (auto-issued on first
//                    appointment / prescription / lab order /
//                    medical record / walk-in / message).
//   specialist     — invited by primary_care for a second opinion;
//                    `consent_record_id` references the patient-
//                    issued share-link token.
//   covering       — covering doctor during the primary's leave
//                    (auto-issued on walk-ins to a different doctor).
//   on_call        — triage doctor for the hospital; can see patients
//                    only while they have an active slot.
//   family_view    — patient's chosen family representative.
//
// `scope` limits what the doctor sees:
//   full          — all PHI.
//   episodes_only — records from this doctor only, no other-doctor
//                    prescriptions / labs.
//   records_only  — read-only access to records; cannot prescribe.
//
// `status` lifecycle:
//   active → paused (doctor temporarily unavailable)
//   active → revoked (patient removed the doctor)
// Both terminal states retain the row for audit. Re-issuing a revoked
// role creates a NEW row (different id); the partial UNIQUE index
// allows multiple revoked rows for the same triple.
export const careTeamMembers = sqliteTable(
  "care_team_members",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    role: text("role", {
      enum: [
        "primary_care",
        "specialist",
        "covering",
        "on_call",
        "family_view",
      ],
    }).notNull(),
    scope: text("scope", {
      enum: ["full", "episodes_only", "records_only"],
    })
      .notNull()
      .default("full"),
    status: text("status", {
      enum: ["active", "paused", "revoked"],
    })
      .notNull()
      .default("active"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id),
    invitedAt: text("invited_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    acceptedAt: text("accepted_at"),
    revokedAt: text("revoked_at"),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id),
    consentRecordId: text("consent_record_id"),
    notes: text("notes"),
    // Phase MTN-1 (Multi-Tenant Network): optional tenant scope for the
    // access grant. NULL = global (legacy semantics: doctor sees the
    // patient across every hospital/clinic the patient touches). When
    // set, the access grant is restricted to records at the named
    // context — `contextType` is 'hospital' or 'clinic'; `contextId`
    // is the tenant's id. The doctor must also be a member of the
    // named tenant for the grant to be usable (enforced at POST).
    contextType: text("context_type", {
      enum: ["hospital", "clinic"],
    }),
    contextId: text("context_id"),
    // Optional FK to the clinical-relationship row that triggered this
    // access grant. Set when the patient's "add to care team" flow is
    // driven by an existing doctor_patient_relationships row. NULL
    // preserves backwards compatibility for legacy grants.
    relationshipId: text("relationship_id"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    // Drizzle has no partial-index builder — the partial-unique index
    // is created in migration 0024 as a raw CREATE UNIQUE INDEX ...
    // WHERE clause. Drizzle sees this index for query planning and
    // rejects duplicate inserts that match the WHERE predicate.
    doctorStatusIdx: index("care_team_doctor_status_idx").on(
      t.doctorId,
      t.status
    ),
    patientStatusIdx: index("care_team_patient_status_idx").on(
      t.patientId,
      t.status
    ),
  })
);

// ════════════════════════════════════════════════════════════
// Phase MTN-1: Multi-Tenant Hospital Network — membership tables
// ════════════════════════════════════════════════════════════
// Six new tables to replace the single-FK `doctors.hospital_id` model
// with full M:N membership across hospitals and clinics.
//
// Design invariants:
//   1. `hospital_doctors` / `hospital_patients` are the ONLY source of
//      truth for "who belongs to which hospital". `doctors.hospital_id`
//      is kept for the booking UI's "primary hospital" badge but new
//      reads MUST consult the membership tables.
//   2. `clinic_doctors` / `clinic_patients` mirror the hospital pattern
//      for clinics. `clinic_doctors` allows multiple doctors per clinic
//      (owners, partners, associates, locums) per the locked decision.
//   3. `doctor_patient_relationships` is the NEW clinical-context table
//      — it replaces the implicit "doctor treats patient" signal that
//      used to live in appointments/prescriptions/lab_orders/etc. A
//      `(doctor, patient, contextType, contextId)` row represents the
//      doctor's clinical role at that tenant. `care_team_members` stays
//      for patient-driven access grants.
//   4. All FK columns are indexed. UNIQUE constraints enforce
//      membership invariants. Partial UNIQUE indexes (created via raw
//      SQL migrations — Drizzle can't emit partial predicates) prevent
//      duplicate active rows after status transitions.

// ─── Clinics (NEW) ─────────────────────────────────────────
// First-class tenant owned by at least one doctor. Mirrors the
// `hospitals` table shape so the same UI components can render both.
// `userId` is the initial owner (matches the `hospitals.userId` pattern);
// actual multi-doctor membership lives in `clinic_doctors`.
export const clinics = sqliteTable("clinics", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  license: text("license"),
  address: text("address"),
  phone: text("phone"),
  location: text("location"), // JSON: { lat, lng }
  specializations: text("specializations"), // JSON array
  rating: real("rating"),
  // Short code used in MRN generation (e.g. CL-ABC-0001). Optional so
  // freshly-created clinics get auto-assigned codes by a separate
  // generator (see 0028 migration).
  shortCode: text("short_code"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Hospital ↔ Doctor (REPLACES doctors.hospital_id role) ──
// M:N membership. One row per (hospital, doctor) pair. Status changes
// in-place (active ↔ suspended ↔ inactive) — no row duplication, so the
// audit trail is implicit via updatedAt. Soft-leave sets `leftAt`.
export const hospitalDoctors = sqliteTable(
  "hospital_doctors",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    department: text("department"),
    role: text("role", {
      enum: ["consultant", "visiting", "resident", "on_call", "admin"],
    }).notNull().default("consultant"),
    status: text("status", {
      enum: ["active", "inactive", "suspended"],
    })
      .notNull()
      .default("active"),
    joinedAt: text("joined_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    leftAt: text("left_at"),
    notes: text("notes"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    pairUnique: uniqueIndex("hospital_doctors_pair_unique").on(
      t.hospitalId,
      t.doctorId
    ),
    hospitalStatusIdx: index("hospital_doctors_hospital_status_idx").on(
      t.hospitalId,
      t.status
    ),
    doctorStatusIdx: index("hospital_doctors_doctor_status_idx").on(
      t.doctorId,
      t.status
    ),
  })
);

// ─── Hospital ↔ Patient ────────────────────────────────────
// M:N registration. Each row carries the hospital-scoped MRN (Medical
// Record Number) which MUST be unique within the hospital. The
// (hospital_id, patient_id) pair is also unique — a patient registered
// at a hospital has exactly one row. Re-registration after discharge
// updates `status` and bumps `registeredAt` (rare; audit row gets a
// separate id if needed — see migration 0036).
export const hospitalPatients = sqliteTable(
  "hospital_patients",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    mrn: text("mrn").notNull(),
    status: text("status", {
      enum: ["registered", "discharged", "deceased"],
    })
      .notNull()
      .default("registered"),
    registeredAt: text("registered_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    dischargedAt: text("discharged_at"),
    notes: text("notes"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    mrnUnique: uniqueIndex("hospital_patients_mrn_unique").on(
      t.hospitalId,
      t.mrn
    ),
    pairUnique: uniqueIndex("hospital_patients_pair_unique").on(
      t.hospitalId,
      t.patientId
    ),
    patientStatusIdx: index("hospital_patients_patient_status_idx").on(
      t.patientId,
      t.status
    ),
    hospitalStatusIdx: index("hospital_patients_hospital_status_idx").on(
      t.hospitalId,
      t.status
    ),
  })
);

// ─── Hospital PACS Integrations (Tier 2) ──────────────────
//
// One row per configured DICOMweb endpoint for a hospital. Credentials
// (HTTP Basic username + password) are envelope-encrypted with the same
// AES-256-GCM shape used by `doctors.signing_private_key_enc` — see
// `apps/api/src/lib/envelope-crypto.ts`. The KEK wire id used to wrap
// the per-row DEK is denormalised into `kekVersion` so a rotation script
// can find rows that need to be re-wrapped under a new KEK without
// scanning ciphertext.
//
// Sync state machine: `lastSyncStatus` ∈ {idle, running, succeeded,
// failed}. The cron checks `enabled=true AND (lastSyncAt IS NULL OR
// datetime(lastSyncAt, '+syncIntervalMinutes minutes') <= now)` before
// claiming a row. A per-row lease (lastSyncAttemptAt + status=running)
// prevents two cron ticks from racing on the same integration.
export const hospitalPacsIntegrations = sqliteTable(
  "hospital_pacs_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    usernameEnc: text("username_enc").notNull(),
    passwordEnc: text("password_enc").notNull(),
    kekVersion: text("kek_version").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(60),
    lastSyncAt: text("last_sync_at"),
    lastSyncAttemptAt: text("last_sync_attempt_at"),
    lastSyncStatus: text("last_sync_status", {
      enum: ["idle", "running", "succeeded", "failed"],
    })
      .notNull()
      .default("idle"),
    lastSyncError: text("last_sync_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    hospitalIdx: index("hospital_pacs_integrations_hospital_idx").on(
      t.hospitalId
    ),
    dueIdx: index("hospital_pacs_integrations_due_idx").on(
      t.enabled,
      t.lastSyncAt
    ),
  })
);

// Per (integration, MRN) sync cursor — lets each patient advance
// independently without re-pulling studies the cron has already seen.
// `lastStudyDate` is the max StudyDate (YYYYMMDD) seen for this MRN.
export const hospitalPacsSyncCursors = sqliteTable(
  "hospital_pacs_sync_cursors",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    integrationId: text("integration_id")
      .notNull()
      .references(() => hospitalPacsIntegrations.id, { onDelete: "cascade" }),
    patientMrn: text("patient_mrn").notNull(),
    lastStudyDate: text("last_study_date"),
    lastPulledAt: text("last_pulled_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    pairUnique: uniqueIndex("hospital_pacs_cursors_pair_unique").on(
      t.integrationId,
      t.patientMrn
    ),
    integrationIdx: index("hospital_pacs_cursors_integration_idx").on(
      t.integrationId
    ),
  })
);

// ─── Clinic ↔ Doctor (multi-doctor per locked decision) ────
// A doctor can hold multiple roles in the same clinic over time
// (owner → partner). The active partial UNIQUE on
// (clinic_id, doctor_id, role) WHERE status='active' is created via raw
// SQL in migration 0031 — Drizzle can't emit partial predicates. The
// full UNIQUE on (clinic_id, doctor_id) prevents the same doctor from
// holding two ACTIVE rows of any role simultaneously.
export const clinicDoctors = sqliteTable(
  "clinic_doctors",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => clinics.id),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    role: text("role", {
      enum: ["owner", "partner", "associate", "locum", "on_call"],
    })
      .notNull()
      .default("owner"),
    // Revenue-share percentage (0-100). Sum across owners of a clinic
    // is enforced at the API layer (see `routes/clinics.ts` PATCH).
    ownershipPct: real("ownership_pct").notNull().default(0),
    status: text("status", {
      enum: ["active", "inactive", "suspended"],
    })
      .notNull()
      .default("active"),
    joinedAt: text("joined_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    leftAt: text("left_at"),
    notes: text("notes"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    pairUnique: uniqueIndex("clinic_doctors_pair_unique").on(
      t.clinicId,
      t.doctorId
    ),
    clinicStatusIdx: index("clinic_doctors_clinic_status_idx").on(
      t.clinicId,
      t.status
    ),
    doctorStatusIdx: index("clinic_doctors_doctor_status_idx").on(
      t.doctorId,
      t.status
    ),
  })
);

// ─── Clinic ↔ Patient ──────────────────────────────────────
// Patient registered at a clinic (similar semantics to
// hospital_patients). MRN unique per clinic.
export const clinicPatients = sqliteTable(
  "clinic_patients",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    clinicId: text("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    mrn: text("mrn").notNull(),
    status: text("status", {
      enum: ["registered", "discharged", "deceased"],
    })
      .notNull()
      .default("registered"),
    registeredAt: text("registered_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    dischargedAt: text("discharged_at"),
    notes: text("notes"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    mrnUnique: uniqueIndex("clinic_patients_mrn_unique").on(
      t.clinicId,
      t.mrn
    ),
    pairUnique: uniqueIndex("clinic_patients_pair_unique").on(
      t.clinicId,
      t.patientId
    ),
    patientStatusIdx: index("clinic_patients_patient_status_idx").on(
      t.patientId,
      t.status
    ),
    clinicStatusIdx: index("clinic_patients_clinic_status_idx").on(
      t.clinicId,
      t.status
    ),
  })
);

// ─── Doctor ↔ Patient clinical context (NEW) ───────────────
// THE heart of the multi-tenant model. A row here means "doctor X has
// a clinical relationship with patient Y at tenant Z". The tenant is
// either a hospital OR a clinic — pinned by (contextType, contextId).
// Both fields are NOT NULL: every clinical relationship is tenant-
// scoped. NULL contexts would defeat the model, hence a CHECK
// constraint at the migration level.
//
// `relationshipKind`:
//   primary_care   — patient's main doctor at this tenant
//   consulting     — single-visit or short-term consultation
//   covering       — covering for another doctor's leave
//   referred_to    — patient referred to this doctor (from elsewhere)
//   referred_from  — this doctor referred the patient out
//   on_call        — triage / emergency duty
//   second_opinion — patient sought a second opinion
//
// `isPrimary` flags the patient's main relationship at this tenant —
// used by the UI to surface the "your doctor at <hospital>" pill.
// Multiple primary flags per (patient, tenant) is prevented by a
// partial UNIQUE INDEX on (patient_id, context_type, context_id)
// WHERE is_primary=1 AND status='active' — created in 0033 raw SQL.
//
// `referredByDoctorId` is a self-FK for tracking referral chains.
//
// Lifecycle: status transitions in-place (active → ended). `endedAt`
// is set on transition. Re-activation (e.g. transferred back) creates
// a NEW row with a fresh `startedAt`. The partial UNIQUE on
// (doctor_id, patient_id, context_type, context_id) WHERE status='active'
// permits any number of ended rows per triple but at most one active.
export const doctorPatientRelationships = sqliteTable(
  "doctor_patient_relationships",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    contextType: text("context_type", {
      enum: ["hospital", "clinic"],
    })
      .notNull(),
    contextId: text("context_id").notNull(),
    relationshipKind: text("relationship_kind", {
      enum: [
        "primary_care",
        "consulting",
        "covering",
        "referred_to",
        "referred_from",
        "on_call",
        "second_opinion",
      ],
    })
      .notNull()
      .default("consulting"),
    status: text("status", {
      enum: ["active", "ended", "transferred"],
    })
      .notNull()
      .default("active"),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    startedAt: text("started_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    endedAt: text("ended_at"),
    referredByDoctorId: text("referred_by_doctor_id").references(
      (): any => doctorPatientRelationships.id
    ),
    notes: text("notes"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    doctorStatusIdx: index("dpr_doctor_status_idx").on(t.doctorId, t.status),
    patientStatusIdx: index("dpr_patient_status_idx").on(
      t.patientId,
      t.status
    ),
    contextStatusIdx: index("dpr_context_status_idx").on(
      t.contextType,
      t.contextId,
      t.status
    ),
    // CHECK constraint on (contextType IS NOT NULL AND contextId IS NOT
    // NULL) is added via raw SQL migration since Drizzle's check builder
    // is unreliable across drivers. The partial UNIQUE INDEX on
    // (doctor_id, patient_id, context_type, context_id) WHERE
    // status='active' and the partial UNIQUE on (patient_id, context_type,
    // context_id) WHERE is_primary=1 AND status='active' are also raw
    // SQL in 0033.
  })
);

// ─── Phase v3: Unified records envelope + revisions ───────────────
export const recordRevisions = sqliteTable(
  "record_revisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    recordId: text("record_id")
      .notNull()
      .references(() => medicalRecords.id, { onDelete: "cascade" }),
    revisionNumber: integer("revision_number").notNull(),
    encryptedPayloadSnapshot: text("encrypted_payload_snapshot"),
    editedByUserId: text("edited_by_user_id"),
    editedAt: text("edited_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    diffSummary: text("diff_summary"),
  },
  (t) => ({
    recordRevisionUnique: uniqueIndex("record_revisions_record_number_unique").on(
      t.recordId,
      t.revisionNumber
    ),
  })
);

export const documentDicomMetadata = sqliteTable(
  "document_dicom_metadata",
  {
    fileId: text("file_id")
      .primaryKey()
      .references(() => files.id, { onDelete: "cascade" }),
    studyInstanceUid: text("study_instance_uid"),
    seriesInstanceUid: text("series_instance_uid"),
    sopInstanceUid: text("sop_instance_uid"),
    modality: text("modality"),
    bodyPart: text("body_part"),
    studyDate: text("study_date"),
    manufacturer: text("manufacturer"),
    metadataJson: text("metadata_json"),
  }
);

export const fileDownloadTokens = sqliteTable("file_download_tokens", {
  token: text("token").primaryKey(),
  fileId: text("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  issuedByUserId: text("issued_by_user_id").notNull(),
  recipientUserId: text("recipient_user_id"),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  auditAction: text("audit_action"),
});

export const dsarRequests = sqliteTable(
  "dsar_requests",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    purpose: text("purpose", {
      enum: ["export", "erasure", "rectification"],
    }).notNull(),
    status: text("status", {
      enum: ["queued", "approved", "processing", "completed", "cancelled", "failed"],
    })
      .default("queued")
      .notNull(),
    requestedAt: text("requested_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    approvedAt: text("approved_at"),
    completedAt: text("completed_at"),
    cancelledAt: text("cancelled_at"),
    notes: text("notes"),
    resultUrl: text("result_url"),
    resultExpiresAt: text("result_expires_at"),
    approverUserId: text("approver_user_id"),
  }
);

// ─── Phase v3: Granular consent + QR ephemeral tokens ──────────────
export const consentGrants = sqliteTable(
  "consent_grants",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    familyMemberId: text("family_member_id").references(() => familyMembers.id),
    grantedToUserId: text("granted_to_user_id"),
    grantedToToken: text("granted_to_token"),
    purpose: text("purpose", {
      enum: [
        "emergency",
        "family_view",
        "insurance",
        "research",
        "referral",
        "lab_share",
      ],
    }).notNull(),
    scopeJson: text("scope_json").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    revokedByUserId: text("revoked_by_user_id"),
    consentRecordId: text("consent_record_id"),
    grantedAt: text("granted_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    grantedByUserId: text("granted_by_user_id").notNull(),
    label: text("label"),
  }
);

// QR-Code Check-in & Dispensing: rotate-purpose tokens. Existing
// emergency rows keep `purpose='emergency'`; new checkin/dispense/id
// rows share the same table so we don't duplicate the rotation +
// audit machinery. The partial-unique index below ensures at most
// one live token per (patientId, purpose) so each issue kills the
// prior row in the same write.
export const qrAccessTokens = sqliteTable(
  "qr_access_tokens",
  {
    token: text("token").primaryKey(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    familyMemberId: text("family_member_id").references(() => familyMembers.id),
    encryptedPayload: text("encrypted_payload").notNull(),
    expiresAt: text("expires_at").notNull(),
    maxScans: integer("max_scans").notNull().default(5),
    scansJson: text("scans_json").notNull().default("[]"),
    revokedAt: text("revoked_at"),
    // New: purpose lets us share the table between emergency profile
    // tokens + rotating Health ID tokens. Emergency rows default to
    // 'emergency'; Health ID tokens issue with purpose in
    // {checkin, dispense, id, all}. A partial-unique index on
    // (patient_id, purpose) WHERE revoked_at IS NULL keeps at most
    // one live token per slot.
    purpose: text("purpose").notNull().default("emergency"),
    // CSV of capabilities. '*' = open-scope (any portal role can
    // resolve). Otherwise 'checkin', 'dispense', or comma mix.
    scopes: text("scopes"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    hospitalId: text("hospital_id").references(() => hospitals.id),
    lastIssuedAt: text("last_issued_at"),
    rotationSeconds: integer("rotation_seconds").default(30),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    // Only one *live* (non-revoked) token per (patient, purpose) at a
    // time. Issuing a fresh token in the same slot revokes the prior
    // row in a single write so a stolen old QR can never be scanned.
    qrPatPurposeIdx: uniqueIndex("qr_access_tokens_pat_purpose_idx")
      .on(t.patientId, t.purpose)
      .where(sql`${t.revokedAt} IS NULL`),
    // Lookups by expiry for the future cron sweeper.
    qrExpiryIdx: index("qr_access_tokens_expiry_idx").on(t.expiresAt),
  }),
);

// QR-Code Check-in & Dispensing: append-only log of every staff scan
// attempt. Lets ops trace who scanned whose QR, when, from which
// tenant, and why any rejection happened. `success=false` rows are
// common during the demo (wrong-purpose + tenant-mismatch are
// expected on the live investor walkthrough) so the table grows
// fast — flagged for a 90-day retention cron in the next iteration.
export const portalScanEvents = sqliteTable(
  "portal_scan_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    token: text("token").notNull(),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    scannedByUserId: text("scanned_by_user_id")
      .notNull()
      .references(() => users.id),
    portalRole: text("portal_role").notNull(),
    purpose: text("purpose").notNull(),
    hospitalId: text("hospital_id").references(() => hospitals.id),
    success: integer("success", { mode: "boolean" }).notNull(),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    byTimeIdx: index("portal_scan_events_time_idx").on(t.createdAt),
    byPatientIdx: index("portal_scan_events_patient_idx").on(
      t.patientId,
      t.createdAt,
    ),
  }),
);

// ─── Phase ADM-2: runtime settings + admin notes ─────────────
//
// system_settings is a key-value store for runtime configuration
// that super_admins can flip without redeploying. Reads are
// hot-path so app code caches per isolate (see lib/settings.ts).

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),                       // JSON-encoded per valueType
  valueType: text("value_type", { enum: ["string", "number", "boolean", "json"] }).notNull(),
  category: text("category").notNull(),                 // "registration" | "uploads" | "operations" | "feature_flags"
  description: text("description").notNull().default(""),
  isSensitive: integer("is_sensitive", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id),
});

// Internal admin notes attached to a user record. Soft delete so
// audit history stays intact.

export const userAdminNotes = sqliteTable(
  "user_admin_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    deletedAt: text("deleted_at"),
  },
  (t) => ({
    userCreatedIdx: index("user_admin_notes_user_created_idx").on(t.userId, t.createdAt),
  }),
);

// ─── Phase ADM-3: SLMC verification docs + admin passkeys ──
//
// doctor_verification_docs: documents uploaded by an admin to
// support a doctor's SLMC / medical-license claim. Approval of
// an `slmc_certificate` doc sets `doctors.slmcVerifiedAt`.

export const doctorVerificationDocs = sqliteTable(
  "doctor_verification_docs",
  {
    id: text("id").primaryKey(),
    doctorId: text("doctor_id")
      .notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: ["slmc_certificate", "medical_license", "other"] }).notNull(),
    r2Key: text("r2_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    decision: text("decision", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    decisionNote: text("decision_note"),
    decidedByUserId: text("decided_by_user_id").references(() => users.id),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    doctorIdx: index("doctor_verification_docs_doctor_idx").on(t.doctorId, t.createdAt),
  }),
);

// admin_passkeys: WebAuthn credentials for super_admin step-up
// auth. Public key is COSE-encoded base64url (per WebAuthn spec).
// `counter` increments on each assertion; mismatch = cloned
// credential, must reject.

export const adminPasskeys = sqliteTable(
  "admin_passkeys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports"),
    deviceName: text("device_name").notNull().default("Passkey"),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    userIdx: index("admin_passkeys_user_idx").on(t.userId),
  }),
);

// ─── HOS-6: Departments ───────────────────────────────────
// First-class departments per hospital. Head doctor is optional
// (we don't enforce FK to doctors here — the doctor may be added
// later). `active=false` soft-deletes.
export const departments = sqliteTable(
  "departments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    name: text("name").notNull(),
    headDoctorId: text("head_doctor_id"),
    active: integer("active", { mode: "boolean" }).default(true),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    hospitalIdx: index("departments_hospital_idx").on(t.hospitalId),
  }),
);

// ─── HOS-5: Admissions ────────────────────────────────────
// One row per inpatient stay. A patient may have multiple
// historical admissions but only one with status='admitted' at a
// time. The `bedId`/`wardId` mirror the open `bedAssignments` row
// for fast lookups (denormalized on admit).
export const admissions = sqliteTable(
  "admissions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    admittedByUserId: text("admitted_by_user_id")
      .notNull()
      .references(() => users.id),
    admittingDoctorId: text("admitting_doctor_id"),
    admissionType: text("admission_type", {
      enum: ["planned", "emergency", "transfer"],
    })
      .notNull()
      .default("planned"),
    wardId: text("ward_id"),
    bedId: text("bed_id"),
    admittedAt: text("admitted_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    dischargedAt: text("discharged_at"),
    dischargedByUserId: text("discharged_by_user_id"),
    status: text("status", {
      enum: ["admitted", "discharged", "transferred", "dama", "deceased"],
    })
      .notNull()
      .default("admitted"),
    reason: text("reason"),
    diagnosisAtAdmission: text("diagnosis_at_admission"),
    dischargeDiagnosis: text("discharge_diagnosis"),
    dischargeCondition: text("discharge_condition"),
    dischargeInstructions: text("discharge_instructions"),
    followUpDate: text("follow_up_date"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    hospitalStatusIdx: index("admissions_hospital_status_idx").on(
      t.hospitalId,
      t.status
    ),
    patientStatusIdx: index("admissions_patient_status_idx").on(
      t.patientId,
      t.status
    ),
  }),
);

// ─── HOS-5: Admission notes ──────────────────────────────
// Vitals / nursing / progress / doctor rounds on an admission.
export const admissionNotes = sqliteTable(
  "admission_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    admissionId: text("admission_id")
      .notNull()
      .references(() => admissions.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", {
      enum: ["vitals", "nursing", "progress", "doctor_round"],
    }).notNull(),
    body: text("body").notNull(),
    recordedAt: text("recorded_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    admissionIdx: index("admission_notes_admission_idx").on(t.admissionId),
  }),
);

// ─── HOS-9: Invoices ──────────────────────────────────────
// One invoice per visit (opd/ipd/emergency/pharmacy/lab/other).
// Line items live in `invoiceLineItems`. Payments reconcile against
// the invoice total — `status` is derived from total paid.
export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    hospitalId: text("hospital_id")
      .notNull()
      .references(() => hospitals.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    admissionId: text("admission_id"),
    appointmentId: text("appointment_id"),
    walkInId: text("walk_in_id"),
    visitType: text("visit_type", {
      enum: ["opd", "ipd", "emergency", "pharmacy", "lab", "other"],
    })
      .notNull()
      .default("opd"),
    invoiceNumber: text("invoice_number").notNull(),
    subtotalLkr: real("subtotal_lkr").notNull().default(0),
    taxLkr: real("tax_lkr").notNull().default(0),
    discountLkr: real("discount_lkr").notNull().default(0),
    totalLkr: real("total_lkr").notNull().default(0),
    status: text("status", {
      enum: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "cancelled",
        "void",
      ],
    })
      .notNull()
      .default("draft"),
    issuedAt: text("issued_at"),
    dueAt: text("due_at"),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    hospitalStatusIdx: index("invoices_hospital_status_idx").on(
      t.hospitalId,
      t.status
    ),
    patientStatusIdx: index("invoices_patient_status_idx").on(
      t.patientId,
      t.status
    ),
  }),
);

// ─── HOS-9: Invoice line items ────────────────────────────
export const invoiceLineItems = sqliteTable(
  "invoice_line_items",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    quantity: real("quantity").notNull().default(1),
    unitPriceLkr: real("unit_price_lkr").notNull().default(0),
    amountLkr: real("amount_lkr").notNull().default(0),
    kind: text("kind", {
      enum: [
        "consultation",
        "bed",
        "procedure",
        "medicine",
        "lab",
        "imaging",
        "other",
        "nursing",
      ],
    })
      .notNull()
      .default("other"),
    refRecordId: text("ref_record_id"),
    refPrescriptionId: text("ref_prescription_id"),
    refLabOrderId: text("ref_lab_order_id"),
  },
  (t) => ({
    invoiceIdx: index("invoice_line_items_invoice_idx").on(t.invoiceId),
  }),
);

// ─── HOS-9: Payments ──────────────────────────────────────
export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    amountLkr: real("amount_lkr").notNull(),
    method: text("method", {
      enum: ["cash", "card", "mobile_wallet", "insurance", "bank_transfer", "other"],
    })
      .notNull()
      .default("cash"),
    reference: text("reference"),
    receivedByUserId: text("received_by_user_id")
      .notNull()
      .references(() => users.id),
    paidAt: text("paid_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    notes: text("notes"),
  },
  (t) => ({
    invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
  }),
);

// ─── Phase 5: PayHere online payments for appointments ──────
// Separate from the existing `payments` (hospital billing) table.
// Tracks online gateway transactions initiated by the patient.
export const appointmentPayments = sqliteTable(
  "appointment_payments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    amountLkr: real("amount_lkr").notNull(),
    currency: text("currency").notNull().default("LKR"),
    status: text("status", {
      enum: ["pending", "paid", "failed", "refunded"],
    })
      .notNull()
      .default("pending"),
    payhereOrderId: text("payhere_order_id").notNull().unique(),
    payherePaymentId: text("payhere_payment_id"),
    payhereStatusCode: text("payhere_status_code"),
    payhereMethod: text("payhere_method"),
    rawNotify: text("raw_notify"),
    failureReason: text("failure_reason"),
    refundedAmountLkr: real("refunded_amount_lkr").notNull().default(0),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    appointmentIdx: index("appointment_payments_appointment_idx").on(
      t.appointmentId
    ),
    userStatusIdx: index("appointment_payments_user_idx").on(
      t.userId,
      t.status
    ),
  })
);

// ─── Phase HOS-14: Inter-hospital collaboration ──────────────
// Hospital-to-hospital record requests, referrals, lab routing,
// doctor consult notes, and discharge handoffs.

export const hospitalShareRequests = sqliteTable(
  "hospital_share_requests",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    requesterHospitalId: text("requester_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    sourceHospitalId: text("source_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    scope: text("scope", {
      enum: ["full", "records", "prescriptions", "lab"],
    })
      .notNull()
      .default("full"),
    reason: text("reason").notNull(),
    status: text("status", {
      enum: ["pending", "approved", "declined", "expired", "revoked"],
    })
      .notNull()
      .default("pending"),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    approvedAt: text("approved_at"),
    declinedAt: text("declined_at"),
    declinedReason: text("declined_reason"),
    revokedAt: text("revoked_at"),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id),
    viewedCount: integer("viewed_count").notNull().default(0),
    lastViewedAt: text("last_viewed_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    requesterIdx: index("idx_hsr_requester").on(
      t.requesterHospitalId,
      t.status
    ),
    sourceIdx: index("idx_hsr_source").on(t.sourceHospitalId, t.status),
    patientIdx: index("idx_hsr_patient").on(t.patientId),
  })
);

export const hospitalShareRequestEvents = sqliteTable(
  "hospital_share_request_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    requestId: text("request_id")
      .notNull()
      .references(() => hospitalShareRequests.id),
    kind: text("kind", {
      enum: [
        "requested",
        "approved",
        "declined",
        "viewed",
        "revoked",
        "expired",
        "notified_patient",
      ],
    }).notNull(),
    actorUserId: text("actor_user_id").references(() => users.id),
    details: text("details"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    reqIdx: index("idx_hsr_events_req").on(t.requestId, t.createdAt),
  })
);

export const crossHospitalReferrals = sqliteTable(
  "cross_hospital_referrals",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    fromHospitalId: text("from_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    fromDoctorId: text("from_doctor_id")
      .notNull()
      .references(() => doctors.id),
    toHospitalId: text("to_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    toSpecialty: text("to_specialty").notNull(),
    reason: text("reason").notNull(),
    clinicalSummary: text("clinical_summary").notNull(),
    urgency: text("urgency", {
      enum: ["routine", "urgent", "emergency"],
    })
      .notNull()
      .default("routine"),
    status: text("status", {
      enum: ["pending", "accepted", "declined", "completed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id),
    acceptedAt: text("accepted_at"),
    completedAt: text("completed_at"),
    declinedAt: text("declined_at"),
    declinedReason: text("declined_reason"),
    linkedShareRequestId: text("linked_share_request_id").references(
      () => hospitalShareRequests.id
    ),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    toIdx: index("idx_xref_to").on(t.toHospitalId, t.status),
    fromIdx: index("idx_xref_from").on(t.fromHospitalId, t.status),
  })
);

export const crossHospitalLabRoutings = sqliteTable(
  "cross_hospital_lab_routings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    labOrderId: text("lab_order_id")
      .notNull()
      .references(() => labOrders.id),
    fromHospitalId: text("from_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    toHospitalId: text("to_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    routedByUserId: text("routed_by_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: text("status", {
      enum: ["pending", "accepted", "completed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id),
    acceptedAt: text("accepted_at"),
    completedAt: text("completed_at"),
    resultShareRequestId: text("result_share_request_id").references(
      () => hospitalShareRequests.id
    ),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    fromIdx: index("idx_xlabr_from").on(t.fromHospitalId, t.status),
    toIdx: index("idx_xlabr_to").on(t.toHospitalId, t.status),
  })
);

export const consultNotes = sqliteTable(
  "consult_notes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    fromDoctorId: text("from_doctor_id")
      .notNull()
      .references(() => doctors.id),
    toDoctorId: text("to_doctor_id").references(() => doctors.id),
    fromHospitalId: text("from_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    toHospitalId: text("to_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    question: text("question").notNull(),
    thread: text("thread").notNull().default("[]"),
    status: text("status", {
      enum: ["open", "answered", "closed"],
    })
      .notNull()
      .default("open"),
    linkedShareRequestId: text("linked_share_request_id").references(
      () => hospitalShareRequests.id
    ),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    lastReplyAt: text("last_reply_at"),
  },
  (t) => ({
    toIdx: index("idx_consult_to").on(t.toHospitalId, t.status),
    patientIdx: index("idx_consult_patient").on(t.patientId),
  })
);

export const dischargeHandoffs = sqliteTable(
  "discharge_handoffs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    admissionId: text("admission_id")
      .notNull()
      .references(() => admissions.id),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    fromHospitalId: text("from_hospital_id")
      .notNull()
      .references(() => hospitals.id),
    toClinicId: text("to_clinic_id").references(() => clinics.id),
    toHospitalId: text("to_hospital_id").references(() => hospitals.id),
    dischargeSummary: text("discharge_summary").notNull(),
    followUpPlan: text("follow_up_plan"),
    sharedAt: text("shared_at"),
    acknowledgedByUserId: text("acknowledged_by_user_id").references(
      () => users.id
    ),
    acknowledgedAt: text("acknowledged_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    patientIdx: index("idx_dh_patient").on(t.patientId),
    fromIdx: index("idx_dh_from").on(t.fromHospitalId),
  })
);

// ─── Day 1: AI safety floor counters ─────────────────────
//
// Generic counter table used by:
//   * per-user rate limit on /ai/* (scope: `user:<id>:hour:<bucket>`)
//   * Anthropic fallback daily cap (scope: `anthropic:day:<bucket>`)
//
// Atomic UPSERT in middleware reads `count` after increment; row stays
// tiny. Cleanup cron (see 0046) prunes rows older than 30d.
export const aiCounters = sqliteTable("ai_counters", {
  scope: text("scope").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Phase ADM-2: Operator orgs + ambulance dispatches ────
//
// Insurance + ambulance operators belong to an operator_org (a company).
// Their UI/API is scoped to that org. super_admin may have operatorOrgId
// NULL for cross-org ops. Mapping to existing insuranceClaims.insuranceId
// is intentionally NOT done here — insuranceClaims represent a patient's
// insurance POLICY, not the insurance COMPANY. The denormalized org
// linkage is `users.operatorOrgId` for the operator's company, and a
// separate mapping table (or per-claim claim_operators) would be needed
// to bind claims → companies; that ships in a follow-up migration.
export const operatorOrgs = sqliteTable("operator_orgs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["insurance", "ambulance"] }).notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const ambulanceDispatches = sqliteTable("ambulance_dispatches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  operatorOrgId: text("operator_org_id")
    .notNull()
    .references(() => operatorOrgs.id),
  patientId: text("patient_id").references(() => patients.id),
  pickupAddress: text("pickup_address").notNull(),
  destinationAddress: text("destination_address"),
  status: text("status", {
    enum: ["queued", "acknowledged", "enroute", "completed", "cancelled"],
  })
    .notNull()
    .default("queued"),
  assignedUserId: text("assigned_user_id").references(() => users.id),
  notes: text("notes"),
  acknowledgedAt: text("acknowledged_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── Phase INS-MKT: Health Insurance Marketplace ──────────
//
// Catalog of providers + plans; patient enrollments (active policy);
// reimbursement claims with documents + reviewer thread. Reuses
// `operator_orgs` (kind='insurance') for the company entity so the
// existing operator-side admin surface and `users.role='insurance'`
// remain the source of truth for who works at which insurer.
export const insuranceProviders = sqliteTable("insurance_providers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  operatorOrgId: text("operator_org_id")
    .notNull()
    .references(() => operatorOrgs.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  tagline: text("tagline"),
  description: text("description"),
  regulatorLicense: text("regulator_license"),
  claimSettlementRatioPct: real("claim_settlement_ratio_pct"),
  cashlessHospitalCount: integer("cashless_hospital_count"),
  websiteUrl: text("website_url"),
  supportPhone: text("support_phone"),
  ratingAvg: real("rating_avg").default(0),
  ratingCount: integer("rating_count").default(0),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
},
(t) => ({
  publishedIdx: index("insurance_providers_published_idx").on(
    t.isPublished,
    t.ratingAvg,
  ),
}));

export const insurancePlans = sqliteTable("insurance_plans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  providerId: text("provider_id")
    .notNull()
    .references(() => insuranceProviders.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  planType: text("plan_type", {
    enum: [
      "individual",
      "family_floater",
      "senior",
      "critical_illness",
      "cancer",
      "dental",
      "maternity",
    ],
  }).notNull(),
  coverageSummaryLkr: real("coverage_summary_lkr").notNull(),
  coverageDetailsJson: text("coverage_details_json"),
  monthlyPremiumLkr: real("monthly_premium_lkr").notNull(),
  annualPremiumLkr: real("annual_premium_lkr").notNull(),
  annualDiscountPct: real("annual_discount_pct").default(0),
  deductibleLkr: real("deductible_lkr").default(0),
  copayPct: real("copay_pct").default(0),
  coPaymentCapLkr: real("co_payment_cap_lkr").default(0),
  waitingPeriodDays: integer("waiting_period_days").default(30),
  preExistingWaitingDays: integer("pre_existing_waiting_days").default(365),
  networkHospitalCount: integer("network_hospital_count").default(0),
  keyFeaturesJson: text("key_features_json"),
  exclusionsJson: text("exclusions_json"),
  termMonths: integer("term_months").notNull().default(12),
  isPublished: integer("is_published", { mode: "boolean" })
    .notNull()
    .default(false),
  isFeatured: integer("is_featured", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
},
(t) => ({
  providerSlugUnique: uniqueIndex("insurance_plans_provider_slug_unique").on(
    t.providerId,
    t.slug,
  ),
  publishedIdx: index("insurance_plans_published_idx").on(
    t.providerId,
    t.isPublished,
  ),
  typeIdx: index("insurance_plans_type_idx").on(t.planType, t.isPublished),
}));

export const insuranceEnrollments = sqliteTable("insurance_enrollments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  planId: text("plan_id")
    .notNull()
    .references(() => insurancePlans.id),
  providerId: text("provider_id")
    .notNull()
    .references(() => insuranceProviders.id),
  policyNumber: text("policy_number").unique(),
  status: text("status", {
    enum: [
      "quote_pending",
      "payment_pending",
      "active",
      "grace",
      "lapsed",
      "cancelled",
      "expired",
    ],
  })
    .notNull()
    .default("payment_pending"),
  billingCycle: text("billing_cycle", {
    enum: ["monthly", "annual"],
  }).notNull(),
  premiumAmountLkr: real("premium_amount_lkr").notNull(),
  coverageAmountLkr: real("coverage_amount_lkr").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  nextPremiumDueAt: text("next_premium_due_at"),
  lastPremiumPaidAt: text("last_premium_paid_at"),
  kycStatus: text("kyc_status", {
    enum: ["pending", "verified", "rejected"],
  })
    .notNull()
    .default("pending"),
  nomineeName: text("nominee_name"),
  nomineeRelation: text("nominee_relation"),
  nomineeDob: text("nominee_dob"),
  dependentsJson: text("dependents_json"),
  paymentId: text("payment_id"),
  cancelledAt: text("cancelled_at"),
  cancelledReason: text("cancelled_reason"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
},
(t) => ({
  userStatusIdx: index("insurance_enrollments_user_status_idx").on(
    t.userId,
    t.status,
  ),
  providerStatusIdx: index("insurance_enrollments_provider_status_idx").on(
    t.providerId,
    t.status,
  ),
  nextDueIdx: index("insurance_enrollments_next_due_idx").on(
    t.nextPremiumDueAt,
    t.status,
  ),
}));

export const insuranceDependentMembers = sqliteTable(
  "insurance_dependent_members",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => insuranceEnrollments.id),
    name: text("name").notNull(),
    relation: text("relation").notNull(),
    dob: text("dob"),
    gender: text("gender"),
    nicHash: text("nic_hash"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    enrollmentIdx: index("insurance_dependents_enrollment_idx").on(
      t.enrollmentId,
    ),
  }),
);

export const insurancePremiumInvoices = sqliteTable(
  "insurance_premium_invoices",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => insuranceEnrollments.id),
    cycle: text("cycle", { enum: ["monthly", "annual"] }).notNull(),
    amountLkr: real("amount_lkr").notNull(),
    dueAt: text("due_at").notNull(),
    paidAt: text("paid_at"),
    attemptCount: integer("attempt_count").notNull().default(0),
    paymentId: text("payment_id"),
    status: text("status", {
      enum: ["open", "paid", "failed", "expired"],
    })
      .notNull()
      .default("open"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    enrollmentStatusIdx: index("insurance_invoices_enrollment_status_idx").on(
      t.enrollmentId,
      t.status,
    ),
    dueStatusIdx: index("insurance_invoices_due_status_idx").on(
      t.dueAt,
      t.status,
    ),
  }),
);

export const insuranceEcards = sqliteTable("insurance_ecards", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  enrollmentId: text("enrollment_id")
    .notNull()
    .unique()
    .references(() => insuranceEnrollments.id),
  cardNumber: text("card_number").notNull().unique(),
  qrToken: text("qr_token").notNull().unique(),
  issuedAt: text("issued_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  validUntil: text("valid_until").notNull(),
},
(t) => ({
  tokenIdx: index("insurance_ecards_token_idx").on(t.qrToken),
}));

export const insuranceMarketplaceClaims = sqliteTable(
  "insurance_marketplace_claims",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => insuranceEnrollments.id),
    userId: text("user_id")
    .notNull()
    .references(() => users.id),
  providerId: text("provider_id")
    .notNull()
    .references(() => insuranceProviders.id),
  incurringFacility: text("incurring_facility"),
  treatmentType: text("treatment_type", {
    enum: [
      "hospitalization",
      "day_care",
      "opd",
      "dental",
      "diagnostic",
      "maternity",
    ],
  }).notNull(),
  admissionDate: text("admission_date"),
  dischargeDate: text("discharge_date"),
  diagnosis: text("diagnosis"),
  amountRequestedLkr: real("amount_requested_lkr").notNull(),
  amountApprovedLkr: real("amount_approved_lkr"),
  status: text("status", {
    enum: [
      "draft",
      "submitted",
      "under_review",
      "more_info_needed",
      "approved",
      "rejected",
      "paid",
    ],
  })
    .notNull()
    .default("draft"),
  insurerRemarks: text("insurer_remarks"),
  patientRemarks: text("patient_remarks"),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  paidAt: text("paid_at"),
  transactionRef: text("transaction_ref"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
},
(t) => ({
  enrollmentStatusIdx: index("insurance_mkt_claims_enrollment_status_idx").on(
    t.enrollmentId,
    t.status,
  ),
  userIdx: index("insurance_mkt_claims_user_idx").on(t.userId, t.status),
  providerStatusIdx: index("insurance_mkt_claims_provider_status_idx").on(
    t.providerId,
    t.status,
  ),
}));

export const insuranceMarketplaceClaimDocs = sqliteTable(
  "insurance_marketplace_claim_docs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    claimId: text("claim_id")
      .notNull()
      .references(() => insuranceMarketplaceClaims.id),
    kind: text("kind", {
      enum: [
        "bill",
        "discharge_summary",
        "prescription",
        "lab_report",
        "id_proof",
        "other",
      ],
    }).notNull(),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name"),
    contentType: text("content_type"),
    uploadedAt: text("uploaded_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    claimIdx: index("insurance_mkt_claim_docs_claim_idx").on(t.claimId),
  }),
);

export const insuranceMarketplaceClaimMessages = sqliteTable(
  "insurance_marketplace_claim_messages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    claimId: text("claim_id")
      .notNull()
      .references(() => insuranceMarketplaceClaims.id),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => users.id),
    senderRole: text("sender_role", {
      enum: ["patient", "operator"],
    }).notNull(),
    body: text("body").notNull(),
    attachmentFileKey: text("attachment_file_key"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    claimIdx: index("insurance_mkt_claim_messages_claim_idx").on(
      t.claimId,
      t.createdAt,
    ),
  }),
);

// ─── Caretaker Profiles: Patient Links ────────────────────
//
// M:N join between a caretaker user (role='caretaker') and a principal
// patient. Each row grants the caretaker full management on the
// principal's data. status lifecycle: active → paused → revoked.
//
// Distinct from family_members (which is principal-owned data rows for
// household members, no auth identity) — patient_links connect two
// separate auth identities.
//
// On insert: validate that caretakerUserId references a users row with
// role='caretaker' and principalPatientId references an existing patient.
// Enforced at the route layer (apps/api/src/lib/caretaker.ts) rather than
// via a check constraint because D1 SQLite lacks subquery constraints.

export const patientLinks = sqliteTable(
  "patient_links",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    caretakerUserId: text("caretaker_user_id")
      .notNull()
      .references(() => users.id),
    principalPatientId: text("principal_patient_id")
      .notNull()
      .references(() => patients.id),
    careRole: text("care_role", {
      enum: [
        "parent",
        "guardian",
        "spouse_caregiver",
        "child_caregiver",
        "sibling_caregiver",
        "other",
        "nurse",
        "caregiver",
        "home_aide",
        "companion",
      ],
    })
      .notNull()
      .default("other"),
    inviteId: text("invite_id").references((): any => caretakerInvites.id),
    status: text("status", {
      enum: ["active", "paused", "revoked"],
    })
      .notNull()
      .default("active"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id),
    invitedAt: text("invited_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    acceptedAt: text("accepted_at"),
    revokedAt: text("revoked_at"),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id),
    revokedReason: text("revoked_reason"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    // Partial unique: only one active link per (caretaker, principal) pair.
    // Paused and revoked rows can exist alongside an active one for the
    // same pair (audit trail), but only one may be 'active' at a time.
    uniqueActive: uniqueIndex("uniq_patient_links_active")
      .on(t.caretakerUserId, t.principalPatientId)
      .where(sql`status = 'active'`),
    byCaretakerStatus: index("idx_patient_links_caretaker_status").on(
      t.caretakerUserId,
      t.status
    ),
    byPrincipalStatus: index("idx_patient_links_principal_status").on(
      t.principalPatientId,
      t.status
    ),
    byInvite: index("idx_patient_links_invite").on(t.inviteId),
  })
);

// ─── Caretaker Profiles: Invites ──────────────────────────
//
// Distinct from share_links(kind='family_invite') because:
//   1. Caretaker invites mint a new user (or upgrade existing), not
//      just a family_members row.
//   2. Lifecycle: token → phone/email OTP → user upsert → patient_links.
//   3. Required metadata: principalPatientId, channel, contactTarget.
//
// Token is 24-byte hex (existing pattern). expiresAt defaults to 14d.
// rate-limit inherited from /auth/send-otp.

export const caretakerInvites = sqliteTable(
  "caretaker_invites",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    token: text("token").notNull().unique(),
    principalPatientId: text("principal_patient_id")
      .notNull()
      .references(() => patients.id),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    caretakerName: text("caretaker_name").notNull(),
    careRole: text("care_role", {
      enum: [
        "parent",
        "guardian",
        "spouse_caregiver",
        "child_caregiver",
        "sibling_caregiver",
        "other",
        "nurse",
        "caregiver",
        "home_aide",
        "companion",
      ],
    })
      .notNull()
      .default("other"),
    channel: text("channel", {
      enum: ["mobile", "email"],
    }).notNull(),
    contactTarget: text("contact_target").notNull(),
    expiresAt: text("expires_at").notNull(),
    revoked: integer("revoked", { mode: "boolean" }).default(false),
    consumedAt: text("consumed_at"),
    redeemedByUserId: text("redeemed_by_user_id").references(() => users.id),
    // OTP brute-force tracking — separate from /auth OTP counters so a
    // locked invite does not also lock the contact's login OTP.
    otpAttempts: integer("otp_attempts").notNull().default(0),
    lockedAt: text("locked_at"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    byPrincipal: index("idx_caretaker_invites_principal").on(
      t.principalPatientId,
      t.createdAt
    ),
    byContact: index("idx_caretaker_invites_contact").on(
      t.channel,
      t.contactTarget
    ),
  })
);

// ─── Caretaker Profiles: Verification Requests ─────────────
//
// Lifecycle of a verification request:
//   pending  → caretaker just submitted, awaits admin review
//   approved → admin flipped users.verified=true (badge visible)
//   rejected → admin denied with `decisionNote`; users.verified unchanged
//   superseded → a newer pending request replaced this one (history)
//
// Revocation is recorded separately on the latest approved row via
// `revokedAt`/`revokedByUserId`/`revokedReason` so we keep an audit
// chain rather than mutating a decided row.
//
// The `documentFileId` references a row uploaded by the caretaker via
// the existing /files/upload endpoint — verified-tier requests just
// snapshot a pointer, not the bytes. R2 key lookup happens at admin
// review time.

export const caretakerVerifications = sqliteTable(
  "caretaker_verifications",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    caretakerUserId: text("caretaker_user_id")
      .notNull()
      .references(() => users.id),
    documentType: text("document_type", {
      enum: ["nic", "passport", "drivers_license", "other"],
    }).notNull(),
    documentFileId: text("document_file_id").notNull(),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "superseded"],
    })
      .notNull()
      .default("pending"),
    submittedAt: text("submitted_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    decidedAt: text("decided_at"),
    decidedByUserId: text("decided_by_user_id").references(() => users.id),
    decisionNote: text("decision_note"),
    revokedAt: text("revoked_at"),
    revokedByUserId: text("revoked_by_user_id").references(() => users.id),
    revokedReason: text("revoked_reason"),
  },
  (t) => ({
    byCaretaker: index("idx_caretaker_verifications_caretaker").on(
      t.caretakerUserId,
      t.submittedAt
    ),
    byStatus: index("idx_caretaker_verifications_status").on(
      t.status,
      t.submittedAt
    ),
  })
);

// ─── Caretaker Marketplace: Profiles ──────────────────────
//
// One row per verified caretaker who wants to be discoverable by
// patients looking to hire help. `users.verified=true` is the trust
// gate — patients only see profiles whose caretaker passes that bar.
//
// `careRolesOffered` is a JSON array of enum values (parent, guardian,
// …, nurse, caregiver, home_aide, companion) so caretakers can offer
// multiple specialties. Same shape for `languages` (en / si / ta).
//
// `hourlyRateLkr` is display-only — v1 has no payment processing.
// NULL means "rate on request".
//
// Listing visibility is controlled by `isAvailable` (boolean), not by
// deleting the row. This lets caretakers hide themselves without
// losing the profile (e.g. during a break), and the historical
// patient_links still tie back to a (now-hidden) profile.

export const caretakerMarketplaceProfiles = sqliteTable(
  "caretaker_marketplace_profiles",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    caretakerUserId: text("caretaker_user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    bio: text("bio").notNull().default(""),
    languages: text("languages").notNull().default("[]"),
    careRolesOffered: text("care_roles_offered").notNull().default("[]"),
    district: text("district").notNull().default(""),
    hourlyRateLkr: integer("hourly_rate_lkr"),
    experienceYears: integer("experience_years").default(0),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    byDistrict: index("idx_caretaker_marketplace_profiles_district").on(
      t.district,
      t.isAvailable
    ),
  })
);

// ─── Caretaker Marketplace: Inquiries ──────────────────────
//
// Patient → caretaker pre-link handshake. Created when a patient
// taps "Send inquiry" on a marketplace profile. Caretaker accepts
// or declines.
//
// Acceptance creates a `patient_links` row (status=active) and sets
// `linkId` here for the audit trail. Decline closes the inquiry
// silently — no notification (per Phase 2 scope decision).
//
// `status='expired'` is set lazily on read (no cron) for pending
// inquiries older than 7 days. Stale rows stay in the DB for audit,
// just hide from active feeds.

export const caretakerMarketplaceInquiries = sqliteTable(
  "caretaker_marketplace_inquiries",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    marketplaceProfileId: text("marketplace_profile_id")
      .notNull()
      .references(() => caretakerMarketplaceProfiles.id),
    caretakerUserId: text("caretaker_user_id")
      .notNull()
      .references(() => users.id),
    patientUserId: text("patient_user_id")
      .notNull()
      .references(() => users.id),
    patientMessage: text("patient_message").notNull(),
    status: text("status", {
      enum: ["pending", "accepted", "declined", "expired"],
    })
      .notNull()
      .default("pending"),
    decidedAt: text("decided_at"),
    linkId: text("link_id").references((): any => patientLinks.id),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    byCaretakerStatus: index(
      "idx_caretaker_marketplace_inquiries_caretaker"
    ).on(t.caretakerUserId, t.status, t.createdAt),
    byPatientStatus: index(
      "idx_caretaker_marketplace_inquiries_patient"
    ).on(t.patientUserId, t.status, t.createdAt),
  })
);

// ─── Diagnostic Test Catalog ─────────────────────────────
//
// Master list of diagnostic tests available for home collection.
// Labs (laboratory role users) populate this catalog. Patients
// browse and book from it. Categories follow standard lab
// divisions (blood, urine, etc.) plus Sri Lankan-relevant
// groupings (dengue, thalassemia screening).
//
// `homeCollectionAvailable` controls whether a phlebotomist can
// visit the patient's home. Some tests (e.g. imaging, stress
// tests) require the patient to visit a lab facility.

export const diagnosticTestCatalog = sqliteTable(
  "diagnostic_test_catalog",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category", {
      enum: [
        "blood",
        "urine",
        "stool",
        "saliva",
        "swab",
        "cardiac",
        "diabetes",
        "thyroid",
        "liver",
        "kidney",
        "lipid",
        "vitamin",
        "hormone",
        "cancer_marker",
        "infection",
        "allergy",
        "genetic",
        "imaging",
        "other",
      ],
    }).notNull(),
    description: text("description"),
    sampleType: text("sample_type", {
      enum: ["blood", "urine", "stool", "saliva", "swab", "other"],
    }).notNull(),
    fastingRequired: integer("fasting_required", { mode: "boolean" })
      .default(false)
      .notNull(),
    fastingHours: integer("fasting_hours").default(0).notNull(),
    homeCollectionAvailable: integer("home_collection_available", {
      mode: "boolean",
    })
      .default(true)
      .notNull(),
    price: real("price").notNull(),
    discountPrice: real("discount_price"),
    labPartnerId: text("lab_partner_id")
      .notNull()
      .references(() => users.id),
    turnaroundHours: integer("turnaround_hours").default(24).notNull(),
    instructions: text("instructions"),
    isActive: integer("is_active", { mode: "boolean" })
      .default(true)
      .notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    categoryIdx: index("idx_diagnostic_test_catalog_category").on(
      t.category,
      t.isActive
    ),
    labPartnerIdx: index("idx_diagnostic_test_catalog_lab_partner").on(
      t.labPartnerId,
      t.isActive
    ),
  })
);

// ─── Test Packages ───────────────────────────────────────
//
// Bundled test packages (e.g. "Full Body Checkup", "Diabetes
// Panel", "Women's Health"). Each package references multiple
// tests from the catalog via `testPackageItems`.
//
// Pricing: the package `price` is the bundle price; individual
// test prices are in `diagnosticTestCatalog`. The UI shows
// savings = sum(individual) - package price.

export const testPackages = sqliteTable(
  "test_packages",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    price: real("price").notNull(),
    discountPrice: real("discount_price"),
    labPartnerId: text("lab_partner_id")
      .notNull()
      .references(() => users.id),
    turnaroundHours: integer("turnaround_hours").default(48).notNull(),
    instructions: text("instructions"),
    isActive: integer("is_active", { mode: "boolean" })
      .default(true)
      .notNull(),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    labPartnerIdx: index("idx_test_packages_lab_partner").on(
      t.labPartnerId,
      t.isActive
    ),
  })
);

// ─── Test Package Items ──────────────────────────────────
// M:N join between packages and catalog tests.

export const testPackageItems = sqliteTable(
  "test_package_items",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    packageId: text("package_id")
      .notNull()
      .references(() => testPackages.id),
    testId: text("test_id")
      .notNull()
      .references(() => diagnosticTestCatalog.id),
  },
  (t) => ({
    packageIdx: index("idx_test_package_items_package").on(t.packageId),
    testIdx: index("idx_test_package_items_test").on(t.testId),
    packageTestUnique: uniqueIndex("idx_test_package_items_unique").on(
      t.packageId,
      t.testId
    ),
  })
);

// ─── Test Bookings ───────────────────────────────────────
//
// Patient-initiated diagnostic test bookings with home sample
// collection. Status flow mirrors the phlebotomist visit lifecycle:
//
//   pending → confirmed → phlebotomist_assigned →
//   sample_collection_en_route → sample_collected →
//   in_progress → completed
//
// Cancellation is allowed up to `sample_collected`. Rescheduling
// creates a new booking and marks the old one `rescheduled`.
//
// `collectionAddress` is a JSON blob with line1, line2, city,
// district, lat, lng, contactPhone, specialInstructions.
//
// `paymentMethod: "cash"` means the phlebotomist collects payment
// on-site (common in Sri Lanka). `"card"` / `"online"` uses
// PayHere integration.

export const testBookings = sqliteTable(
  "test_bookings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    patientId: text("patient_id")
      .notNull()
      .references(() => patients.id),
    labPartnerId: text("lab_partner_id")
      .notNull()
      .references(() => users.id),
    bookingType: text("booking_type", {
      enum: ["single_test", "package"],
    }).notNull(),
    testId: text("test_id").references(() => diagnosticTestCatalog.id),
    packageId: text("package_id").references(() => testPackages.id),
    status: text("status", {
      enum: [
        "pending",
        "confirmed",
        "phlebotomist_assigned",
        "sample_collection_en_route",
        "sample_collected",
        "in_progress",
        "completed",
        "cancelled",
        "rescheduled",
      ],
    })
      .default("pending")
      .notNull(),
    scheduledDate: text("scheduled_date").notNull(),
    scheduledTimeSlot: text("scheduled_time_slot").notNull(),
    collectionAddress: text("collection_address").notNull(), // JSON blob
    phlebotomistId: text("phlebotomist_id").references(() => users.id),
    phlebotomistName: text("phlebotomist_name"),
    phlebotomistPhone: text("phlebotomist_phone"),
    totalPrice: real("total_price").notNull(),
    paymentStatus: text("payment_status", {
      enum: ["pending", "paid", "refunded", "cash_on_collection"],
    })
      .default("pending")
      .notNull(),
    paymentMethod: text("payment_method", {
      enum: ["cash", "card", "online"],
    })
      .default("cash")
      .notNull(),
    paymentRef: text("payment_ref"),
    resultPdfUrl: text("result_pdf_url"),
    resultSummary: text("result_summary"),
    resultReadyAt: text("result_ready_at"),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    createdAt: text("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => ({
    patientStatusIdx: index("idx_test_bookings_patient_status").on(
      t.patientId,
      t.status
    ),
    dateIdx: index("idx_test_bookings_date").on(t.scheduledDate),
    labPartnerStatusIdx: index("idx_test_bookings_lab_partner_status").on(
      t.labPartnerId,
      t.status
    ),
    phlebotomistIdx: index("idx_test_bookings_phlebotomist").on(
      t.phlebotomistId,
      t.status
    ),
  })
);
