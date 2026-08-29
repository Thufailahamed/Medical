"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";

export interface PatientNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  data?: unknown;
}

export function useNotifications() {
  return useQuery<{ notifications: PatientNotification[] }>({
    queryKey: patientKeys.notifications(),
    queryFn: () =>
      api<{ notifications: PatientNotification[] }>(patientPaths.notifications.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery<{ count: number }>({
    queryKey: patientKeys.unreadCount(),
    queryFn: () =>
      api<{ count: number }>(patientPaths.notifications.unreadCount()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ notification: PatientNotification }>(patientPaths.notifications.read(id), {
        method: "PUT",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.notifications() });
      qc.invalidateQueries({ queryKey: patientKeys.unreadCount() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ message: string }>(patientPaths.notifications.readAll(), { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.notifications() });
      qc.invalidateQueries({ queryKey: patientKeys.unreadCount() });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    appointments: boolean;
    prescriptions: boolean;
    labResults: boolean;
    reminders: boolean;
    marketing: boolean;
    quietHours: { start: string | null; end: string | null } | null;
  }>({
    queryKey: patientKeys.notificationPrefs(),
    queryFn: () => api(patientPaths.notificationsPrefs.mine()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api(patientPaths.notificationsPrefs.update(), {
        method: "PATCH",
        json: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notificationPrefs() }),
  });
}
