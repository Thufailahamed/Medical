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
  if (opts.query) params.set("q", opts.query);
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
      api<{ slots: string[]; bookedTimes: string[] }>(
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

// ─── Auth: forgot/reset/change password ──────────────────
export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: { email?: string; phone?: string }) =>
      api<{ message: string; devToken?: string; expiresAt?: string }>(
        "/auth/forgot-password",
        { method: "POST", body: data }
      ),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; newPassword: string }) =>
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