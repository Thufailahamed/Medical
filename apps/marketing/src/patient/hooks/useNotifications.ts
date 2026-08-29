"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys } from "@/patient/lib/query";

export function useUnreadNotificationsCount() {
  const q = useQuery<{ count: number }>({
    queryKey: patientKeys.unreadCount(),
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    ...PATIENT_QUERY_DEFAULTS,
  });
  return q.data?.count ?? 0;
}