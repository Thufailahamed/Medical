import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "@/lib/api";
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
import type {
  VitalType,
  Classification,
  DerivedBlock,
  LatestByType,
  VitalAlert,
  VitalContext,
} from "@healthcare/shared/vitals";

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
      preferredLocale: string | null;
    };
  };
};

export function usePatientProfile() {
  return useQuery({
    queryKey: ["patient", "me"],
    queryFn: () => api<PatientProfileResponse>("/patients/me"),
  });
}

// Phase 1.4: per-user personal inbox alias for email-to-record ingestion.
export type EmailAliasResponse = {
  alias: string;        // e.g. "u_a1b2c3d4"
  address: string;      // e.g. "u_a1b2c3d4@records.healthhub.app"
  email: string | null; // user's verified email (legacy path From address)
  domain: string;
};

export function useEmailAlias() {
  return useQuery({
    queryKey: ["patient", "me", "email-alias"],
    queryFn: () => api<EmailAliasResponse>("/patients/me/email-alias"),
  });
}

export function useRotateEmailAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<EmailAliasResponse>("/patients/me/email-alias/rotate", {
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", "me", "email-alias"] });
    },
  });
}

// ─── Phase 3.1: Request-a-Demo lead capture ──────────────
// Unauthenticated POST — no `Authorization` header is sent because the
// api() helper at apps/mobile/src/lib/api.ts silently drops it for the
// unauth context (see useRequestDemoForUnauth wrapper).
export type DemoRequestPayload = {
  clinicName?: string;
  contactName: string;
  contactRole?: string;
  phone: string;
  email: string;
  nic?: string;
  slmcRegistrationNo?: string;
  specialty?: string;
  clinicSize?: string;
  message?: string;
};

export function useRequestDemo() {
  return useMutation({
    mutationFn: (payload: DemoRequestPayload) =>
      api<{ id: string; status: string }>("/demo-requests", {
        method: "POST",
        body: payload,
      }),
    // No cache invalidation — public endpoint.
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

// Phase 2.1: trilingual FTS5 search. Server uses unicode61 tokenizer so
// Sinhala/Tamil terms inside English-source records are findable. Returns
// BM25-ranked records, capped server-side at the same `limit` as the
// regular list. Disabled when query is empty or < 2 chars.
export function useRecordSearch(query: string, opts?: { limit?: number }) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["medical-records", "search", trimmed, opts?.limit ?? 50],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("q", trimmed);
      if (opts?.limit) params.set("limit", String(opts.limit));
      return api<{ records: any[]; total: number }>(
        `/medical-records/me/search?${params.toString()}`
      );
    },
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  });
}

// Phase 2.1: classification result lives on `record.extractedData` as
// `{ classification: { recordType, confidence, ... } }`. Returned by the
// server when auto-classification fired. Mobile currently only reads it
// for the "AI guess" pill on the records list (D8 — pill only shown
// when confidence < 0.7, indicating the model isn't sure).
export type AiClassification = {
  recordType: string;
  confidence: number;
  extracted?: {
    date?: string;
    provider?: string;
    patient_name?: string;
    key_findings?: string;
  };
  modelVersion?: string;
  classifiedAt?: string;
};

export function readAiGuess(record: any): AiClassification | null {
  if (!record) return null;
  const ed = record.extractedData;
  if (!ed) return null;
  let blob: any = ed;
  if (typeof ed === "string") {
    try {
      blob = JSON.parse(ed);
    } catch {
      return null;
    }
  }
  const cls = blob?.classification;
  if (!cls || typeof cls.confidence !== "number") return null;
  // Only show the pill when the model wasn't confident — that's the
  // "AI isn't sure, please confirm" state. Strong matches upgrade
  // recordType silently (no pill needed).
  if (cls.confidence >= 0.7) return null;
  return cls as AiClassification;
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

export function useUpdateRecordTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) =>
      api<{ record: any }>(`/medical-records/${id}`, {
        method: "PATCH",
        body: { tags },
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records", vars.id] });
    },
  });
}

export function useArchiveRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ record: any }>(`/medical-records/${id}`, {
        method: "PATCH",
        body: { archived: true },
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records", id] });
    },
  });
}

export function useRestoreRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ record: any }>(`/medical-records/${id}`, {
        method: "PATCH",
        body: { archived: false },
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records", id] });
    },
  });
}

export function useMoveRecordToFamily() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, familyMemberId }: { id: string; familyMemberId: string | null }) =>
      api<{ record: any }>(`/medical-records/${id}`, {
        method: "PATCH",
        body: { familyMemberId },
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records", vars.id] });
    },
  });
}

export function useReturnRecordToOwn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; familyMemberId: string | null }) =>
      api<{ record: any }>(`/medical-records/${id}`, {
        method: "PATCH",
        body: { familyMemberId: null },
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records", vars.id] });
    },
  });
}

export function useDeleteRecord() {
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

export function useMyPrescription(id?: string) {
  return useQuery({
    queryKey: ["prescriptions", "me", id],
    queryFn: () =>
      api<{ prescription: any }>(`/medical-records/me/prescriptions/${id}`),
    enabled: !!id,
  });
}

async function sharePrescriptionPdfBlob(
  blob: Blob,
  prescriptionId: string
): Promise<void> {
  if (!(blob instanceof Blob)) {
    throw new Error("Unexpected response from server");
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read PDF bytes"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read PDF bytes"));
    reader.readAsDataURL(blob);
  });

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error("Cache directory unavailable on this device");
  }
  const shortId = prescriptionId.slice(0, 8);
  const fileUri = `${cacheDir}prescription-${shortId}.pdf`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Prescription PDF",
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

// Phase 2.3.3: family-member privacy lock. Toggling lock/unlock
// invalidates `family` (list shows badge) AND any record queries that
// fan out across FMs (medical-records, etc.) so the redaction flips
// immediately.
export function useToggleFamilyLock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      api<{ ok: boolean; memberId: string; locked: boolean; changed: boolean }>(
        `/family/members/${id}/lock`,
        { method: "PATCH", body: { locked } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family"] });
      queryClient.invalidateQueries({ queryKey: ["medical-records"] });
      queryClient.invalidateQueries({ queryKey: ["family-locks"] });
    },
  });
}

export function useFamilyLocks() {
  return useQuery({
    queryKey: ["family-locks"],
    queryFn: () => api<{ locks: { id: string; name: string; lockedAt: string }[] }>(
      "/family/members/locks"
    ),
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
      queryClient.invalidateQueries({ queryKey: ["vitals", "derived"] });
      queryClient.invalidateQueries({ queryKey: ["vitals", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["wellness"] });
      queryClient.invalidateQueries({ queryKey: ["health-summary"] });
    },
  });
}

/**
 * Doctor records a vital reading on behalf of a patient.
 *
 * Companion to `useAddVital` (which is self-only on the patient
 * route). Posts to the doctor-portal endpoint, which enforces
 * `canAccessPatient` server-side so a doctor can only write vitals
 * for a patient they have a relationship with.
 *
 * Invalidates the patient summary + overview query keys (which the
 * portal and any other mobile doctor view read from) plus the
 * general vitals namespace in case any screen caches per-patient
 * series data.
 */
export function useCreateDoctorVital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      hospitalId?: string;
      type: string;
      value: number;
      secondaryValue?: number | null;
      unit?: string;
      context?: string | null;
      recordedAt?: string;
      notes?: string | null;
    }) =>
      api<{ vital: any }>("/doctor-portal/vitals", {
        method: "POST",
        body: data,
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["doctor-portal", "patient", vars.patientId, "summary"],
      });
      queryClient.invalidateQueries({
        queryKey: ["doctor-portal", "patient", vars.patientId, "overview"],
      });
      queryClient.invalidateQueries({ queryKey: ["vitals"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-portal"] });
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
      queryClient.invalidateQueries({ queryKey: ["vitals", "derived"] });
      queryClient.invalidateQueries({ queryKey: ["vitals", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["wellness"] });
      queryClient.invalidateQueries({ queryKey: ["health-summary"] });
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
      const formData = new FormData();
      formData.append("file", file);
      if (recordId) formData.append("recordId", recordId);

      return api("/files/upload", {
        method: "POST",
        body: formData,
        isFormData: true,
      });
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

      return api("/files/upload-with-record", {
        method: "POST",
        body: formData,
        isFormData: true,
      });
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

      // If the server returned our own stream proxy, route through api()
      // (responseType: "blob") so locale/family/tenant headers + 401/410
      // plumbing run. If it returned a real R2 presigned URL, fetch
      // directly — never attach auth to a signed URL.
      const isProxy = urlData.url.startsWith("/files/");
      const blob = isProxy
        ? await api<Blob>(urlData.url, { responseType: "blob" })
        : await (await fetch(urlData.url)).blob();
      const contentType = isProxy ? "application/octet-stream" : undefined;

      return { blob, contentType };
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
    queryFn: () => api<WellnessResponse>("/wellness/me"),
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

export function useDoctorPrescription(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ["doctor", "prescription", id],
    queryFn: () =>
      api<{ prescription: any }>(`/doctor/prescriptions/${id}` as string),
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
    staleTime: 10_000,
    gcTime: 30_000,
  });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    // Phase E-Rx 3: `headers` carries `X-Confirm-Warning: true` when the
    // doctor explicitly overrode a blocking safety warning. It must be
    // part of the mutation variables — React Query ignores extra args
    // passed to mutate/mutateAsync.
    mutationFn: (vars: { data: any; headers?: Record<string, string> }) =>
      api<{ prescription: any }>("/doctor/prescriptions", {
        method: "POST",
        body: vars.data,
        headers: vars.headers,
      }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["doctor"] });
      // P4 audit fix: also invalidate the doctor-portal patient summary
      // bundle so a second visit to /patient-detail sees the new
      // prescription immediately. Without this the doctor's view of
      // "current patient medications" lags behind reality.
      if (vars?.data?.patientId) {
        queryClient.invalidateQueries({
          queryKey: ["doctor-portal", "patient", vars.data.patientId],
        });
        queryClient.invalidateQueries({
          queryKey: ["medical-records", vars.data.patientId],
        });
      }
    },
  });
}

// ════════════════════════════════════════════════════════════
// Phase E-Rx: Medicine Master + Safety + Signing hooks
// ════════════════════════════════════════════════════════════

export type MedicineMaster = {
  id: string;
  rxcui: string | null;
  genericName: string;
  brandName: string | null;
  strength: string | null;
  scheduleClass: string | null;
  isGeneric: boolean;
};

// Phase E-Rx 1: master catalogue autocomplete for the doctor
// prescription form. Debounced upstream by the caller (useDebounce).
// 60s staleTime — the catalogue is stable within a session.
export function useMedicineSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ["medicines-master", "search", query],
    queryFn: () =>
      api<{ medicines: MedicineMaster[] }>(
        `/medicines-master/search?q=${encodeURIComponent(query)}&limit=8`
      ),
    enabled: enabled && query.length >= 2,
    staleTime: 60_000,
  });
}

export type SafetyCheckCandidate = {
  name: string;
  dosage?: string;
  masterMedicineId?: string;
};

export type DrugWarning = {
  type:
    | "interaction"
    | "allergy"
    | "duplicate"
    | "pregnancy"
    | "renal"
    | "liver"
    | "pediatric"
    | "controlled";
  severity: "minor" | "moderate" | "severe" | "critical";
  medicines?: string[];
  message: string;
  recommendation: string;
  source: string;
};

// Phase E-Rx 3: live safety pre-flight. Returns warnings for the
// patient's current active meds + allergies + conditions against the
// candidate prescription. Doctor UI shows each warning as a card
// with severity colour; override requires `X-Confirm-Warning: true`
// on the POST.
export function useSafetyCheck(
  payload: { patientId?: string; candidate: SafetyCheckCandidate[] },
  enabled = true
) {
  return useQuery({
    queryKey: ["safety", "check", payload],
    queryFn: () =>
      api<{ warnings: DrugWarning[]; hasWarnings: boolean; severity?: string }>(
        "/safety/check",
        { method: "POST", body: payload }
      ),
    enabled: enabled && !!payload.patientId && payload.candidate.length > 0,
    staleTime: 30_000,
  });
}

// Phase E-Rx 6: sign a draft prescription. The response carries
// the new `signatureId`, `signedAt`, and the public `verifyUrl`
// the doctor can share. Invalidates both the single-prescription
// detail cache and the list cache so the status pill flips.
export function useSignPrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) =>
      api<{
        prescription: any;
        signature: any;
        verifyUrl: string;
      }>(`/doctor/prescriptions/${vars.id}/sign`, { method: "POST" }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["doctor", "prescription", vars.id],
      });
      queryClient.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

// Phase E-Rx 8: edit a draft prescription. Allowed only when the
// server-side status === "draft" — otherwise the route returns 409
// and the mutation surfaces the error. Used by the mobile composer
// once a future UI exposes the "edit draft" affordance.
export function useUpdatePrescriptionDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: any }) =>
      api<{ ok: true; prescriptionId: string }>(
        `/doctor/prescriptions/${vars.id}`,
        { method: "PATCH", body: vars.body }
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["doctor", "prescription", vars.id],
      });
      queryClient.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

// Phase E-Rx 8: cancel a prescription. Allowed from "draft" or
// "signed" only — server returns 409 for "cancelled" or "dispensed".
// Accepts an optional `reason` that lands in the audit row.
export function useCancelPrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) =>
      api<{ ok: true; prescriptionId: string; status: string }>(
        `/doctor/prescriptions/${vars.id}/cancel`,
        { method: "POST", body: { reason: vars.reason } }
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["doctor", "prescription", vars.id],
      });
      queryClient.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

// Phase E-Rx 8: mark a signed prescription as dispensed. Reserved
// for the future pharmacy flow; today the mobile UI doesn't surface
// it. The server enforces that the source state is "signed" (409
// otherwise). Audit row `prescription.dispensed` is written.
export function useDispensePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string }) =>
      api<{ ok: true; prescriptionId: string; status: string }>(
        `/doctor/prescriptions/${vars.id}/dispense`,
        { method: "POST", body: {} }
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["doctor", "prescription", vars.id],
      });
      queryClient.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    },
  });
}

// Phase E-Rx 8: rotate the doctor's signing key. Returns the new
// `keyId` and the `createdAt` timestamp so the UI can show a
// confirmation. The `note` field tells the doctor whether this was
// the first key or a rotation.
export function useRotateSigningKey() {
  return useMutation({
    mutationFn: () =>
      api<{
        keyId: string;
        createdAt: string;
        rotatedFrom: string | null;
        note: string;
      }>("/doctor/regenerate-signing-key", { method: "POST", body: {} }),
  });
}

export type VerifyPrescriptionResponse = {
  valid: boolean;
  reason?: "payload_mismatch" | "revoked" | "missing_key" | "no_signature";
  prescription?: any;
  doctor?: {
    name: string;
    slmcRegistrationNo: string | null;
    publicKey: string;
  };
  medicines?: any[];
  signedAt?: string;
  payloadHash?: string;
  signatureB64?: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
};

// Phase E-Rx 6+7: public verification. No auth header needed for
// the GET — the API exposes `/verify/:id` as a public endpoint so
// pharmacy scanners + printed prescription recipients can verify.
export function useVerifyPrescription(id?: string) {
  return useQuery({
    queryKey: ["verify", "prescription", id],
    queryFn: () =>
      api<VerifyPrescriptionResponse>(`/verify/${id}` as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// Phase E-Rx 6: regenerate doctor's signing keypair. Old
// prescription_signatures rows keep their denormalised public key
// so prior signatures stay verifiable.
export function useRegenerateSigningKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ keyId: string; createdAt: string }>(
        "/doctor/regenerate-signing-key",
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor", "me"] });
    },
  });
}

// ─── Phase 3.1 slice 2: Prescription PDF download ─────────
// Server streams application/pdf from GET /doctor/prescriptions/:id/pdf.
// We fetch as a Blob, write base64 to the OS cache directory, then hand
// the file:// URI to expo-sharing so the doctor can AirDrop / Save to
// Files / Open in another app. Keep this out of React Query — there's
// nothing to cache and the share action is one-shot.
export async function downloadPrescriptionPdf(
  prescriptionId: string
): Promise<void> {
  const blob = await api<Blob>("/doctor/prescriptions/" + prescriptionId + "/pdf", {
    responseType: "blob",
  });
  await sharePrescriptionPdfBlob(blob, prescriptionId);
}

export async function downloadMyPrescriptionPdf(
  prescriptionId: string
): Promise<void> {
  const blob = await api<Blob>(
    `/medical-records/me/prescriptions/${prescriptionId}/pdf`,
    { responseType: "blob" }
  );
  await sharePrescriptionPdfBlob(blob, prescriptionId);
}

// ─── Doctor search (patient-facing) ──────────────────────
export function useDoctorSearch(opts: {
  query?: string;
  specialization?: string;
  hospitalId?: string;
  // Doctor Booking (Round 6): when true, restrict the result set to
  // doctors who have opted in to video consultations. Mirrors the
  // `?telemedicine=1` query param on GET /doctor/search.
  telemedicine?: boolean;
  // Round 7: gate the network call when the patient hasn't narrowed
  // the list yet (e.g. landing on the "specialty picker" view). Saves
  // a wasted request when no filter is active.
  enabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts.query) params.set("query", opts.query);
  if (opts.specialization) params.set("specialization", opts.specialization);
  if (opts.hospitalId) params.set("hospitalId", opts.hospitalId);
  if (opts.telemedicine) params.set("telemedicine", "1");

  return useQuery({
    queryKey: ["doctors", "search", params.toString()],
    queryFn: () =>
      api<{ doctors: any[] }>(`/doctor/search?${params.toString()}`),
    enabled: opts.enabled !== false,
  });
}

export function useSpecialties() {
  return useQuery({
    queryKey: ["doctors", "specialties"],
    queryFn: () =>
      api<{ specialties: Array<{ name: string; count: number }> }>(
        "/doctor/specialties"
      ),
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

// Comprehensive patient overview — single call powering both the web
// portal Overview tab and the mobile doctor patient-detail Summary
// tab. Shape mirrors `@healthcare/shared`'s `PatientOverview`.
export function usePatientOverview(patientId: string | null) {
  return useQuery({
    queryKey: ["doctor-portal", "patient", patientId, "overview"],
    queryFn: () =>
      api<{
        patient: any;
        user: any;
        allergies: any[];
        chronicConditions: any[];
        familyHistory: any[];
        activeMedicines: any[];
        vitals: { latest: any[]; series: Record<string, any[]>; alerts: any[] };
        prescriptions: { recent: any[]; activeCount: number };
        labOrders: { recent: any[] };
        labReports: { recent: any[] };
        clinicalNotes: { recent: any[] };
        followUps: { upcoming: any[]; missed: number };
        visits: { recent: any[]; nextScheduled: any | null };
        records: { recent: any[]; counts: { total: number; byType: Record<string, number> } };
        vaccinations: any[];
        insurance: any | null;
        messages: { lastConversation: any | null; unreadCount: number };
        meta: { fetchedAt: string; asOf: string };
      }>(`/doctor-portal/patients/${patientId}/overview`),
    enabled: !!patientId,
    staleTime: 30_000,
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
      qc.invalidateQueries({ queryKey: ["doctor-portal", "patient", vars.patientId, "overview"] });
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
      qc.invalidateQueries({ queryKey: ["doctor-portal", "patient", vars.patientId, "overview"] });
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
      // P4 audit fix: a lab-order status flip changes what the doctor's
      // patient-summary bundle shows. Re-fetch the patient summaries
      // rather than letting the user discover stale data on next open.
      // We don't have the patientId in the mutation arg, so we
      // invalidate the broad prefix — TanStack will only re-fetch
      // queries that were actually mounted.
      qc.invalidateQueries({
        queryKey: ["doctor-portal", "patient"],
        exact: false,
      });
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
      // P4 audit fix: a completed appointment may also have created a
      // revenue event; the patient-summary bundle's labOrders / past
      // appointments list refreshes too.
      qc.invalidateQueries({
        queryKey: ["doctor-portal", "patient"],
        exact: false,
      });
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

// Day 2 #1: clinical-note summary. Doctor's free-text note → SOAP +
// summary + key terms. Cached on the server (24h by note+patient hash).
export type ClinicalNoteSummary = {
  summary: string;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  keyTerms: string[];
};

export function useAiClinicalNoteSummary() {
  return useMutation({
    mutationFn: (data: { patientId: string; noteText: string }) =>
      api<{ summary: ClinicalNoteSummary; cached?: boolean }>(
        "/ai/clinical-note-summary",
        { method: "POST", body: data }
      ),
  });
}

// Day 3 #6: lab-test cadence narrative. Returns the structural skeleton
// (count, lastDate, completed/pending counts, series) plus the LLM's
// narrative on top. We pass `months` to bound the look-back window.
export type LabTrend = {
  type: string;
  count: number;
  lastDate: string | null;
  pendingCount: number;
  completedCount: number;
  series: Array<{ date: string; status: string }>;
  narrative: string;
  overdue: boolean | null;
  intervalMonths: number | null;
  nextSuggestedDate: string | null;
};

export function useAiLabTrend() {
  return useMutation({
    mutationFn: (data: {
      patientId: string;
      type: string;
      months?: number;
    }) => {
      const qs = new URLSearchParams({
        patientId: data.patientId,
        type: data.type,
        ...(data.months ? { months: String(data.months) } : {}),
      }).toString();
      return api<{ trend: LabTrend; cached?: boolean }>(
        `/ai/lab-trend?${qs}`,
        { method: "GET" }
      );
    },
  });
}

// Day 4 #5: refill prediction. Pure heuristic on the server, no LLM.
// Returns the medicines that need refill within the next N days.
export type RefillCandidate = {
  id: string;
  name: string;
  dosage: string;
  frequency: string | null;
  timing: string | null;
  startDate: string;
  expectedEndDate: string;
  daysRemaining: number;
  refillReminder: boolean;
  source: "explicit" | "inferred" | "unknown";
};

export type RefillResponse = {
  patientId: string;
  withinDays: number;
  count: number;
  refills: RefillCandidate[];
};

export function useRefillDue() {
  return useQuery({
    queryKey: ["refill-due"],
    queryFn: () =>
      api<RefillResponse>("/medicines/refill-due?days=14", { method: "GET" }),
    staleTime: 60 * 60 * 1000, // 1h; server-side is pure SQL
  });
}

/**
 * Read a paper prescription with AI OCR.
 *
 * Flow: upload the captured image to /files/upload (linked to the
 * freshly-created medical record so the file becomes an attachment),
 * then POST /ai/ocr/prescription with the resulting R2 key + patient
 * context. Returns the parsed medicines array for the UI to review
 * before bulk-adding to the patient's medicine list.
 *
 * On OCR or upload failure this returns `{ medicines: [] }` rather
 * than throwing — the caller decides whether to surface a toast.
 */
export function useReadPrescription() {
  return useMutation({
    mutationFn: async (args: {
      recordId: string;
      imageUri: string;
      mimeType: string;
      fileName: string;
      patientId: string;
    }) => {
      // 1. Upload the image, linked to the new record.
      const fd = new FormData();
      fd.append("recordId", args.recordId);
      // RN FormData accepts { uri, name, type } for file parts.
      fd.append("file", {
        uri: args.imageUri,
        name: args.fileName,
        type: args.mimeType,
      } as any);

      let upJson: any = null;
      try {
        upJson = await api("/files/upload", {
          method: "POST",
          body: fd,
          isFormData: true,
        });
      } catch {
        return { medicines: [] as Array<{ name: string; dosage?: string }> };
      }
      const r2Key: string | undefined = upJson?.file?.r2Key || upJson?.file?.url;
      if (!r2Key) {
        return { medicines: [] as Array<{ name: string; dosage?: string }> };
      }

      // 2. Run OCR on the uploaded file. Endpoint returns structured JSON.
      let ocrJson: any = null;
      try {
        ocrJson = await api("/ai/ocr/prescription", {
          method: "POST",
          body: { fileUrl: r2Key, patientId: args.patientId },
        });
      } catch {
        return { medicines: [] as Array<{ name: string; dosage?: string }> };
      }
      const meds = (ocrJson?.result?.medicines || []) as Array<{
        name?: string;
        dosage?: string;
        frequency?: string;
        timing?: string;
      }>;
      // Trim to the shape used by the OCR sheet.
      const medicines = meds
        .map((m) => ({
          name: m.name || "",
          dosage:
            [m.dosage, m.frequency, m.timing].filter(Boolean).join(", ") ||
            undefined,
        }))
        .filter((m) => m.name);
      return { medicines };
    },
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

      return api("/medicines", {
        method: "POST",
        body: data,
        headers,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["doses"] });
      qc.invalidateQueries({ queryKey: ["medicine-interactions"] });
    },
  });
}

// ─── V3: Share links ────────────────────────────────────
// Phase 2.3: `familyMemberId` lets a link be scoped to one family member's
// medicines + records. NULL on a row = household / principal (today's
// behavior). The `familyMember` block is server-resolved on the public
// bundle; the list endpoint returns the id only since it doesn't enrich.
export type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  scope: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  lastViewedAt: string | null;
  familyMemberId?: string | null;
  familyMember?: { id: string; name: string; relationship: string | null };
};

export function useShareLinks() {
  return useQuery({
    queryKey: ["share", "links"],
    queryFn: () => api<{ links: ShareLink[] }>("/share/links"),
    staleTime: 30_000,
  });
}

// Phase 2.3: client-side filter of the existing useShareLinks cache by
// `familyMemberId`. Implemented via `select` so we don't fire a second
// network call and the cache invalidation on revoke still works.
export function useShareLinksByFamilyMember(familyMemberId: string | null) {
  return useQuery({
    queryKey: ["share", "links"],
    queryFn: () => api<{ links: ShareLink[] }>("/share/links"),
    staleTime: 30_000,
    select: (data) => ({
      links:
        familyMemberId == null
          ? data.links
          : data.links.filter((l) => l.familyMemberId === familyMemberId),
    }),
  });
}

export function useCreateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      label?: string;
      scope?: string;
      expiresInHours?: number;
      // Phase 2.3: optional. NULL/undefined = household share; a UUID
      // scopes the link to one family member. Mobile UI entry points
      // always send this explicitly (no silent inference from the
      // x-active-family-member-id header — share is high-stakes).
      familyMemberId?: string | null;
      // Round 3 P1: when set, mints a prescription_share link. Server
      // validates the prescription belongs to the caller's patient and
      // returns kind="prescription_share". UI flips to a "share with
      // another doctor" affordance.
      prescriptionId?: string;
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

// ─── Round 3 P1: Appointment rating ─────────────────────
//
// 1-tap star rating of a completed visit. POST upserts on
// appointment_id; GET pre-fills the rate screen on re-open.
export type AppointmentRating = {
  stars: number;
  comment: string | null;
  createdAt: string;
};

export function useAppointmentRating(appointmentId: string) {
  return useQuery({
    queryKey: ["appointment-rating", appointmentId],
    queryFn: () =>
      api<{ rating: AppointmentRating | null }>(
        `/appointments/${appointmentId}/rating`
      ),
    enabled: !!appointmentId,
  });
}

export function useRateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      appointmentId: string;
      stars: number;
      comment?: string;
    }) =>
      api<{
        ok: true;
        rating: { stars: number; comment: string | null };
        doctor: { id: string; avgStars: number; ratingCount: number };
      }>(`/appointments/${input.appointmentId}/rating`, {
        method: "POST",
        body: { stars: input.stars, comment: input.comment },
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["appointment-rating", vars.appointmentId],
      });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["doctor"] });
    },
  });
}

// ─── Phase 2.3.1: Family Invite Link ───────────────────
// share_links row with kind="family_invite". The principal generates a
// token for a proposed family member (name + relationship); the invitee
// redeems it on first accept and a family_members row is created in
// the inviter's patient context.
export type FamilyInvite = {
  id: string;
  token: string;
  label: string | null;
  scope: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  consumedAt: string | null;
  redeemedByUserId: string | null;
};

export type FamilyInviteView = {
  inviterName: string;
  inviterPhoto: string | null;
  name: string;
  relationship: string | null;
  expiresAt: string;
  consumed: boolean;
};

export function useFamilyInvites() {
  return useQuery({
    queryKey: ["family", "invites"],
    queryFn: () => api<{ invites: FamilyInvite[] }>("/family/invites"),
    staleTime: 30_000,
  });
}

export function useCreateFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      relationship: string;
      expiresInHours?: number;
    }) =>
      api<{
        invite: FamilyInvite;
        token: string;
        url: string;
        expiresAt: string;
      }>("/family/invites", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family", "invites"] });
    },
  });
}

export function useRevokeFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ ok: boolean }>(`/family/invites/${token}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family", "invites"] });
    },
  });
}

// Public preview — no auth header. Used by the deep-link route before
// login. `useApi.ts`'s `api()` already handles missing tokens gracefully.
export function useFamilyInvitePreview(token: string | null) {
  return useQuery({
    queryKey: ["family", "invites", "preview", token],
    queryFn: () =>
      api<FamilyInviteView>(`/family/invites/${token}`, { silent401: true }),
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ member: any; alreadyAccepted?: boolean }>(
        `/family/invites/${token}/accept`,
        { method: "POST" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family"] });
      qc.invalidateQueries({ queryKey: ["family", "invites"] });
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

// ─── Vaccination Card OCR ───────────────────────────────
export type VaccinationExtracted = {
  vaccineName: string;
  date: string;
  doseNumber: number | null;
  provider: string;
  batchNumber: string;
  catalogId: string | null;
  catalogName: string | null;
  catalogShortName: string | null;
  matched: boolean;
};

export type VaccinationCardOcrResult = {
  vaccinations: VaccinationExtracted[];
  raw: Array<{
    vaccineName: string;
    date: string;
    doseNumber: number | null;
    provider: string;
    batchNumber: string;
  }>;
  note?: string;
};

export function useVaccinationCardOcr() {
  return useMutation({
    mutationFn: (data: { fileUrl: string; textHint?: string }) =>
      api<{ result: VaccinationCardOcrResult; cached?: boolean }>(
        "/ai/ocr/vaccination-card",
        { method: "POST", body: data }
      ),
  });
}

// ─── Bulk Add Vaccinations ──────────────────────────────
export function useBulkAddVaccinations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      vaccinations: Array<{
        vaccineName: string;
        vaccineId?: string;
        dose?: number;
        recordDate: string;
        provider?: string;
        notes?: string;
        batchNumber?: string;
      }>;
      familyMemberId?: string;
    }) =>
      api<{ created: any[]; due: VaccinationDueItem[] }>("/vaccinations/me/bulk", {
        method: "POST",
        body: data,
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

// ─── Vitals: derived metrics block ─────────────────────────
export function useVitalsDerived() {
  return useQuery({
    queryKey: ["vitals", "derived"],
    queryFn: () =>
      api<{ derived: DerivedBlock; latestByType: LatestByType[] }>(
        "/vitals/me/derived",
      ),
    staleTime: 60_000,
  });
}

// ─── Vitals: out-of-range alerts (last 30d by default) ─────
export function useVitalsAlerts(days = 30) {
  return useQuery({
    queryKey: ["vitals", "alerts", days],
    queryFn: () =>
      api<{ alerts: VitalAlert[]; count: number; days: number }>(
        `/vitals/me/alerts?days=${days}`,
      ),
    staleTime: 60_000,
  });
}

// ─── Vitals: parallel sparkline series for home cards ─────
// react-query batches the underlying useQuery calls when the keys
// match, so we wrap each into its own hook call site for parity with
// the existing `useVitalsSeries`.
export function useVitalsSparkline(type: VitalType, days = 7) {
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);
  return useVitalsSeries({ type, from });
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
      // P4 audit fix: visit-summary writes prescriptions, lab mirrors,
      // follow-ups, AND may flip the appointment status. The
      // patient-summary bundle should re-fetch on next open so
      // doctor doesn't see stale activeMeds / lab orders.
      if (variables?.patientId) {
        queryClient.invalidateQueries({
          queryKey: ["doctor-portal", "patient", variables.patientId],
        });
        queryClient.invalidateQueries({
          queryKey: ["doctor-portal", "patient", variables.patientId, "overview"],
        });
      }
      // Earnings may have a new revenue event (if appointment flipped).
      queryClient.invalidateQueries({ queryKey: ["doctor-earnings"] });
    },
  });
}
// ─── Phase 3.1 slice 3: hospital staff invites ────────────
// Mirrors the family-invite hooks above (lines 2485-2559). The
// preview hook is `silent401` because the deep-link route fires
// before auth, and the accept hook has no special silent-flag.

export type StaffInviteView = {
  role: string;
  fullName: string;
  email: string;
  hospitalName: string;
  hospitalId: string;
  expiresAt: string;
};

export type StaffInviteRow = {
  id: string;
  hospitalId: string;
  role: string;
  fullName: string;
  email: string;
  phone: string | null;
  expiresAt: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
  revoked: boolean;
  createdByUserId: string;
  createdAt: string;
  token: string | null;
  deepLink: string | null;
};

export function useStaffInvites() {
  return useQuery({
    queryKey: ["hospital", "staff-invites"],
    queryFn: () =>
      api<{ invites: StaffInviteRow[] }>("/hospital-portal/staff/invites"),
  });
}

export function useCreateStaffInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      fullName: string;
      email: string;
      phone?: string;
      role: string;
      expiresInHours?: number;
    }) =>
      api<{
        id: string;
        token: string;
        deepLink: string;
        expiresAt: string;
      }>("/hospital-portal/staff/invites", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital", "staff-invites"] });
    },
  });
}

export function useRevokeStaffInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/hospital-portal/staff/invites/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital", "staff-invites"] });
    },
  });
}

export function useStaffInvitePreview(token: string | null) {
  return useQuery({
    queryKey: ["staff-invite", "preview", token],
    queryFn: () =>
      api<StaffInviteView>(`/staff/invites/${token}`, { silent401: true }),
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptStaffInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{
        hospitalId: string;
        role: string;
        alreadyAccepted: boolean;
      }>(`/staff/invites/${token}/accept`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hospital"] });
      qc.invalidateQueries({ queryKey: ["hospital", "staff"] });
    },
  });
}

// ════════════════════════════════════════════════════════════
// Doctor Portal Expansion: messages, schedule, earnings, rx templates
// ════════════════════════════════════════════════════════════

// ─── Doctor Inbox / Messages ─────────────────────────────
export type DoctorConversation = {
  id: string;
  patientId: string;
  patient: { id: string; userId: string; name: string; photo: string | null };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageSender: "doctor" | "patient" | null;
  doctorUnread: number;
  patientUnread: number;
  status: "open" | "closed";
  createdAt: string;
};

export type DoctorMessage = {
  id: string;
  conversationId: string;
  senderRole: "doctor" | "patient";
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type DoctorConversationsResponse = {
  conversations: DoctorConversation[];
  totalUnread: number;
};

export type DoctorConversationDetail = {
  conversation: DoctorConversation;
  patient: {
    id: string;
    userId: string;
    name: string;
    photo: string | null;
    phone: string | null;
  } | null;
  messages: DoctorMessage[];
};

export function useDoctorConversations() {
  return useQuery({
    queryKey: ["doctor", "messages", "conversations"],
    queryFn: () =>
      api<DoctorConversationsResponse>(
        "/doctor-messages/conversations"
      ),
    refetchInterval: 30_000,
  });
}

export function useDoctorConversation(id: string | string[] | undefined) {
  return useQuery({
    queryKey: ["doctor", "messages", "conversation", id],
    queryFn: () =>
      api<DoctorConversationDetail>(
        `/doctor-messages/conversations/${id}/messages`
      ),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) =>
      api<{ conversation: DoctorConversation; created: boolean }>(
        "/doctor-messages/conversations",
        { method: "POST", body: { patientId } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "messages", "conversations"] });
    },
  });
}

export function useSendDoctorMessage(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<{ message: DoctorMessage }>(
        `/doctor-messages/conversations/${conversationId}/messages`,
        { method: "POST", body: { body } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["doctor", "messages", "conversation", conversationId],
      });
      qc.invalidateQueries({ queryKey: ["doctor", "messages", "conversations"] });
    },
  });
}

export function useMarkConversationRead(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>(
        `/doctor-messages/conversations/${conversationId}/read`,
        { method: "POST" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["doctor", "messages", "conversation", conversationId],
      });
      qc.invalidateQueries({ queryKey: ["doctor", "messages", "conversations"] });
    },
  });
}

export function useSetConversationStatus(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: "open" | "closed") =>
      api<{ ok: boolean; status: string }>(
        `/doctor-messages/conversations/${conversationId}`,
        { method: "PATCH", body: { status } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["doctor", "messages", "conversation", conversationId],
      });
      qc.invalidateQueries({ queryKey: ["doctor", "messages", "conversations"] });
    },
  });
}

// ─── Patient Inbox / Messages ─────────────────────────────
export type PatientConversation = {
  id: string;
  doctorId: string;
  doctor: { id: string; userId: string; name: string; photo: string | null };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  lastMessageSender: "doctor" | "patient" | null;
  patientUnread: number;
  status: "open" | "closed";
  createdAt: string;
};

export type PatientConversationsResponse = {
  conversations: PatientConversation[];
  totalUnread: number;
};

export type PatientConversationDetail = {
  conversation: PatientConversation;
  doctor: { id: string; userId: string; name: string; photo: string | null } | null;
  messages: DoctorMessage[];
};

export function usePatientConversations() {
  return useQuery({
    queryKey: ["patient", "messages", "conversations"],
    queryFn: () =>
      api<PatientConversationsResponse>("/patient-messages/conversations"),
    refetchInterval: 20_000,
  });
}

export function usePatientConversation(id: string | string[] | undefined) {
  return useQuery({
    queryKey: ["patient", "messages", "conversation", id],
    queryFn: () =>
      api<PatientConversationDetail>(
        `/patient-messages/conversations/${id}/messages`
      ),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useSendPatientMessage(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<{ message: DoctorMessage }>(
        `/patient-messages/conversations/${conversationId}/messages`,
        { method: "POST", body: { body } }
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["patient", "messages", "conversation", conversationId],
      });
      qc.invalidateQueries({ queryKey: ["patient", "messages", "conversations"] });
    },
  });
}

export function useMarkPatientConversationRead(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<PatientConversationDetail>(
        `/patient-messages/conversations/${conversationId}/messages?markRead=true`
      ),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["patient", "messages", "conversation", conversationId],
      });
      qc.invalidateQueries({ queryKey: ["patient", "messages", "conversations"] });
    },
  });
}

// ─── Doctor Schedule ──────────────────────────────────────
export type ScheduleEvent = {
  id: string;
  kind: "appointment" | "walkin" | "followup" | "timeoff";
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: string | null;
  patientId: string | null;
  patientName: string | null;
  title: string | null;
  queueNumber: number | null;
  priority: string | null;
};

export function useDoctorScheduleRange(from: string, to: string) {
  return useQuery({
    queryKey: ["doctor", "schedule", from, to],
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      return api<{
        from: string;
        to: string;
        count: number;
        events: ScheduleEvent[];
      }>(`/doctor-schedule/range?${params.toString()}`);
    },
    enabled: !!from && !!to,
    refetchInterval: 60_000,
  });
}

// ─── Doctor Earnings ──────────────────────────────────────
export type EarningsSummary = {
  period: string;
  start: string;
  end: string;
  totalLkr: number;
  visitCount: number;
  avgPerVisitLkr: number;
  previousPeriod: { start: string; end: string; totalLkr: number };
  trendPct: number;
  pendingPayoutLkr: number;
  consultationFee: number;
};

export function useDoctorEarningsSummary(period = "month") {
  return useQuery({
    queryKey: ["doctor", "earnings", "summary", period],
    queryFn: () =>
      api<EarningsSummary>(
        `/doctor-earnings/summary?period=${encodeURIComponent(period)}`
      ),
  });
}

export function useDoctorEarningsTimeseries(opts: {
  from: string;
  to: string;
  bucket?: "day" | "week";
}) {
  return useQuery({
    queryKey: ["doctor", "earnings", "timeseries", opts],
    queryFn: () => {
      const params = new URLSearchParams({
        from: opts.from,
        to: opts.to,
        bucket: opts.bucket || "day",
      });
      return api<{
        bucket: string;
        from: string;
        to: string;
        series: { bucket: string; total: number; count: number }[];
      }>(`/doctor-earnings/timeseries?${params.toString()}`);
    },
    enabled: !!opts.from && !!opts.to,
  });
}

export type Payout = {
  id: string;
  doctorId: string;
  periodStart: string;
  periodEnd: string;
  amountLkr: number;
  eventCount: number;
  status: "pending" | "paid" | "failed";
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
};

export function useDoctorPayouts(limit = 20) {
  return useQuery({
    queryKey: ["doctor", "earnings", "payouts", limit],
    queryFn: () =>
      api<{ payouts: Payout[] }>(
        `/doctor-earnings/payouts?limit=${limit}`
      ),
  });
}

export function useCreatePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { periodStart: string; periodEnd: string }) =>
      api<{ payout: Payout }>("/doctor-earnings/payouts", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "earnings"] });
    },
  });
}

// ─── Doctor Rx Templates ─────────────────────────────────
export type MedicineEntry = {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  slots?: { label: string; time: string; dose: string }[];
  timing?: string;
  [key: string]: any;
};

export type RxTemplate = {
  id: string;
  doctorId: string;
  name: string;
  diagnosis: string | null;
  medicines: MedicineEntry[];
  notes: string | null;
  specialty: string | null;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

export function useDoctorRxTemplates() {
  return useQuery({
    queryKey: ["doctor", "rx-templates"],
    queryFn: () =>
      api<{ templates: RxTemplate[] }>("/doctor-rx-templates"),
  });
}

export function useDoctorRxTemplate(id: string | string[] | undefined) {
  return useQuery({
    queryKey: ["doctor", "rx-templates", id],
    queryFn: () =>
      api<{ template: RxTemplate }>(
        `/doctor-rx-templates/${id}`
      ),
    enabled: !!id,
  });
}

export function useCreateRxTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      diagnosis?: string;
      medicines: MedicineEntry[];
      notes?: string;
      specialty?: string;
    }) =>
      api<{ template: RxTemplate }>("/doctor-rx-templates", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "rx-templates"] });
    },
  });
}

export function useUpdateRxTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      diagnosis?: string;
      medicines?: MedicineEntry[];
      notes?: string;
    }) => {
      const { id, ...rest } = input;
      return api<{ template: RxTemplate }>(`/doctor-rx-templates/${id}`, {
        method: "PATCH",
        body: rest,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "rx-templates"] });
    },
  });
}

export function useDeleteRxTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/doctor-rx-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "rx-templates"] });
    },
  });
}

export function useRecordRxTemplateUse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/doctor-rx-templates/${id}/use`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", "rx-templates"] });
    },
  });
}

// ─── Care Team (Phase 1) ─────────────────────────────────
// Patient-side: list + add/remove doctors from their care team, and
// create single-use invite tokens for doctors to redeem. Doctor-side:
// reverse list shows patients who added the doctor.
export function useCareTeam(patientId: string | null) {
  return useQuery({
    queryKey: ["care-team", patientId],
    enabled: !!patientId,
    queryFn: () =>
      api<{ members: any[] }>(`/care-team?patientId=${encodeURIComponent(patientId!)}`),
  });
}

export function useAddCareTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { doctorId: string; role: string; scope?: string; notes?: string }) =>
      api<{ member: any }>("/care-team", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["care-team"] });
    },
  });
}

export function useUpdateCareTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; status?: string; scope?: string; notes?: string }) =>
      api<{ member: any }>(`/care-team/${id}`, { method: "PATCH", body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["care-team"] });
    },
  });
}

export function useCreateCareTeamInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role?: string; scope?: string; ttlHours?: number } = {}) =>
      api<{
        token: string;
        expiresAt: string;
        patientName: string | null;
        role: string;
        scope: string;
      }>("/care-team/invites", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["care-team", "invites"] });
    },
  });
}

// Doctor-side reverse view: list patients who added this doctor.
export function useDoctorCareTeamPatients() {
  return useQuery({
    queryKey: ["care-team", "reverse"],
    queryFn: () => api<{ patients: any[]; count: number }>("/care-team/reverse"),
  });
}

// ─── Phase v3: Unified records hub ────────────────────────
export function useUnifiedRecords(opts?: { kind?: string; familyMemberId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["medical-records", "unified", opts ?? {}],
    queryFn: () => {
      const params = new URLSearchParams();
      if (opts?.kind) params.set("kind", opts.kind);
      if (opts?.familyMemberId) params.set("familyMemberId", opts.familyMemberId);
      if (opts?.limit) params.set("limit", String(opts.limit));
      const qs = params.toString();
      return api<{ counts: Record<string, number>; records: any[] }>(
        `/medical-records/me/canonical${qs ? `?${qs}` : ""}`,
      );
    },
  });
}

export function useRecordByKind(kind: string, limit = 50) {
  return useQuery({
    queryKey: ["medical-records", "by-kind", kind, limit],
    enabled: !!kind,
    queryFn: () => api<{ items: any[] }>(`/medical-records/by-kind/${kind}?limit=${limit}`),
  });
}

export function useRecordRevisions(recordId: string | null) {
  return useQuery({
    queryKey: ["medical-records", "revisions", recordId],
    enabled: !!recordId,
    queryFn: () => api<{ items: any[] }>(`/medical-records/${recordId}/revisions`),
  });
}

export function useRecordEnvelope(id: string | null) {
  return useQuery({
    queryKey: ["medical-records", "envelope", id],
    enabled: !!id,
    queryFn: () => api<{ id: string; envelope: any; version: string }>(`/medical-records/${id}/envelope`),
  });
}

export function useWriteRecordEnvelope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { kind: string; title: string; summary?: string; notes?: string; tags?: string[]; familyMemberId?: string }) =>
      api<{ id: string; envelopeVersion: string }>("/medical-records/envelope", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medical-records"] });
    },
  });
}

// ─── Phase v3: Consents ────────────────────────────────
export function useConsentsMine() {
  return useQuery({
    queryKey: ["consents", "mine"],
    queryFn: () => api<{ items: any[] }>("/consents/me"),
  });
}

export function useConsentsIssued() {
  return useQuery({
    queryKey: ["consents", "issued"],
    queryFn: () => api<{ items: any[] }>("/consents/issued"),
  });
}

export function useConsentAudit() {
  return useQuery({
    queryKey: ["consents", "audit"],
    queryFn: () => api<{ items: any[] }>("/consents/audit"),
  });
}

export function useIssueConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      purpose: string;
      recipientUserId?: string;
      recipientToken?: string;
      familyMemberId?: string;
      durationDays?: number;
      expiresAt?: string;
      label?: string;
      scope?: Record<string, unknown>;
    }) => api<{ id: string; expiresAt: string }>("/consents", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consents"] });
    },
  });
}

export function useRevokeConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ revoked: boolean }>(`/consents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consents"] });
    },
  });
}

// ─── Phase v3: DSAR ────────────────────────────────────
export function useDsarExport() {
  return useMutation({
    mutationFn: () =>
      api<{ id: string; status: string; bundle: any }>("/dsar/export", { method: "POST" }),
  });
}

export function useDsarErasure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) =>
      api<{ id: string; status: string; result: any }>("/dsar/erasure", {
        method: "POST",
        body: { notes },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dsar"] });
      qc.invalidateQueries({ queryKey: ["consents"] });
    },
  });
}

export function useDsarRectification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fields: Array<{ recordId: string; field: string; proposedValue: string }>; notes?: string }) =>
      api<{ id: string; status: string }>("/dsar/rectification", {
        method: "POST",
        body: { ...data, purpose: "rectification" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dsar"] });
    },
  });
}

export function useDsarJobs() {
  return useQuery({
    queryKey: ["dsar", "jobs"],
    queryFn: () => api<{ items: any[] }>("/dsar/jobs"),
  });
}

// ─── Phase v3: Files presign ────────────────────────────
export function usePresignFile() {
  return useMutation({
    mutationFn: (data: { fileId: string; recipientUserId?: string }) =>
      api<{ token: string; expiresAt: string; url: string }>("/files/presign", {
        method: "POST",
        body: data,
      }),
  });
}

export function useFileDownloadAudit() {
  return useQuery({
    queryKey: ["files", "audit"],
    queryFn: () => api<{ items: any[] }>("/files/audit"),
  });
}

// ─── Phase v3: QR ephemeral tokens ─────────────────────
export function useIssueQrToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { maxScans?: number; ttlHours?: number; familyMemberId?: string } = {}) =>
      api<{ token: string; expiresAt: string; maxScans: number; url: string }>("/emergency/qr/issue", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-tokens"] });
    },
  });
}

export function useRevokeQrToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ revoked: boolean }>(`/emergency/qr/${token}/revoke`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-tokens"] });
    },
  });
}

// ─── Teleconsult (video visits) ──────────────────────────
// Resolves the patient's currently-live video session, if any. Used
// by the appointments list + appointment-detail screen to decide
// whether to surface a "Join video visit" button. The route file
// re-fetches this same endpoint on mount to verify roomId matches.
export type ActiveTeleconsultSession = {
  id: string;
  roomId: string;
  status: string;
  appointmentId: string;
  createdAt: string;
} | null;

export function useActiveTeleconsultSession() {
  return useQuery({
    queryKey: ["teleconsult", "me", "active"],
    queryFn: () =>
      api<{ session: ActiveTeleconsultSession }>("/teleconsult/sessions/me/active"),
    // Short staleTime — appointment status flips in real time as the
    // doctor starts/ends the call, and the mobile UI needs to pick up
    // the session within a few seconds of creation.
    staleTime: 5_000,
  });
}
