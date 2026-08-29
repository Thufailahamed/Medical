"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  type RangeKey,
  patientKeys,
  rangeToFrom,
} from "@/patient/lib/query";
import type {
  AllergyRow,
  AppointmentRow,
  Conversation,
  HealthSummary,
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
  VitalContext,
  VitalSeriesResponse,
  VitalType,
  VitalsDerived,
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
    queryFn: async () => {
      const res = await api<{ alerts?: VitalAlert[]; items?: VitalAlert[]; count?: number }>(
        `/vitals/me/alerts?days=${days}`
      );
      const items = res.items ?? res.alerts ?? [];
      return {
        items,
        count: res.count ?? items.length,
      };
    },
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

// ─── Vitals + Symptoms ─────────────────────────────────────
export function useVitalsDerived() {
  return useQuery<{ derived: VitalsDerived }>({
    queryKey: patientKeys.vitalsDerived(),
    queryFn: () => api<{ derived: VitalsDerived }>("/vitals/me/derived"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVitalsSeriesRaw(type: VitalType, days: number) {
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  return useQuery<VitalSeriesResponse>({
    queryKey: [...patientKeys.vitalsSeries(type, "week"), "raw", days] as const,
    queryFn: () =>
      api<VitalSeriesResponse>(
        `/vitals/me/series?type=${encodeURIComponent(type)}&from=${encodeURIComponent(from)}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useSymptoms() {
  return useQuery<{ symptoms: SymptomRow[] }>({
    queryKey: patientKeys.symptoms(),
    queryFn: () => api<{ symptoms: SymptomRow[] }>("/vitals/symptoms/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: VitalType;
      value: number;
      secondaryValue?: number | null;
      context?: VitalContext | null;
      recordedAt?: string;
      notes?: string | null;
    }) =>
      api<{ vital: { id: string } }>("/vitals", { method: "POST", json: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "vitals"] });
    },
  });
}

export function useDeleteVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/vitals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "vitals"] });
    },
  });
}

export function useAddSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      symptom: string;
      severity?: SymptomRow["severity"];
      startedAt?: string;
      notes?: string | null;
    }) =>
      api<{ symptom: SymptomRow }>("/vitals/symptoms", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.symptoms() }),
  });
}

export function useDeleteSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/vitals/symptoms/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.symptoms() }),
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
    mutationFn: (id: string) => api<{ message: string }>(`/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

// ─── Lab Results ───────────────────────────────────────────
export function useLabResults(params: { months?: number; test?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.months) qs.set("months", String(params.months));
  if (params.test) qs.set("test", params.test);
  return useQuery<{ items: LabResultRow[] }>({
    queryKey: patientKeys.labResults(params),
    queryFn: () =>
      api<{ items: LabResultRow[] }>(
        `/medical-records/me/lab-results${qs.size ? "?" + qs.toString() : ""}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
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
