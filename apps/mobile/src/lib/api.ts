import { supabase } from "./supabase";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8787";
const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === "true";

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  isFormData?: boolean;
}

export async function api<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, isFormData = false } = options;

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  if (DEV_MODE) {
    requestHeaders["Authorization"] = "Bearer dev-token";
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      requestHeaders["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  if (!isFormData) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
