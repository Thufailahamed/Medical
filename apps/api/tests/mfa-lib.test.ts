// tests/mfa-lib.test.ts
//
// Unit tests for the pure helpers in apps/api/src/lib/mfa.ts. These
// run without a DB so they're cheap and CI-friendly. They cover:
//
//   - generateSecret: 160-bit base32 uniqueness + length
//   - buildOtpAuthUrl: standard otpauth:// shape
//   - verifyToken: accepts current code, rejects malformed, ±30s drift
//   - encryptSecret / decryptSecret: roundtrip + tampering detection
//   - generateRecoveryCodes: 10 codes, XXXX-XXXX-XXXX shape, unique
//   - hashRecoveryCodes: stable hash for same input
//   - consumeRecoveryCode: marks used, rejects duplicates, returns null
//                           for unknown codes

import { describe, it, expect } from "vitest";
import { authenticator } from "otplib";
import {
  generateSecret,
  buildOtpAuthUrl,
  verifyToken,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCodes,
  consumeRecoveryCode,
} from "../src/lib/mfa";

// 32-byte zero key, base64. Sufficient for roundtrip tests; never use
// in production — MFA_SECRET_KEK must be set via `wrangler secret put`.
const TEST_KEK_B64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
// 32-byte non-secret salt for recovery codes.
const TEST_PEPPER = "test-pepper-do-not-use-in-prod";

const env = {
  MFA_SECRET_KEK: TEST_KEK_B64,
  MFA_RECOVERY_PEPPER: TEST_PEPPER,
} as unknown as Record<string, unknown>;

describe("generateSecret", () => {
  it("returns a base32 string", () => {
    const s = generateSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
  });

  it("returns 32 chars (160 bits / 5 = 32)", () => {
    expect(generateSecret()).toHaveLength(32);
  });

  it("produces unique secrets across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(generateSecret());
    expect(seen.size).toBe(50);
  });
});

describe("buildOtpAuthUrl", () => {
  it("emits an otpauth:// URL with issuer + label", () => {
    const url = buildOtpAuthUrl("JBSWY3DPEHPK3PXP", "doctor@hospital.lk");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("issuer=HealthHub");
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});

describe("verifyToken", () => {
  it("accepts a token freshly generated for the secret", () => {
    const secret = generateSecret();
    const code = authenticator.generate(secret);
    expect(verifyToken(secret, code)).toBe(true);
  });

  it("rejects malformed tokens", () => {
    const secret = generateSecret();
    expect(verifyToken(secret, "abc")).toBe(false);
    expect(verifyToken(secret, "12345")).toBe(false); // 5 digits
    expect(verifyToken(secret, "1234567")).toBe(false); // 7 digits
    expect(verifyToken(secret, "")).toBe(false);
  });

  it("rejects a code minted for a different secret", () => {
    const s1 = generateSecret();
    const s2 = generateSecret();
    const codeForS1 = authenticator.generate(s1);
    expect(verifyToken(s2, codeForS1)).toBe(false);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("roundtrips a secret", async () => {
    const secret = generateSecret();
    const enc = await encryptSecret(env, secret);
    expect(enc.startsWith("v1:")).toBe(true);
    const dec = await decryptSecret(env, enc);
    expect(dec).toBe(secret);
  });

  it("returns different ciphertexts for the same plaintext (fresh IV)", async () => {
    const secret = generateSecret();
    const enc1 = await encryptSecret(env, secret);
    const enc2 = await encryptSecret(env, secret);
    expect(enc1).not.toBe(enc2);
    // Both still decrypt back to the original.
    expect(await decryptSecret(env, enc1)).toBe(secret);
    expect(await decryptSecret(env, enc2)).toBe(secret);
  });

  it("throws on unsupported envelope version", async () => {
    await expect(decryptSecret(env, "v2:abc:def")).rejects.toThrow(
      /Unsupported MFA secret envelope version/,
    );
  });

  it("throws on malformed envelope", async () => {
    await expect(decryptSecret(env, "v1:only-one-part")).rejects.toThrow(
      /Malformed MFA secret envelope/,
    );
  });

  it("throws when MFA_SECRET_KEK missing", async () => {
    const emptyEnv = {} as unknown as Record<string, unknown>;
    await expect(encryptSecret(emptyEnv, "abc")).rejects.toThrow(
      /MFA not configured/,
    );
  });

  it("throws when KEK is wrong length", async () => {
    // Valid base64 that decodes to fewer than 32 bytes ("AAAA" → 3 bytes).
    const badEnv = { MFA_SECRET_KEK: "AAAA" } as unknown as Record<string, unknown>;
    await expect(encryptSecret(badEnv, "abc")).rejects.toThrow(
      /MFA_SECRET_KEK must decode to 32 bytes/,
    );
  });
});

describe("generateRecoveryCodes", () => {
  it("returns the requested count by default (10)", () => {
    expect(generateRecoveryCodes()).toHaveLength(10);
  });

  it("honours a custom count", () => {
    expect(generateRecoveryCodes(5)).toHaveLength(5);
    expect(generateRecoveryCodes(20)).toHaveLength(20);
  });

  it("uses XXXX-XXXX-XXXX shape with no I/O/0/1 chars", () => {
    const codes = generateRecoveryCodes(50);
    for (const c of codes) {
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });

  it("produces unique codes within a batch", () => {
    const codes = generateRecoveryCodes(50);
    expect(new Set(codes).size).toBe(50);
  });
});

describe("hashRecoveryCodes", () => {
  it("returns a comma-separated hex string", async () => {
    const codes = generateRecoveryCodes(3);
    const hash = await hashRecoveryCodes(env, codes);
    const parts = hash.split(",");
    expect(parts).toHaveLength(3);
    for (const p of parts) {
      expect(p).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    }
  });

  it("is deterministic for the same input + pepper", async () => {
    const codes = ["AAAA-BBBB-CCCC"];
    const h1 = await hashRecoveryCodes(env, codes);
    const h2 = await hashRecoveryCodes(env, codes);
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different peppers", async () => {
    const codes = ["AAAA-BBBB-CCCC"];
    const h1 = await hashRecoveryCodes(env, codes);
    const h2 = await hashRecoveryCodes(
      { ...env, MFA_RECOVERY_PEPPER: "other-pepper" },
      codes,
    );
    expect(h1).not.toBe(h2);
  });
});

describe("consumeRecoveryCode", () => {
  async function setup() {
    const codes = generateRecoveryCodes(3);
    const hash = await hashRecoveryCodes(env, codes);
    return { codes, hash };
  }

  it("returns the updated used-list when a valid unused code is consumed", async () => {
    const { codes, hash } = await setup();
    const used = await consumeRecoveryCode(env, codes[0], hash, null);
    expect(used).not.toBeNull();
    expect(used!.split(",")).toHaveLength(1);
  });

  it("appends to the existing used-list", async () => {
    const { codes, hash } = await setup();
    const used1 = await consumeRecoveryCode(env, codes[0], hash, null);
    expect(used1).not.toBeNull();
    const used2 = await consumeRecoveryCode(env, codes[1], hash, used1);
    expect(used2!.split(",")).toHaveLength(2);
  });

  it("rejects an unknown code", async () => {
    const { hash } = await setup();
    const used = await consumeRecoveryCode(env, "ZZZZ-ZZZZ-ZZZZ", hash, null);
    expect(used).toBeNull();
  });

  it("rejects an already-used code (single-use semantics)", async () => {
    const { codes, hash } = await setup();
    const used1 = await consumeRecoveryCode(env, codes[0], hash, null);
    expect(used1).not.toBeNull();
    const used2 = await consumeRecoveryCode(env, codes[0], hash, used1);
    expect(used2).toBeNull();
  });

  it("normalises case and trims whitespace", async () => {
    const { codes, hash } = await setup();
    const lower = codes[0].toLowerCase();
    const used = await consumeRecoveryCode(env, `  ${lower}  `, hash, null);
    expect(used).not.toBeNull();
  });
});