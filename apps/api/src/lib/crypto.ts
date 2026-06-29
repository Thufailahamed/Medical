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
 */
export async function generateToken(userId: string, secret: string): Promise<string> {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
  };
  return sign(payload, secret);
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
