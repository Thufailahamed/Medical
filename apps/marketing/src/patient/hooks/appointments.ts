"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";
import type { AppointmentRow, RecordRow } from "@/patient/types/patient";

export function useAppointments() {
  return useQuery<{ appointments: AppointmentRow[] }>({
    queryKey: patientKeys.appointments(),
    queryFn: () =>
      api<{ appointments: AppointmentRow[] }>(patientPaths.appointments.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAppointmentRecords(id: string) {
  return useQuery<{ appointment: AppointmentRow; records: RecordRow[] }>({
    queryKey: patientKeys.appointmentRecords(id),
    queryFn: () =>
      api<{ appointment: AppointmentRow; records: RecordRow[] }>(
        patientPaths.appointments.records(id)
      ),
    enabled: Boolean(id),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useBookAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ appointment: AppointmentRow }>(patientPaths.appointments.create(), {
        method: "POST",
        json: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.appointments() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ appointment: AppointmentRow }>(patientPaths.appointments.detail(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.appointments() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, time }: { id: string; date: string; time: string }) =>
      api<{ appointment: AppointmentRow }>(
        patientPaths.appointments.reschedule(id),
        {
          method: "PATCH",
          json: { date, time },
        }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.appointments() });
      qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}
