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
  // Phase 3.1 slice 3: optional staff-invite token. When present the
  // register endpoint will consume it on success — only valid for
  // role:"hospital_staff" (server-enforced in apps/api/src/routes/auth.ts).
  inviteToken: z.string().min(8).max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ─── E-Rx: Prescription lifecycle ────────────────────────
//
// Phase E-Rx 8: shared prescription schemas used by both clients
// (mobile + web) and the API. Centralizing them keeps the create /
// edit / draft / sign / cancel / dispense / verify surface aligned.
//
// `prescriptionItems` mirrors the fields the doctor captures in the
// composer. The `masterMedicineId` is optional — free-text entries
// (rare) keep it null. `ongoing` and `durationDays` are mutually
// tolerant: if `ongoing` is true the end-date is "open" and the
// `durationDays` value is ignored for the end-date computation.

export const prescriptionItemSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(64).optional().default(""),
  frequency: z.string().min(1).max(64),
  timing: z.string().max(64).optional().default(""),
  durationDays: z.number().int().min(0).max(365).optional(),
  ongoing: z.boolean().optional().default(false),
  instructions: z.string().max(500).optional().default(""),
  masterMedicineId: z.string().uuid().optional().nullable(),
});

export const prescriptionCreateSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().optional(),
  diagnosis: z.string().max(500).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  items: z.array(prescriptionItemSchema).min(1).max(50),
});

export const prescriptionPatchSchema = z.object({
  diagnosis: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(prescriptionItemSchema).min(1).max(50).optional(),
});

export const prescriptionCancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;
export type PrescriptionCreate = z.infer<typeof prescriptionCreateSchema>;
export type PrescriptionPatch = z.infer<typeof prescriptionPatchSchema>;
export type PrescriptionCancelInput = z.infer<typeof prescriptionCancelSchema>;

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

// ─── Doctor-recorded vaccination (P1 bundle 2) ──────────
//
// Mirrors the patient self-record schema in apps/api/src/routes/vaccinations.ts
// but adds an explicit `patientId` so the doctor portal can target a
// specific patient. `vaccineId` (catalog reference) and a free-text
// `vaccineName` are both accepted — the route will resolve to a
// catalog row when possible and fall back to a raw string otherwise.
export const recordPatientVaccinationSchema = z.object({
  patientId: z.string().min(1),
  hospitalId: z.string().optional(),
  vaccineId: z.string().min(1).optional(),
  vaccineName: z.string().min(1).max(200).optional(),
  doseNumber: z.number().int().min(1).max(20).optional(),
  administeredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "administeredAt must be YYYY-MM-DD")
    .optional(),
  nextDueAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "nextDueAt must be YYYY-MM-DD")
    .nullable()
    .optional(),
  provider: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});
export type RecordPatientVaccinationInput = z.infer<typeof recordPatientVaccinationSchema>;

// ─── Doctor↔Patient Care Team (Phase 1) ─────────────────
// Patient-initiated: pick a known doctor + their role on the team.
export const careTeamAddSchema = z.object({
  doctorId: z.string().min(1),
  role: z
    .enum(["primary_care", "specialist", "covering", "on_call", "family_view"])
    .default("primary_care"),
  scope: z
    .enum(["full", "episodes_only", "records_only"])
    .default("full"),
  notes: z.string().max(500).optional(),
});

// Doctor-initiated: requires a patient-issued share link token
// (created via POST /care-team/invites).
export const careTeamJoinSchema = z.object({
  patientId: z.string().min(1),
  consentToken: z.string().min(8).max(64),
  role: z
    .enum(["primary_care", "specialist", "covering", "on_call", "family_view"])
    .default("specialist"),
  scope: z
    .enum(["full", "episodes_only", "records_only"])
    .default("full"),
  notes: z.string().max(500).optional(),
});

export const careTeamPatchSchema = z.object({
  status: z.enum(["active", "paused", "revoked"]).optional(),
  scope: z.enum(["full", "episodes_only", "records_only"]).optional(),
  notes: z.string().max(500).optional(),
});

export const careTeamInviteSchema = z.object({
  role: z
    .enum(["primary_care", "specialist", "covering", "on_call", "family_view"])
    .default("primary_care"),
  scope: z
    .enum(["full", "episodes_only", "records_only"])
    .default("full"),
  // Hours the link stays valid. Defaults to 7 days. Cap at 30 days.
  ttlHours: z.number().int().min(1).max(24 * 30).default(24 * 7),
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

// Day 2 #1: clinical-note auto-summary.
// Free-text doctor note → 1-line summary + SOAP fields + key terms.
// Patient-scoped for RBAC; cache by note hash + patientId.
export const aiClinicalNoteSummarySchema = z.object({
  patientId: z.string().min(1),
  noteText: z.string().min(1).max(8000),
  locale: z.enum(["en", "si", "ta"]).optional(),
});

// Day 4 #9: SOAP draft generator.
//
// Inverse of `aiClinicalNoteSummarySchema` — instead of distilling a
// free-text note into structured SOAP, this takes short bullet
// observations (one per SOAP section) and asks the model to draft
// polished, full-sentence SOAP prose a doctor can paste into the chart.
//
// Bullets per section are optional; missing sections are left as
// empty strings in the output.
export const aiSoapDraftSchema = z.object({
  patientId: z.string().min(1),
  bullets: z
    .object({
      subjective: z.string().max(2000).optional(),
      objective: z.string().max(2000).optional(),
      assessment: z.string().max(2000).optional(),
      plan: z.string().max(2000).optional(),
    })
    .strict(),
  locale: z.enum(["en", "si", "ta"]).optional(),
});

// Day 3 #6: lab-test trend narrative.
//
// `type` is the user-typed label they want trends for (e.g. "HbA1c",
// "Lipid Panel", "CBC"). We do a case-insensitive `LIKE` match against
// lab_reports.reportType. `months` controls the look-back window
// (default 24 — covers a typical chronic-disease monitoring horizon).
export const aiLabTrendSchema = z.object({
  patientId: z.string().min(1),
  type: z.string().min(1).max(120),
  months: z.number().int().min(1).max(120).optional(),
  locale: z.enum(["en", "si", "ta"]).optional(),
});

// ─── Phase 3.1 slice 3: hospital staff invites ────────────
// Role enum mirrors `hospitalStaff.role` in packages/db/src/schema.ts
// (`nurse | receptionist | technician | manager | housekeeping |
// security`). Keep in sync.
export const HOSPITAL_STAFF_INVITE_ROLES = [
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
  role: z.enum(HOSPITAL_STAFF_INVITE_ROLES),
  expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
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

export type TenantRegisterInput = z.infer<typeof tenantRegisterSchema>;

// ─── HOS-6: Departments ──────────────────────────────────
export const departmentSchema = z.object({
  name: z.string().min(1).max(120),
  headDoctorId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

// ─── HOS-5: Admissions ───────────────────────────────────
export const admissionSchema = z.object({
  patientId: z.string().min(1),
  admittingDoctorId: z.string().nullable().optional(),
  admissionType: z.enum(["planned", "emergency", "transfer"]).default("planned"),
  wardId: z.string().nullable().optional(),
  bedId: z.string().nullable().optional(),
  reason: z.string().max(1000).optional(),
  diagnosisAtAdmission: z.string().max(2000).optional(),
});
export type AdmissionInput = z.infer<typeof admissionSchema>;

export const admissionPatchSchema = z.object({
  admittingDoctorId: z.string().nullable().optional(),
  wardId: z.string().nullable().optional(),
  bedId: z.string().nullable().optional(),
  diagnosisAtAdmission: z.string().max(2000).optional(),
});
export type AdmissionPatch = z.infer<typeof admissionPatchSchema>;

export const admissionTransferSchema = z.object({
  wardId: z.string().nullable().optional(),
  bedId: z.string().nullable().optional(),
});
export type AdmissionTransferInput = z.infer<typeof admissionTransferSchema>;

export const dischargeSchema = z.object({
  dischargeDiagnosis: z.string().max(2000).optional(),
  dischargeCondition: z.string().max(200).optional(),
  dischargeInstructions: z.string().max(4000).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  handoffTo: z
    .object({
      clinicId: z.string().optional(),
      hospitalId: z.string().optional(),
      followUpPlan: z.string().max(4000).optional(),
    })
    .optional(),
});
export type DischargeInput = z.infer<typeof dischargeSchema>;

export const admissionNoteSchema = z.object({
  kind: z.enum(["vitals", "nursing", "progress", "doctor_round"]),
  body: z.string().min(1).max(8000),
});
export type AdmissionNoteInput = z.infer<typeof admissionNoteSchema>;

// ─── HOS-9: Billing ──────────────────────────────────────
export const lineItemInputSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().positive().default(1),
  unitPriceLkr: z.number().nonnegative(),
  amountLkr: z.number().nonnegative().optional(),
  kind: z
    .enum([
      "consultation",
      "bed",
      "procedure",
      "medicine",
      "lab",
      "imaging",
      "other",
      "nursing",
    ])
    .default("other"),
  refRecordId: z.string().nullable().optional(),
  refPrescriptionId: z.string().nullable().optional(),
  refLabOrderId: z.string().nullable().optional(),
});
export type LineItemInput = z.infer<typeof lineItemInputSchema>;

export const invoiceCreateSchema = z.object({
  patientId: z.string().min(1),
  visitType: z
    .enum(["opd", "ipd", "emergency", "pharmacy", "lab", "other"])
    .default("opd"),
  admissionId: z.string().nullable().optional(),
  appointmentId: z.string().nullable().optional(),
  walkInId: z.string().nullable().optional(),
  taxLkr: z.number().nonnegative().optional(),
  discountLkr: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  lineItems: z.array(lineItemInputSchema).min(1),
});
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export const paymentSchema = z.object({
  amountLkr: z.number().positive(),
  method: z
    .enum(["cash", "card", "mobile_wallet", "insurance", "bank_transfer", "other"])
    .default("cash"),
  reference: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
