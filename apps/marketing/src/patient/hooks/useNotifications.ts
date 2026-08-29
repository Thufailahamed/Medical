"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";

/**
 * Stub: real implementation lands in Task 7. Returning 0 keeps the
 * Topbar's badge hidden while every other screen renders correctly.
 */
export function useUnreadNotificationsCount() {
  const q = useQuery<{ count: number }>({
    queryKey: patientKeys.unreadCount(),
    queryFn: () => api("/patient-notifications/unread-count"),
    ...PATIENT_QUERY_DEFAULTS,
  });
  return q.data?.count ?? 0;
}