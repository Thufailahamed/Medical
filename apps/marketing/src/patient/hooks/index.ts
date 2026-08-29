"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  type RangeKey,
  patientKeys,
  rangeToFrom,
} from "@/patient/lib/query";
import type {
  AppointmentRow,
  Conversation,
  HealthSummary,
  MedicineRow,
  MedicineStats,
  Message,
  RecordRow,
  RecordStats,
  TimelineEvent,
  VitalAlert,
  VitalSeriesResponse,
  VitalType,
  WellnessResponse,
} from "@/patient/types/patient";
import type { AuthUser } from "@/portal/stores/auth";

// ─── Profile & summary ──────────────────────────────────────
export function useProfile() {
  return useQuery<AuthUser | null>({
    queryKey: patientKeys.profile(),
    queryFn: () => api<{ user: AuthUser }>("/auth/me").then((r) => r.user),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useHealthSummary() {
  return useQuery<HealthSummary>({
    queryKey: patientKeys.healthSummary(),
    queryFn: () => api<HealthSummary>("/health-summary/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useWellness() {
  return useQuery<WellnessResponse>({
    queryKey: patientKeys.wellness(),
    queryFn: () => api<WellnessResponse>("/wellness/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

// ─── Vitals ────────────────────────────────────────────────
export function useVitalsSeries(type: VitalType, range: RangeKey) {
  const from = rangeToFrom(range);
  return useQuery<VitalSeriesResponse>({
    queryKey: patientKeys.vitalsSeries(type, range),
    queryFn: () =>
      api<VitalSeriesResponse>(
        `/vitals/me/series?type=${encodeURIComponent(type)}&from=${encodeURIComponent(from)}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVitalsAlerts(days = 7) {
  return useQuery<{ items: VitalAlert[]; count: number }>({
    queryKey: patientKeys.vitalsAlerts(days),
    queryFn: () =>
      api<{ items: VitalAlert[]; count: number }>(
        `/vitals/me/alerts?days=${days}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

// ─── Appointments ──────────────────────────────────────────
export function useAppointments() {
  return useQuery<{ appointments: AppointmentRow[] }>({
    queryKey: patientKeys.appointments(),
    queryFn: () =>
      api<{ appointments: AppointmentRow[] }>("/appointments/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

// ─── Medical records ───────────────────────────────────────
export function useRecords(params: {
  type?: string;
  search?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.search) qs.set("search", params.search);
  if (params.limit) qs.set("limit", String(params.limit));
  return useQuery<{ records: RecordRow[] }>({
    queryKey: patientKeys.records({ ...params }),
    queryFn: () =>
      api<{ records: RecordRow[] }>(
        `/medical-records/me${qs.size ? "?" + qs.toString() : ""}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRecordStats() {
  return useQuery<RecordStats>({
    queryKey: patientKeys.recordStats(),
    queryFn: () => api<RecordStats>("/medical-records/me/stats"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRecord(id: string) {
  return useQuery<RecordRow>({
    queryKey: patientKeys.record(id),
    queryFn: () => api<RecordRow>(`/medical-records/${id}`),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(id),
  });
}

// ─── Medications ───────────────────────────────────────────
export function useMedications() {
  return useQuery<{ medicines: MedicineRow[] }>({
    queryKey: patientKeys.medicines(),
    queryFn: () =>
      api<{ medicines: MedicineRow[] }>("/medicines/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMedicationsToday() {
  return useQuery<{ medicines: MedicineRow[] }>({
    queryKey: patientKeys.medicinesToday(),
    queryFn: () =>
      api<{ medicines: MedicineRow[] }>("/medicines/today"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMedicationStats(days = 7) {
  return useQuery<MedicineStats>({
    queryKey: patientKeys.medicineStats(days),
    queryFn: () =>
      api<MedicineStats>(`/medicines/me/stats?days=${days}`),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

// ─── Timeline ──────────────────────────────────────────────
export function useTimeline(params: { limit?: number; kinds?: string[] } = {}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.kinds?.length) qs.set("kinds", params.kinds.join(","));
  return useQuery<{ events: TimelineEvent[] }>({
    queryKey: patientKeys.timeline({ ...params }),
    queryFn: () =>
      api<{ events: TimelineEvent[] }>(
        `/timeline/me${qs.size ? "?" + qs.toString() : ""}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

// ─── Messages ──────────────────────────────────────────────
export function useConversations() {
  return useQuery<{ conversations: Conversation[] }>({
    queryKey: patientKeys.conversations(),
    queryFn: () =>
      api<{ conversations: Conversation[] }>(
        "/patient-messages/conversations"
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useConversationMessages(conversationId: string) {
  return useQuery<{ messages: Message[] }>({
    queryKey: patientKeys.conversation(conversationId),
    queryFn: () =>
      api<{ messages: Message[] }>(
        `/patient-messages/conversations/${conversationId}/messages`
      ),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(conversationId),
  });
}

// ─── Notifications ─────────────────────────────────────────
export function useNotifications() {
  return useQuery<{ items: unknown[] }>({
    queryKey: patientKeys.notifications(),
    queryFn: () => api<{ items: unknown[] }>("/patient-notifications"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery<{ count: number }>({
    queryKey: patientKeys.unreadCount(),
    queryFn: () =>
      api<{ count: number }>("/patient-notifications/unread-count"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
