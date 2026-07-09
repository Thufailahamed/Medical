// @ts-nocheck
// Field-level PII encryption helpers.
//
// Encrypts small string columns (`users.email`, `users.phone`, `users.nic`)
// with AES-256-GCM keyed by the active KEK. Plaintext columns are retained
// (nullable) so existing rows that pre-date encryption can be lazily
// migrated as they are touched by a write path.
//
// Wire format: `pii:v1:<kekId>:<ivB64>:<ciphertextB64>:<tagB64>`
//   - `v1` is the envelope version; lets us reject plaintext that happens
//     to start with `pii:`.
//   - `ivB64` is 12 bytes of random IV per cell (no nonce reuse).
//   - `ciphertextB64` is the AES-GCM ciphertext (sans 16-byte tag).
//   - `tagB64` is the 16-byte GCM auth tag, separated out for column
//     clarity (mirrors `envelope-crypto.ts`).
//
// Falsy inputs encrypt to `null` (the column is nullable) — encrypting
// `""` to a wrapper would corrupt the cache hash (see
// `pii-cipher.test.ts`) and waste a row update.

import { DEFAULT_KEK_ID } from "@healthcare/shared/records";

const PREFIX = "pii:v1:";

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

function bufFromString(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer as ArrayBuffer;
}

// Same KEK loader as `envelope-crypto.ts` — duplicated (not imported) to
// avoid a cross-module dep from this small helper. Mirrors the wire ids
// so columns encrypted here decrypt cleanly via the same key bytes.
function loadKek(env: Record<string, unknown>): { id: string; key: Uint8Array } {
  const envKey =
    (env as Record<string, string>).RECORD_KEK_PRIMARY ||
    (env as Record<string, string>).DOCTOR_KEY_KEK;
  if (!envKey) {
    throw new Error(
      "No KEK configured for PII cipher. Set RECORD_KEK_PRIMARY or DOCTOR_KEY_KEK.",
    );
  }
  const raw = atob(envKey + "=".repeat((4 - (envKey.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (bytes.length !== 32) {
    throw new Error(`PII cipher: KEK must decode to 32 bytes (got ${bytes.length}).`);
  }
  const id = (env as Record<string, string>).RECORD_KEK_PRIMARY
    ? "kek-2026-01"
    : DEFAULT_KEK_ID;
  return { id, key: bytes };
}

async function importKek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * Returns true when the string looks like an encrypted PII blob.
 * Used to detect legacy plaintext rows that pre-date encryption so
 * callers can choose to read either column gracefully.
 */
export function isPiiCipher(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypt a single PII cell. Returns `null` for empty / nullish input
 * (so we never write `pii:v1:` blobs for empty values).
 */
export async function encryptPii(
  env: Record<string, unknown>,
  plaintext: string | null | undefined,
): Promise<string | null> {
  if (plaintext == null) return null;
  const trimmed = plaintext.trim();
  if (!trimmed) return null;
  // Idempotent — re-encrypting an already-encrypted blob returns it as-is.
  if (isPiiCipher(trimmed)) return trimmed;
  const kek = loadKek(env);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const k = await importKek(kek.key);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    k,
    bufFromString(trimmed),
  );
  const ctBytes = new Uint8Array(ct);
  const cipher = ctBytes.slice(0, ctBytes.length - 16);
  const tag = ctBytes.slice(ctBytes.length - 16);
  return `${PREFIX}${kek.id}:${b64encode(iv)}:${b64encode(cipher)}:${b64encode(tag)}`;
}

/**
 * Decrypt a single PII cell. Passes plaintext / nullish values through
 * unchanged so callers can switch a column transparently during the
 * migration window. Throws on tampered ciphertext.
 */
export async function decryptPii(
  env: Record<string, unknown>,
  value: string | null | undefined,
): Promise<string | null> {
  if (value == null || value === "") return value ?? null;
  if (!isPiiCipher(value)) {
    // Legacy plaintext — return as-is. Caller can backfill later.
    return value;
  }
  // pii:v1:<kekId>:<ivB64>:<cipherB64>:<tagB64>
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 4) {
    throw new Error("PII cipher: malformed envelope");
  }
  const [, ivB64, cipherB64, tagB64] = parts;
  const iv = b64decode(ivB64);
  const cipher = b64decode(cipherB64);
  const tag = b64decode(tagB64);
  const buf = new Uint8Array(cipher.length + tag.length);
  buf.set(cipher, 0);
  buf.set(tag, cipher.length);
  const kek = loadKek(env);
  const k = await importKek(kek.key);
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, k, buf);
  } catch {
    throw new Error("PII decryption failed (tamper or wrong key)");
  }
  return new TextDecoder().decode(pt);
}

/**
 * Convenience: encrypt each PII field on a flat object, preserving the
 * shape and dropping empty values to `null`. Used by the auth routes'
 * user create / update paths.
 */
export async function encryptPiiFields<T extends Record<string, unknown>>(
  env: Record<string, unknown>,
  fields: T,
  keys: (keyof T)[],
): Promise<T> {
  const out: Record<string, unknown> = { ...fields };
  for (const k of keys) {
    const v = out[k as string];
    if (typeof v === "string" || v == null) {
      out[k as string] = await encryptPii(env, v as string | null | undefined);
    }
  }
  return out as T;
}