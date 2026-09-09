import { loginHref } from "@/portal/lib/login";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.healthhub.app";

export async function api<T>(
  path: string,
  init?: RequestInit & { body?: any }
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("healthcare-lab-auth")
        ? JSON.parse(localStorage.getItem("healthcare-lab-auth")!).state?.token
        : null
      : null;

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
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Lab Task 3: R2 upload via POST /files/upload (multipart, no JSON Content-Type).
// Returns the canonical `/files/download/<key>` URL for `complete { resultPdfUrl }`.
export async function uploadFile(file: File): Promise<{ r2Key: string; url: string }> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("healthcare-lab-auth")
        ? JSON.parse(localStorage.getItem("healthcare-lab-auth")!).state?.token
        : null
      : null;
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
