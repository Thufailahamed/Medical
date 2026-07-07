// @ts-nocheck
// ─── Step-up auth (Phase ADM-3) ─────────────────────────────
//
// Short-lived HMAC token that proves the calling admin
// re-authenticated (via passkey, future TOTP, or future email
// code) within the last 5 minutes. Required before destructive
// admin actions.
//
// Token format: base64url(payload) + "." + base64url(hmacSha256)
// where payload is { userId, exp } JSON. HMAC key = JWT_SECRET
// (already in env).
//
// Why not use the existing JWT: a JWT lasts 30 days; we want a
// fresh, narrowly-scoped proof. A separate token type avoids
// conflating session with step-up.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types";

const STEPUP_TTL_SECONDS = 5 * 60;

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function getSecret(c: Context<AppEnvironment>): string {
  return c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
}

export function issueStepUpToken(c: Context<AppEnvironment>, userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + STEPUP_TTL_SECONDS;
  const payload = JSON.stringify({ userId, exp });
  const mac = createHmac("sha256", getSecret(c)).update(payload).digest();
  return `${b64url(payload)}.${b64url(mac)}`;
}

export function verifyStepUpToken(c: Context<AppEnvironment>, token: string): { userId: string; exp: number } | null {
  if (!token || !token.includes(".")) return null;
  const [p, sig] = token.split(".");
  let payloadBuf: Buffer;
  let sigBuf: Buffer;
  try {
    payloadBuf = fromB64url(p);
    sigBuf = fromB64url(sig);
  } catch {
    return null;
  }
  const expected = createHmac("sha256", getSecret(c)).update(payloadBuf).digest();
  if (sigBuf.length !== expected.length) return null;
  if (!timingSafeEqual(sigBuf, expected)) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(payloadBuf.toString("utf-8"));
  } catch {
    return null;
  }
  if (typeof parsed?.userId !== "string" || typeof parsed?.exp !== "number") return null;
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}

/**
 * Middleware. Reject the request with 401 + code `step_up_required`
 * unless the caller presented a fresh step-up token matching
 * `c.get("dbUser").id`.
 */
export async function requirePasskeyFresh(c: Context<AppEnvironment>, next: Next) {
  const dbUser = c.get("dbUser");
  if (!dbUser) {
    return c.json({ error: "Unauthorized", code: "no_session" }, 401);
  }
  const token = c.req.header("X-Stepup-Token");
  if (!token) {
    return c.json({ error: "Step-up authentication required", code: "step_up_required" }, 401);
  }
  const parsed = verifyStepUpToken(c, token);
  if (!parsed) {
    return c.json({ error: "Step-up token invalid or expired", code: "step_up_invalid" }, 401);
  }
  if (parsed.userId !== dbUser.id) {
    return c.json({ error: "Step-up token does not match session", code: "step_up_mismatch" }, 401);
  }
  await next();
}