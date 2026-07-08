/**
 * Fetch wrapper used by every TanStack Query hook in the hospital portal.
 *
 * - Adds `Authorization: Bearer <token>` from the hospital auth store.
 * - Adds `Accept-Language` from the auth store's locale field.
 * - Adds `x-active-hospital-id` / `x-active-clinic-id` for tenant scoping.
 * - Throws `ApiError` on non-2xx so React Query surfaces a useful message.
 * - On 401 the store is cleared and the window redirected to /hospital/login.
 *
 * The hospital store is intentionally separate from the doctor portal store
 * so a user can be signed into both surfaces in the same browser.
 */

import { useAuthStore } from "@/hospital/stores/auth";

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

  // Unauthorised → drop the session and bounce to /hospital/login.
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      useAuthStore.getState().logout();
      if (window.location.pathname !== "/hospital/login") {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = `/hospital/login?next=${next}`;
      }
    }
    throw new ApiError("Session expired. Please sign in again.", 401);
  }

  // 403 — surface to caller (page-level RBAC will redirect when needed).
  if (res.status === 403) {
    if (typeof window !== "undefined" && window.location.pathname !== "/hospital/403") {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/hospital/403?next=${next}`;
    }
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

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

/** Query-key registry for the hospital portal. */
export const qk = {
  me: ["auth", "me"] as const,
  dashboard: ["hospital-portal", "dashboard"] as const,
  meTenants: ["me", "tenants"] as const,
  unreadCount: ["notifications", "unread-count"] as const,

  // Reception
  patientSearch: (q: string) => ["doctor", "search-patients", q] as const,
  hospitalPatients: (params: Record<string, unknown>) =>
    ["hospital-portal", "patients", JSON.stringify(params)] as const,
  walkIns: (params: Record<string, unknown>) =>
    ["walk-ins", JSON.stringify(params)] as const,
  appointments: (params: Record<string, unknown>) =>
    ["appointments", JSON.stringify(params)] as const,
  doctors: ["doctor", "search"] as const,

  // Wards & Beds
  wards: ["hospital-portal", "wards"] as const,
  beds: (params: Record<string, unknown>) =>
    ["hospital-portal", "beds", JSON.stringify(params)] as const,
  admissions: (params: Record<string, unknown>) =>
    ["hospital-portal", "admissions", JSON.stringify(params)] as const,
  admission: (id: string) => ["hospital-portal", "admission", id] as const,

  // Staff & Departments
  staff: ["hospital-portal", "staff"] as const,
  staffInvites: ["hospital-portal", "staff", "invites"] as const,
  departments: ["hospital-portal", "departments"] as const,

  // Pharmacy
  pharmacyQueue: (params: Record<string, unknown>) =>
    ["pharmacy", "prescriptions", JSON.stringify(params)] as const,
  pharmacyInventory: ["hospital-portal", "pharmacy", "inventory"] as const,

  // Lab
  labOrders: (params: Record<string, unknown>) =>
    ["labs", JSON.stringify(params)] as const,

  // Billing
  invoices: (params: Record<string, unknown>) =>
    ["hospital-portal", "billing", "invoices", JSON.stringify(params)] as const,
  invoice: (id: string) => ["hospital-portal", "billing", "invoice", id] as const,
  invoiceOutstanding: ["hospital-portal", "billing", "outstanding"] as const,

  // Reports
  reportDashboardTiles: ["hospital-portal", "reports", "dashboard-tiles"] as const,
  reportOpd: (params: Record<string, unknown>) =>
    ["hospital-portal", "reports", "opd", JSON.stringify(params)] as const,
  reportIpd: (params: Record<string, unknown>) =>
    ["hospital-portal", "reports", "ipd", JSON.stringify(params)] as const,
  reportOccupancy: (params: Record<string, unknown>) =>
    ["hospital-portal", "reports", "occupancy", JSON.stringify(params)] as const,
  reportRevenue: (params: Record<string, unknown>) =>
    ["hospital-portal", "reports", "revenue", JSON.stringify(params)] as const,
  reportDoctorUtil: (params: Record<string, unknown>) =>
    ["hospital-portal", "reports", "doctor-utilization", JSON.stringify(params)] as const,
  reportPharmacy: (params: Record<string, unknown>) =>
    ["hospital-portal", "reports", "pharmacy", JSON.stringify(params)] as const,
  reportTopDiagnoses: (params: Record<string, unknown>) =>
    ["hospital-portal", "reports", "top-diagnoses", JSON.stringify(params)] as const,

  // Admin
  adminTenants: (params: Record<string, unknown>) =>
    ["admin", "tenants", JSON.stringify(params)] as const,
  adminApprovals: (params: Record<string, unknown>) =>
    ["admin", "approvals", JSON.stringify(params)] as const,
};