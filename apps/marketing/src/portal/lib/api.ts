/**
 * Fetch wrapper used by every TanStack Query hook.
 *
 * - Adds `Authorization: Bearer <token>` from the Zustand auth store.
 * - Adds `Accept-Language` from the auth store's locale field.
 * - Adds `x-active-hospital-id` / `x-active-clinic-id` for tenant scoping.
 * - Throws `ApiError` on non-2xx so React Query surfaces a useful message.
 * - On 401 the store is cleared and the window redirected to /login.
 *
 * NOTE: This module is browser-only. Server components reach the API
 * directly via fetch + the same base URL — they don't go through here.
 */

import { useAuthStore } from "@/portal/stores/auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type Init = Omit<RequestInit, "body"> & {
  json?: unknown;
  // Allow overriding the path on the API root (default API_URL).
  base?: string;
};

export async function api<T = any>(
  path: string,
  init: Init = {}
): Promise<T> {
  const { json, headers, base, ...rest } = init;

  const store = useAuthStore.getState();
  const token = store.token;
  const locale = store.locale;
  const hospitalId = store.activeHospitalId;
  const clinicId = store.activeClinicId;

  const url = `${base ?? API_URL}${path}`;

  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) reqHeaders["Content-Type"] = "application/json";
  if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
  if (locale) reqHeaders["Accept-Language"] = locale;
  if (hospitalId) reqHeaders["x-active-hospital-id"] = hospitalId;
  if (clinicId) reqHeaders["x-active-clinic-id"] = clinicId;

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
  });

  // Unauthorised → drop the session and bounce to /login.
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      useAuthStore.getState().logout();
      if (window.location.pathname !== "/portal/login") {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?next=${next}`;
      }
    }
    throw new ApiError("Session expired. Please sign in again.", 401);
  }

  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON error body — fall through.
    }
    const msg = body?.error ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, body?.details ?? body);
  }

  // 204 No Content / empty body — return undefined as T.
  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

/** Convenience helper for query keys. */
export const qk = {
  me: ["auth", "me"] as const,
  dashboard: ["doctor", "dashboard"] as const,
  doctorMe: ["doctor", "me"] as const,
  patientSearch: (params: Record<string, unknown> | string) =>
    ["doctor", "search-patients", typeof params === "string" ? params : JSON.stringify(params)] as const,
  recentPatients: ["doctor", "search-patients", "recent"] as const,
  patientSummary: (id: string) => ["doctor-portal", "patient", id, "summary"] as const,
  patientOverview: (id: string) => ["doctor-portal", "patient", id, "overview"] as const,
  patientTimeline: (params: Record<string, string>) =>
    ["timeline", JSON.stringify(params)] as const,
  schedule: (from: string, to: string) => ["doctor-schedule", "range", from, to] as const,
  scheduleRange: (params: Record<string, string>) =>
    ["doctor-schedule", "range", JSON.stringify(params)] as const,
  doctorQueue: (date: string) => ["doctor-portal", "queue", date] as const,
  appointments: (params: Record<string, unknown>) =>
    ["appointments", JSON.stringify(params)] as const,
  walkins: (params: Record<string, unknown>) => ["walk-ins", JSON.stringify(params)] as const,
  prescriptions: (params: Record<string, unknown>) =>
    ["doctor", "prescriptions", JSON.stringify(params)] as const,
  labOrders: (params: Record<string, unknown>) =>
    ["doctor-portal", "lab-orders", JSON.stringify(params)] as const,
  clinicalNotes: (params: Record<string, unknown>) =>
    ["doctor-portal", "clinical-notes", JSON.stringify(params)] as const,
  followUps: (params: Record<string, unknown>) =>
    ["doctor-portal", "follow-ups", JSON.stringify(params)] as const,
  timeline: (patientId: string) => ["timeline", patientId] as const,
  medicines: (params: Record<string, unknown>) =>
    ["medicines", JSON.stringify(params)] as const,
  vitals: (params: Record<string, unknown>) =>
    ["vitals", JSON.stringify(params)] as const,
  allergies: (patientId?: string) => ["allergies", patientId ?? null] as const,
  messages: (params: Record<string, unknown>) =>
    ["doctor-messages", JSON.stringify(params)] as const,
  earningsSummary: ["doctor-earnings", "summary"] as const,
  earningsTimeseries: (days: number) =>
    ["doctor-earnings", "timeseries", days] as const,
  payouts: ["doctor-earnings", "payouts"] as const,
  rxTemplates: ["doctor-rx-templates"] as const,
  careTeam: (params: Record<string, unknown>) =>
    ["care-team", JSON.stringify(params)] as const,
  availability: ["doctor-portal", "availability"] as const,
  timeOff: ["doctor-portal", "time-off"] as const,
  clinics: (params: Record<string, unknown>) =>
    ["clinics", JSON.stringify(params)] as const,
  meTenants: ["me", "tenants"] as const,
  safetyCheck: (payload: unknown) => ["safety", "check", JSON.stringify(payload)] as const,
  medicinesMasterSearch: (q: string) =>
    ["medicines-master", "search", q] as const,
  portalPatientSearch: (q: string) =>
    ["doctor-portal", "search-patients", q] as const,
};