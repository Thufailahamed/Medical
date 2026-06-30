import { z } from "zod";

// ─── Phase 1.2: SL National Identity Card ──────────────────
// Old format (pre-2016): 9 digits + 1 letter (V/X) e.g. 123456789V
// New format (2016+):    12 digits e.g. 200012345678
export const NIC_REGEX = /^(\d{9}[VvXx]|\d{12})$/;

/**
 * Normalize NIC to upper-case + digits only (letters uppercase).
 * Acceptance is case-insensitive but stored canonical.
 */
export function normalizeNic(nic: string): string {
  return nic.trim().toUpperCase();
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

const nicField = z
  .string()
  .regex(NIC_REGEX, "NIC must be 9 digits + letter (old) or 12 digits (new)");

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
    (d) => d.role !== "patient" || (!!d.nic && !!d.dob),
    {
      message: "NIC and date of birth are required for patient accounts",
      path: ["nic"],
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
