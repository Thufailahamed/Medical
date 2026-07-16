export type UserRole =
  | "patient"
  | "doctor"
  | "hospital_admin"
  | "hospital_staff"
  | "laboratory"
  | "pharmacy"
  | "insurance"
  | "ambulance"
  | "super_admin"
  | "caretaker";

export type CareRole =
  | "parent"
  | "guardian"
  | "spouse_caregiver"
  | "child_caregiver"
  | "sibling_caregiver"
  | "other";

export type CaretakerLinkStatus = "active" | "paused" | "revoked";

export interface PatientLink {
  id: string;
  caretakerUserId: string;
  principalPatientId: string;
  careRole: CareRole;
  status: CaretakerLinkStatus;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CaretakerInvite {
  id: string;
  token: string;
  principalPatientId: string;
  invitedByUserId: string;
  caretakerName: string;
  careRole: CareRole;
  channel: "mobile" | "email";
  contactTarget: string;
  expiresAt: string;
  revoked: boolean;
  consumedAt: string | null;
  redeemedByUserId: string | null;
  createdAt: string;
}

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "pending" | "paid" | "refunded" | "insurance";

export type LabReportStatus =
  | "pending"
  | "sample_collected"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ClaimStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "paid";

export type EmergencyStatus = "active" | "responding" | "resolved" | "cancelled";

export type RecordType =
  | "lab_report"
  | "imaging"
  | "prescription"
  | "hospital_visit"
  | "vaccination"
  | "surgery"
  | "allergy"
  | "insurance"
  | "fitness"
  | "discharge_summary"
  | "medical_certificate"
  | "operation_note"
  | "invoice"
  | "clinical_note"
  | "lab_order"
  | "follow_up";

export type BedStatus =
  | "available"
  | "occupied"
  | "cleaning"
  | "maintenance"
  | "reserved";

export type WardType =
  | "general"
  | "icu"
  | "pediatric"
  | "maternity"
  | "surgical"
  | "emergency";

export type StaffRole =
  | "nurse"
  | "receptionist"
  | "technician"
  | "manager"
  | "housekeeping"
  | "security";

export type Shift = "morning" | "evening" | "night" | "rotating";

export type LabOrderStatus =
  | "ordered"
  | "sample_collected"
  | "in_progress"
  | "completed"
  | "cancelled";

export type LabOrderPriority = "routine" | "urgent" | "stat";

export type ChatRole = "user" | "assistant" | "system";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export interface User {
  id: string;
  supabaseId: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  name: string;
  nic: string | null;
  photo: string | null;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string;
  userId: string;
  bloodGroup: BloodGroup | null;
  height: number | null;
  weight: number | null;
  dateOfBirth: string | null;
  gender: string | null;
  allergies: string | null;
  medicalConditions: string | null;
  emergencyContacts: string | null;
  lifestyle: string | null;
  insuranceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  hospitalId: string | null;
  specialization: string;
  registrationNumber: string | null;
  qualification: string | null;
  experience: number | null;
  consultationFee: number | null;
  availableSlots: string | null;
  rating: number | null;
  createdAt: string;
}

export interface Hospital {
  id: string;
  userId: string;
  name: string;
  license: string | null;
  address: string | null;
  phone: string | null;
  location: string | null;
  specializations: string | null;
  rating: number | null;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  hospitalId: string | null;
  doctorId: string | null;
  recordType: RecordType;
  title: string;
  diagnosis: string | null;
  summary: string | null;
  notes: string | null;
  date: string;
  followUpDate: string | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  hospitalId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  queueNumber: number | null;
  waitingTime: number | null;
  reason: string | null;
  notes: string | null;
  paymentAmount: number | null;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface Medicine {
  id: string;
  patientId: string;
  prescriptionId: string | null;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string;
  endDate: string | null;
  refillReminder: boolean;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// ─── Doctor↔Patient Care Team (Phase 1) ─────────────────
//
// Single source of truth for "this doctor can see this patient".
// Backfilled automatically on first appointment / prescription /
// lab order / medical record / walk-in / message; patient can revoke
// at any time (status flips to "revoked", row preserved for audit).

export type CareTeamRole =
  | "primary_care"
  | "specialist"
  | "covering"
  | "on_call"
  | "family_view";

export type CareTeamScope = "full" | "episodes_only" | "records_only";

export type CareTeamStatus = "active" | "paused" | "revoked";

export interface CareTeamMember {
  id: string;
  patientId: string;
  doctorId: string;
  role: CareTeamRole;
  scope: CareTeamScope;
  status: CareTeamStatus;
  invitedByUserId: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  consentRecordId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Enriched row returned by GET /care-team (joins doctor + user for the UI).
export interface CareTeamMemberWithDoctor extends CareTeamMember {
  doctorName: string;
  doctorSpecialization: string;
  doctorPhoto: string | null;
  doctorHospitalId: string | null;
}

// Enriched row returned by GET /care-team/reverse (joins patient + user).
export interface CareTeamPatientForDoctor {
  careTeamId: string;
  patientId: string;
  patientName: string;
  patientNic: string | null;
  patientPhone: string | null;
  patientPhoto: string | null;
  patientDob: string | null;
  patientGender: string | null;
  role: CareTeamRole;
  scope: CareTeamScope;
  status: CareTeamStatus;
  invitedAt: string;
  acceptedAt: string | null;
}

export type ShareLinkKind =
  | "record_share"
  | "care_team_invite"
  | "family_invite"
  | "prescription_share"
  | "record_bundle";

export interface CareTeamInvitePayload {
  token: string;
  expiresAt: string;
  patientName: string;
  role: CareTeamRole;
  scope: CareTeamScope;
}

// ─── Doctor portal: comprehensive patient overview ───────────
// Returned by GET /doctor-portal/patients/:id/overview and consumed by
// both the marketing portal Overview tab and the mobile doctor
// patient-detail Summary tab. Single source of truth so the two apps
// stay in sync.

export type OverviewAllergySeverity = "mild" | "moderate" | "severe" | "critical";
export type OverviewRxStatus = "draft" | "signed" | "cancelled" | "dispensed";

// Phase E-Rx 8: shared prescription status enum. Mirrors
// prescriptions.status in the DB and OverviewRxStatus. Use this for
// any new client-side prescription type work.
export const RX_STATUS_VALUES = [
  "draft",
  "signed",
  "cancelled",
  "dispensed",
] as const;
export type RxStatus = (typeof RX_STATUS_VALUES)[number];
export type OverviewLabOrderStatus =
  | "ordered"
  | "sample_collected"
  | "in_progress"
  | "completed"
  | "cancelled";
export type OverviewLabOrderPriority = "routine" | "urgent" | "stat";
export type OverviewVisitKind = "appointment" | "walkin";
export type OverviewFollowUpStatus = "pending" | "completed" | "cancelled";

export interface OverviewVitals {
  latest: Array<{
    type: string;
    label: string;
    unit: string | null;
    value: number | null;
    secondaryValue: number | null;
    classification: string | null;
    recordedAt: string;
  }>;
  series: Record<string, Array<{ value: number; recordedAt: string }>>;
  alerts: Array<{
    type: string;
    label: string;
    classification: string;
    value: number | null;
    unit: string | null;
    recordedAt: string;
  }>;
}

export interface OverviewActiveMedicine {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  startDate: string | null;
  endDate: string | null;
  instructions: string | null;
  active: boolean;
}

export interface OverviewPrescription {
  id: string;
  title: string | null;
  diagnosis: string | null;
  date: string | null;
  status: OverviewRxStatus | string;
  medicineCount: number;
}

export interface OverviewLabOrder {
  id: string;
  tests: string[];
  priority: OverviewLabOrderPriority | string;
  status: OverviewLabOrderStatus | string;
  notes: string | null;
  orderedAt: string | null;
}

export interface OverviewLabReport {
  id: string;
  reportType: string | null;
  status: string;
  createdAt: string;
}

export interface OverviewClinicalNote {
  id: string;
  title: string | null;
  diagnosis: string | null;
  notes: string | null;
  createdAt: string | null;
}

export interface OverviewFollowUp {
  id: string;
  title: string;
  followUpDate: string | null;
  notes: string | null;
  status: OverviewFollowUpStatus | string | null;
}

export interface OverviewVisit {
  id: string;
  kind: OverviewVisitKind;
  date: string;
  time: string | null;
  status: string;
  reason: string | null;
}

export interface OverviewRecord {
  id: string;
  recordType: string;
  title: string | null;
  diagnosis: string | null;
  summary: string | null;
  notes: string | null;
  date: string | null;
}

export interface OverviewAllergy {
  id: string;
  substance: string;
  severity: OverviewAllergySeverity | string;
  reaction: string | null;
  notes: string | null;
  recordedAt: string | null;
}

export interface OverviewChronicCondition {
  id: string;
  name: string;
  since: string | null;
}

export interface OverviewFamilyHistoryEntry {
  id: string;
  name: string;
  relationship: string;
  conditions: string[];
  isDeceased?: boolean;
  causeOfDeath?: string | null;
}

export interface OverviewVaccination {
  id: string;
  vaccine: string;
  shortName: string | null;
  doseNumber: number;
  administeredAt: string | null;
  nextDueAt: string | null;
}

export interface OverviewInsurance {
  id: string;
  provider: string;
  policyNumber: string;
  coverageType: string | null;
  validUntil: string | null;
}

export interface OverviewMessages {
  lastConversation: {
    id: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    doctorUnread: number;
  } | null;
  unreadCount: number;
}

export interface OverviewMeta {
  fetchedAt: string;
  asOf: string;
}

export interface PatientOverview {
  patient: {
    id: string;
    nic: string | null;
    dob: string | null;
    sex: string | null;
    bloodGroup: string | null;
    photo: string | null;
    height: number | null;
    weight: number | null;
    insuranceId: string | null;
    preferredLocale: string | null;
  };
  user: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    verified: boolean;
  };
  allergies: OverviewAllergy[];
  chronicConditions: OverviewChronicCondition[];
  familyHistory: OverviewFamilyHistoryEntry[];
  activeMedicines: OverviewActiveMedicine[];
  vitals: OverviewVitals;
  prescriptions: { recent: OverviewPrescription[]; activeCount: number };
  labOrders: { recent: OverviewLabOrder[] };
  labReports: { recent: OverviewLabReport[] };
  clinicalNotes: { recent: OverviewClinicalNote[] };
  followUps: { upcoming: OverviewFollowUp[]; missed: number };
  visits: {
    recent: OverviewVisit[];
    nextScheduled: { id: string; date: string; time: string; reason: string | null } | null;
  };
  records: {
    recent: OverviewRecord[];
    counts: { total: number; byType: Record<string, number> };
  };
  vaccinations: OverviewVaccination[];
  insurance: OverviewInsurance | null;
  messages: OverviewMessages;
  meta: OverviewMeta;
}

// ─── HOS-5: Admissions ───────────────────────────────────
export type AdmissionStatus =
  | "admitted"
  | "discharged"
  | "transferred"
  | "dama"
  | "deceased";

export type AdmissionType = "planned" | "emergency" | "transfer";

export type AdmissionNoteKind = "vitals" | "nursing" | "progress" | "doctor_round";

export interface Admission {
  id: string;
  hospitalId: string;
  patientId: string;
  admittedByUserId: string;
  admittingDoctorId: string | null;
  admissionType: AdmissionType;
  wardId: string | null;
  bedId: string | null;
  admittedAt: string;
  dischargedAt: string | null;
  dischargedByUserId: string | null;
  status: AdmissionStatus;
  reason: string | null;
  diagnosisAtAdmission: string | null;
  dischargeDiagnosis: string | null;
  dischargeCondition: string | null;
  dischargeInstructions: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionNote {
  id: string;
  admissionId: string;
  authorUserId: string;
  kind: AdmissionNoteKind;
  body: string;
  recordedAt: string;
}

// ─── HOS-6: Departments ──────────────────────────────────
export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  headDoctorId: string | null;
  active: boolean;
  createdAt: string;
}

// ─── HOS-9: Billing ──────────────────────────────────────
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "void";

export type VisitType = "opd" | "ipd" | "emergency" | "pharmacy" | "lab" | "other";

export type PaymentMethod =
  | "cash"
  | "card"
  | "mobile_wallet"
  | "insurance"
  | "bank_transfer"
  | "other";

export type LineItemKind =
  | "consultation"
  | "bed"
  | "procedure"
  | "medicine"
  | "lab"
  | "imaging"
  | "other"
  | "nursing";

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPriceLkr: number;
  amountLkr: number;
  kind: LineItemKind;
  refRecordId: string | null;
  refPrescriptionId: string | null;
  refLabOrderId: string | null;
}

export interface Invoice {
  id: string;
  hospitalId: string;
  patientId: string;
  admissionId: string | null;
  appointmentId: string | null;
  walkInId: string | null;
  visitType: VisitType;
  invoiceNumber: string;
  subtotalLkr: number;
  taxLkr: number;
  discountLkr: number;
  totalLkr: number;
  status: InvoiceStatus;
  issuedAt: string | null;
  dueAt: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  lineItems?: InvoiceLineItem[];
  payments?: Payment[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  amountLkr: number;
  method: PaymentMethod;
  reference: string | null;
  receivedByUserId: string;
  paidAt: string;
  notes: string | null;
}

// ─── QR-Code Check-in & Dispensing (Health ID) ───────────
//
// Purpose enum drives both token issuance (mobile decides which
// scanner context the QR is for) and resolution (staff scanner
// enforces a matching purpose or rejects with 409 purpose_mismatch).
//   - "checkin"  → reception / front-desk creates a walk_in row
//   - "dispense" → pharmacy shows only that patient's signed Rx
//   - "id"       → opens the patient overview
//   - "all"      → emergency-style opener (no scan intent pinned)
//   - "emergency" → reserved for the legacy profile bundle flow;
//                   the QR itself still uses this row but never
//                   resolves through the portal scanner.

export type HealthIdPurpose = "checkin" | "dispense" | "id" | "all" | "emergency";

export interface HealthIdToken {
  token: string;
  purpose: HealthIdPurpose;
  rotationSeconds: number;
  expiresAt: string;
  scopes: string[];
}

export interface ResolveScanPatient {
  id: string;
  name: string;
  photo: string | null;
  nic: string | null;
  dob: string | null;
  bloodGroup: string | null;
}

export interface ResolveScanResult {
  patient: ResolveScanPatient;
  purpose: HealthIdPurpose;
  scopes: string[];
  hospitalId: string | null;
  expiresAt: string;
  remainingScans: number;
}
