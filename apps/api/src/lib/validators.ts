import { z } from "zod";

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
    nic: z.string().optional(),
    doctorProfile: doctorProfileSchema.optional(),
  })
  .refine(
    (d) => d.role !== "doctor" || !!d.doctorProfile?.specialization?.trim(),
    {
      message: "Specialization is required for doctor accounts",
      path: ["doctorProfile", "specialization"],
    }
  );

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
