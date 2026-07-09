// apps/api/src/lib/kms.ts
//
// Key-management abstraction. Today: pass-through to environment
// secrets. Tomorrow: swap in Cloudflare Workers Secrets Store, AWS
// KMS, Vault Transit, or GCP KMS — without touching the envelope
// crypto or any caller.
//
// Why this abstraction exists:
//   - P1 plan calls for a per-tenant DEK hierarchy. Today the KEK is
//     a single env secret; in production we'll want tenant-scoped
//     DEKs wrapped by a master KEK, with rotation.
//   - The envelope-crypto layer should depend on `loadKek()`, not on
//     `c.env.RECORD_KEK_PRIMARY` directly. That keeps the rotation
//     story confined to one file.
//
// Interface contract:
//   - `loadKek(env, kekId?)` returns a 32-byte Uint8Array.
//   - The function is async because a real KMS provider is async
//     (network round-trip); the env-shim version is sync internally
//     but the public signature stays `async` so callers don't change
//     when we swap providers.
//
// Multiple KEK IDs are supported so a rotation can wrap an old KEK
// alongside a new one. `unwrapDek` in envelope-crypto.ts walks the
// list; whichever KEK successfully decrypts the DEK wins.

export interface KmsProvider {
  /**
   * Load a KEK by its identifier. Returns the raw key bytes.
   * Throws `KmsError` if the KEK is missing or malformed.
   */
  loadKek(env: any, kekId: string): Promise<Uint8Array>;
  /**
   * List the KEK identifiers this provider is configured with.
   * Used for envelope rotation (try each until one decrypts).
   */
  listKekIds(env: any): Promise<string[]>;
}

export class KmsError extends Error {
  constructor(message: string, public readonly kekId?: string) {
    super(message);
    this.name = "KmsError";
  }
}

// ─── Env-shim provider (default today) ──────────────────────────
//
// Reads base64-encoded 32-byte keys from environment variables:
//   - RECORD_KEK_PRIMARY (preferred)
//   - DOCTOR_KEY_KEK (legacy, kept for backward compat during rotation)
//
// Both decode identically; the rotation logic in envelope-crypto.ts
// tries each in order. When we cut over to a real KMS, this file
// becomes one provider among many; the interface stays.

const ENV_KEYS: Record<string, string> = {
  RECORD_KEK_PRIMARY: "RECORD_KEK_PRIMARY",
  DOCTOR_KEY_KEK: "DOCTOR_KEY_KEK",
};

function decodeBase64Key(b64: string, kekId: string): Uint8Array {
  let buf: Uint8Array;
  try {
    buf = base64ToBytes(b64);
  } catch (err) {
    throw new KmsError(
      `KMS: KEK ${kekId} is not valid base64: ${(err as Error).message}`,
      kekId
    );
  }
  if (buf.length !== 32) {
    throw new KmsError(
      `KMS: KEK ${kekId} must decode to 32 bytes, got ${buf.length}`,
      kekId
    );
  }
  return buf;
}

// Tiny base64 decoder (URL-safe + standard). Workers don't expose
// Buffer; we use atob on the standard alphabet and handle the
// URL-safe alphabet explicitly.
function base64ToBytes(b64: string): Uint8Array {
  const std = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export const envKmsProvider: KmsProvider = {
  async loadKek(env, kekId) {
    const envKeyName = ENV_KEYS[kekId];
    if (!envKeyName) {
      throw new KmsError(
        `KMS: unknown KEK identifier ${kekId}. Known: ${Object.keys(ENV_KEYS).join(", ")}`,
        kekId
      );
    }
    const value = env?.[envKeyName];
    if (!value || typeof value !== "string") {
      throw new KmsError(
        `KMS: env.${envKeyName} is missing or empty`,
        kekId
      );
    }
    return decodeBase64Key(value, kekId);
  },

  async listKekIds(env) {
    const ids: string[] = [];
    for (const [id, envKeyName] of Object.entries(ENV_KEYS)) {
      if (env?.[envKeyName]) ids.push(id);
    }
    return ids;
  },
};

// ─── Default singleton used by envelope-crypto ─────────────────

/**
 * Load a KEK using the default provider. Pass-through to env today;
 * replace `defaultProvider` with `cloudflareSecretsProvider` etc.
 * when we add them.
 */
export async function loadKek(env: any, kekId = "RECORD_KEK_PRIMARY"): Promise<Uint8Array> {
  return defaultProvider.loadKek(env, kekId);
}

/**
 * List configured KEKs. Used by envelope-crypto.ts to attempt
 * decryption with each KEK during rotation.
 */
export async function listKekIds(env: any): Promise<string[]> {
  return defaultProvider.listKekIds(env);
}

// Pluggable in tests: swap `defaultProvider` to a fake that returns
// deterministic keys without reading env.
let defaultProvider: KmsProvider = envKmsProvider;
export function setKmsProvider(provider: KmsProvider) {
  defaultProvider = provider;
}
export function getKmsProvider(): KmsProvider {
  return defaultProvider;
}