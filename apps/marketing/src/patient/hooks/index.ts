"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  rangeToFrom,
} from "@/patient/lib/query";
import type {
  AllergyRow,
  AppointmentRow,
  Conversation,
  LabResultRow,
  MedicineRow,
  MedicineStats,
  Message,
  NoteRow,
  RecordRow,
  RecordStats,
  RefillCandidate,
  SymptomRow,
  TimelineEvent,
  VaccinationAdministeredRow,
  VaccinationSlot,
  VitalAlert,
  VitalSeriesResponse,
  VitalType,
  WellnessResponse,
} from "@/patient/types/patient";

// Read-side hooks have moved to per-domain modules. This barrel
// re-exports them so existing imports keep working. Task 6 finishes the
// split for appointments, medicines, messages, notifications, allergies,
// vaccinations, and notes.
export * from "./profile";
export * from "./vitals";
export * from "./records";
export * from "./timeline";

// ─── Appointments ──────────────────────────────────────────
export function useAppointments() {
  return useQuery<{ appointments: AppointmentRow[] }>({
    queryKey: patientKeys.appointments(),
    queryFn: () =>
      api<{ appointments: AppointmentRow[] }>("/appointments/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAppointmentRecords(id: string) {
  return useQuery<{ appointment: AppointmentRow; records: RecordRow[] }>({
    queryKey: patientKeys.appointmentRecords(id),
    queryFn: () => api<{ appointment: AppointmentRow; records: RecordRow[] }>(`/appointments/${id}/records`),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useBookAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ appointment: AppointmentRow }>("/appointments", { method: "POST", json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.appointments() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ appointment: AppointmentRow }>(`/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.appointments() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, time }: { id: string; date: string; time: string }) =>
      api<{ appointment: AppointmentRow }>(`/appointments/${id}/reschedule`, {
        method: "PATCH",
        json: { date, time },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.appointments() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
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

export function useAddMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ medicine: MedicineRow }>("/medicines", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useEditMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; [key: string]: unknown }) =>
      api<{ medicine: MedicineRow }>(`/medicines/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useStopMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ medicine: MedicineRow }>(`/medicines/${id}/stop`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useTodayDoses() {
  return useQuery<{ doses: Array<{ id: string; medicineId: string; takenAt: string | null; skipped: boolean }> }>({
    queryKey: ["patient", "doses", "today"],
    queryFn: () => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });
      return api<{ doses: Array<{ id: string; medicineId: string; takenAt: string | null; skipped: boolean }> }>(`/doses/me?${params}`);
    },
    ...PATIENT_QUERY_DEFAULTS,
  });
}

function invalidateMedicationQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: patientKeys.all });
  qc.invalidateQueries({ queryKey: ["patient", "doses"] });
}

export function useMarkDoseTaken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api(`/doses/${id}/taken`, { method: "POST", json: { notes } }),
    onSuccess: () => invalidateMedicationQueries(qc),
  });
}

export function useSkipDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api(`/doses/${id}/skip`, { method: "POST", json: { notes } }),
    onSuccess: () => invalidateMedicationQueries(qc),
  });
}

export function useUntakeDose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/doses/${id}/taken`, { method: "DELETE" }),
    onSuccess: () => invalidateMedicationQueries(qc),
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
  return useQuery<{
    conversation: Conversation;
    doctor: { id: string; userId: string; name: string; photo: string | null } | null;
    messages: Message[];
  }>({
    queryKey: patientKeys.conversation(conversationId),
    queryFn: () =>
      api<{
        conversation: Conversation;
        doctor: { id: string; userId: string; name: string; photo: string | null } | null;
        messages: Message[];
      }>(
        `/patient-messages/conversations/${conversationId}/messages`
      ),
    ...PATIENT_QUERY_DEFAULTS,
    enabled: Boolean(conversationId),
  });
}

export function useSendPatientMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<{ message: Message }>(`/patient-messages/conversations/${conversationId}/messages`, {
        method: "POST",
        json: { body },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: patientKeys.conversations() });
    },
  });
}

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>(`/patient-messages/conversations/${conversationId}/read`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: patientKeys.conversations() });
    },
  });
}

// ─── Notifications ─────────────────────────────────────────
export interface PatientNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  data?: unknown;
}

export function useNotifications() {
  return useQuery<{ notifications: PatientNotification[] }>({
    queryKey: patientKeys.notifications(),
    queryFn: () => api<{ notifications: PatientNotification[] }>("/notifications/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery<{ count: number }>({
    queryKey: patientKeys.unreadCount(),
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ notification: PatientNotification }>(`/notifications/${id}/read`, {
        method: "PUT",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.notifications() });
      qc.invalidateQueries({ queryKey: patientKeys.unreadCount() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ message: string }>("/notifications/read-all", { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.notifications() });
      qc.invalidateQueries({ queryKey: patientKeys.unreadCount() });
    },
  });
}

// ─── Allergies ─────────────────────────────────────────────
export function useAllergies() {
  return useQuery<{ allergies: AllergyRow[] }>({
    queryKey: patientKeys.allergies(),
    queryFn: () => api<{ allergies: AllergyRow[] }>("/allergies/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      substance: string;
      severity?: AllergyRow["severity"];
      reaction?: string | null;
      onsetDate?: string | null;
      notes?: string | null;
    }) =>
      api<{ allergy: AllergyRow }>("/allergies/me", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}

export function useEditAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Omit<AllergyRow, "id" | "recordedAt">> & { id: string }) =>
      api<{ allergy: AllergyRow }>(`/allergies/${id}`, { method: "PATCH", json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}

export function useDeleteAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/allergies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}

// ─── Vaccinations ──────────────────────────────────────────
export function useVaccinations() {
  return useQuery<{ administered: VaccinationAdministeredRow[]; catalog: unknown[] }>({
    queryKey: patientKeys.vaccinations(),
    queryFn: () =>
      api<{ administered: VaccinationAdministeredRow[]; catalog: unknown[] }>(
        "/vaccinations/me"
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVaccinationsDue() {
  return useQuery<{ due: VaccinationSlot[]; overdue: VaccinationSlot[]; upcoming: VaccinationSlot[] }>({
    queryKey: patientKeys.vaccinationsDue(),
    queryFn: () =>
      api<{
        due: VaccinationSlot[];
        overdue: VaccinationSlot[];
        upcoming: VaccinationSlot[];
      }>("/vaccinations/me/due"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      vaccineName: string;
      vaccineId?: string;
      dose?: string | null;
      administeredAt?: string;
      recordDate?: string;
      provider?: string | null;
      notes?: string | null;
    }) =>
      api<{ vaccination: VaccinationAdministeredRow }>("/vaccinations/me", {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.vaccinations() });
      qc.invalidateQueries({ queryKey: patientKeys.vaccinationsDue() });
    },
  });
}

// ─── Notes ─────────────────────────────────────────────────
export function useNotes() {
  return useQuery<{ notes: NoteRow[] }>({
    queryKey: patientKeys.notes(),
    queryFn: () => api<{ notes: NoteRow[] }>("/notes/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string | null; body: string; pinned?: boolean }) =>
      api<{ note: NoteRow }>("/notes", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

export function useEditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Omit<NoteRow, "id" | "createdAt" | "updatedAt">> & { id: string }) =>
      api<{ note: NoteRow }>(`/notes/${id}`, { method: "PUT", json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

// ─── Refill-due ────────────────────────────────────────────
export function useRefillDue(days = 14) {
  return useQuery<{ refills: RefillCandidate[]; count: number }>({
    queryKey: [...patientKeys.medicineRefills(), days] as const,
    queryFn: () =>
      api<{ refills: RefillCandidate[]; count: number }>(`/medicines/refill-due?days=${days}`),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
