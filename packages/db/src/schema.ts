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
    ],
  }).notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  name: text("name").notNull(),
  nic: text("nic"),
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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (t) => ({
  doctorDateTimeIdx: index("appointments_doctor_date_time_idx").on(
    t.doctorId,
    t.date,
    t.time
  ),
  patientDateIdx: index("appointments_patient_date_idx").on(t.patientId, t.date),
  doctorDateIdx: index("appointments_doctor_date_idx").on(t.doctorId, t.date),
}));

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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

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
});

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
    ],
  }).notNull(),
  inputHash: text("input_hash").notNull(),
  output: text("output").notNull(), // JSON
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  ttlAt: text("ttl_at").notNull(),
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
  },
  (t) => ({
    familyMemberIdx: index("idx_share_links_family_member").on(
      t.familyMemberId
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

export const qrAccessTokens = sqliteTable("qr_access_tokens", {
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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
