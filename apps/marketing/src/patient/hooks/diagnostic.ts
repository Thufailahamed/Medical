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
      ...input
    }: {
      slug: string;
      scheduledAt: string;
      labId?: string;
      notes?: string;
    }) =>
      api<{ booking: TestBooking }>(patientPaths.diagnostic.bookPackage(slug), {
        method: "POST",
        json: input,
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
      rating,
      review,
    }: {
      id: string;
      rating: number;
      review?: string;
    }) =>
      api<{ rating: unknown }>(patientPaths.diagnostic.rateTest(id), {
        method: "POST",
        json: { rating, review },
      }),
  });
}
