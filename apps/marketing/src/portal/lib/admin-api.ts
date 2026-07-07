"use client";

import { useAuthStore } from "@/portal/stores/auth";

/**
 * Admin fetch wrapper. Reuses the same Authorization + Accept-Language
 * headers as the doctor portal, but routes auth failures to /admin/login
 * instead of /portal/login.
 *
 * Thin wrapper so admin pages don't have to repeat the redirect logic.
 *
 * Step-up token support: a token cached in `sessionStorage` under
 * `admin:stepUpToken` is attached as `X-Stepup-Token` on every
 * request. When the server replies `401 code="step_up_required"`,
 * we throw an `AdminApiError` whose `details.code` matches so the
 * `<StepUpModal>` mounted at the admin layout can prompt the admin
 * for a fresh passkey. The token is then retried once after
 * acquisition (see `adminApiWithStepUp`).
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

const STEPUP_STORAGE_KEY = "admin:stepUpToken";

export function getStepUpToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(STEPUP_STORAGE_KEY);
}

export function setStepUpToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(STEPUP_STORAGE_KEY, token);
  else window.sessionStorage.removeItem(STEPUP_STORAGE_KEY);
}

function attachStepUpHeader(headers: Record<string, string>): void {
  const tok = getStepUpToken();
  if (tok) headers["X-Stepup-Token"] = tok;
}

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
  attachStepUpHeader(reqHeaders);

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
    // Dispatch a global event for the StepUpModal. The mutated caller
    // can choose to retry with `adminApiWithStepUp`, which will
    // re-issue the request after the modal obtains a fresh token.
    if (body?.code === "step_up_required" && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("admin:step_up_required", { detail: { path, body, status: res.status } }),
      );
    }
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

/**
 * Same as `adminApi` but retries once if the server replies with
 * `code: "step_up_required"`. We dispatch a global event so the
 * mounted `<StepUpModal>` opens the WebAuthn assertion prompt.
 * The `refresh` callback is invoked as the actual acquisition
 * path (it should call /admin/webauthn/auth/verify and return
 * the step-up token). Callers can pass `null` to defer entirely
 * to the modal.
 */
export async function adminApiWithStepUp<T = any>(
  path: string,
  init: Init = {},
  refresh?: () => Promise<string>,
): Promise<T> {
  try {
    return await adminApi<T>(path, init);
  } catch (e: any) {
    const code = e?.details?.code;
    if (e?.status !== 401 || code !== "step_up_required") throw e;
    if (refresh) {
      const fresh = await refresh();
      setStepUpToken(fresh);
      return adminApi<T>(path, init);
    }
    // Wait for the modal to acquire the token.
    const acquired = await new Promise<string>((resolve, reject) => {
      const onResolved = () => {
        cleanup();
        const tok = getStepUpToken();
        if (tok) resolve(tok);
        else reject(new Error("Step-up cancelled"));
      };
      const onCancelled = () => { cleanup(); reject(new Error("Step-up cancelled")); };
      const cleanup = () => {
        window.removeEventListener("admin:step_up_resolved", onResolved);
        window.removeEventListener("admin:step_up_cancelled", onCancelled);
      };
      window.addEventListener("admin:step_up_resolved", onResolved, { once: true });
      window.addEventListener("admin:step_up_cancelled", onCancelled, { once: true });
    });
    return adminApi<T>(path, init);
  }
}

/**
 * Download helper for export endpoints. Returns the blob + filename
 * so callers can wire up `<a download>` or stream the file.
 */
export async function adminDownload(path: string, filename?: string): Promise<{ blob: Blob; filename: string }> {
  const store = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (store.token) headers["Authorization"] = `Bearer ${store.token}`;
  if (store.locale) headers["Accept-Language"] = store.locale;
  attachStepUpHeader(headers);

  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    throw new AdminApiError(`Export failed (${res.status})`, res.status);
  }
  const disp = res.headers.get("Content-Disposition") ?? "";
  const m = disp.match(/filename="?([^";]+)"?/);
  const finalName = filename ?? (m?.[1] ?? "export");
  return { blob: await res.blob(), filename: finalName };
}

/** Canonical query key registry for admin endpoints. */
export const adminQk = {
  dashboard: () => ["admin", "dashboard"] as const,
  approvals: (status = "pending") => ["admin", "approvals", status] as const,
  users: (params: Record<string, unknown>) => ["admin", "users", params] as const,
  user: (id: string) => ["admin", "users", id] as const,
  userNotes: (id: string) => ["admin", "users", id, "notes"] as const,
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
  settings: () => ["admin", "settings"] as const,
  setting: (key: string) => ["admin", "settings", key] as const,
  slmcDocs: (doctorId: string) => ["admin", "doctors", doctorId, "docs"] as const,
  passkeys: () => ["admin", "webauthn", "status"] as const,
};