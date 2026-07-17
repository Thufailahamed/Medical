import { z } from "zod";
import {
  isStructurallyValid,
  nicMatchesDob,
  normalizeNic as normalizeNicLib,
} from "./nic";
import { normalizeSLPhone } from "./phone";

// ─── Phase 1.2: SL National Identity Card ──────────────────
// Structural validation + DOB cross-check lives in `./nic`. We re-export
// the regex here so existing call sites keep working.
export { NIC_REGEX } from "./nic";

/** Canonicalise a NIC to upper-case + trimmed. */
export function normalizeNic(nic: string): string {
  return normalizeNicLib(nic);
}

/**
 * Validate YYYY-MM-DD as a real past date (age 0..120).
 * Returns the parsed Date on success, null otherwise.
 */
export function parseDob(dob: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [_, y, mo, d] = m;
  const yr = +y,
    moIdx = +mo - 1,
    day = +d;
  if (moIdx < 0 || moIdx > 11) return null;
  if (day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(yr, moIdx, day));
  if (
    date.getUTCFullYear() !== yr ||
    date.getUTCMonth() !== moIdx ||
    date.getUTCDate() !== day
  ) {
    return null; // invalid calendar date (Feb 30 etc.)
  }
  const now = new Date();
  if (date.getTime() > now.getTime()) return null; // future
  const ageYears = (now.getTime() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (ageYears > 120) return null;
  return date;
}

// Phase 1.2a: nicField now uses the structural parser (regex + year range +
// day-of-year bounds + female offset). The regex-only check was enough to
// stop obvious typos but let through clearly fabricated numbers like
// `111111111V`. See `./nic.ts` for the rationale.
const nicField = z
  .string()
  .refine(isStructurallyValid, {
    message:
      "NIC must be 9 digits + V/X (old format) or 12 digits (new format) and encode a valid birthdate",
  });

/**
 * Age threshold for the NIC skip path. Matches typical SL NIC issuance
 * age (12–16 depending on district). `isMinor` JWT claim is derived
 * separately using 18 (WHO + SL law).
 */
export const MINOR_NIC_THRESHOLD = 16;

/**
 * Compute the patient's age in years at registration given their DOB
 * (YYYY-MM-DD). Returns null if DOB is missing or unparseable.
 */
export function ageAtRegistration(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = parseDob(dob);
  if (!d) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - d.getUTCMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && now.getUTCDate() < d.getUTCDate())
  ) {
    years--;
  }
  return years;
}

const dobField = z.string().refine((s) => parseDob(s) !== null, {
  message: "Date of birth must be a real past date (YYYY-MM-DD)",
});

export const doctorProfileSchema = z.object({
  specialization: z.string().min(2, "Specialization is required").max(80),
  registrationNumber: z.string().max(80).optional(),
  hospitalId: z.string().uuid().optional(),
});

export const registerSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(10).max(15).optional(),
    name: z.string().min(2).max(100),
    role: z.enum([
      "patient",
      "doctor",
      "hospital_admin",
      "hospital_staff",
      "laboratory",
      "pharmacy",
      "insurance",
      "ambulance",
    ]),
    password: z.string().min(8),
    // Phase 1.2: NIC + DOB required for patients (SL soft 2FA baseline).
    // Optional for non-patient roles (clinic staff may not have an SL NIC).
    nic: nicField.optional(),
    dob: dobField.optional(),
    doctorProfile: doctorProfileSchema.optional(),
  })
  .refine(
    (d) => d.role !== "doctor" || !!d.doctorProfile?.specialization?.trim(),
    {
      message: "Specialization is required for doctor accounts",
      path: ["doctorProfile", "specialization"],
    }
  )
  .refine(
    (d) => {
      if (d.role !== "patient") return true;
      // Phase 1.2b: minors can register without NIC. They should be added
      // to a parent's account via the Family screen instead of self-registering,
      // but we don't block self-registration — that's a parental-consent
      // conversation for later phases.
      const age = ageAtRegistration(d.dob);
      if (age !== null && age < MINOR_NIC_THRESHOLD) return true;
      return !!d.nic && !!d.dob;
    },
    {
      message: "NIC and date of birth are required for adult patient accounts",
      path: ["nic"],
    }
  )
  .refine(
    (d) => {
      if (d.role !== "patient") return true;
      // Skip the cross-check for minors.
      const age = ageAtRegistration(d.dob);
      if (age !== null && age < MINOR_NIC_THRESHOLD) return true;
      return (
        d.role !== "patient" ||
        !d.nic ||
        !d.dob ||
        nicMatchesDob(d.nic, d.dob)
      );
    },
    {
      message: "Date of birth doesn't match the NIC. Please re-check both.",
      path: ["dob"],
    }
  );

/** Login by NIC + DOB (no password) — for soft 2FA first factor. */
export const loginByNicSchema = z.object({
  nic: nicField,
  dob: dobField,
});

/** Request an OTP to a known channel for a known user. */
export const sendOtpSchema = z.object({
  /** Subject — either an authed userId (preferred) or unguided lookup. */
  userId: z.string().optional(),
  nic: nicField.optional(),
  channel: z.enum(["mobile", "email"]),
  /** Optional override target; if omitted the server reads from profile. */
  target: z.string().optional(),
  /** Soft-verify purpose — printed in OTP log for debugging, never trusted. */
  purpose: z
    .enum(["login", "register", "nic_bind", "reset_password"])
    .default("login"),
});

/** Verify a previously-issued OTP code. */
export const verifyOtpSchema = z.object({
  userId: z.string().optional(),
  nic: nicField.optional(),
  channel: z.enum(["mobile", "email"]),
  code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

// ─── Phase 1.2b: family member ────────────────────────────────
// Mirrors the 13 relationship values exposed as chips in
// `apps/mobile/src/app/(app)/family.tsx`. `Other` accepts a free-text
// alternative via the existing `notes` field if needed in future.
export const FAMILY_RELATIONSHIP_VALUES = [
  "Spouse",
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Uncle",
  "Aunt",
  "Cousin",
  "Other",
] as const;

/** POST /patients/me/family — creates a child/relative profile owned by the parent patient. */
export const familyMemberSchema = z.object({
  name: z.string().min(1).max(120),
  relationship: z.enum(FAMILY_RELATIONSHIP_VALUES),
  // Optional but encouraged for child entries — used downstream for
  // pediatric vs adult dosing and for the in-app adult-DOB warning.
  dateOfBirth: z
    .string()
    .refine((s) => {
      if (!s) return true;
      const d = parseDob(s);
      if (!d) return false;
      // Reject ages > 100 (likely typo or test data).
      const age = ageAtRegistration(s);
      return age !== null && age <= 100;
    }, "Date of birth must be a real past date (YYYY-MM-DD)"),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  allergies: z.array(z.string()).optional(),
  medicalConditions: z.array(z.string()).optional(),
  // Hereditary conditions (Phase 3 in the family schema). Accept as string
  // array for client simplicity.
  conditions: z.array(z.string()).optional(),
  phone: z.string().min(10).max(15).optional(),
  isDeceased: z.boolean().optional(),
  causeOfDeath: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

// ─── Caretaker Profiles ───────────────────────────────────
//
// careRole values surfaced in mobile chips. Distinct from
// FAMILY_RELATIONSHIP_VALUES because caretakers are a different
// relationship domain (cross-account, not household).
export const CARE_ROLE_VALUES = [
  "parent",
  "guardian",
  "spouse_caregiver",
  "child_caregiver",
  "sibling_caregiver",
  "other",
  // Marketplace: distinct from family roles. A professional caretaker
  // who lists themselves on the marketplace picks one (or more) of
  // these to describe what they offer.
  "nurse",
  "caregiver",
  "home_aide",
  "companion",
] as const;

/** POST /caretaker/invites — principal creates an invite for a phone/email. */
export const createCaretakerInviteSchema = z.object({
  caretakerName: z.string().min(1).max(120),
  careRole: z.enum(CARE_ROLE_VALUES).default("other"),
  channel: z.enum(["mobile", "email"]),
  contact: z.string().min(3).max(254),
  expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
});

/** POST /caretaker/invites/:token/accept — caretaker proves contact possession. */
export const acceptCaretakerInviteSchema = z.object({
  otp: z.string().regex(/^\d{6}$/),
  channel: z.enum(["mobile", "email"]),
});

/** PATCH /caretaker/links/:linkId — principal pauses/resumes a link. */
export const patchCaretakerLinkSchema = z.object({
  status: z.enum(["active", "paused"]),
  reason: z.string().max(500).optional(),
});

/** PATCH /caretaker/me/active-principal — caretaker picks active principal. */
export const setActivePrincipalSchema = z.object({
  patientId: z.string().uuid().nullable(),
});

// ─── Caretaker Marketplace ─────────────────────────────────
//
// Profiles are upserts keyed on `caretakerUserId` (UNIQUE). Gated
// behind `users.verified=true` — clients should call
// /caretaker/verification/me first if they're unverified.
//
// Inquiries are patient → caretaker text. 10..500 chars enforces
// enough signal for a caretaker to accept/decline without becoming
// a chat thread.

/** PUT /caretaker/marketplace/me — upsert the caller's marketplace listing. */
export const upsertMarketplaceProfileSchema = z.object({
  bio: z.string().max(1000).default(""),
  languages: z.array(z.string().min(2).max(8)).max(10).default([]),
  careRolesOffered: z
    .array(z.enum(CARE_ROLE_VALUES))
    .min(1)
    .max(6),
  district: z.string().min(1).max(80),
  hourlyRateLkr: z.number().int().min(0).max(100000).nullable().optional(),
  experienceYears: z.number().int().min(0).max(80).default(0),
  isAvailable: z.boolean().default(true),
});

/** POST /marketplace/caretakers/:userId/inquire — patient opens inquiry. */
export const createMarketplaceInquirySchema = z.object({
  patientMessage: z.string().min(10).max(500),
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
});

export const patientProfileSchema = z.object({
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  height: z.number().min(50).max(250).optional(),
  weight: z.number().min(20).max(300).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  allergies: z.array(z.string()).optional(),
  medicalConditions: z.array(z.string()).optional(),
  emergencyContacts: z.array(z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string(),
  })).optional(),
  lifestyle: z.object({
    smoking: z.boolean().optional(),
    alcohol: z.boolean().optional(),
    exercise: z.string().optional(),
  }).optional(),
});

// ─── V2: Medicine ────────────────────────────────────────
export const FREQUENCY_VALUES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "As needed",
] as const;

export const TIMING_VALUES = [
  "Before food",
  "After food",
  "With food",
  "Any time",
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
] as const;

export const medicineSchema = z.object({
  patientId: z.string().min(1),
  prescriptionId: z.string().optional(),
  name: z.string().min(1).max(120),
  dosage: z.string().min(1).max(60),
  frequency: z.enum(FREQUENCY_VALUES),
  timing: z.enum(TIMING_VALUES).optional(),
  startDate: z.string().min(1), // YYYY-MM-DD
  endDate: z.string().min(1).optional(), // YYYY-MM-DD
  refillReminder: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  // Tag a medicine for a specific family member. NULL = household /
  // principal patient. Server falls back to the active family member
  // header when omitted. FK to family_members(id) is enforced at the
  // DB layer (see PRAGMA foreign_keys in apps/api/src/lib/db.ts).
  familyMemberId: z.string().uuid().nullable().optional(),
  // Phase E-Rx 1: optional FK into `medicines_master`. When the user
  // picks from the master autocomplete we set both `name` and
  // `masterMedicineId`; free-text-only entries leave this null and
  // `name` alone populates the row.
  masterMedicineId: z.string().uuid().nullable().optional(),
});

export const medicineUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  dosage: z.string().min(1).max(60).optional(),
  frequency: z.enum(FREQUENCY_VALUES).optional(),
  timing: z.enum(TIMING_VALUES).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  refillReminder: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  active: z.boolean().optional(),
  // Reassign medicine to another family member. NULL clears the tag
  // and reverts it to "household".
  familyMemberId: z.string().uuid().nullable().optional(),
});

// ─── Phase 2.3: Share link creation ───────────────────────
// Replaces the inline `c.req.json().catch(() => ({}))` parsing that lived
// in share.ts so every field is shape-validated before persistence. The
// `familyMemberId` mirrors medicineSchema.familyMemberId verbatim (same
// nullable semantics: NULL = household / principal, UUID = scope to
// that family member). Server enforces FM ownership separately.
export const SHARE_SCOPE_VALUES = ["all", "recent6m"] as const;
export const createShareLinkSchema = z.object({
  label: z.string().max(100).optional(),
  expiresInHours: z.number().int().min(1).max(720).optional(),
  scope: z.enum(SHARE_SCOPE_VALUES).optional(),
  familyMemberId: z.string().uuid().nullable().optional(),
  // Round 3 P1: prescription-share-with-doctor. When present, the share
  // link is scoped to a single prescription (kind="prescription_share")
  // and the public GET /share/:token + GET /share/:token/prescription.pdf
  // routes surface the signed PDF + verification URL. Server enforces
  // that the prescription belongs to the caller's principal patient.
  prescriptionId: z.string().min(1).max(64).optional(),
  // Tier 1 records: share-pack. When present, the share link is scoped to
  // a hand-picked set of medical_records (kind="record_bundle") and the
  // public GET /share/:token route returns those records instead of the
  // legacy "last 6 months" bundle. Server enforces ownership + the 50-row
  // cap so a patient can't accidentally mint an unbounded pack.
  recordIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

export const appointmentSchema = z.object({
  doctorId: z.string().min(1, "Invalid doctor id"),
  hospitalId: z.string().min(1, "Invalid hospital id"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM (24h)"),
  reason: z.string().max(500, "Reason must be under 500 chars").optional(),
  // Round 5: patient-requested consultation mode. Default "in_person"
  // — server still respects the DB default if zod is bypassed.
  mode: z.enum(["in_person", "video"]).default("in_person").optional(),
});

export const medicalRecordSchema = z.object({
  hospitalId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  recordType: z.enum([
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
  ]),
  title: z.string().min(1),
  diagnosis: z.string().optional(),
  summary: z.string().optional(),
  notes: z.string().optional(),
  date: z.string(),
  followUpDate: z.string().optional(),
});

// ─── Bulk ops on medical records (V4) ───────────────────────
export const medicalRecordBulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).max(200),
});

export const medicalRecordBulkTagSchema = z.object({
  ids: z.array(z.string().min(1)).max(200),
  add: z.array(z.string().min(1).max(40)).max(50).optional(),
  remove: z.array(z.string().min(1).max(40)).max(50).optional(),
});

export const medicalRecordBulkMoveSchema = z.object({
  ids: z.array(z.string().min(1)).max(200),
  // null = unassign back to the patient
  familyMemberId: z.string().min(1).nullable(),
});

// ─── Phase 3.1: SLMC + Request-a-Demo ─────────────────────
// SLMC numbers are heuristic — SLMC doesn't publish a format spec. Real
// numbers look like "12345" or "12345A". Uppercase normalisation on the
// server so callers can pass either case.
export const slmcRegistrationNoSchema = z
  .string()
  .regex(/^\d{4,8}[A-Z]?$/, "SLMC number must be 4-8 digits, optional uppercase letter suffix")
  .transform((v) => v.toUpperCase());

// Demo request body — public POST. Required contact details, optional
// clinic + SLMC info. Rate-limit is a CF binding TODO.
export const DEMO_CONTACT_ROLES = [
  "Doctor",
  "Receptionist",
  "Manager",
  "Other",
] as const;
export const DEMO_CLINIC_SIZES = [
  "Solo",
  "2-5 doctors",
  "6+ doctors",
  "Polyclinic",
  "Hospital",
] as const;
export const DEMO_SPECIALTIES = [
  "General practice",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "General surgery",
  "Internal medicine",
  "Neurology",
  "Obstetrics & gynaecology",
  "Oncology",
  "Ophthalmology",
  "Orthopaedics",
  "Paediatrics",
  "Psychiatry",
  "Radiology",
  "Urology",
  "Other",
] as const;
export const demoRequestSchema = z.object({
  clinicName: z.string().max(120).optional(),
  contactName: z.string().min(1).max(120),
  contactRole: z.enum(DEMO_CONTACT_ROLES).optional(),
  phone: z
    .string()
    .min(7)
    .max(16)
    .regex(/^[+0-9 ()-]+$/, "Phone must be 7-16 digits, may include + ( ) -"),
  email: z.string().email().max(254),
  nic: z.string().max(20).optional(),
  slmcRegistrationNo: slmcRegistrationNoSchema.optional().or(z.literal("")),
  specialty: z.enum(DEMO_SPECIALTIES).optional(),
  clinicSize: z.enum(DEMO_CLINIC_SIZES).optional(),
  message: z.string().max(2000).optional(),
});

// SLMC verify payload — used by /slmc/verify (authenticated doctor).
// Distinct from demoRequestSchema because the SLMC number is required here.
export const slmcVerifySchema = z.object({
  slmcRegistrationNo: slmcRegistrationNoSchema,
});

// ─── Phase 3.1 slice 3: hospital staff invites ────────────
// Role enum mirrors packages/db/src/schema.ts `hospitalStaff.role`
// (`nurse | receptionist | technician | manager | housekeeping |
// security`). Keep in sync if either side adds values.
export const HOSPITAL_STAFF_ROLES = [
  "nurse",
  "receptionist",
  "technician",
  "manager",
  "housekeeping",
  "security",
] as const;

export const createStaffInviteSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(254),
  phone: z
    .string()
    .min(7)
    .max(16)
    .regex(/^[+0-9 ()-]+$/, "Phone must be 7-16 digits, may include + ( ) -")
    .optional(),
  role: z.enum(HOSPITAL_STAFF_ROLES),
  expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
});

// ─── Phase 4: phone-only login ────────────────────────────

/** Login by phone — triggers OTP send to the phone number. */
export const loginByPhoneSchema = z.object({
  phone: z
    .string()
    .min(9, "Phone number is too short")
    .max(15, "Phone number is too long")
    .refine((v) => normalizeSLPhone(v) !== null, {
      message: "Enter a valid Sri Lankan mobile number (07X)",
    })
    .transform((v) => normalizeSLPhone(v)!),
});

// ─── HOS-0: Tenant registration ───────────────────────────
export const tenantRegisterSchema = z.object({
  tenantType: z.enum(["hospital", "clinic"]),
  ownerName: z.string().min(1).max(120),
  email: z.string().email().max(254),
  phone: z
    .string()
    .min(7)
    .max(16)
    .regex(/^[+0-9 ()-]+$/)
    .optional(),
  password: z.string().min(8).max(128),
  facilityName: z.string().min(2).max(200),
  licenseNumber: z.string().min(2).max(64),
  address: z.string().max(500).optional(),
  facilityPhone: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
  specializations: z.array(z.string().min(1).max(80)).max(20).optional(),
});

// ─── Diagnostic Test Bookings ──────────────────────────────

const collectionAddressSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required").max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1, "City is required").max(100),
  district: z.string().min(1, "District is required").max(100),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  contactPhone: z.string().min(7).max(16),
  specialInstructions: z.string().max(500).optional(),
});

export const testBookingSchema = z
  .object({
    bookingType: z.enum(["single_test", "package"]),
    testId: z.string().optional(),
    packageId: z.string().optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    scheduledTimeSlot: z.string().min(1, "Time slot is required"),
    collectionAddress: collectionAddressSchema,
    paymentMethod: z.enum(["cash", "card", "online"]).default("cash"),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.testId || d.packageId, {
    message: "Either testId or packageId is required",
  });

export const testBookingCancelSchema = z.object({
  cancellationReason: z.string().max(500).optional(),
});

export const testBookingRescheduleSchema = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  scheduledTimeSlot: z.string().min(1, "Time slot is required"),
});

export const diagnosticTestCatalogSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  category: z.enum([
    "blood", "urine", "stool", "saliva", "swab", "cardiac", "diabetes",
    "thyroid", "liver", "kidney", "lipid", "vitamin", "hormone",
    "cancer_marker", "infection", "allergy", "genetic", "imaging", "other",
  ]),
  description: z.string().max(2000).optional(),
  sampleType: z.enum(["blood", "urine", "stool", "saliva", "swab", "other"]),
  fastingRequired: z.boolean().default(false),
  fastingHours: z.number().int().min(0).max(48).default(0),
  homeCollectionAvailable: z.boolean().default(true),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional(),
  turnaroundHours: z.number().int().min(1).max(720).default(24),
  instructions: z.string().max(2000).optional(),
});

export const testPackageSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional(),
  turnaroundHours: z.number().int().min(1).max(720).default(48),
  instructions: z.string().max(2000).optional(),
  testIds: z.array(z.string().min(1)).min(1).max(50),
});

export const assignPhlebotomistSchema = z.object({
  phlebotomistId: z.string().min(1),
  phlebotomistName: z.string().min(1).max(120),
  phlebotomistPhone: z.string().min(7).max(16),
});

export const completeTestBookingSchema = z.object({
  resultPdfUrl: z.string().url().optional(),
  resultSummary: z.string().max(5000).optional(),
  notes: z.string().max(1000).optional(),
});

