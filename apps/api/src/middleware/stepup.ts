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
import { resolveJwtSecret } from "../lib/jwt-secret";

const STEPUP_TTL_SECONDS = 5 * 60;

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/**
 * Returns the HMAC key used to sign step-up tokens. Throws when the
 * deploy is misconfigured in production (no JWT_SECRET) so the caller
 * can surface a 503 instead of silently issuing tokens under a public
 * default key. See lib/jwt-secret.ts for the rule.
 */
function requireSecret(c: Context<AppEnvironment>): string {
  const r = resolveJwtSecret(c.env);
  if (!r.ok) {
    throw new JwtSecretMissingError(r.reason);
  }
  return r.secret;
}

class JwtSecretMissingError extends Error {
  constructor(public readonly reason: string) {
    super(`JWT_SECRET missing in production (${reason})`);
    this.name = "JwtSecretMissingError";
  }
}

export function issueStepUpToken(c: Context<AppEnvironment>, userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + STEPUP_TTL_SECONDS;
  const payload = JSON.stringify({ userId, exp });
  const mac = createHmac("sha256", requireSecret(c)).update(payload).digest();
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
  let expected: Buffer;
  try {
    expected = createHmac("sha256", requireSecret(c)).update(payloadBuf).digest();
  } catch (err) {
    if (err instanceof JwtSecretMissingError) {
      // Bubble up the typed error so requirePasskeyFresh can map it
      // to a 503. Returning null here would silently accept invalid
      // tokens, which is exactly the bug we're trying to prevent.
      throw err;
    }
    throw err;
  }
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
  let parsed: ReturnType<typeof verifyStepUpToken>;
  try {
    parsed = verifyStepUpToken(c, token);
  } catch (err) {
    if (err instanceof JwtSecretMissingError) {
      return c.json(
        {
          error: "Server misconfigured: JWT_SECRET is required in production.",
          reason: err.reason,
        },
        503,
      );
    }
    throw err;
  }
  if (!parsed) {
    return c.json({ error: "Step-up token invalid or expired", code: "step_up_invalid" }, 401);
  }
  if (parsed.userId !== dbUser.id) {
    return c.json({ error: "Step-up token does not match session", code: "step_up_mismatch" }, 401);
  }
  await next();
}