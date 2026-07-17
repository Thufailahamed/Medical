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
      window.location.href = "/lab-portal/login";
    }
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const qk = {
  dashboard: ["lab-dashboard"] as const,
  bookings: (status?: string) => ["lab-bookings", status] as const,
  booking: (id: string) => ["lab-booking", id] as const,
  catalog: ["lab-catalog"] as const,
  packages: ["lab-packages"] as const,
  phlebotomists: ["lab-phlebotomists"] as const,
};
