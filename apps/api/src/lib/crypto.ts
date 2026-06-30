import { sign, verify } from "hono/jwt";

/**
 * Hashes a password using PBKDF2 with SHA-256.
 * Returns format: pbkdf2:iterations:saltHex:hashHex
 */
export async function hashPassword(password: string): Promise<string> {
  const iterations = 100000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    baseKey,
    256 // 32 bytes
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith("pbkdf2:")) {
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 4) {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const hashHex = parts[3];

  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    baseKey,
    256
  );

  const currentHashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return currentHashHex === hashHex;
}

/**
 * Helper to generate a JWT token for a user.
 *
 * Optional `claims` are merged into the payload — used by the NIC identity
 * layer to surface plain NIC + DOB on the session so the mobile app can
 * scope data to a verified subject without a server round-trip per
 * request.
 */
export async function generateToken(
  userId: string,
  secret: string,
  claims: Record<string, unknown> = {},
): Promise<string> {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    ...claims,
  };
  return sign(payload as any, secret);
}

/**
 * Helper to verify a JWT token.
 */
export async function verifyToken(token: string, secret: string): Promise<any> {
  try {
    return await verify(token, secret, "HS256");
  } catch {
    return null;
  }
}

// ─── Phase 1.2: hashing for second-factor secrets ──────────
// Used for NIC + OTP code storage at rest. Same PBKDF2 schema as
// `hashPassword` so the audit/rotation story stays uniform.

const SECRET_ITERATIONS = 50000; // lower than password since OTPs are short-lived
const SECRET_SALT_BYTES = 12;

/** Hash a secret (NIC, OTP code) with PBKDF2. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SECRET_SALT_BYTES));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: SECRET_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    256,
  );
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `pbkdf2s:${SECRET_ITERATIONS}:${saltHex}:${hashHex}`;
}

/** Verify a secret against a previously stored hash. */
export async function verifySecret(
  secret: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith("pbkdf2s:")) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const hashHex = parts[3];

  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
  );
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    256,
  );
  const current = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return current === hashHex;
}

/** Generate a 6-digit numeric OTP code. */
export function generateOtpCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

/** Mask an email or phone for display: "thi****@gm**.com" / "+94****4567". */
export function maskTarget(target: string): string {
  if (target.includes("@")) {
    const [local, domain] = target.split("@");
    const localMasked =
      local.length <= 2 ? local[0] + "*" : local.slice(0, 3) + "****";
    const dotIdx = domain.lastIndexOf(".");
    const tld = dotIdx >= 0 ? domain.slice(dotIdx) : "";
    const d = dotIdx >= 0 ? domain.slice(0, dotIdx) : domain;
    const domainMasked =
      d.length <= 2 ? d[0] + "*" + tld : d.slice(0, 2) + "**" + tld;
    return `${localMasked}@${domainMasked}`;
  }
  if (target.length <= 6) return "****";
  return target.slice(0, 3) + "****" + target.slice(-2);
}
