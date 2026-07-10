"use client";

import {
  Bell,
  Calendar,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { parseNotificationData } from "@/portal/lib/notifications-types";

export { parseNotificationData };

export const PATIENT_TYPE_ICON: Record<string, LucideIcon> = {
  appointment: Calendar,
  prescription: Pill,
  lab_ready: FlaskConical,
  hospital: Stethoscope,
  medicine: Pill,
  vaccination: Stethoscope,
  general: Bell,
  clinical_note: FileText,
};

export function resolvePatientPortalHref(
  notificationType: string,
  data: ReturnType<typeof parseNotificationData>,
): string | null {
  const kind = typeof data?.kind === "string" ? data.kind : notificationType;

  if (typeof data?.recordId === "string") {
    return "/portal/me/records";
  }

  switch (kind) {
    case "clinical_note":
    case "prescription_signed":
    case "prescription_dispensed":
    case "prescription_rejected":
    case "lab_ready":
    case "follow_up":
      return "/portal/me/records";
    case "appointment":
      return "/portal/me";
    case "invoice_issued":
      return "/portal/me/records";
    default:
      if (notificationType === "prescription" || notificationType === "lab_ready") {
        return "/portal/me/records";
      }
      return "/portal/me";
  }
}

export function iconForPatientNotification(type: string, data: ReturnType<typeof parseNotificationData>) {
  const kind = typeof data?.kind === "string" ? data.kind : type;
  return PATIENT_TYPE_ICON[kind] ?? PATIENT_TYPE_ICON[type] ?? Bell;
}
