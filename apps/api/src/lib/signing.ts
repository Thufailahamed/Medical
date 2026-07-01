// @ts-nocheck
// ─── E-Rx Phase 6: Doctor Signing (Web Crypto) ─────────────────
// Per-doctor RSA-2048 keypair, generated server-side on first sign
// attempt. Private key is AES-256-GCM encrypted at rest with the
// `DOCTOR_KEY_KEK` Workers Secret. Public key is plain SPKI PEM so
// `GET /verify/:id` can serve it without unwrapping.
//
// Web Crypto is available in Cloudflare Workers — no extra dep.
//
// Cipher format for the wrapped private key:
//   "v1:" + base64(iv) + ":" + base64(ciphertext || authTag)
// - iv: 12 random bytes (GCM default)
// - ciphertext: RSA-OAEP / PKCS#8 PEM plaintext bytes
// - tag: 16 bytes appended by SubtleCrypto.encrypt
//
// Public key format served to clients:
//   "-----BEGIN PUBLIC KEY-----\n<base64>\n-----END PUBLIC KEY-----"

const VERSION_PREFIX = "v1:";

// ─── helpers ───────────────────────────────────────────────────

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

function pemToBuf(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function bufToPem(buf: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buf);
  let b64 = "";
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  const base64 = btoa(b64);
  const lines = base64.match(/.{1,64}/g) || [base64];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function getKek(env: { DOCTOR_KEY_KEK?: string }): Uint8Array {
  const raw = env.DOCTOR_KEY_KEK;
  if (!raw) {
    throw new Error(
      "DOCTOR_KEY_KEK not configured. Set via `wrangler secret put DOCTOR_KEY_KEK` (32 random bytes, base64)."
    );
  }
  // Accept either base64 (preferred) or hex (legacy)
  let bytes: Uint8Array;
  try {
    bytes = b64decode(raw);
  } catch {
    throw new Error("DOCTOR_KEY_KEK must be base64-encoded (use `openssl rand -base64 32`).");
  }
  if (bytes.length !== 32) {
    throw new Error(
      `DOCTOR_KEY_KEK must decode to 32 bytes; got ${bytes.length}.`
    );
  }
  return bytes;
}

async function importKek(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

// ─── keypair lifecycle ────────────────────────────────────────

export type KeyPair = {
  keyId: string;
  publicKeyPem: string;
  privateKeyPemEnc: string;
};

/**
 * Generate a new RSA-2048 keypair and wrap the private key.
 * Returns SPKI PEM for the public key (stored plaintext) and the
 * wrapped PKCS#8 PEM (stored in `doctors.signing_private_key_enc`).
 */
export async function generateKeyPair(env: { DOCTOR_KEY_KEK?: string }): Promise<KeyPair> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )) as CryptoKeyPair;

  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const publicKeyPem = bufToPem(spki, "PUBLIC KEY");
  const privateKeyPem = bufToPem(pkcs8, "PRIVATE KEY");

  const privateKeyPemEnc = await encryptPrivateKey(privateKeyPem, env);
  const keyId = crypto.randomUUID();
  return { keyId, publicKeyPem, privateKeyPemEnc };
}

/**
 * Decrypt the stored wrapped private key and return the SPKI private
 * key handle ready for `crypto.subtle.sign`.
 */
export async function importPrivateKey(
  privateKeyPemEnc: string,
  env: { DOCTOR_KEY_KEK?: string }
): Promise<CryptoKey> {
  const pem = await decryptPrivateKey(privateKeyPemEnc, env);
  const buf = pemToBuf(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// ─── encryption envelope (AES-256-GCM) ─────────────────────────

/**
 * Encrypt a PEM string. Output format:
 *   "v1:<base64 iv>:<base64 ciphertext+tag>"
 *
 * IV is 12 random bytes (AES-GCM default). Tag is appended by
 * SubtleCrypto automatically and is included in the ciphertext blob.
 */
export async function encryptPrivateKey(
  pem: string,
  env: { DOCTOR_KEY_KEK?: string }
): Promise<string> {
  const kek = await importKek(getKek(env));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ptBytes = new TextEncoder().encode(pem);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    kek,
    ptBytes
  );
  return `${VERSION_PREFIX}${b64encode(iv)}:${b64encode(new Uint8Array(ct))}`;
}

export async function decryptPrivateKey(
  wrapped: string,
  env: { DOCTOR_KEY_KEK?: string }
): Promise<string> {
  if (!wrapped.startsWith(VERSION_PREFIX)) {
    throw new Error("Wrapped key is missing the `v1:` version prefix.");
  }
  const body = wrapped.slice(VERSION_PREFIX.length);
  const [ivB64, ctB64] = body.split(":");
  if (!ivB64 || !ctB64) {
    throw new Error("Wrapped key is malformed; expected `v1:<iv>:<ct>`.");
  }
  const kek = await importKek(getKek(env));
  const iv = b64decode(ivB64);
  const ct = b64decode(ctB64);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    kek,
    ct
  );
  return new TextDecoder().decode(pt);
}

// ─── payload + signing ─────────────────────────────────────────

/**
 * Build the canonical payload that gets hashed and signed. Sorted
 * keys + no whitespace so two equal payloads always hash the same.
 *
 * The shape is the prescription "as-prescribed" snapshot:
 *   - prescription fields (id, doctorId, patientId, hospitalId, diagnosis, notes, date)
 *   - medicines array, sorted by id, each with the columns we sign
 *
 * Fields intentionally omitted because they're derived:
 *   - status (always "signed" at this point — implied)
 *   - signatureId / signedAt / signedPayloadHash (set AFTER sign)
 *   - createdAt (immutable, redundant with date)
 */
export function buildCanonicalPayload(input: {
  id: string;
  doctorId: string;
  patientId: string;
  hospitalId: string | null;
  diagnosis: string | null;
  notes: string | null;
  date: string;
  medicines: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string | null;
    timing: string | null;
    startDate: string;
    endDate: string | null;
    masterMedicineId?: string | null;
  }>;
}): string {
  const sortedMeds = [...input.medicines]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((m) => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      timing: m.timing,
      startDate: m.startDate,
      endDate: m.endDate,
      masterMedicineId: m.masterMedicineId ?? null,
    }));
  const payload = {
    prescriptionId: input.id,
    doctorId: input.doctorId,
    patientId: input.patientId,
    hospitalId: input.hospitalId,
    diagnosis: input.diagnosis,
    notes: input.notes,
    date: input.date,
    medicines: sortedMeds,
  };
  return JSON.stringify(payload);
}

/**
 * SHA-256 hash of a payload, returned as hex (lowercase). Used as
 * the `payload_hash` column for fast comparison + audit log search.
 */
export async function hashPayload(payload: string): Promise<string> {
  const buf = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sign a canonical payload. Returns base64 string suitable for
 * `prescription_signatures.signature_b64`.
 */
export async function signPayload(
  payload: string,
  privateKey: CryptoKey
): Promise<string> {
  const buf = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    buf
  );
  return b64encode(new Uint8Array(sig));
}

/**
 * Verify a base64 signature against a payload using a public key PEM.
 * Returns true on match, false otherwise. Never throws on signature
 * mismatch (the caller decides whether to 401 or just return
 * `valid: false`).
 */
export async function verifySignature(
  payload: string,
  signatureB64: string,
  publicKeyPem: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      pemToBuf(publicKeyPem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const buf = new TextEncoder().encode(payload);
    const sig = b64decode(signatureB64);
    return await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      sig,
      buf
    );
  } catch {
    return false;
  }
}