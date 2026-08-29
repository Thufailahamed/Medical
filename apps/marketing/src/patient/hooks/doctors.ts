"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type {
  DoctorRow,
  DoctorSlot,
} from "@healthcare/shared/contracts";
import { useBookAppointment } from "@/patient/hooks/appointments";

export function useDoctorSearch(params: {
  search?: string;
  specialization?: string;
  hospitalId?: string;
  telemedicine?: boolean;
  enabled?: boolean;
}) {
  return useQuery<{ doctors: DoctorRow[] }>({
    queryKey: patientKeys.doctors(params),
    queryFn: () =>
      api<{ doctors: DoctorRow[] }>(
        patientPaths.appointmentsBook.doctors({
          search: params.search,
          specialization: params.specialization,
          hospitalId: params.hospitalId,
          telemedicine: params.telemedicine,
        })
      ),
    enabled: params.enabled !== false,
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useSpecialties() {
  return useQuery<{
    specialties: Array<{ name: string; count: number }>;
  }>({
    queryKey: ["patient", "specialties"],
    queryFn: () =>
      api<{ specialties: Array<{ name: string; count: number }> }>(
        patientPaths.appointmentsBook.specialties()
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDoctorDetail(doctorId: string) {
  return useQuery<{ doctor: DoctorRow & { bio: string; hospital: unknown } }>({
    queryKey: patientKeys.doctor(doctorId),
    queryFn: () =>
      api<{ doctor: DoctorRow & { bio: string; hospital: unknown } }>(
        patientPaths.appointmentsBook.doctorDetail(doctorId)
      ),
    enabled: Boolean(doctorId),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useDoctorAvailability(doctorId: string, date?: string) {
  return useQuery<{
    slots: Array<{ time: string; available: boolean; queueNumber?: number }>;
    bookedTimes: string[];
  }>({
    queryKey: patientKeys.doctorSlots(doctorId, date),
    queryFn: () =>
      api<{
        slots: Array<{ time: string; available: boolean; queueNumber?: number }>;
        bookedTimes: string[];
      }>(patientPaths.appointmentsBook.availability(doctorId, date)),
    enabled: Boolean(doctorId) && Boolean(date),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export { useBookAppointment };

export function useRateAppointment() {
  return useMutation({
    mutationFn: ({
      appointmentId,
      rating,
      review,
    }: {
      appointmentId: string;
      rating: number;
      review?: string;
    }) =>
      api<{ rating: unknown }>(patientPaths.appointmentsBook.rate(appointmentId), {
        method: "POST",
        json: { rating, review },
      }),
  });
}
