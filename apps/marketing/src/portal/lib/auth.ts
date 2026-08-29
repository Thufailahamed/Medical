/**
 * Auth-side helpers: the actual `login`/`register` calls + the /me read
 * that hydrates the store after a refresh.
 *
 * The Zustand store owns the token. These functions take a token from the
 * server response and call `setSession` to persist it.
 */

"use client";

import { patientPaths } from "@healthcare/shared/contracts";

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

export interface PhoneOtpStartResponse {
  otpSent: boolean;
  userId: string;
  channel: "mobile" | "email" | string;
  target: string;
  expiresAt: string;
  /** Present in DEV_MODE / known test phones — auto-verify without SMS. */
  devCode?: string;
}

export async function login(input: LoginInput): Promise<AuthUser> {
  // The /auth/login endpoint accepts {email} OR {phone}.
  const res = await api<LoginResponse>(patientPaths.auth.login(), {
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

/**
 * Start phone OTP login (same path as mobile "As Patient").
 * Returns the OTP start payload — callers either auto-verify with
 * `devCode` or route the user to the OTP entry screen.
 */
export async function startPhoneLogin(
  phone: string,
): Promise<PhoneOtpStartResponse> {
  return api<PhoneOtpStartResponse>(patientPaths.auth.loginByPhone(), {
    method: "POST",
    json: { phone },
  });
}

/** Complete phone OTP login and persist the session. */
export async function verifyPhoneLogin(input: {
  userId: string;
  channel?: "mobile" | "email";
  code: string;
}): Promise<AuthUser> {
  const res = await api<LoginResponse>(patientPaths.auth.verifyOtp(), {
    method: "POST",
    json: {
      userId: input.userId,
      channel: input.channel ?? "mobile",
      code: input.code,
    },
  });
  if (!res.session?.access_token) {
    throw new ApiError(
      "Verification succeeded but no session was returned.",
      500,
    );
  }
  useAuthStore.getState().setSession({
    token: res.session.access_token,
    user: res.user,
    refreshToken: res.session.refresh_token,
  });
  return res.user;
}

/**
 * Mobile-parity quick login: request OTP and, when the API returns
 * `devCode`, verify immediately. Otherwise returns `{ needsOtp: true, … }`.
 */
export async function loginWithPhone(phone: string): Promise<
  | { user: AuthUser; needsOtp: false }
  | { needsOtp: true; start: PhoneOtpStartResponse }
> {
  const start = await startPhoneLogin(phone);
  if (!start.otpSent) {
    throw new ApiError("Could not send verification code.", 400);
  }
  if (!start.devCode) {
    return { needsOtp: true, start };
  }
  const user = await verifyPhoneLogin({
    userId: start.userId,
    channel: "mobile",
    code: start.devCode,
  });
  return { user, needsOtp: false };
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

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
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
