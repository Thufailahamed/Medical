const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.healthhub.app";

export async function api<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: any },
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("healthcare-insurance-operator-auth")
        ? JSON.parse(
            localStorage.getItem("healthcare-insurance-operator-auth")!,
          ).state?.token
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
      localStorage.removeItem("healthcare-insurance-operator-auth");
      window.location.href = "/insurance-operator/login";
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
  dashboard: ["insurance-operator-dashboard"] as const,
  claims: (status?: string) => ["insurance-operator-claims", status] as const,
  claim: (id: string) => ["insurance-operator-claim", id] as const,
  enrollments: ["insurance-operator-enrollments"] as const,
};