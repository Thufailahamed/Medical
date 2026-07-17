import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qk } from "../lib/api";

// Types
export type LabBooking = {
  id: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  bookingType: string;
  testId: string | null;
  packageId: string | null;
  itemName?: string;
  status: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  collectionAddress: {
    line1: string;
    line2?: string;
    city: string;
    district: string;
    contactPhone: string;
    specialInstructions?: string;
  };
  phlebotomistId: string | null;
  phlebotomistName: string | null;
  phlebotomistPhone: string | null;
  totalPrice: number;
  paymentStatus: string;
  paymentMethod: string;
  resultPdfUrl: string | null;
  resultSummary: string | null;
  resultReadyAt: string | null;
  createdAt: string;
};

export type LabTest = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  sampleType: string;
  fastingRequired: boolean;
  fastingHours: number;
  homeCollectionAvailable: boolean;
  price: number;
  discountPrice: number | null;
  turnaroundHours: number;
  instructions: string | null;
  isActive: boolean;
};

export type LabPackage = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPrice: number | null;
  turnaroundHours: number;
  instructions: string | null;
  isActive: boolean;
  testCount?: number;
};

export type Phlebotomist = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
};

export type LabStats = {
  totalBookings: number;
  todayBookings: number;
  pendingBookings: number;
  completedBookings: number;
  activeTests: number;
};

// Dashboard
export function useLabDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api<{ stats: LabStats }>("/lab-portal/stats"),
  });
}

// Bookings
export function useLabBookings(status?: string) {
  return useQuery({
    queryKey: qk.bookings(status),
    queryFn: () =>
      api<{ bookings: LabBooking[]; total: number }>(
        `/lab-portal/bookings${status ? `?status=${status}` : ""}`
      ),
  });
}

export function useLabBookingDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.booking(id!),
    queryFn: () => api<{ booking: LabBooking }>(`/lab-portal/bookings/${id}`),
    enabled: Boolean(id),
  });
}

export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ booking: LabBooking }>(`/lab-portal/bookings/${id}/confirm`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-bookings"] });
      qc.invalidateQueries({ queryKey: ["lab-booking"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useAssignPhlebotomist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      phlebotomistId,
      phlebotomistName,
      phlebotomistPhone,
    }: {
      id: string;
      phlebotomistId: string;
      phlebotomistName: string;
      phlebotomistPhone: string;
    }) =>
      api<{ booking: LabBooking }>(
        `/lab-portal/bookings/${id}/assign-phlebotomist`,
        {
          method: "PATCH",
          body: { phlebotomistId, phlebotomistName, phlebotomistPhone },
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-bookings"] });
      qc.invalidateQueries({ queryKey: ["lab-booking"] });
    },
  });
}

export function useCollectSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ booking: LabBooking }>(
        `/lab-portal/bookings/${id}/collect-sample`,
        { method: "PATCH" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-bookings"] });
      qc.invalidateQueries({ queryKey: ["lab-booking"] });
    },
  });
}

export function useCompleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      resultPdfUrl,
      resultSummary,
      results,
    }: {
      id: string;
      resultPdfUrl?: string;
      resultSummary?: string;
      results?: Array<{
        testName: string;
        value: number;
        unit?: string;
        referenceMin?: number;
        referenceMax?: number;
        isAbnormal?: boolean;
      }>;
    }) =>
      api<{ ok: boolean }>(`/lab-portal/bookings/${id}/results`, {
        method: "POST",
        body: { resultPdfUrl, resultSummary, results },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-bookings"] });
      qc.invalidateQueries({ queryKey: ["lab-booking"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCancelLabBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<{ booking: LabBooking }>(`/lab-portal/bookings/${id}/cancel`, {
        method: "PATCH",
        body: { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-bookings"] });
      qc.invalidateQueries({ queryKey: ["lab-booking"] });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// Catalog
export function useLabCatalog() {
  return useQuery({
    queryKey: qk.catalog,
    queryFn: () => api<{ tests: LabTest[] }>("/lab-portal/catalog"),
  });
}

export function useCreateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<LabTest, "id" | "isActive" | "labPartnerId">) =>
      api<{ test: LabTest }>("/lab-portal/catalog", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.catalog }),
  });
}

export function useUpdateTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<LabTest> & { id: string }) =>
      api<{ test: LabTest }>(`/lab-portal/catalog/${id}`, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.catalog }),
  });
}

export function useDeleteTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean }>(`/lab-portal/catalog/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.catalog }),
  });
}

// Packages
export function useLabPackages() {
  return useQuery({
    queryKey: qk.packages,
    queryFn: () => api<{ packages: LabPackage[] }>("/lab-portal/packages"),
  });
}

// Phlebotomists
export function usePhlebotomists() {
  return useQuery({
    queryKey: qk.phlebotomists,
    queryFn: () =>
      api<{ phlebotomists: Phlebotomist[] }>("/lab-portal/phlebotomists"),
  });
}

export function useCreatePhlebotomist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phone: string; email?: string }) =>
      api<{ phlebotomist: Phlebotomist }>("/lab-portal/phlebotomists", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.phlebotomists }),
  });
}

export function useUpdatePhlebotomist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: Partial<Phlebotomist> & { id: string }) =>
      api<{ phlebotomist: Phlebotomist }>(
        `/lab-portal/phlebotomists/${id}`,
        { method: "PUT", body: data }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.phlebotomists }),
  });
}

export function useDeletePhlebotomist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean }>(`/lab-portal/phlebotomists/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.phlebotomists }),
  });
}
