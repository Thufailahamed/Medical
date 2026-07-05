// @ts-nocheck
// Single source of truth for medical records: kind registry, purpose
// (consent verb) registry, envelope crypto constants. Shared by the API
// (route validation + access control + DSAR redaction) and the mobile
// app (hub UI + share sheet + audit). No DB / no DOM.

import { z } from "zod";

// ─── Kinds (record types) ─────────────────────────────────────────────

export const RECORD_KINDS = [
  // Existing medicalRecords.recordType (17) — names match legacy column
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
  "other",
  // New kinds introduced in v3
  "medication_order",
  "lab_subtest",
  "clinical_attachment",
  "imaging_series",
  "wearable_metric",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

export type RecordCategory =
  | "clinical"
  | "diagnostic"
  | "medication"
  | "imaging"
  | "administrative"
  | "lifestyle";

export interface RecordKindDef {
  key: RecordKind;
  /** i18n key under records.kind.<key>.label */
  labelKey: string;
  /** lucide-react-native icon name */
  icon: string;
  /** Token name from app theme */
  color: "blue" | "red" | "amber" | "green" | "violet" | "teal" | "slate" | "pink";
  category: RecordCategory;
  /** True when the record body is structured (prescription, lab, imaging) */
  isStructured: boolean;
  /** Attachments allowed */
  hasAttachments: boolean;
  /** Default retention hint (days) */
  retentionDays: number;
}

const DEF = (
  key: RecordKind,
  icon: string,
  color: RecordKindDef["color"],
  category: RecordCategory,
  isStructured: boolean,
  hasAttachments: boolean,
  retentionDays: number,
): RecordKindDef => ({
  key,
  labelKey: `records.kind.${key}.label`,
  icon,
  color,
  category,
  isStructured,
  hasAttachments,
  retentionDays,
});

export const RECORD_REGISTRY: Record<RecordKind, RecordKindDef> = {
  lab_report:           DEF("lab_report",           "FlaskConical",      "blue",   "diagnostic",    true,  true,  3650),
  imaging:              DEF("imaging",              "ScanLine",          "violet", "imaging",       true,  true,  3650),
  prescription:         DEF("prescription",         "Pill",              "green",  "medication",    true,  true,  1825),
  hospital_visit:       DEF("hospital_visit",       "Hospital",          "red",    "clinical",      false, true,  3650),
  vaccination:          DEF("vaccination",          "Syringe",           "teal",   "clinical",      true,  true,  3650),
  surgery:              DEF("surgery",              "Scissors",          "red",    "clinical",      false, true,  3650),
  allergy:              DEF("allergy",              "AlertTriangle",     "amber",  "clinical",      true,  false, 3650),
  insurance:            DEF("insurance",            "Shield",            "slate",  "administrative",false, true,  1825),
  fitness:              DEF("fitness",              "Dumbbell",          "pink",   "lifestyle",     false, false, 1825),
  discharge_summary:    DEF("discharge_summary",    "FileText",          "blue",   "clinical",      false, true,  3650),
  medical_certificate:  DEF("medical_certificate",  "BadgeCheck",        "slate",  "administrative",false, true,  1825),
  operation_note:       DEF("operation_note",       "NotebookPen",       "red",    "clinical",      false, true,  3650),
  invoice:              DEF("invoice",              "Receipt",           "slate",  "administrative",false, true,  1825),
  clinical_note:        DEF("clinical_note",        "Notebook",          "blue",   "clinical",      false, false, 3650),
  lab_order:            DEF("lab_order",            "TestTube",          "blue",   "diagnostic",    true,  false, 3650),
  follow_up:            DEF("follow_up",            "CalendarCheck2",    "amber",  "clinical",      false, false, 1825),
  other:                DEF("other",                "Folder",            "slate",  "clinical",      false, true,  1825),
  medication_order:     DEF("medication_order",     "PillBottle",        "green",  "medication",    true,  true,  1825),
  lab_subtest:          DEF("lab_subtest",          "Microscope",        "blue",   "diagnostic",    true,  false, 3650),
  clinical_attachment:  DEF("clinical_attachment",  "Paperclip",         "slate",  "clinical",      false, true,  3650),
  imaging_series:       DEF("imaging_series",       "Layers",            "violet", "imaging",       true,  true,  3650),
  wearable_metric:      DEF("wearable_metric",      "Activity",          "pink",   "lifestyle",     true,  false, 1825),
};

export const RECORD_CATEGORIES: Record<RecordCategory, RecordKind[]> = Object.entries(
  RECORD_REGISTRY,
).reduce((acc, [key, def]) => {
  const k = key as RecordKind;
  (acc[def.category] = acc[def.category] ?? []).push(k);
  return acc;
}, {} as Record<RecordCategory, RecordKind[]>);

// ─── Sources ──────────────────────────────────────────────────────────

export const RECORD_SOURCES = [
  "user_upload",
  "doctor",
  "lab",
  "hospital",
  "device",
  "apple_health",
  "google_fit",
  "email-alias",
  "email-from",
  "ocr",
  "manual",
] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

// ─── Consent purposes (verbs) ────────────────────────────────────────

export const CONSENT_PURPOSES = [
  "emergency",
  "family_view",
  "insurance",
  "research",
  "referral",
  "lab_share",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export type ConsentScope =
  | "profile"
  | "allergies"
  | "conditions"
  | "medicines"
  | "contacts"
  | "records_all"
  | "records_recent"
  | "lab_orders"
  | "lab_reports"
  | "imaging"
  | "diagnoses"
  | "deidentified";

export interface PurposeDef {
  key: ConsentPurpose;
  /** i18n key under consent.purpose.<key> */
  labelKey: string;
  /** Default scope set the purpose grants when not customised */
  defaultScope: ConsentScope[];
  /** Default lifetime (in days) if user doesn't pick one */
  defaultDays: number;
  /** Hard max days (UX guard) */
  maxDays: number;
  /** Whether this purpose is allowed for first-responder / public recipients */
  publicOk: boolean;
  /** Whether the bundle gets de-identified before delivery */
  deidentify: boolean;
}

export const PURPOSE_REGISTRY: Record<ConsentPurpose, PurposeDef> = {
  emergency: {
    key: "emergency",
    labelKey: "consent.purpose.emergency",
    defaultScope: ["profile", "allergies", "conditions", "medicines", "contacts"],
    defaultDays: 0, // hours-based; UI: 2h
    maxDays: 1,
    publicOk: true,
    deidentify: false,
  },
  family_view: {
    key: "family_view",
    labelKey: "consent.purpose.family",
    defaultScope: ["records_recent", "allergies", "conditions", "medicines"],
    defaultDays: 365,
    maxDays: 3650,
    publicOk: false,
    deidentify: false,
  },
  insurance: {
    key: "insurance",
    labelKey: "consent.purpose.insurance",
    defaultScope: ["records_recent", "lab_reports", "diagnoses", "medicines"],
    defaultDays: 30,
    maxDays: 365,
    publicOk: false,
    deidentify: false,
  },
  research: {
    key: "research",
    labelKey: "consent.purpose.research",
    defaultScope: ["deidentified"],
    defaultDays: 730,
    maxDays: 3650,
    publicOk: false,
    deidentify: true,
  },
  referral: {
    key: "referral",
    labelKey: "consent.purpose.referral",
    defaultScope: ["records_recent", "lab_reports", "imaging", "diagnoses", "medicines"],
    defaultDays: 90,
    maxDays: 365,
    publicOk: false,
    deidentify: false,
  },
  lab_share: {
    key: "lab_share",
    labelKey: "consent.purpose.lab",
    defaultScope: ["lab_orders", "lab_reports"],
    defaultDays: 30,
    maxDays: 365,
    publicOk: false,
    deidentify: false,
  },
};

// ─── Envelope crypto constants ───────────────────────────────────────

export const ENVELOPE_VERSION = "v1" as const;
export const RECORD_SCHEMA_VERSION = "healthhub.record.v3" as const;
export const MAX_ENCRYPTED_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_KEK_ID = "kek-2026-01" as const;

// ─── Validators ──────────────────────────────────────────────────────

export const issueConsentSchema = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  scope: z.array(z.string()).optional(), // ConsentScope[] but flexible for ad-hoc
  recipientUserId: z.string().optional(),
  recipientToken: z.string().optional(),
  familyMemberId: z.string().optional(),
  durationDays: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
  label: z.string().max(120).optional(),
});

export const dsarRequestSchema = z.object({
  purpose: z.enum(["export", "erasure", "rectification"]),
  notes: z.string().max(2000).optional(),
  fields: z
    .array(
      z.object({
        recordId: z.string(),
        field: z.string(),
        proposedValue: z.string().max(5000),
      }),
    )
    .optional(),
});

export const recordUploadEnvelopeSchema = z.object({
  kind: z.enum(RECORD_KINDS),
  title: z.string().max(240),
  summary: z.string().max(5000).optional(),
  notes: z.string().max(20000).optional(),
  diagnosis: z.string().max(2000).optional(),
  tags: z.array(z.string().max(40)).max(40).optional(),
  familyMemberId: z.string().optional(),
  recordDate: z.string().datetime().optional(),
  structured: z.record(z.unknown()).optional(), // shape depends on `kind`
});

export type RecordUploadEnvelope = z.infer<typeof recordUploadEnvelopeSchema>;

// ─── Classification helpers (consumed by DSAR + audit UI) ────────────

export type ConsentStatus = "active" | "expired" | "revoked";

export function classifyConsent(
  expiresAt: string,
  revokedAt: string | null,
  now = new Date(),
): ConsentStatus {
  if (revokedAt) return "revoked";
  if (new Date(expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

// ─── Out-of-purpose detection (used by portals) ──────────────────────

/**
 * Determines whether `purpose` is allowed to see a record of `kind`.
 * Conservative: when purpose allows "records_recent" or "records_all",
 * any kind is visible (subject to date filter applied at query time).
 * `emergency` is always permissive (first responders need full access).
 * When purpose is restricted to e.g. "lab_reports", only matching kinds.
 */
export function purposeAllowsKind(purpose: ConsentPurpose, kind: RecordKind): boolean {
  if (purpose === "emergency") return true; // first responders need everything
  const def = PURPOSE_REGISTRY[purpose];
  if (def.defaultScope.includes("records_all") || def.defaultScope.includes("records_recent")) {
    return true;
  }
  if (def.defaultScope.includes("lab_reports") && kind === "lab_report") return true;
  if (def.defaultScope.includes("lab_reports") && kind === "lab_subtest") return true;
  if (def.defaultScope.includes("lab_orders") && (kind === "lab_order" || kind === "lab_subtest")) return true;
  if (def.defaultScope.includes("imaging") && (kind === "imaging" || kind === "imaging_series")) return true;
  if (def.defaultScope.includes("deidentified")) return true; // caller must de-identify
  return false;
}

// ─── DSAR redaction (free-text strip for non-clinical purposes) ──────

export const REDACT_FIELDS_BY_PURPOSE: Record<ConsentPurpose, string[]> = {
  emergency: [],
  family_view: [],
  insurance: ["notes"], // strip free-text doctor notes; keep structured
  research: ["notes", "diagnosis", "summary", "title", "tags"],
  referral: [],
  lab_share: ["notes"],
};

export function redactEnvelopeForPurpose(
  purpose: ConsentPurpose,
  payload: RecordUploadEnvelope,
): RecordUploadEnvelope {
  const fields = REDACT_FIELDS_BY_PURPOSE[purpose];
  if (!fields.length) return payload;
  const out = { ...payload };
  for (const f of fields) {
    if (f === "title") out.title = "[redacted]";
    else delete (out as Record<string, unknown>)[f];
  }
  return out;
}