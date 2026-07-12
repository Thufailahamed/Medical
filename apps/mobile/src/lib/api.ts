import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { useActiveFamilyMemberStore } from "@/stores/activeFamilyMember";
import { useActiveTenantStore } from "@/stores/tenant-store";
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
  // Phase 3.1 slice 2: prescription PDF. "blob" returns a raw Blob instead
  // of JSON so the caller can stream it to disk (expo-file-system) and
  // hand the URI to expo-sharing.
  responseType?: "json" | "blob";
}

// ─── Internal: build headers + run a single request ───────
async function runRequest<T>(
  endpoint: string,
  options: ApiOptions,
  token: string | null
): Promise<T> {
  const { method = "GET", body, headers = {}, isFormData = false, responseType = "json" } = options;

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
  // Phase MTN-1: forward active tenant so list endpoints scope to the
  // chosen hospital/clinic. Mutex by design — server returns 400 if
  // both headers are set. Header wins over the user's persisted
  // column, which the server uses as offline fallback.
  const activeHospId = useActiveTenantStore.getState().activeHospitalId;
  const activeClinicId = useActiveTenantStore.getState().activeClinicId;
  if (activeHospId) {
    requestHeaders["x-active-hospital-id"] = activeHospId;
  } else if (activeClinicId) {
    requestHeaders["x-active-clinic-id"] = activeClinicId;
  }
  // Forward device timezone offset (minutes east of UTC) so the server
  // can compute "today" in the user's wall-clock day, not UTC.
  // e.g. UTC+5:30 => 330, UTC-5 => -300
  requestHeaders["x-timezone-offset"] = String(
    -new Date().getTimezoneOffset()
  );

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

  return responseType === "blob"
    ? (response.blob() as unknown as T)
    : response.json();
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

// ─── Public: derive the marketing-site origin for share/invite URLs ─
// The marketing app serves /share/<token> and /invite/<token> links
// out-of-band of the API. Prefer an explicit PUBLIC_URL; otherwise
// derive it from API_URL by stripping a trailing /api. Returns "" when
// neither is set — callers can detect and hide share UI.
export function getPublicBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_PUBLIC_URL;
  if (explicit && explicit.length > 0) return explicit;
  const api = process.env.EXPO_PUBLIC_API_URL;
  if (api && api.length > 0) return api.replace(/\/api$/, "");
  return "";
}

// ─── Public: derive the API origin for non-fetch URL consumers ─────
// `api()` handles every authenticated request. This helper exists for
// the rare cases that need a raw URL string — RN `<Image source={uri}>`
// and `Linking.openURL(url)` — neither of which can carry auth headers.
// Auth-required downloads must go through `api({responseType:"blob"})`
// instead. Falls back to "" when unset so callers can branch on it.
export function getApiBaseUrl(): string {
  const api = process.env.EXPO_PUBLIC_API_URL;
  return api && api.length > 0 ? api : "";
}

// ─── SSE consumer ────────────────────────────────────────
// Opens a streamed POST/GET to the API and invokes `onEvent` for each
// parsed SSE message. `onEvent` receives `{ event, data }`; the caller
// is responsible for parsing `data` (it is always a JSON string).
//
// Aborts automatically on the returned `abort()` call or when the
// caller-supplied `signal` fires. Re-uses the same headers as the JSON
// `api()` helper (auth, locale, family member, tenant, tz) so SSE
// routes get the full request context.
export type SseEvent = { event: string; data: string };

export type SseOptions = {
  method?: "GET" | "POST";
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export async function apiSse(
  endpoint: string,
  options: SseOptions,
  onEvent: (e: SseEvent) => void
): Promise<{ abort: () => void; done: Promise<void> }> {
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

  const requestHeaders: Record<string, string> = { ...(options.headers || {}) };
  if (token) requestHeaders["Authorization"] = `Bearer ${token}`;
  requestHeaders["Accept-Language"] = intlLocale(
    useLocaleStore.getState().locale
  );
  const activeFmId = useActiveFamilyMemberStore.getState().activeFamilyMemberId;
  if (activeFmId) {
    requestHeaders["x-active-family-member-id"] = activeFmId;
  }
  const activeHospId = useActiveTenantStore.getState().activeHospitalId;
  const activeClinicId = useActiveTenantStore.getState().activeClinicId;
  if (activeHospId) {
    requestHeaders["x-active-hospital-id"] = activeHospId;
  } else if (activeClinicId) {
    requestHeaders["x-active-clinic-id"] = activeClinicId;
  }
  requestHeaders["x-timezone-offset"] = String(
    -new Date().getTimezoneOffset()
  );
  if (options.body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }
  requestHeaders["Accept"] = "text/event-stream";

  const ctrl = new AbortController();
  // Forward caller-supplied signal into our internal abort controller.
  if (options.signal) {
    if (options.signal.aborted) ctrl.abort();
    else options.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }

  const done = (async () => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: options.method || "POST",
      headers: requestHeaders,
      body: options.body
        ? typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: `HTTP ${res.status}` }));
      const e: any = new Error(err?.error || `HTTP ${res.status}`);
      e.status = res.status;
      throw e;
    }
    if (!res.body) return;

    // React Native's fetch returns a ReadableStream that supports
    // getReader(); iterate line-by-line, splitting on blank lines per
    // the SSE wire format.
    const reader = (res.body as any).getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { value, done: rDone } = await reader.read();
        if (rDone) break;
        buf += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          if (!raw.trim()) continue;
          let event = "message";
          let data = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
            // SSE allows multi-line `data:`; concatenate. The first
            // line keeps its prefix in the concat above — strip the
            // first "data: " if multiple lines (harmless if not).
          }
          try {
            onEvent({ event, data: data.replace(/^data: /, "") });
          } catch (cbErr) {
            console.error("[apiSse] onEvent threw:", cbErr);
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  })();

  return { abort: () => ctrl.abort(), done };
}