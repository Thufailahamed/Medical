"use client";

import {
  AlertCircle,
  Bell,
  Calendar,
  FileText,
  FlaskConical,
  MessageSquare,
  Pill,
  Stethoscope,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

export type Tone = "info" | "success" | "warn" | "danger" | "neutral";

export const TYPE_TONE: Record<string, Tone> = {
  appointment: "info",
  prescription: "success",
  lab_ready: "info",
  hospital: "warn",
  emergency: "danger",
  medicine: "success",
  vaccination: "info",
  insurance: "neutral",
  general: "neutral",
  care_team: "info",
  clinical_note: "info",
  follow_up: "info",
  message: "info",
};

export const TYPE_ICON: Record<string, LucideIcon> = {
  appointment: Calendar,
  prescription: Pill,
  lab_ready: FlaskConical,
  hospital: Stethoscope,
  emergency: AlertCircle,
  medicine: Pill,
  vaccination: Stethoscope,
  insurance: FileText,
  general: Bell,
  care_team: UserPlus,
  clinical_note: FileText,
  follow_up: Calendar,
  message: MessageSquare,
};

type NotificationData = Record<string, unknown> | null | undefined;

export function parseNotificationData(raw: unknown): NotificationData {
  if (!raw) return null;
  if (typeof raw === "object") return raw as NotificationData;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as NotificationData;
    } catch {
      return null;
    }
  }
  return null;
}

export function resolveDoctorPortalHref(
  notificationType: string,
  data: NotificationData,
): string | null {
  const kind = typeof data?.kind === "string" ? data.kind : notificationType;

  if (typeof data?.conversationId === "string") {
    return `/portal/messages/${data.conversationId}`;
  }

  switch (kind) {
    case "appointment":
    case "follow_up":
      if (typeof data?.appointmentId === "string") {
        return `/portal/appointments`;
      }
      return "/portal/appointments";
    case "prescription_signed":
    case "prescription_dispensed":
    case "prescription_rejected":
    case "prescription":
      return typeof data?.prescriptionId === "string"
        ? `/portal/prescriptions/${data.prescriptionId}`
        : "/portal/prescriptions";
    case "lab_ready":
      return typeof data?.patientId === "string"
        ? `/portal/patients/${data.patientId}/lab-orders`
        : "/portal/lab-orders";
    case "care_team":
      return typeof data?.patientId === "string"
        ? `/portal/patients/${data.patientId}`
        : "/portal/patients";
    case "clinical_note":
      return typeof data?.patientId === "string"
        ? `/portal/patients/${data.patientId}/clinical-notes`
        : "/portal/clinical-notes";
    case "hospital":
      if (typeof data?.walkInId === "string") return "/portal/walk-ins";
      return "/portal/walk-ins";
    default:
      if (notificationType === "appointment") return "/portal/appointments";
      if (notificationType === "lab_ready") return "/portal/lab-orders";
      if (notificationType === "prescription") return "/portal/prescriptions";
      if (notificationType === "hospital") return "/portal/walk-ins";
      if (notificationType === "general" && typeof data?.patientId === "string") {
        return `/portal/patients/${data.patientId}`;
      }
      return null;
  }
}

export function iconForNotification(type: string, data: NotificationData) {
  const kind = typeof data?.kind === "string" ? data.kind : type;
  if (typeof data?.conversationId === "string") return TYPE_ICON.message;
  return TYPE_ICON[kind] ?? TYPE_ICON[type] ?? Bell;
}

export function toneForNotification(type: string, data: NotificationData) {
  const kind = typeof data?.kind === "string" ? data.kind : type;
  if (typeof data?.conversationId === "string") return TYPE_TONE.message;
  return TYPE_TONE[kind] ?? TYPE_TONE[type] ?? "neutral";
}
