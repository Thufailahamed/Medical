/**
 * Fetch wrapper used by every TanStack Query hook.
 *
 * - Adds `Authorization: Bearer <token>` from the Zustand auth store.
 * - Adds `Accept-Language` from the auth store's locale field.
 * - Adds `x-active-hospital-id` / `x-active-clinic-id` for tenant scoping.
 * - Throws `ApiError` on non-2xx so React Query surfaces a useful message.
 *
 * 401 handling (Phase 1.1):
 *   - If we have a refresh_token AND this is the first 401 for the
 *     request, hit POST /auth/refresh once, swap the access token in
 *     the store, and retry the original request. This keeps a user
 *     who briefly outlives their access token from being forced back
 *     to /login mid-session.
 *   - If refresh fails, or the retried request 401s again, fall through
 *     to the legacy logout+redirect flow.
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
  body?: BodyInit | null;
  json?: unknown;
  // Allow overriding the path on the API root (default API_URL).
  base?: string;
  // Internal: skip the 401 refresh+retry path. Set on the recursive
  // retry so we don't loop forever if the refreshed token is also bad.
  __skipRefresh?: boolean;
};

interface RefreshResponse {
  session?: { access_token: string; refresh_token: string };
}

/**
 * Hit POST /auth/refresh with a raw fetch — bypasses api() entirely so
 * a 400 from the backend (no refresh_token) doesn't get classified as a
 * session-expired 401 and trigger another logout cycle. On success,
 * swap the access token into the store so the retry sees it.
 */
async function attemptRefresh(refreshToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as RefreshResponse | null;
    const next = data?.session?.access_token;
    const nextRefresh = data?.session?.refresh_token;
    if (!next) return false;
    // Update only the token/refreshToken — keep user + tenant state.
    const state = useAuthStore.getState();
    // `useAuthStore` exposes a setter for the access token via setSession
    // (which also re-derives activeHospitalId) but we want to preserve
    // the existing user, so we mutate the store directly via a minimal
    // partial set. Using setSession would clobber user. So write token
    // through the persisted shape: easiest path is to update both fields
    // via the dedicated setRefreshToken + a direct token assignment.
    // (Zustand persists automatically; direct assignment works because
    // the store doesn't use immer.)
    (useAuthStore as any).setState({
      token: next,
      refreshToken: nextRefresh ?? null,
    });
    return true;
  } catch {
    return false;
  }
}

function bounceToLogin(reason?: string) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const onLoginPage =
    path === "/portal/login" ||
    path === "/login" ||
    path === "/hospital/login" ||
    path === "/admin/login";
  if (onLoginPage) return;
  const next = encodeURIComponent(path);
  const loginTarget = path.startsWith("/portal")
    ? "/portal/login"
    : path.startsWith("/hospital")
      ? "/hospital/login"
      : path.startsWith("/admin")
        ? "/admin/login"
        : "/login";
  const qs = reason ? `&reason=${encodeURIComponent(reason)}` : "";
  window.location.href = `${loginTarget}?next=${next}${qs}`;
}

export async function api<T = any>(
  path: string,
  init: Init = {}
): Promise<T> {
  const { json, headers, base, __skipRefresh, ...rest } = init;

  const store = useAuthStore.getState();
  let token = store.token;
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

  let res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    credentials: "include",
    body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
  });

  // ─── 401 → refresh + retry once (Phase 1.1) ────────────────────
  if (res.status === 401 && !__skipRefresh) {
    const onLoginPage =
      typeof window !== "undefined" &&
      (window.location.pathname === "/portal/login" ||
        window.location.pathname === "/login");
    // The refresh endpoint is itself auth-free, so even when /auth/me
    // bounces us here there's a path back. Don't try to refresh on the
    // login page (where the user has no refresh token yet anyway).
    if (!onLoginPage) {
      const rt = useAuthStore.getState().refreshToken;
      if (rt) {
        const ok = await attemptRefresh(rt);
        if (ok) {
          // Retry the original request exactly once with the new token.
          return api<T>(path, { ...init, __skipRefresh: true });
        }
      }
    }
    // No refresh token, or refresh failed — fall through to the legacy
    // logout+redirect block below.
  }

  let body: any = null;
  if (!res.ok) {
    try {
      body = await res.json();
    } catch {
      // Non-JSON error body — fall through.
    }
  }

  // Unauthorised → drop the session and bounce to /login.
  // On the login page itself, surface the server's message (e.g. "Invalid
  // credentials") instead of the generic session-expired copy.
  if (res.status === 401) {
    const onLoginPage =
      typeof window !== "undefined" &&
      (window.location.pathname === "/portal/login" ||
        window.location.pathname === "/login");
    const msg =
      onLoginPage && body?.error
        ? body.error
        : "Session expired. Please sign in again.";
    if (typeof window !== "undefined") {
      useAuthStore.getState().logout();
      if (!onLoginPage) bounceToLogin("session_expired");
    }
    throw new ApiError(msg, 401, body?.details ?? body);
  }

  if (!res.ok) {
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
  safetyCheck: (payload: unknown) =>
    ["safety", "check", JSON.stringify(payload)] as const,
  medicinesMasterSearch: (q: string) =>
    ["medicines-master", "search", q] as const,
  portalPatientSearch: (q: string) =>
    ["doctor-portal", "search-patients", q] as const,
  unreadCount: ["notifications", "unread-count"] as const,
  labOrdersAll: (params: Record<string, unknown>) =>
    ["doctor-portal", "lab-orders-all", JSON.stringify(params)] as const,
  aiSummary: (patientId: string) => ["ai", "summary", patientId] as const,
  aiLabExplain: (key: string) => ["ai", "lab-explain", key] as const,
  auditMe: (params: Record<string, unknown>) =>
    ["audit", "me", JSON.stringify(params)] as const,
  shareDoctorLinks: ["doctor-portal", "share-links"] as const,
};