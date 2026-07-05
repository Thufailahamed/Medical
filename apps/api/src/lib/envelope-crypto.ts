// @ts-nocheck
// ─── Phase v3: Field-level envelope encryption ───────────────────────
// AES-256-GCM with per-record DEK wrapped by KEK. Used by the unified
// `medical_records.encrypted_payload` column, QR ephemeral tokens, and
// DSAR export bundle. Same `crypto.subtle` primitives as
// `lib/signing.ts` — no extra dep.
//
// KEK sources (in priority order):
//   1. env.RECORD_KEK_PRIMARY (preferred, 32 bytes b64)
//   2. env.DOCTOR_KEY_KEK (legacy fallback for the same physical secret)
//
// Per-record DEK:
//   - Random 32 bytes generated once per record.
//   - Wrapped with the active KEK; stored as `encrypted_payload_dek_wrapped`.
//   - Stored alongside `iv`, `auth_tag`, `encrypted_payload`, `kek_id`.
//   - Plaintext payload is the canonicalised JSON of the record envelope.
//
// Tamper-evidence:
//   - Each row stores `prev_record_hash` linking to the previous row for
//     the same patient (insertion-order by `created_at`). The chain head
//     is the `rehashed_at` digest of the most recent row.

import {
  ENVELOPE_VERSION,
  RECORD_SCHEMA_VERSION,
  MAX_ENCRYPTED_PAYLOAD_BYTES,
  DEFAULT_KEK_ID,
} from "@healthcare/shared/records";

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

function stringFromBuf(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

// ─── KEK resolution ──────────────────────────────────────────────

interface KekRecord {
  id: string;
  key: Uint8Array;
}

function loadKeks(env: Record<string, unknown>): KekRecord[] {
  const out: KekRecord[] = [];
  const primary = (env as Record<string, string>).RECORD_KEK_PRIMARY;
  const legacy = (env as Record<string, string>).DOCTOR_KEY_KEK;
  if (primary) {
    try {
      const bytes = b64decode(primary);
      if (bytes.length === 32) out.push({ id: "kek-2026-01", key: bytes });
    } catch {
      /* ignore malformed */
    }
  }
  if (legacy) {
    try {
      const bytes = b64decode(legacy);
      if (bytes.length === 32 && !out.some((k) => k.id === DEFAULT_KEK_ID)) {
        out.push({ id: DEFAULT_KEK_ID, key: bytes });
      }
    } catch {
      /* ignore */
    }
  }
  if (!out.length) {
    throw new Error(
      "No KEK configured. Set RECORD_KEK_PRIMARY or DOCTOR_KEY_KEK as a 32-byte base64 secret."
    );
  }
  return out;
}

function getActiveKek(env: Record<string, unknown>): KekRecord {
  const keks = loadKeks(env);
  return keks[0];
}

function getKekById(env: Record<string, unknown>, id: string): KekRecord | null {
  const keks = loadKeks(env);
  return keks.find((k) => k.id === id) ?? null;
}

async function importKek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// ─── DEK lifecycle ───────────────────────────────────────────────

async function generateDek(): Promise<Uint8Array> {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr;
}

async function importDek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * Wrap a DEK with the active KEK. Result is base64(iv || ciphertext || tag).
 */
export async function wrapDek(env: Record<string, unknown>, dek: Uint8Array): Promise<string> {
  const kek = getActiveKek(env);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const k = await importKek(kek.key);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, k, dek);
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return b64encode(out);
}

export async function unwrapDek(env: Record<string, unknown>, wrapped: string): Promise<Uint8Array> {
  const bytes = b64decode(wrapped);
  if (bytes.length < 12 + 16) throw new Error("Wrapped DEK too short");
  const iv = bytes.slice(0, 12);
  const body = bytes.slice(12);
  // Try every loaded KEK until one decrypts cleanly (rotation support)
  const keks = loadKeks(env);
  for (const kek of keks) {
    try {
      const k = await importKek(kek.key);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, k, body);
      return new Uint8Array(pt);
    } catch {
      /* try next KEK */
    }
  }
  throw new Error("No KEK could unwrap this DEK");
}

// ─── Payload encryption / decryption ─────────────────────────────

export interface Envelope {
  version: typeof ENVELOPE_VERSION;
  schema: typeof RECORD_SCHEMA_VERSION;
  ciphertext: string; // base64
  iv: string;         // base64
  authTag: string;    // base64 (last 16 bytes of the GCM ciphertext, isolated for column clarity)
  kekId: string;
  dekWrapped: string;
  createdAt: string;
}

export interface EncryptedPayloadRow {
  encryptedPayload: string;        // base64 ciphertext (sans tag)
  encryptedPayloadKekId: string;
  encryptedPayloadDekWrapped: string;
  iv: string;
  authTag: string;
  envelopeVersion: string;
  schemaVersion: string;
}

/**
 * Encrypt a JSON payload using a freshly-generated per-record DEK.
 */
export async function encryptEnvelope(
  env: Record<string, unknown>,
  payload: unknown,
): Promise<EncryptedPayloadRow> {
  const json = JSON.stringify(payload);
  const jsonBytes = bufFromString(json);
  if (jsonBytes.byteLength > MAX_ENCRYPTED_PAYLOAD_BYTES) {
    throw new Error(
      `Payload exceeds MAX_ENCRYPTED_PAYLOAD_BYTES (${MAX_ENCRYPTED_PAYLOAD_BYTES} bytes).`
    );
  }
  const kek = getActiveKek(env);
  const dek = await generateDek();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const dekKey = await importDek(dek);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    dekKey,
    jsonBytes,
  );
  const ctBytes = new Uint8Array(ct);
  const ciphertext = ctBytes.slice(0, ctBytes.length - 16);
  const authTag = ctBytes.slice(ctBytes.length - 16);
  const dekWrapped = await wrapDek(env, dek);
  return {
    encryptedPayload: b64encode(ciphertext),
    encryptedPayloadKekId: kek.id,
    encryptedPayloadDekWrapped: dekWrapped,
    iv: b64encode(iv),
    authTag: b64encode(authTag),
    envelopeVersion: ENVELOPE_VERSION,
    schemaVersion: RECORD_SCHEMA_VERSION,
  };
}

/**
 * Decrypt a row that was produced by `encryptEnvelope`. Throws on
 * tamper / wrong key — caller is expected to log + audit.
 */
export async function decryptEnvelope<T = unknown>(
  env: Record<string, unknown>,
  row: Pick<EncryptedPayloadRow, "encryptedPayload" | "encryptedPayloadDekWrapped" | "iv" | "authTag"> & {
    kekId?: string;
  },
): Promise<T> {
  const dek = await unwrapDek(env, row.encryptedPayloadDekWrapped);
  const dekKey = await importDek(dek);
  const ciphertext = b64decode(row.encryptedPayload);
  const iv = b64decode(row.iv);
  const authTag = b64decode(row.authTag);
  // Reassemble GCM input: ciphertext || tag
  const buf = new Uint8Array(ciphertext.length + authTag.length);
  buf.set(ciphertext, 0);
  buf.set(authTag, ciphertext.length);
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, dekKey, buf);
  } catch (err) {
    throw new Error("Envelope decryption failed (tamper or wrong key)");
  }
  return JSON.parse(stringFromBuf(pt)) as T;
}

/**
 * Quick boolean check — used by search/scan to short-circuit rows
 * whose envelope has not been backfilled yet. Returns true if the row
 * looks envelope-shaped.
 */
export function hasEnvelope(row: {
  encryptedPayload?: string | null;
  encryptedPayloadDekWrapped?: string | null;
  envelopeVersion?: string | null;
}): boolean {
  return Boolean(
    row.encryptedPayload &&
      row.encryptedPayloadDekWrapped &&
      row.envelopeVersion === ENVELOPE_VERSION,
  );
}

// ─── Tamper-evidence hash chain ───────────────────────────────────

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bufFromString(s));
  return b64encode(new Uint8Array(buf));
}

/**
 * Compute the next hash for a record given the previous head.
 * Deterministic over the canonical record fields.
 */
export async function recordChainHash(args: {
  patientId: string;
  recordId: string;
  envelope?: string | null;
  prevHash: string | null;
}): Promise<string> {
  const canonical = JSON.stringify({
    p: args.patientId,
    r: args.recordId,
    e: args.envelope ?? "",
    h: args.prevHash ?? "",
  });
  return sha256(canonical);
}

// ─── KEK rotation ────────────────────────────────────────────────

/**
 * Re-wrap the DEK for a record under a new KEK. Idempotent if the
 * record is already under the requested KEK. Returns true if a rewrite
 * happened.
 */
export async function rewrapUnderKek(
  env: Record<string, unknown>,
  row: EncryptedPayloadRow,
  targetKekId: string,
): Promise<EncryptedPayloadRow> {
  if (row.encryptedPayloadKekId === targetKekId) return row;
  const target = getKekById(env, targetKekId);
  if (!target) throw new Error(`Unknown KEK id: ${targetKekId}`);
  const dek = await unwrapDek(env, row.encryptedPayloadDekWrapped);
  // Wrap under target — simulate by constructing a wrapped blob using target KEK
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const k = await importKek(target.key);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, k, dek);
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return {
    ...row,
    encryptedPayloadKekId: target.id,
    encryptedPayloadDekWrapped: b64encode(out),
  };
}