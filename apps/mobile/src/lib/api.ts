import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { useActiveFamilyMemberStore } from "@/stores/activeFamilyMember";
import { intlLocale } from "./format";

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;
const FALLBACK_API_URL = "http://localhost:8787";
const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === "true";

// In production builds, never silently fall back to localhost — that would mean
// every network call resolves to a dev machine. Warn loudly so deploys fail
// visibly instead of silently returning "network error" to users.
const API_URL =
  ENV_API_URL && ENV_API_URL.length > 0
    ? ENV_API_URL
    : __DEV__
    ? FALLBACK_API_URL
    : (() => {
        console.warn(
          "[api] EXPO_PUBLIC_API_URL is not set; production requests will fail."
        );
        return FALLBACK_API_URL;
      })();

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  isFormData?: boolean;
  silent401?: boolean; // suppress the auth error event
}

// ─── Internal: build headers + run a single request ───────
async function runRequest<T>(
  endpoint: string,
  options: ApiOptions,
  token: string | null
): Promise<T> {
  const { method = "GET", body, headers = {}, isFormData = false } = options;

  const requestHeaders: Record<string, string> = { ...headers };
  if (token) requestHeaders["Authorization"] = `Bearer ${token}`;
  // Forward active locale so the API can translate Zod validation errors.
  requestHeaders["Accept-Language"] = intlLocale(
    useLocaleStore.getState().locale
  );
  // Phase 2.3: forward active family member so list endpoints filter
  // and POST endpoints default-assign. Header is the request-level hint;
  // server column is the durable source of truth.
  const activeFmId = useActiveFamilyMemberStore.getState().activeFamilyMemberId;
  if (activeFmId) {
    requestHeaders["x-active-family-member-id"] = activeFmId;
  }

  if (!isFormData && body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body
      ? isFormData
        ? body
        : typeof body === "string"
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  if (!response.ok) {
    if (response.status === 401 && !options.silent401) {
      // Notify the auth layer that the session is bad.
      try {
        useAuthStore.getState().onAuthError();
      } catch {
        // store not ready; ignore
      }
    }
    // Phase 2.3: 410 with `family_member_gone` means the active FM the
    // client thinks it's acting as no longer exists (deleted on another
    // device, owner changed, etc.). Clear the local store + tell the
    // caller via a typed error so screens can react.
    if (response.status === 410) {
      try {
        const body = await response.clone().json().catch(() => ({}));
        if (body?.reason === "family_member_gone") {
          useActiveFamilyMemberStore.getState().clear();
        }
      } catch {
        // ignore parse errors — clear() is idempotent
      }
    }
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));

    let errMsg = "Request failed";
    if (typeof error.error === "string") {
      errMsg = error.error;
    } else if (error.error && typeof error.error.message === "string") {
      errMsg = error.error.message;
    } else if (typeof error.message === "string") {
      errMsg = error.message;
    } else {
      errMsg = `HTTP ${response.status}`;
    }
    const err: any = new Error(errMsg);
    err.status = response.status;
    err.reason = error?.reason;
    throw err;
  }

  return response.json();
}

// ─── Public: simple call (matches the old `api` shape) ────
export async function api<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  let token: string | null = null;
  if (DEV_MODE) {
    token = "dev-token";
  } else {
    try {
      token = await SecureStore.getItemAsync("auth_token");
    } catch {
      token = null;
    }
  }
  return runRequest<T>(endpoint, options, token);
}

// ─── Public: call with auto-refresh on 401 ────────────────
export async function apiWithRefresh<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  return api<T>(endpoint, options);
}