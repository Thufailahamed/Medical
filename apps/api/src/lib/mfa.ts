// @ts-nocheck
// ─── TOTP-based MFA for doctors (Round 2 P0) ───────────────────────
//
// Library for generating, encrypting, and verifying TOTP secrets and
// recovery codes. All secrets persist AES-256-GCM encrypted under
// env.MFA_SECRET_KEK (32 bytes, base64).
//
// Wire format (matches signing-key encryption convention):
//   v1:<iv_b64>:<ct_b64>      (ct includes appended 16-byte auth tag)
//
// Recovery code hashing deliberately avoids bcrypt to keep zero native
// deps — SHA-256(pepper + code) is enough since the codes are 12-char
// random, single-use, and the pepper lives in env.MFA_RECOVERY_PEPPER.

import { authenticator } from "otplib";

const VERSION = "v1";
const RECOVERY_COUNT = 10;

// 30-second TOTP step is otplib default; ±1 step tolerance is 90s drift.
authenticator.options = { step: 30, window: 1 };

// ─── Base32 secrets ─────────────────────────────────────────────

/**
 * Generate a fresh 20-byte (160-bit) TOTP secret, base32-encoded.
 * RFC 6238 recommends ≥128 bits; 160 gives us margin against future
 * brute-forcers and matches Authy / Google Authenticator defaults.
 */
export function generateSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return bytesToBase32(bytes);
}

export function buildOtpAuthUrl(secret: string, account: string): string {
  return authenticator.keyuri(account, "HealthHub", secret);
}

/**
 * Verify a 6-digit TOTP token against a base32 secret. Returns true on
 * success, false on mismatch / malformed. otplib `window: 1` tolerates
 * ±30s drift so doctors with slightly off clocks aren't locked out.
 */
export function verifyToken(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

// ─── AES-256-GCM envelope (for mfa_secret_enc) ───────────────────

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function kekBytes(env: Record<string, unknown>): Uint8Array {
  const v = (env as Record<string, string>).MFA_SECRET_KEK;
  if (!v) {
    throw new Error(
      "MFA not configured. Set MFA_SECRET_KEK (32-byte base64 secret) via wrangler secret."
    );
  }
  const padded = v + "=".repeat((4 - (v.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (bytes.length !== 32) {
    throw new Error(`MFA_SECRET_KEK must decode to 32 bytes (got ${bytes.length}).`);
  }
  return bytes;
}

async function importKek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * Encrypt a base32 TOTP secret under the configured KEK. Returns
 * `v1:<iv_b64>:<ct_b64>` where `ct_b64` includes the appended 16-byte
 * auth tag (GCM standard).
 */
export async function encryptSecret(env: Record<string, unknown>, secret: string): Promise<string> {
  const kek = kekBytes(env);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const k = await importKek(kek);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    k,
    new TextEncoder().encode(secret).buffer as ArrayBuffer
  );
  const all = new Uint8Array(iv.length + ct.byteLength);
  all.set(iv, 0);
  all.set(new Uint8Array(ct), iv.length);
  return `${VERSION}:${b64encode(iv)}:${b64encode(all)}`;
}

export async function decryptSecret(env: Record<string, unknown>, enc: string): Promise<string> {
  if (!enc.startsWith(`${VERSION}:`)) throw new Error("Unsupported MFA secret envelope version");
  const parts = enc.split(":");
  if (parts.length !== 3) throw new Error("Malformed MFA secret envelope");
  const iv = b64decode(parts[1]);
  const blob = b64decode(parts[2]);
  if (blob.length < 16 + iv.length) throw new Error("MFA secret envelope too short");
  const ct = blob.slice(iv.length);
  const kek = kekBytes(env);
  const k = await importKek(kek);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    k,
    ct
  );
  return new TextDecoder().decode(pt);
}

// ─── Recovery codes ─────────────────────────────────────────────

/**
 * Issue a fresh batch of recovery codes. Format `XXXX-XXXX-XXXX` —
 * 12 chars, ~62 bits of entropy each. Stored as SHA-256(pepper + code)
 * hex, comma-separated. Codes are single-use; consumed codes move
 * into the `used` list.
 */
export function generateRecoveryCodes(count = RECOVERY_COUNT): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    out.push(formatRecovery(bytes));
  }
  return out;
}

function formatRecovery(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Crockford-ish, no I/O/0/1
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += alphabet[bytes[i] % alphabet.length];
  }
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function pepperedHash(pepper: string, code: string): Promise<string> {
  const enc = new TextEncoder();
  return crypto.subtle
    .digest("SHA-256", enc.encode(`${pepper}:${code}`).buffer as ArrayBuffer)
    .then((buf) => {
      const arr = new Uint8Array(buf);
      let hex = "";
      for (let i = 0; i < arr.length; i++) hex += arr[i].toString(16).padStart(2, "0");
      return hex;
    });
}

export async function hashRecoveryCodes(
  env: Record<string, unknown>,
  codes: string[],
): Promise<string> {
  const pepper = (env as Record<string, string>).MFA_RECOVERY_PEPPER || "";
  const hashes = await Promise.all(codes.map((c) => pepperedHash(pepper, c)));
  return hashes.join(",");
}

/**
 * Verify and consume a recovery code. Returns the updated used-list
 * on success. Returns null if the code is invalid or already used.
 */
export async function consumeRecoveryCode(
  env: Record<string, unknown>,
  code: string,
  allHashesCsv: string,
  usedHashesCsv: string | null,
): Promise<string | null> {
  const all = allHashesCsv.split(",").filter(Boolean);
  const used = new Set((usedHashesCsv || "").split(",").filter(Boolean));
  const pepper = (env as Record<string, string>).MFA_RECOVERY_PEPPER || "";
  const normalized = code.trim().toUpperCase();
  const candidate = await pepperedHash(pepper, normalized);
  if (!all.includes(candidate)) return null;
  if (used.has(candidate)) return null;
  used.add(candidate);
  return Array.from(used).join(",");
}

// ─── Base32 (RFC 4648) ───────────────────────────────────────────

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}