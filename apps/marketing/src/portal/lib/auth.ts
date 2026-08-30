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

/**
 * Server response shape when the doctor's credentials are valid but
 * their account still has MFA pending (`enroll`) or enrolled (`verify`).
 * The caller must post `{ mfaToken, code }` to /mfa/challenge to mint
 * a real session. Non-doctor logins never hit this branch.
 */
export interface MfaRequiredResponse {
  mfaRequired: "enroll" | "verify";
  mfaToken: string;
  expiresAt: number;
  user: AuthUser;
}

/**
 * Thrown by `login()` when the doctor must complete MFA. The login
 * page catches this, stashes `mfaToken` in the URL, and routes to
 * /portal/mfa-challenge for the second factor.
 */
export class MfaRequiredError extends Error {
  status = 200;
  payload: MfaRequiredResponse;
  constructor(payload: MfaRequiredResponse) {
    super("MFA required");
    this.name = "MfaRequiredError";
    this.payload = payload;
  }
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
  // The /auth/login endpoint accepts {email} OR {phone}. Doctors with
  // MFA enabled (or still pending enrollment) get an MFA branch back
  // instead of a session — we surface that as MfaRequiredError so the
  // login page can route to /portal/mfa-challenge.
  const res = await api<LoginResponse | MfaRequiredResponse>(
    patientPaths.auth.login(),
    {
      method: "POST",
      json: input,
    },
  );
  if ((res as MfaRequiredResponse).mfaRequired) {
    throw new MfaRequiredError(res as MfaRequiredResponse);
  }
  const ok = res as LoginResponse;
  useAuthStore.getState().setSession({
    token: ok.session.access_token,
    user: ok.user,
    refreshToken: ok.session.refresh_token,
  });
  return ok.user;
}

/**
 * Complete MFA after the credentials step. Posts the short-lived
 * `mfaToken` (returned by /auth/login when mfaRequired=true) plus a
 * 6-digit TOTP code OR a recovery code to /mfa/challenge. On success
 * the route mints a real session JWT; we persist it the same way
 * `login()` does for non-MFA users.
 */
export async function verifyMfaChallenge(input: {
  mfaToken: string;
  code: string;
}): Promise<AuthUser> {
  const res = await api<{ token: string; user: AuthUser }>("/mfa/challenge", {
    method: "POST",
    json: input,
  });
  useAuthStore.getState().setSession({
    token: res.token,
    user: res.user,
    refreshToken: null,
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
