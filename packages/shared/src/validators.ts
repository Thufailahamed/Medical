import { z } from "zod";

export const registerSchema = z.object({
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
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ─── V2: Clinical Note ──────────────────────────────────
export const clinicalNoteSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().optional(),
  title: z.string().min(1).max(200),
  notes: z.string().min(1),
  diagnosis: z.string().optional(),
});

// ─── V2: Lab Order ──────────────────────────────────────
export const labOrderSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().optional(),
  tests: z.array(z.string().min(1)).min(1).max(20),
  priority: z.enum(["routine", "urgent", "stat"]).default("routine"),
  notes: z.string().optional(),
});

// ─── V2: Follow-up ──────────────────────────────────────
export const followUpSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().optional(),
  title: z.string().min(1).max(200),
  notes: z.string().optional(),
  followUpDate: z.string().min(1), // YYYY-MM-DD
});

// ─── V2: Ward ───────────────────────────────────────────
export const wardSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["general", "icu", "pediatric", "maternity", "surgical", "emergency"]),
  capacity: z.number().int().min(1).max(500),
  floor: z.number().int().optional(),
});

// ─── V2: Bed ────────────────────────────────────────────
export const bedSchema = z.object({
  wardId: z.string().min(1),
  bedNumber: z.string().min(1).max(20),
  status: z.enum(["available", "occupied", "cleaning", "maintenance", "reserved"]).default("available"),
  notes: z.string().optional(),
});

export const bedStatusSchema = z.object({
  status: z.enum(["available", "occupied", "cleaning", "maintenance", "reserved"]),
});

export const bedAssignSchema = z.object({
  patientId: z.string().min(1),
  notes: z.string().optional(),
});

// ─── V2: Hospital Staff ─────────────────────────────────
export const staffSchema = z.object({
  fullName: z.string().min(1).max(100),
  role: z.enum(["nurse", "receptionist", "technician", "manager", "housekeeping", "security"]),
  shift: z.enum(["morning", "evening", "night", "rotating"]).default("morning"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  userId: z.string().optional(),
});

// ─── V2: Appointment status ─────────────────────────────
export const appointmentStatusSchema = z.object({
  status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]),
  notes: z.string().optional(),
});

// ─── V2: Doctor availability ────────────────────────────
export const availabilitySchema = z.object({
  schedule: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotMinutes: z.number().int().min(5).max(120).default(30),
      active: z.boolean().default(true),
    })
  ),
});

// ─── V2: Chat ───────────────────────────────────────────
export const chatSessionSchema = z.object({
  title: z.string().min(1).max(200),
  patientId: z.string().optional(),
});

export const chatMessageSchema = z.object({
  sessionId: z.string().min(1),
  content: z.string().min(1).max(4000),
});

// ─── V2: AI endpoints ───────────────────────────────────
export const aiSummarySchema = z.object({
  patientId: z.string().min(1),
});

export const aiLabExplainSchema = z.object({
  fileUrl: z.string().url().or(z.string().min(1)), // accept raw R2 key OR http(s) URL
  reportId: z.string().optional(),
  textHint: z.string().max(8000).optional(),
});

export const aiDrugInteractionSchema = z.object({
  medicines: z.array(z.string().min(1)).min(1).max(50),
});

export const aiChatSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
  patientId: z.string().optional(),
});

export const aiOcrSchema = z.object({
  fileUrl: z.string().url().or(z.string().min(1)),
  textHint: z.string().max(8000).optional(),
});
