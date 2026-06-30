import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import { api, apiWithRefresh } from "@/lib/api";
import { setLastAllergies, setLastMeds } from "@/lib/offline-cache";

const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === "true";

async function getAuthToken(): Promise<string | null> {
  if (DEV_MODE) {
    return "dev-token";
  }
  try {
    return await SecureStore.getItemAsync("auth_token");
  } catch {
    return null;
  }
}
import type { Patient, MedicalRecord, Appointment } from "@healthcare/shared";

// ─── Patient Profile ─────────────────────────────────────
export type PatientProfileResponse = {
  patient: {
    patients: {
      id: string;
      userId: string;
      bloodGroup: string | null;
      height: number | null;
      weight: number | null;
      dateOfBirth: string | null;
      gender: string | null;
      allergies: string | null;
      medicalConditions: string | null;
      emergencyContacts: string | null;
      lifestyle: string | null;
      insuranceId: string | null;
    };
    users: {
      id: string;
      supabaseId: string;
      name: string;
      email: string | null;
      phone: string | null;
      photo: string | null;
      verified: boolean;
      role: string;
    };
  };
};

export function usePatientProfile() {
  return useQuery({
    queryKey: ["patient", "me"],
    queryFn: () => apiWithRefresh<PatientProfileResponse>("/patients/me"),
  });
}

export function useUpdatePatientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ patient: Patient }>("/patients/me", {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient"] });
      queryClient.invalidateQueries({ queryKey: ["wellness"] });
    },
  });
}

// ─── Medical Records ─────────────────────────────────────
export type UseMedicalRecordsOpts = {
  limit?: number;
  offset?: number;
  type?: string;
  query?: string;
  tags?: string[];
  archived?: "all" | "only"; // "all" = include archived; default = active only
  scope?: "own" | "family"; // "own" = patient only; "family" = union of own + family-member records
  familyMemberId?: string | null;
  sort?: "newest" | "oldest" | "relevance";
};

export function useMedicalRecords(opts?: UseMedicalRecordsOpts) {
  const key = [
    "medical-records",
    opts?.limit ?? 100,
    opts?.offset ?? 0,
    opts?.type ?? "all",
    opts?.query ?? "",
    opts?.tags?.join(",") ?? "",
    opts?.archived ?? "active",
    opts?.scope ?? "family",
    opts?.familyMemberId ?? "",
    opts?.sort ?? "newest",
  ];
  return useQuery({
    queryKey: key,
    queryFn: () => {
      const params = new URLSearchParams();
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      if (opts?.type && opts.type !== "all") params.set("type", opts.type);
      if (opts?.query) params.set("q", opts.query);
      if (opts?.tags?.length) params.set("tags", opts.tags.join(","));
      if (opts?.archived === "only") params.set("archived", "only");
      if (opts?.archived === "all") params.set("archived", "all");
      if (opts?.scope) params.set("scope", opts.scope);
      if (opts?.familyMemberId) params.set("familyMemberId", opts.familyMemberId);
      if (opts?.sort) params.set("sort", opts.sort);
      const qs = params.toString();
      return api<{ records: any[]; total: number; limit: number; offset: number }>(
        `/medical-records/me${qs ? `?${qs}` : ""}`
      );
    },
    staleTime: 30_000,
  });
}

export function useRecordStats() {
  return useQuery({
    queryKey: ["medical-records", "stats"],
    queryFn: () =>
      api<{ total: number; byType: Record<string, number>; lastDate: string | null }>(
        "/medical-records/me/stats"
      ),
    staleTime: 60_000,
  });
}

export function useMedicalRecord(id: string | string[] | undefined) {
  const recordId = Array.isArray(id) ? id[0] : id;
  return useQuery({
    queryKey: ["medical-records", recordId],
    queryFn: () => api<{ record: any }>(`/medical-records/${recordId}`),
    enabled: !!recordId,
    select: (data) => data.record,
  });
}

export function useCreateMedicalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ record: MedicalRecord }>("/medical-records", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
    },
  });
}

export function useEditMedicalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: any }) =>
      api<{ record: any }>(`/medical-records/${id}`, {
        method: "PATCH",
        body: data,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records", vars.id] });
    },
  });
}

export function useDeleteMedicalRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/medical-records/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
    },
  });
}

// ─── V4: bulk operations on medical records ─────────────────
function bulkKeys() {
  return {
    all: ["medical-records", "doctor-portal", "records"] as const,
  };
}

export function useBulkDeleteRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deleted: number; denied: Array<{ id: string; reason: string }> }>(
        "/medical-records/bulk-delete",
        { method: "POST", body: { ids } }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkKeys().all });
    },
  });
}

export function useBulkArchiveRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ archived: number; denied: Array<{ id: string; reason: string }> }>(
        "/medical-records/bulk-archive",
        { method: "POST", body: { ids } }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkKeys().all });
    },
  });
}

export function useBulkRestoreRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ restored: number; denied: Array<{ id: string; reason: string }> }>(
        "/medical-records/bulk-restore",
        { method: "POST", body: { ids } }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkKeys().all });
    },
  });
}

export function useBulkTagRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; add?: string[]; remove?: string[] }) =>
      api<{ updated: number; denied: Array<{ id: string; reason: string }> }>(
        "/medical-records/bulk-tag",
        { method: "POST", body: data }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkKeys().all });
    },
  });
}

export function useBulkMoveRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; familyMemberId: string | null }) =>
      api<{ moved: number; denied: Array<{ id: string; reason: string }> }>(
        "/medical-records/bulk-move",
        { method: "POST", body: data }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkKeys().all });
    },
  });
}

export function useTimeline(patientId: string) {
  return useQuery({
    queryKey: ["timeline", patientId],
    queryFn: () => api<{ timeline: any }>(`/medical-records/timeline/${patientId}`),
    enabled: !!patientId,
  });
}

// ─── Prescriptions list for patient ──────────────────────
export function useMyPrescriptions() {
  return useQuery({
    queryKey: ["prescriptions", "me"],
    queryFn: () => api<{ prescriptions: any[] }>("/medical-records/me/prescriptions"),
  });
}

// ─── Appointments ────────────────────────────────────────
export function useMyAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: () => api<{ appointments: any[] }>("/appointments/me"),
  });
}

export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ appointment: Appointment }>("/appointments", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

// ─── Family Members ──────────────────────────────────────
export function useFamilyMembers() {
  return useQuery({
    queryKey: ["family"],
    queryFn: () => api<{ family: any[] }>("/patients/me/family"),
  });
}

export function useAddFamilyMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ member: any }>("/patients/me/family", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

export function useDeleteFamilyMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/patients/me/family/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

// ─── Medicines ───────────────────────────────────────────
export function useMyMedicines(opts?: { includeInactive?: boolean }) {
  const q = useQuery({
    queryKey: ["medicines", opts?.includeInactive ? "all" : "active"],
    queryFn: () =>
      api<{ medicines: any[] }>(
        `/medicines/me${opts?.includeInactive ? "?includeInactive=true" : ""}`
      ),
  });
  // V3: hydrate offline cache (active only)
  if (!opts?.includeInactive && q.data?.medicines) {
    setLastMeds(
      q.data.medicines
        .filter((m: any) => !m.endDate)
        .map((m: any) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
        }))
    );
  }
  return q;
}

export function useMedicineStats(days: number = 7) {
  return useQuery({
    queryKey: ["medicines", "stats", days],
    queryFn: () =>
      api<{
        activeCount: number;
        pausedCount: number;
        todayCount: number;
        todayTaken: number;
        streakDays: number;
        last7Days: Array<{
          date: string;
          total: number;
          taken: number;
          skipped: number;
          missed: number;
          pct: number;
        }>;
      }>(`/medicines/me/stats?days=${days}`),
    staleTime: 60_000,
  });
}

// F3: list missed doses (past, never taken, not skipped).
export function useMissedDoses(limit: number = 50) {
  return useQuery({
    queryKey: ["doses", "missed", limit],
    queryFn: () => api<{ doses: any[]; count: number }>(`/doses/missed?limit=${limit}`),
    refetchInterval: 60_000,
  });
}

// F3: history of doses for an arbitrary window.
export function useDosesHistory(opts: { from?: string; to?: string; medicineId?: string } = {}) {
  return useQuery({
    queryKey: ["doses", "history", opts],
    queryFn: () => {
      const p = new URLSearchParams();
      if (opts.from) p.set("from", opts.from);
      if (opts.to) p.set("to", opts.to);
      if (opts.medicineId) p.set("medicineId", opts.medicineId);
      const qs = p.toString();
      return api<{ doses: any[] }>(`/doses/me${qs ? `?${qs}` : ""}`);
    },
  });
}

export type MedicineSuggestion = {
  name: string;
  category?: string;
  commonDosages: string[];
  commonFrequencies: string[];
  commonTimings: string[];
  source: "history" | "catalog";
  score: number;
};

export function useMedicineSuggestions(query: string, limit = 8) {
  return useQuery({
    queryKey: ["medicines", "suggest", query.trim().toLowerCase(), limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (query.trim()) params.set("q", query.trim());
      return api<{
        suggestions: MedicineSuggestion[];
        query: string;
        count: number;
      }>(`/medicines/suggest?${params.toString()}`);
    },
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
  });
}

export function useMedicine(id: string) {
  return useQuery({
    queryKey: ["medicine", id],
    queryFn: () => api<{ medicine: any }>(`/medicines/${id}`),
    enabled: !!id,
  });
}

export function useTodayMedicines() {
  return useQuery({
    queryKey: ["medicines", "today"],
    queryFn: () => api<{ medicines: any[] }>("/medicines/today"),
  });
}

export function useAddMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ medicine: any }>("/medicines", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      queryClient.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}

export function useUpdateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api<{ medicine: any }>(`/medicines/${id}`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
  });
}

export function useEditMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: any }) =>
      api<{ medicine: any }>(`/medicines/${id}`, {
        method: "PATCH",
        body: data,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      queryClient.invalidateQueries({ queryKey: ["medicine", vars.id] });
    },
  });
}

export function useDeleteMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/medicines/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
  });
}

export function useStopMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ medicine: any }>(`/medicines/${id}/stop`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      queryClient.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}

// ─── Medicine Doses (adherence) ───────────────────────────
export function useTodayDoses() {
  return useQuery({
    queryKey: ["doses", "today"],
    queryFn: () => {
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      const params = `?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`;
      return api<{ doses: any[] }>(`/doses/me${params}`);
    },
    refetchInterval: 60_000,
  });
}

export function useScheduleTodayDoses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ doses: any[]; count: number }>("/doses/schedule/today", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doses"] });
      // M6: schedule can introduce new medicines into the Today view if
      // the med list was racing with the schedule call. Refresh the
      // /medicines/today query so the screen reflects the new schedule.
      queryClient.invalidateQueries({ queryKey: ["medicines", "today"] });
    },
  });
}

export function useMarkDoseTaken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, takenAt, notes }: { id: string; takenAt?: string; notes?: string }) =>
      api(`/doses/${id}/taken`, { method: "POST", body: { takenAt, notes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}

export function useSkipDose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api(`/doses/${id}/skip`, { method: "POST", body: { notes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}

export function useUntakeDose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/doses/${id}/taken`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}

// ─── Vitals ──────────────────────────────────────────────
export function useVitals(type?: string) {
  return useQuery({
    queryKey: ["vitals", type || "all"],
    queryFn: () =>
      api<{ vitals: any[] }>(`/vitals/me${type ? `?type=${type}` : ""}`),
  });
}

export function useAddVital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ vital: any }>("/vitals", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vitals"] });
    },
  });
}

export function useDeleteVital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/vitals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vitals"] });
    },
  });
}

// ─── Symptoms ────────────────────────────────────────────
export function useSymptoms() {
  return useQuery({
    queryKey: ["symptoms"],
    queryFn: () => api<{ symptoms: any[] }>("/vitals/symptoms/me"),
  });
}

export function useAddSymptom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ symptom: any }>("/vitals/symptoms", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["symptoms"] });
    },
  });
}

export function useDeleteSymptom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/vitals/symptoms/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["symptoms"] });
    },
  });
}

// ─── Patient Notes ───────────────────────────────────────
export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: () => api<{ notes: any[] }>("/notes/me"),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; body: string; pinned?: boolean }) =>
      api<{ note: any }>("/notes", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api<{ note: any }>(`/notes/${id}`, { method: "PUT", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

// ─── Audit Log ───────────────────────────────────────────
export function useAuditLog() {
  return useQuery({
    queryKey: ["audit"],
    queryFn: () => api<{ auditLogs: any[] }>("/audit/me"),
  });
}

// ─── Insurance ───────────────────────────────────────────
export function useInsurance() {
  return useQuery({
    queryKey: ["insurance"],
    queryFn: () => api<{ insurance: any[] }>("/insurance/me"),
  });
}

export function useAddInsurance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ insurance: any }>("/insurance", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance"] });
    },
  });
}

export function useDeleteInsurance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/insurance/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance"] });
    },
  });
}

// ─── Lab Reports ─────────────────────────────────────────
export function useLabReports() {
  return useQuery({
    queryKey: ["labs"],
    queryFn: () => api<{ reports: any[] }>("/labs/me"),
  });
}

// ─── Hospitals ───────────────────────────────────────────
export function useHospitals(query: string = "") {
  return useQuery({
    queryKey: ["hospitals", query],
    queryFn: () =>
      api<{ hospitals: any[] }>(`/hospitals${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  });
}

// ─── Emergency ───────────────────────────────────────────
export function useTriggerSOS() {
  return useMutation({
    mutationFn: (data: { latitude?: number; longitude?: number; message?: string }) =>
      api<{ emergency: any; notifiedContacts: any[]; sharePayload: any }>(
        "/emergency/sos",
        { method: "POST", body: data }
      ),
  });
}

export function useEmergencyQR() {
  return useQuery({
    queryKey: ["emergency", "qr"],
    queryFn: () => api<{ qrData: any }>("/emergency/qr"),
  });
}

// ─── File Upload ─────────────────────────────────────────
export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, recordId }: { file: File; recordId?: string }) => {
      const token = await getAuthToken();

      const formData = new FormData();
      formData.append("file", file);
      if (recordId) formData.append("recordId", recordId);

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/files/upload`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
    },
  });
}

// ─── Record + file together (patient upload) ─────────────
export function useUploadRecordWithFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      file: File;
      recordType: string;
      title: string;
      date: string;
      diagnosis?: string;
      summary?: string;
      notes?: string;
    }) => {
      const token = await getAuthToken();

      // Pull patientId from the cached profile if available, otherwise
      // hit the API via the shared helper (handles 401 refresh).
      const cached = queryClient.getQueryData<any>(["patient", "me"]);
      let patientId: string | undefined =
        cached?.patient?.patients?.id || cached?.patient?.id;
      if (!patientId) {
        const profile = await api<{ patient: { patients: { id: string } } }>(
          "/patients/me"
        );
        patientId = profile?.patient?.patients?.id;
      }
      if (!patientId) throw new Error("Patient profile not found");

      const formData = new FormData();
      formData.append("file", args.file as any);
      formData.append("recordType", args.recordType);
      formData.append("title", args.title);
      formData.append("date", args.date);
      formData.append("patientId", patientId);
      if (args.diagnosis) formData.append("diagnosis", args.diagnosis);
      if (args.summary) formData.append("summary", args.summary);
      if (args.notes) formData.append("notes", args.notes);

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/files/upload-with-record`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Upload failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["patient", "me"] });
    },
  });
}

// ─── File download (signed URL → fetch stream) ───────────
export function useDownloadFile() {
  return useMutation({
    mutationFn: async (key: string) => {
      const urlData = await api<{ url: string }>(`/files/download/${encodeURIComponent(key)}`);

      const token = await getAuthToken();

      // If the server returned our own stream proxy, attach auth.
      // If it returned a real R2 presigned URL, fetch directly.
      const isProxy = urlData.url.startsWith("/files/");
      const fetchUrl = isProxy
        ? `${process.env.EXPO_PUBLIC_API_URL}${urlData.url}`
        : urlData.url;

      const response = await fetch(fetchUrl, {
        headers: {
          ...(token && isProxy ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      return {
        blob: await response.blob(),
        contentType: response.headers.get("Content-Type"),
      };
    },
  });
}

// ─── Wellness ────────────────────────────────────────────
export type WellnessLevel = {
  label: string;
  tone: "success" | "info" | "warning" | "danger";
};

export type WellnessComponent = {
  key: string;
  label: string;
  score: number;
  max: number;
  tip?: string;
};

export type WellnessResponse = {
  score: number;
  level: WellnessLevel;
  components: WellnessComponent[];
  topTip?: string;
  bmi: number | null;
  bmiCategory: string;
  adherence: { taken: number; scheduled: number; ratio: number | null };
  vitals: { readings: number; recent: number };
  profile: { filled: number; total: number; missing: string[] };
  engagement: {
    activeMedicines: number;
    recentRecords: number;
    recentVitals: number;
    completedAppointments: number;
    noShows: number;
  };
  updatedAt: string;
};

export function useWellness() {
  return useQuery({
    queryKey: ["wellness", "me"],
    queryFn: () => apiWithRefresh<WellnessResponse>("/wellness/me"),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

// ─── Notifications ───────────────────────────────────────
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ notifications: any[] }>("/notifications/me"),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(`/notifications/read-all`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Doctor (existing) ───────────────────────────────────
export function useDoctorDashboard() {
  return useQuery({
    queryKey: ["doctor", "dashboard"],
    queryFn: () => api<any>("/doctor/dashboard"),
  });
}

export type UseDoctorRecordsOpts = {
  limit?: number;
  offset?: number;
  type?: string;
  query?: string;
  tags?: string[];
  archived?: "all" | "only";
  patientId?: string;
  sort?: "newest" | "oldest" | "relevance";
};

export function useDoctorRecords(opts?: UseDoctorRecordsOpts) {
  const key = [
    "doctor-portal",
    "records",
    opts?.limit ?? 50,
    opts?.offset ?? 0,
    opts?.type ?? "all",
    opts?.query ?? "",
    opts?.tags?.join(",") ?? "",
    opts?.archived ?? "active",
    opts?.patientId ?? "",
    opts?.sort ?? "newest",
  ];
  return useQuery({
    queryKey: key,
    queryFn: () => {
      const params = new URLSearchParams();
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      if (opts?.type && opts.type !== "all") params.set("type", opts.type);
      if (opts?.query) params.set("q", opts.query);
      if (opts?.tags?.length) params.set("tags", opts.tags.join(","));
      if (opts?.archived === "only") params.set("archived", "only");
      if (opts?.archived === "all") params.set("archived", "all");
      if (opts?.patientId) params.set("patientId", opts.patientId);
      if (opts?.sort) params.set("sort", opts.sort);
      const qs = params.toString();
      return api<{ records: any[]; total: number; limit: number; offset: number }>(
        `/doctor-portal/records${qs ? `?${qs}` : ""}`
      );
    },
    staleTime: 30_000,
  });
}

export function useDoctorMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["doctor", "me"],
    queryFn: () =>
      api<{ doctor: { doctors: any; users: any } | null }>("/doctor/me"),
    staleTime: 60_000,
    ...options,
  });
}

export function useDoctorPrescriptions() {
  return useQuery({
    queryKey: ["doctor", "prescriptions"],
    queryFn: () => api<{ prescriptions: any[] }>("/doctor/prescriptions"),
  });
}

export function useDoctorClinicalNotes(limit = 50) {
  return useQuery({
    queryKey: ["doctor-portal", "clinical-notes", "list", limit],
    queryFn: () =>
      api<{ notes: any[]; count: number }>(
        `/doctor-portal/clinical-notes?limit=${limit}`
      ),
    staleTime: 30_000,
  });
}

export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: ["doctor", "search", query],
    queryFn: () => api<{ patients: any[] }>(`/doctor/search-patients?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      api<{ prescription: any }>("/doctor/prescriptions", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor"] });
    },
  });
}

// ─── Doctor search (patient-facing) ──────────────────────
export function useDoctorSearch(opts: {
  query?: string;
  specialization?: string;
  hospitalId?: string;
}) {
  const params = new URLSearchParams();
  if (opts.query) params.set("query", opts.query);
  if (opts.specialization) params.set("specialization", opts.specialization);
  if (opts.hospitalId) params.set("hospitalId", opts.hospitalId);

  return useQuery({
    queryKey: ["doctors", "search", params.toString()],
    queryFn: () =>
      api<{ doctors: any[] }>(`/doctor/search?${params.toString()}`),
  });
}

export function useSpecialties() {
  return useQuery({
    queryKey: ["doctors", "specialties"],
    queryFn: () => api<{ specialties: string[] }>("/doctor/specialties"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDoctorAvailability(doctorId: string, date: string) {
  return useQuery({
    queryKey: ["doctor", doctorId, "availability", date],
    queryFn: () =>
      api<{ slots: { time: string; available: boolean; queueNumber?: number }[]; bookedTimes: string[] }>(
        `/doctor/${doctorId}/availability?date=${date}`
      ),
    enabled: !!doctorId && !!date,
  });
}

export function useDoctor(doctorId: string) {
  return useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: () => api<{ doctor: any; hospital: any }>(`/doctor/${doctorId}`),
    enabled: !!doctorId,
  });
}

// ─── Password recovery ───────────────────────────────────
export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: { email: string; redirectTo?: string }) =>
      api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: data,
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { accessToken: string; newPassword: string }) =>
      api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: data,
      }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: data,
      }),
  });
}

// ─── Appointment cancel (patient) ────────────────────────
export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; date: string; time: string }) =>
      api<{ appointment: any; queueNumber: number }>(
        `/appointments/${input.id}/reschedule`,
        { method: "PATCH", body: { date: input.date, time: input.time } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

export function useAppointmentRecords(id: string | null) {
  return useQuery({
    queryKey: ["appointments", id, "records"],
    queryFn: () =>
      api<{ appointment: any; records: any[] }>(
        `/appointments/${id}/records`
      ),
    enabled: !!id,
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ appointment: any }>(`/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

// ─── Doctor Portal (V2) ──────────────────────────────────
export function useDoctorQueue(date?: string) {
  const d = date || new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["doctor-portal", "queue", d],
    queryFn: () =>
      api<{ date: string; count: number; queue: any[] }>(
        `/doctor-portal/queue?date=${encodeURIComponent(d)}`
      ),
    refetchInterval: 30_000,
  });
}

export function usePatientSummary(patientId: string | null) {
  return useQuery({
    queryKey: ["doctor-portal", "patient", patientId, "summary"],
    queryFn: () =>
      api<{
        patient: any;
        user: any;
        records: any[];
        activeMedicines: any[];
        prescriptions: any[];
        labReports: any[];
        labOrders: any[];
        vitals: any[];
        pastAppointments: any[];
      }>(`/doctor-portal/patients/${patientId}/summary`),
    enabled: !!patientId,
  });
}

export function useCreateClinicalNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      hospitalId?: string;
      title: string;
      notes: string;
      diagnosis?: string;
    }) =>
      api<{ record: any }>(`/doctor-portal/clinical-notes`, {
        method: "POST",
        body: data,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "patient", vars.patientId, "summary"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal"] });
    },
  });
}

export function useFollowUps(opts: { upcoming?: boolean } = {}) {
  const params = new URLSearchParams();
  if (opts.upcoming) params.set("upcoming", "true");
  const qs = params.toString();
  return useQuery({
    queryKey: ["doctor-portal", "follow-ups", qs],
    queryFn: () =>
      api<{ followUps: any[] }>(
        `/doctor-portal/follow-ups${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      hospitalId?: string;
      title: string;
      notes?: string;
      followUpDate: string;
    }) =>
      api<{ record: any }>(`/doctor-portal/follow-ups`, {
        method: "POST",
        body: data,
      }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "follow-ups"] });
      // Follow-up lands in medical_records; refresh the patient summary
      // bundle so patient-detail shows it without a manual reload.
      qc.invalidateQueries({
        queryKey: ["doctor-portal", "patient", vars.patientId],
      });
    },
  });
}

export function useUpdateFollowUpStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      status: "pending" | "completed" | "cancelled";
    }) =>
      api<{ record: any }>(
        `/doctor-portal/follow-ups/${data.id}/status`,
        { method: "PATCH", body: { status: data.status } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "follow-ups"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "patient"] });
    },
  });
}

export function useLabOrders(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();
  return useQuery({
    queryKey: ["doctor-portal", "lab-orders", qs],
    queryFn: () =>
      api<{ orders: any[] }>(`/doctor-portal/lab-orders${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateLabOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      hospitalId?: string;
      tests: string[];
      priority: "routine" | "urgent" | "stat";
      notes?: string;
    }) =>
      api<{ order: any }>(`/doctor-portal/lab-orders`, {
        method: "POST",
        body: data,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "lab-orders"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "patient", vars.patientId, "summary"] });
    },
  });
}

export function useUpdateLabOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      status?: "ordered" | "sample_collected" | "in_progress" | "completed" | "cancelled";
      resultSummary?: string;
      resultUrl?: string;
    }) =>
      api<{ order: any }>(`/doctor-portal/lab-orders/${data.id}`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "lab-orders"] });
    },
  });
}

export function useDoctorAvailabilityMe() {
  return useQuery({
    queryKey: ["doctor-portal", "availability"],
    queryFn: () =>
      api<{ availability: any[] }>(`/doctor-portal/availability`),
  });
}

export function useUpdateDoctorAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      schedule: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        slotMinutes: number;
        active: boolean;
      }[];
    }) =>
      api<{ availability: any[] }>(`/doctor-portal/availability`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "availability"] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show";
      notes?: string;
    }) =>
      api<{ appointment: any }>(
        `/doctor-portal/appointments/${data.id}/status`,
        { method: "POST", body: { status: data.status, notes: data.notes } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-portal"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}

// ─── Walk-ins ────────────────────────────────────────────
export function useWalkIns(opts?: {
  date?: string;
  status?: string;
  doctorId?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.date) params.set("date", opts.date);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.doctorId) params.set("doctorId", opts.doctorId);
  const qs = params.toString();
  return useQuery({
    queryKey: ["walk-ins", opts?.date || "", opts?.status || "", opts?.doctorId || ""],
    queryFn: () => api<{ walkIns: any[] }>(`/walk-ins${qs ? `?${qs}` : ""}`),
    refetchInterval: 30_000,
  });
}

export function useCreateWalkIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      patientId: string;
      doctorId: string;
      reason?: string;
      priority?: "routine" | "urgent";
    }) =>
      api<{ walkIn: any }>("/walk-ins", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue"] });
    },
  });
}

export function useUpdateWalkIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status?: "waiting" | "in_consultation" | "completed" | "no_show";
      notes?: string;
    }) =>
      api<{ walkIn: any }>(`/walk-ins/${input.id}`, {
        method: "PATCH",
        body: { status: input.status, notes: input.notes },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walk-ins"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "queue"] });
    },
  });
}

export function useWalkInSearch(q: string) {
  return useQuery({
    queryKey: ["walk-ins", "search", q],
    queryFn: () =>
      api<{ patients: any[] }>(`/walk-ins/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });
}

// ─── Notification Preferences ────────────────────────────
const NOTIF_TYPES = [
  "appointment",
  "medicine",
  "lab_ready",
  "prescription",
  "vaccination",
  "insurance",
  "hospital",
  "emergency",
  "general",
] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences", "me"],
    queryFn: () =>
      api<{ preferences: any[] }>("/push/notification-preferences/me"),
    initialData: { preferences: NOTIF_TYPES.map((t) => ({ type: t, inApp: true, push: true })) },
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Array<{ type: string; inApp: boolean; push: boolean }>) =>
      api("/push/notification-preferences/me", {
        method: "PUT",
        body: { preferences },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}

// ─── Doctor Time Off ─────────────────────────────────────
export function useTimeOff(opts?: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const qs = params.toString();
  return useQuery({
    queryKey: ["doctor-portal", "time-off", opts?.from || "", opts?.to || ""],
    queryFn: () =>
      api<{ timeOff: any[] }>(
        `/doctor-portal/time-off${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useAddTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      date: string;
      startTime?: string | null;
      endTime?: string | null;
      reason?: string | null;
    }) =>
      api<{ timeOff: any }>("/doctor-portal/time-off", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "time-off"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "availability"] });
    },
  });
}

export function useDeleteTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/doctor-portal/time-off/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-portal", "time-off"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "availability"] });
    },
  });
}

// ─── Hospital Portal (V2) ────────────────────────────────
export function useHospitalDashboard() {
  return useQuery({
    queryKey: ["hospital-portal", "dashboard"],
    queryFn: () =>
      api<{
        hospital: any;
        occupancy: {
          totalBeds: number;
          occupied: number;
          available: number;
          cleaning: number;
          maintenance: number;
          occupancyRate: number;
        };
        shift: "morning" | "evening" | "night";
        staffOnShift: any[];
        staffTotals: { total: number; nurses: number; doctors: number };
        admissions: any[];
      }>("/hospital-portal/dashboard"),
    refetchInterval: 60_000,
  });
}

export function useWards() {
  return useQuery({
    queryKey: ["hospital-portal", "wards"],
    queryFn: () => api<{ wards: any[] }>("/hospital-portal/wards"),
  });
}

export function useCreateWard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      type: "general" | "icu" | "pediatric" | "maternity" | "surgical" | "emergency";
      capacity: number;
      floor?: number;
    }) =>
      api<{ ward: any }>("/hospital-portal/wards", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "wards"] });
      qc.invalidateQueries({ queryKey: ["hospital-portal", "dashboard"] });
    },
  });
}

export function useUpdateWard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; [k: string]: any }) =>
      api<{ ward: any }>(`/hospital-portal/wards/${data.id}`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "wards"] });
    },
  });
}

export function useDeleteWard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/hospital-portal/wards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "wards"] });
      qc.invalidateQueries({ queryKey: ["hospital-portal", "dashboard"] });
    },
  });
}

export function useBeds(wardId?: string) {
  const params = wardId ? `?wardId=${encodeURIComponent(wardId)}` : "";
  return useQuery({
    queryKey: ["hospital-portal", "beds", wardId || "all"],
    queryFn: () =>
      api<{ beds: any[] }>(`/hospital-portal/beds${params}`),
  });
}

export function useCreateBed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      wardId: string;
      bedNumber: string;
      status?:
        | "available"
        | "occupied"
        | "cleaning"
        | "maintenance"
        | "reserved";
      notes?: string;
    }) =>
      api<{ bed: any }>("/hospital-portal/beds", {
        method: "POST",
        body: data,
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "beds"] });
      qc.invalidateQueries({ queryKey: ["hospital-portal", "dashboard"] });
    },
  });
}

export function useUpdateBedStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      status:
        | "available"
        | "occupied"
        | "cleaning"
        | "maintenance"
        | "reserved";
    }) =>
      api<{ bed: any }>(`/hospital-portal/beds/${data.id}/status`, {
        method: "PUT",
        body: { status: data.status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "beds"] });
      qc.invalidateQueries({ queryKey: ["hospital-portal", "dashboard"] });
    },
  });
}

export function useAssignBed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { bedId: string; patientId: string; notes?: string }) =>
      api<{ assignment: any }>(`/hospital-portal/beds/${data.bedId}/assign`, {
        method: "POST",
        body: { patientId: data.patientId, notes: data.notes },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal"] });
    },
  });
}

export function useDischargeBed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bedId: string) =>
      api<{ assignment: any }>(
        `/hospital-portal/beds/${bedId}/discharge`,
        { method: "POST" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal"] });
    },
  });
}

export function useStaff() {
  return useQuery({
    queryKey: ["hospital-portal", "staff"],
    queryFn: () => api<{ staff: any[] }>("/hospital-portal/staff"),
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fullName: string;
      role:
        | "nurse"
        | "receptionist"
        | "technician"
        | "manager"
        | "housekeeping"
        | "security";
      shift: "morning" | "evening" | "night" | "rotating";
      phone?: string;
      email?: string;
      userId?: string;
    }) =>
      api<{ staff: any }>("/hospital-portal/staff", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "staff"] });
      qc.invalidateQueries({ queryKey: ["hospital-portal", "dashboard"] });
    },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; [k: string]: any }) =>
      api<{ staff: any }>(`/hospital-portal/staff/${data.id}`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "staff"] });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/hospital-portal/staff/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital-portal", "staff"] });
    },
  });
}

export function useHospitalPatients() {
  return useQuery({
    queryKey: ["hospital-portal", "patients"],
    queryFn: () =>
      api<{ patients: any[] }>("/hospital-portal/patients"),
    refetchInterval: 60_000,
  });
}

export function useAdmittedPatient(patientId: string | null) {
  return useQuery({
    queryKey: ["hospital-portal", "patient", patientId],
    queryFn: () =>
      api<{
        admission: any;
        patient: any;
        user: any;
        records: any[];
        vitals: any[];
      }>(`/hospital-portal/patients/${patientId}`),
    enabled: !!patientId,
  });
}

// ─── AI Module (V2) ──────────────────────────────────────
export type AiSummary = {
  patientSummary: string;
  diagnoses: string[];
  medicines: string[];
  history: string[];
  risks: string[];
  recentTests: string[];
};

export function useAiSummary() {
  return useMutation({
    mutationFn: (data: { patientId: string }) =>
      api<{ summary: AiSummary; cached?: boolean }>("/ai/summary", {
        method: "POST",
        body: data,
      }),
  });
}

export type LabExplanation = {
  explanation: string;
  recommendations: string[];
  abnormalValues: string[];
};

export function useAiLabExplain() {
  return useMutation({
    mutationFn: (data: {
      fileUrl: string;
      reportId?: string;
      textHint?: string;
    }) =>
      api<{ explanation: LabExplanation; cached?: boolean }>(
        "/ai/explain/lab-report",
        { method: "POST", body: data }
      ),
  });
}

export type DrugInteraction = {
  medicines: string[];
  severity: "minor" | "moderate" | "severe";
  note: string;
  source: "curated" | "model";
};

export function useAiDrugCheck() {
  return useMutation({
    mutationFn: (data: { medicines: string[] }) =>
      api<{
        interactions: DrugInteraction[];
        warnings?: string[];
      }>("/ai/drug-interaction", {
        method: "POST",
        body: data,
      }),
  });
}

export type OcrResult = {
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    timing?: string;
  }>;
  doctor?: string;
  date?: string;
  diagnosis?: string;
  note?: string;
};

export function useAiOcr() {
  return useMutation({
    mutationFn: (data: { fileUrl: string; textHint?: string }) =>
      api<{ result: OcrResult; cached?: boolean }>("/ai/ocr/prescription", {
        method: "POST",
        body: data,
      }),
  });
}

export function useChatSessions() {
  return useQuery({
    queryKey: ["chat", "sessions"],
    queryFn: () =>
      api<{ sessions: any[] }>("/chat/sessions"),
    staleTime: 30_000,
  });
}

export function useCreateChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; patientId?: string }) =>
      api<{ session: any }>("/chat/sessions", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ["chat", "session", sessionId, "messages"],
    queryFn: () =>
      api<{ session: any; messages: any[] }>(
        `/chat/sessions/${sessionId}/messages`
      ),
    enabled: !!sessionId,
    refetchInterval: 30_000,
  });
}

export function useSendChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; content: string }) =>
      api<{ userMessage: any; assistantMessage: any }>(
        `/chat/sessions/${data.sessionId}/messages`,
        { method: "POST", body: { content: data.content } }
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["chat", "session", vars.sessionId, "messages"],
      });
      qc.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });
}

export function useDeleteChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/chat/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });
}

// ─── V3: Allergies (structured) ─────────────────────────
export type Allergy = {
  id: string;
  patientId: string;
  substance: string;
  severity: "mild" | "moderate" | "severe" | "critical";
  reaction: string | null;
  onsetDate: string | null;
  notes: string | null;
  active: number | boolean;
  createdAt: string;
};

export function useAllergies(opts?: { activeOnly?: boolean }) {
  const q = useQuery({
    queryKey: ["allergies", opts?.activeOnly ? "active" : "all"],
    queryFn: () => api<{ allergies: Allergy[] }>("/allergies/me"),
    staleTime: 30_000,
  });
  // V3: hydrate offline cache
  if (q.data?.allergies) {
    setLastAllergies(
      q.data.allergies.map((a) => ({
        substance: a.substance,
        severity: a.severity,
        reaction: a.reaction,
      }))
    );
  }
  return q;
}

export function useAddAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      substance: string;
      severity?: "mild" | "moderate" | "severe" | "critical";
      reaction?: string;
      onsetDate?: string;
      notes?: string;
    }) =>
      api<{ allergy: Allergy }>("/allergies/me", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allergies"] });
    },
  });
}

export function useUpdateAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [k: string]: any }) =>
      api<{ allergy: Allergy }>(`/allergies/${id}`, {
        method: "PATCH",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allergies"] });
    },
  });
}

export function useDeleteAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/allergies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allergies"] });
    },
  });
}

// ─── V3: Medicine Interaction Check ──────────────────────
export type InteractionWarning = {
  medicines: string[];
  severity: "minor" | "moderate" | "severe";
  note: string;
  source?: string;
};

export type AllergyMatch = {
  id: string;
  substance: string;
  severity: "mild" | "moderate" | "severe" | "critical";
  reaction: string | null;
};

export type InteractionsResponse = {
  candidate: string;
  activeMedicines: string[];
  allergies: AllergyMatch[];
  interactions: InteractionWarning[];
  hasWarnings: boolean;
  severity: "minor" | "moderate" | "severe" | "critical" | null;
};

export function useMedicineInteractions(candidate: string, enabled = true) {
  return useQuery({
    queryKey: ["medicine-interactions", candidate.trim().toLowerCase()],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("candidate", candidate);
      return api<InteractionsResponse>(`/medicines/me/interactions?${params.toString()}`);
    },
    enabled: enabled && candidate.trim().length >= 2,
    staleTime: 30_000,
  });
}

// ─── V3: Add medicine with interaction override ──────────
export function useAddMedicineWithConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      data: any;
      confirmOverride?: boolean;
    }) => {
      const { data, confirmOverride } = args;
      const headers: Record<string, string> = {};
      if (confirmOverride) headers["X-Confirm-Warning"] = "true";

      const token = await getAuthToken();

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/medicines`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          body: JSON.stringify(data),
        }
      );

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err: any = new Error(json.error || `HTTP ${response.status}`);
        err.status = response.status;
        err.body = json;
        throw err;
      }
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["doses"] });
      qc.invalidateQueries({ queryKey: ["medicine-interactions"] });
    },
  });
}

// ─── V3: Share links ────────────────────────────────────
export type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  scope: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  lastViewedAt: string | null;
};

export function useShareLinks() {
  return useQuery({
    queryKey: ["share", "links"],
    queryFn: () => api<{ links: ShareLink[] }>("/share/links"),
    staleTime: 30_000,
  });
}

export function useCreateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      label?: string;
      scope?: string;
      expiresInHours?: number;
    }) =>
      api<{ link: ShareLink; token: string; url: string; expiresAt: string }>(
        "/share/links",
        { method: "POST", body: payload }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", "links"] });
    },
  });
}

export function useRevokeShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/share/links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", "links"] });
    },
  });
}

// ─── V3: Data export ────────────────────────────────────
export type ExportFormat = "json" | "txt" | "fhir-bundle";

export function getExportUrl(format: ExportFormat = "json") {
  return `/export/me?format=${format}`;
}

// ─── V3: Health Summary ─────────────────────────────────
export type HealthSummary = {
  generatedAt: string;
  demographics: {
    name: string | null;
    dob: string | null;
    age: number | null;
    sex: string | null;
    bloodGroup: string | null;
    heightCm: number | null;
    weightKg: number | null;
    bmi: number | null;
  };
  allergies: { substance: string; severity: string; reaction: string | null }[];
  conditions: { title: string; diagnosedOn: string | null; notes: string | null }[];
  activeMedicines: { name: string; dosage: string | null; frequency: string | null; since: string | null }[];
  recentVitals: {
    type: string;
    latest: { value: any; secondary: any; unit: string | null; recordedAt: string } | null;
    avg: number | null;
    count: number;
  }[];
  followUps: { title: string; scheduledAt: string; location: string | null; provider: string | null }[];
  lifestyle: Record<string, any>;
};

export function useHealthSummary() {
  return useQuery({
    queryKey: ["health-summary", "json"],
    queryFn: () => api<HealthSummary>("/health-summary/me"),
    staleTime: 60_000,
  });
}

// ─── V3: Unified Timeline ───────────────────────────────
export type TimelineEventKind =
  | "record"
  | "vital"
  | "symptom"
  | "medicine_start"
  | "medicine_stop"
  | "appointment"
  | "note";

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  date: string | null;
  title: string;
  subtitle: string | null;
  icon: string;
  color: string;
  label: string;
  meta?: Record<string, any>;
};

export type TimelineResponse = {
  events: TimelineEvent[];
  counts: Record<string, number>;
};

export function useUnifiedTimeline(opts?: {
  type?: TimelineEventKind | "all";
  from?: string;
  to?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.type && opts.type !== "all") params.set("type", opts.type);
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  if (opts?.limit) params.set("limit", String(opts.limit));
  return useQuery({
    queryKey: ["timeline", opts?.type || "all", opts?.from || "", opts?.to || ""],
    queryFn: () =>
      api<TimelineResponse>(`/timeline/me?${params.toString()}`),
    staleTime: 30_000,
  });
}

// ─── V3: Vaccinations ───────────────────────────────────
export type VaccineCatalogItem = {
  id: string;
  name: string;
  shortName: string | null;
  category: string | null;
  targetDisease: string | null;
  schedule: string;
  aliases: string | null;
  notes: string | null;
};

export type VaccinationDueItem = {
  vaccineId: string;
  vaccine: string;
  shortName: string | null;
  dose: number;
  doseLabel: string;
  dueDate: string;
  daysUntil: number;
  targetDisease: string | null;
};

export function useVaccinations() {
  return useQuery({
    queryKey: ["vaccinations", "list"],
    queryFn: () =>
      api<{ administered: any[]; catalog: VaccineCatalogItem[] }>(
        "/vaccinations/me"
      ),
    staleTime: 60_000,
  });
}

export function useVaccinationsDue() {
  return useQuery({
    queryKey: ["vaccinations", "due"],
    queryFn: () =>
      api<{
        due: VaccinationDueItem[];
        overdue: VaccinationDueItem[];
        upcoming: VaccinationDueItem[];
      }>("/vaccinations/me/due"),
    staleTime: 60_000,
  });
}

export function useAddVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      vaccineName: string;
      vaccineId?: string;
      dose?: number;
      recordDate?: string;
      provider?: string;
      notes?: string;
    }) =>
      api<{ vaccination: any }>("/vaccinations/me", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccinations"] });
      qc.invalidateQueries({ queryKey: ["medical-records"] });
    },
  });
}

// ─── V3: Vitals trend series ─────────────────────────────
export type VitalsPoint = {
  t: string;
  value: number;
  secondary: number | null;
  id: string;
  unit: string | null;
};

export type VitalsSeriesStats = {
  min: number | null;
  max: number | null;
  avg: number | null;
  latest: number | null;
  delta: number | null;
  count: number;
};

export type VitalsSeriesResponse = {
  type: string | null;
  range: { from: string | null; to: string | null };
  points: VitalsPoint[];
  stats: VitalsSeriesStats | null;
};

export function useVitalsSeries(opts: {
  type: string;
  from?: string;
  to?: string;
  enabled?: boolean;
}) {
  const params = new URLSearchParams();
  params.set("type", opts.type);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  return useQuery({
    queryKey: ["vitals", "series", opts.type, opts.from || "", opts.to || ""],
    queryFn: () =>
      api<VitalsSeriesResponse>(`/vitals/me/series?${params.toString()}`),
    enabled: opts.enabled !== false && !!opts.type,
    staleTime: 60_000,
  });
}

// ─── Doctor: Visit Summary (one-shot SOAP write-up) ───────
export type VisitSummaryInput = {
  patientId: string;
  appointmentId?: string;
  title?: string;
  diagnosis?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  notes?: string;
  prescriptionItems?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  labOrders?: Array<{ testName: string; instructions?: string }>;
  followUp?: { followUpDate: string; title: string; notes?: string };
  markAppointmentCompleted?: boolean;
};

export function useCreateVisitSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VisitSummaryInput) =>
      api<{
        visit: any;
        prescriptions: any[];
        labOrders: any[];
        followUp: any;
      }>("/doctor-portal/visit-summary", { method: "POST", body: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({
        queryKey: ["medical-records", variables.patientId],
      });
      queryClient.invalidateQueries({ queryKey: ["doctor-portal", "queue"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
}