import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, apiWithRefresh } from "@/lib/api";
import { supabase } from "@/lib/supabase";
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
      queryClient.invalidateQueries({ queryKey: ["patient", "me"] });
    },
  });
}

// ─── Medical Records ─────────────────────────────────────
export function useMedicalRecords() {
  return useQuery({
    queryKey: ["medical-records"],
    queryFn: () => api<{ records: any[] }>("/medical-records/me"),
  });
}

export function useMedicalRecord(id: string) {
  return useQuery({
    queryKey: ["medical-records", id],
    queryFn: () => api<{ record: any }>(`/medical-records/${id}`),
    enabled: !!id,
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
export function useMyMedicines() {
  return useQuery({
    queryKey: ["medicines"],
    queryFn: () => api<{ medicines: any[] }>("/medicines/me"),
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

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

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

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