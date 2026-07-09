"use client";

// Shared type-aware metadata for hospital-portal notifications.
// Used by both the NotificationsBell component and the full Notifications
// page so the bell and the list page stay in sync.

import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  FlaskConical,
  type LucideIcon,
  MessageSquare,
  Pill,
  Receipt,
  UserPlus,
  FileText,
} from "lucide-react";

export type Tone = "info" | "success" | "warn" | "danger" | "neutral";

export const TYPE_TONE: Record<string, Tone> = {
  admission_created: "warn",
  admission_discharged: "success",
  prescription_signed: "info",
  prescription_dispensed: "success",
  prescription_rejected: "danger",
  invoice_issued: "info",
  lab_ready: "info",
  account_pending_review: "warn",
  tenant_pending_review: "warn",
  hospital_request_incoming: "info",
  hospital_request_approved: "success",
  hospital_request_declined: "danger",
  hospital_request_revoked: "warn",
  hospital_request_patient_notice: "info",
  referral_received: "info",
  referral_accepted: "success",
  referral_declined: "danger",
  consult_note_received: "info",
  consult_note_reply: "info",
  lab_routing_received: "info",
  lab_routing_accepted: "success",
  lab_routing_completed: "success",
  discharge_handoff_received: "info",
  discharge_handoff_acknowledged: "success",
};

export const TYPE_ICON: Record<string, LucideIcon> = {
  admission_created: UserPlus,
  admission_discharged: CheckCircle2,
  prescription_signed: Pill,
  prescription_dispensed: Pill,
  prescription_rejected: AlertCircle,
  invoice_issued: Receipt,
  lab_ready: FlaskConical,
  account_pending_review: AlertCircle,
  tenant_pending_review: AlertCircle,
  hospital_request_incoming: BellRing,
  hospital_request_approved: CheckCircle2,
  hospital_request_declined: AlertCircle,
  hospital_request_revoked: AlertCircle,
  hospital_request_patient_notice: BellRing,
  referral_received: UserPlus,
  referral_accepted: CheckCircle2,
  referral_declined: AlertCircle,
  consult_note_received: MessageSquare,
  consult_note_reply: MessageSquare,
  lab_routing_received: FlaskConical,
  lab_routing_accepted: CheckCircle2,
  lab_routing_completed: CheckCircle2,
  discharge_handoff_received: FileText,
  discharge_handoff_acknowledged: CheckCircle2,
};

type NotificationData = Record<string, unknown> | null | undefined;

export function resolveHref(notificationType: string, data: NotificationData): string | null {
  // The data.kind discriminator is the new (HOS-14) approach; the legacy
  // type-based discriminator stays for backwards compatibility.
  const kind = typeof data?.kind === "string" ? data.kind : notificationType;
  switch (kind) {
    case "prescription_dispensed":
    case "prescription_rejected":
    case "prescription_signed":
      return typeof data?.prescriptionId === "string"
        ? `/portal/prescriptions/${data.prescriptionId}`
        : null;
    case "admission_created":
    case "admission_discharged":
      return typeof data?.admissionId === "string" ? `/hospital/ipd/${data.admissionId}` : null;
    case "invoice_issued":
      return typeof data?.invoiceId === "string" ? `/hospital/billing/${data.invoiceId}` : null;
    case "lab_ready":
      return typeof data?.labOrderId === "string" ? `/hospital/lab` : null;
    case "hospital_request_incoming":
    case "hospital_request_approved":
    case "hospital_request_declined":
    case "hospital_request_revoked":
      return typeof data?.requestId === "string"
        ? `/hospital/collab/requests/${data.requestId}`
        : "/hospital/collab/requests";
    case "referral_received":
    case "referral_accepted":
    case "referral_declined":
      return typeof data?.referralId === "string"
        ? `/hospital/collab/referrals`
        : "/hospital/collab/referrals";
    case "consult_note_received":
    case "consult_note_reply":
      return typeof data?.consultId === "string"
        ? `/hospital/collab/consults`
        : "/hospital/collab/consults";
    case "lab_routing_received":
    case "lab_routing_accepted":
    case "lab_routing_completed":
      return "/hospital/collab/lab-routing";
    case "discharge_handoff_received":
    case "discharge_handoff_acknowledged":
      return typeof data?.handoffId === "string"
        ? `/hospital/collab/discharges`
        : "/hospital/collab/discharges";
    case "hospital_request_patient_notice":
      // Patient-facing notification — no hospital-portal deep link.
      return null;
    default:
      return null;
  }
}
