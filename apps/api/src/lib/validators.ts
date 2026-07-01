import { z } from "zod";
import {
  isStructurallyValid,
  nicMatchesDob,
  normalizeNic as normalizeNicLib,
} from "./nic";

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

export const appointmentSchema = z.object({
  doctorId: z.string().uuid("Invalid doctor id"),
  hospitalId: z.string().uuid("Invalid hospital id"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM (24h)"),
  reason: z.string().max(500, "Reason must be under 500 chars").optional(),
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
