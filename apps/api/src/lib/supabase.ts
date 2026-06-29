import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey);
}

export function createSupabaseAuth(url: string, anonKey: string, token: string) {
  return createClient(
    url,
    anonKey,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );
}
