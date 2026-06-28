import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { Patient, MedicalRecord, Appointment } from "@healthcare/shared";

// ─── Patient Profile ─────────────────────────────────────
export function usePatientProfile() {
  return useQuery({
    queryKey: ["patient", "me"],
    queryFn: () => api<{ patient: any }>("/patients/me"),
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

export function useTimeline(patientId: string) {
  return useQuery({
    queryKey: ["timeline", patientId],
    queryFn: () => api<{ timeline: any }>(`/medical-records/timeline/${patientId}`),
    enabled: !!patientId,
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

// ─── Emergency ───────────────────────────────────────────
export function useTriggerSOS() {
  return useMutation({
    mutationFn: (data: { latitude: number; longitude: number }) =>
      api<{ emergency: any }>("/emergency/sos", { method: "POST", body: data }),
  });
}

export function useEmergencyQR() {
  return useQuery({
    queryKey: ["emergency", "qr"],
    queryFn: () => api<{ qrData: any }>("/emergency/qr"),
  });
}

// ─── File Upload (fixed auth header) ─────────────────────
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

// ─── Doctor ──────────────────────────────────────────────
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
