// @ts-nocheck
/**
 * Session cookie helpers for the portal.
 *
 * The portal (`apps/marketing`) and the mobile app use different auth
 * surfaces. The portal stores its JWT in an httpOnly cookie so client
 * JS can't exfiltrate it via XSS — same-origin requests from the
 * marketing app still carry the cookie automatically; cross-origin
 * requests from the mobile app continue to use `Authorization: Bearer`.
 *
 * Cookie name: `portal_session`
 * Flags:        HttpOnly; Secure; SameSite=Lax; Path=/
 * TTL:          mirrors the access-token TTL (default 60 minutes)
 */

import type { Context } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { AppEnvironment } from "../types";

export const SESSION_COOKIE = "portal_session";

const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour, matches generateToken default

/**
 * Emit the session JWT as an httpOnly cookie. Caller passes the
 * already-minted access token (we don't sign it here — keeps
 * cookie emission in sync with the body shape).
 */
export function setSessionCookie(
  c: Context<AppEnvironment>,
  token: string,
  ttlSeconds: number = ACCESS_TTL_SECONDS
) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: ttlSeconds,
  });
}

/**
 * Clear the session cookie on logout / refresh-revocation.
 */
export function clearSessionCookie(c: Context<AppEnvironment>) {
  deleteCookie(c, SESSION_COOKIE, {
    path: "/",
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
  });
}

/**
 * Read the session JWT from the cookie if present. Auth middleware
 * falls back to this when no `Authorization: Bearer` header is set.
 */
export function readSessionCookie(c: Context<AppEnvironment>): string | null {
  const v = getCookie(c, SESSION_COOKIE);
  return v ?? null;
}
