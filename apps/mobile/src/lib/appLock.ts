// Phase 2.4: app-level PIN crypto.
//
// Storage shape matches the API's NIC/OTP hashSecret:
//   "pbkdf2s:<iterations>:<saltHex>:<hashHex>"
//
// The PIN never leaves the device — no server round-trip. Storing the
// hash in SecureStore means the keychain (iOS) or EncryptedSharedPreferences
// (Android) wraps it under the platform's hardware-backed key. The hash
// itself is a defense-in-depth layer in case an attacker lifts the
// SecureStore blob (rooted device / iCloud backup edge cases).

const ITERATIONS = 50000;
const SALT_BYTES = 12;
const HASH_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function deriveBits(secret: string, salt: Uint8Array): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  // Slice the salt into a fresh ArrayBuffer-backed view so TypeScript's
  // strict BufferSource typing (Uint8Array<ArrayBufferLike>) doesn't reject
  // it: the algorithm needs ArrayBufferView<ArrayBuffer>, not the wider
  // ArrayBufferLike that includes SharedArrayBuffer.
  const saltBuf = new Uint8Array(salt.length);
  saltBuf.set(salt);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuf as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveBits(pin, salt);
  return `pbkdf2s:${ITERATIONS}:${toHex(salt)}:${toHex(bits)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith("pbkdf2s:")) return false;
  const parts = stored.split(":");
  if (parts.length !== 4) return false;
  const salt = fromHex(parts[2]);
  const expectedHex = parts[3];
  const bits = await deriveBits(pin, salt);
  const currentHex = toHex(bits);
  if (currentHex.length !== expectedHex.length) return false;
  // Constant-time compare.
  let diff = 0;
  for (let i = 0; i < currentHex.length; i++) {
    diff |= currentHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Validate a PIN string. 4-6 digits, all numeric, no repeating
 * "1111"-or-similar obviously-weak patterns (user-chosen but we warn
 * via UI; we don't reject — too aggressive for a personal device lock).
 */
export function isWellFormedPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
