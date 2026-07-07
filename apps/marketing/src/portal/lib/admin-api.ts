"use client";

import { useAuthStore } from "@/portal/stores/auth";

/**
 * Admin fetch wrapper. Reuses the same Authorization + Accept-Language
 * headers as the doctor portal, but routes auth failures to /admin/login
 * instead of /portal/login.
 *
 * Thin wrapper so admin pages don't have to repeat the redirect logic.
 */
export class AdminApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.details = details;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

type Init = Omit<RequestInit, "body"> & { json?: unknown };

export async function adminApi<T = any>(path: string, init: Init = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const store = useAuthStore.getState();
  const token = store.token;
  const locale = store.locale;

  const url = `${API_URL}${path}`;
  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (json !== undefined) reqHeaders["Content-Type"] = "application/json";
  if (token) reqHeaders["Authorization"] = `Bearer ${token}`;
  if (locale) reqHeaders["Accept-Language"] = locale;

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
  });

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== "undefined") {
      const onAdminPath = window.location.pathname.startsWith("/admin");
      if (!onAdminPath) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/admin/login?next=${next}`;
      }
    }
    let body: any = null;
    try { body = await res.json(); } catch {}
    throw new AdminApiError(body?.error ?? "Admin session invalid", res.status, body);
  }

  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch {}
    throw new AdminApiError(body?.error ?? `Request failed (${res.status})`, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("Content-Type") ?? "";
  return ct.includes("application/json") ? ((await res.json()) as T) : ((await res.text()) as unknown as T);
}

/** Canonical query key registry for admin endpoints. */
export const adminQk = {
  dashboard: () => ["admin", "dashboard"] as const,
  approvals: (status = "pending") => ["admin", "approvals", status] as const,
  users: (params: Record<string, unknown>) => ["admin", "users", params] as const,
  user: (id: string) => ["admin", "users", id] as const,
  doctors: (params: Record<string, unknown>) => ["admin", "doctors", params] as const,
  doctor: (id: string) => ["admin", "doctors", id] as const,
  tenants: (type: string) => ["admin", "tenants", type] as const,
  waitlist: (status = "all") => ["admin", "waitlist", status] as const,
  demoRequests: (status?: string) => ["admin", "demo-requests", status ?? "all"] as const,
  audit: (params: Record<string, unknown>) => ["admin", "audit", params] as const,
  payouts: (status?: string) => ["admin", "payouts", status ?? "all"] as const,
  insuranceClaims: (status?: string) => ["admin", "insurance-claims", status ?? "all"] as const,
  dsar: (status?: string) => ["admin", "dsar", status ?? "all"] as const,
  medicinesMaster: (params: Record<string, unknown>) => ["admin", "medicines-master", params] as const,
};