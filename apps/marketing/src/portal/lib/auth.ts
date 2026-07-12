/**
 * Auth-side helpers: the actual `login`/`register` calls + the /me read
 * that hydrates the store after a refresh.
 *
 * The Zustand store owns the token. These functions take a token from the
 * server response and call `setSession` to persist it.
 */

"use client";

import { api, ApiError } from "./api";
import { useAuthStore, type AuthUser, type Locale } from "@/portal/stores/auth";

export interface LoginInput {
  email?: string;
  phone?: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  session: { access_token: string; refresh_token: string };
}

export async function login(input: LoginInput): Promise<AuthUser> {
  // The /auth/login endpoint accepts {email} OR {phone}.
  const res = await api<LoginResponse>("/auth/login", {
    method: "POST",
    json: input,
  });
  useAuthStore.getState().setSession({
    token: res.session.access_token,
    user: res.user,
    refreshToken: res.session.refresh_token,
  });
  return res.user;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const store = useAuthStore.getState();
  if (!store.token) return null;
  try {
    const res = await api<{ user: AuthUser }>("/auth/me");
    useAuthStore.getState().setUser(res.user);
    return res.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // Already cleared by api.ts on 401.
      return null;
    }
    throw err;
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await api("/auth/change-password", {
    method: "POST",
    json: { currentPassword, newPassword },
  });
}

export async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Best-effort — clear local regardless.
  }
  useAuthStore.getState().logout();
}

/** Push a new locale into the store + persist + tell the API. */
export function setLocale(l: Locale) {
  useAuthStore.getState().setLocale(l);
  if (typeof document !== "undefined") {
    document.documentElement.lang = l;
  }
}
