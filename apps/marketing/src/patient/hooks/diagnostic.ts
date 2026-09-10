"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { TestPackage, TestBooking } from "@healthcare/shared/contracts";

export function useTestPackages() {
  return useQuery<{ packages: TestPackage[] }>({
    queryKey: patientKeys.diagnosticPackages(),
    queryFn: () =>
      api<{ packages: TestPackage[] }>(patientPaths.diagnostic.packages()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useTestPackage(slug: string) {
  return useQuery<{ package: TestPackage }>({
    queryKey: patientKeys.diagnosticPackage(slug),
    queryFn: () =>
      api<{ package: TestPackage }>(patientPaths.diagnostic.packageDetail(slug)),
    enabled: Boolean(slug),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useBookTestPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      slug,
      labId,
      labPartnerId,
      ...input
    }: {
      slug?: string;
      packageId?: string;
      testId?: string;
      bookingType?: "single_test" | "package";
      scheduledDate?: string;
      scheduledTimeSlot?: string;
      scheduledAt?: string;
      collectionAddress?: Record<string, unknown>;
      paymentMethod?: string;
      labId?: string;
      labPartnerId?: string;
      notes?: string;
    }) =>
      api<{ booking: TestBooking }>(patientPaths.diagnostic.book(), {
        method: "POST",
        // Backend expects labPartnerId; accept legacy labId alias.
        json: { ...input, ...(labPartnerId ?? labId ? { labPartnerId: labPartnerId ?? labId } : {}) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.diagnosticBookings() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useTestBookings() {
  return useQuery<{ bookings: TestBooking[] }>({
    queryKey: patientKeys.diagnosticBookings(),
    queryFn: () =>
      api<{ bookings: TestBooking[] }>(patientPaths.diagnostic.bookings()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useTestBooking(id: string) {
  return useQuery<{ booking: TestBooking }>({
    queryKey: patientKeys.diagnosticBooking(id),
    queryFn: () =>
      api<{ booking: TestBooking }>(patientPaths.diagnostic.bookingDetail(id)),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useRateTest() {
  return useMutation({
    mutationFn: ({
      id,
      score,
      comment,
      // Back-compat aliases (legacy callers send rating/review).
      rating,
      review,
    }: {
      id: string;
      score?: number;
      comment?: string;
      rating?: number;
      review?: string;
    }) =>
      api<{ rating: unknown }>(patientPaths.diagnostic.rateTest(id), {
        method: "POST",
        json: {
          score: score ?? rating,
          comment: comment ?? review,
        },
      }),
  });
}

export function useTestBookingRating(id: string) {
  return useQuery<{ rating: { score: number; stars: number; comment: string | null } | null }>({
    queryKey: patientKeys.diagnosticBooking(id + ":rating"),
    queryFn: () =>
      api<{ rating: { score: number; stars: number; comment: string | null } | null }>(
        patientPaths.diagnostic.rateTest(id),
      ),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useCancelTestBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<{ booking: TestBooking }>(`/diagnostic-tests/bookings/${id}/cancel`, {
        method: "PATCH",
        json: { cancellationReason: reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.diagnosticBookings() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useRescheduleTestBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, slot }: { id: string; date: string; slot: string }) =>
      api<{ booking: TestBooking }>(`/diagnostic-tests/bookings/${id}/reschedule`, {
        method: "PATCH",
        json: { scheduledDate: date, scheduledTimeSlot: slot },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.diagnosticBookings() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useInitiateTestPayment() {
  return useMutation({
    mutationFn: ({ bookingId }: { bookingId: string }) =>
      api<{ orderId: string; checkoutUrl: string; fields: Record<string, string>; amount: number }>(
        "/payments/initiate",
        { method: "POST", json: { testBookingId: bookingId } },
      ),
  });
}
