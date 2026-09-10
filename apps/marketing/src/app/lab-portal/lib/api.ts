import { loginHref } from "@/portal/lib/login";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.healthhub.app";

function readStoreToken(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw)?.state?.token ?? null;
  } catch {
    return null;
  }
}

// Unified login persists in the main portal store; the legacy
// lab store is only a fallback. Prefer main so labs authenticated
// via /login (port=facility) can reach the portal APIs.
export function getLabToken(): string | null {
  return (
    readStoreToken("healthcare-portal-auth") ??
    readStoreToken("healthcare-lab-auth")
  );
}

export async function api<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: any }
): Promise<T> {
  const token = getLabToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("healthcare-lab-auth");
      window.location.href = loginHref({ port: "facility" });
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    // Surface backend `details` (e.g. Zod field errors) so the UI can
    // tell the user *why* validation failed instead of just the top-
    // level "Validation failed" string.
    const detail = err.details
      ? typeof err.details === "string"
        ? err.details
        : JSON.stringify(err.details)
      : null;
    const message = detail
      ? `${err.error || `HTTP ${res.status}`}: ${detail}`
      : err.error || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

// Lab Task 3: R2 upload via POST /files/upload (multipart, no JSON Content-Type).
// Returns the canonical `/files/download/<key>` URL for `complete { resultPdfUrl }`.
export async function uploadFile(file: File): Promise<{ r2Key: string; url: string }> {
  const token = getLabToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const body = await res.json();
  const r2Key: string = body.file?.r2Key ?? body.file?.url ?? "";
  const url = r2Key.startsWith("/files")
    ? r2Key
    : `/files/download/${encodeURIComponent(r2Key)}`;
  return { r2Key, url };
}

export const qk = {
  dashboard: ["lab-dashboard"] as const,
  bookings: (status?: string) => ["lab-bookings", status] as const,
  booking: (id: string) => ["lab-booking", id] as const,
  catalog: ["lab-catalog"] as const,
  packages: ["lab-packages"] as const,
  phlebotomists: ["lab-phlebotomists"] as const,
};
