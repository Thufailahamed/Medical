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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
},
(t) => ({
  emailAliasUnique: uniqueIndex("users_email_alias_unique").on(t.emailAlias),
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
export const doctors = sqliteTable("doctors", {
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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

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
export const medicines = sqliteTable("medicines", {
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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

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
    ],
  }).notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  // For BP (systolic/diastolic pair)
  secondaryValue: real("secondary_value"),
  recordedAt: text("recorded_at").notNull(),
  source: text("source").default("manual"), // manual, device, imported
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
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ─── V3: Share Links (time-limited doctor access) ───────
export const shareLinks = sqliteTable("share_links", {
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
});

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
