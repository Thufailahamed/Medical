// tests/pii-cipher.test.ts
//
// P1 bundle 3 — PII field-level encryption.
//
// Asserts the round-trip and the prefix-detection helpers. The cipher
// is keyed by the active KEK; we feed `RECORD_KEK_PRIMARY` in via the
// `env` shim.

import { describe, it, expect } from "bun:test";
import { encryptPii, decryptPii, isPiiCipher } from "../src/lib/pii-cipher";

const ENV = {
  RECORD_KEK_PRIMARY: Buffer.alloc(32, 7).toString("base64"),
};

describe("pii-cipher", () => {
  it("round-trips an email", async () => {
    const ct = await encryptPii(ENV, "patient@example.com");
    expect(ct).toStartWith("pii:v1:kek-2026-01:");
    const pt = await decryptPii(ENV, ct);
    expect(pt).toBe("patient@example.com");
  });

  it("round-trips a phone with SL format", async () => {
    const ct = await encryptPii(ENV, "+94 77 123 4567");
    const pt = await decryptPii(ENV, ct);
    expect(pt).toBe("+94 77 123 4567");
  });

  it("round-trips an NIC", async () => {
    const ct = await encryptPii(ENV, "200012345678");
    const pt = await decryptPii(ENV, ct);
    expect(pt).toBe("200012345678");
  });

  it("returns null for nullish input", async () => {
    expect(await encryptPii(ENV, null)).toBeNull();
    expect(await encryptPii(ENV, undefined)).toBeNull();
    expect(await encryptPii(ENV, "")).toBeNull();
    expect(await encryptPii(ENV, "   ")).toBeNull(); // whitespace-only
  });

  it("decrypts legacy plaintext through (no prefix)", async () => {
    expect(await decryptPii(ENV, "old@plaintext.com")).toBe("old@plaintext.com");
    expect(await decryptPii(ENV, null)).toBeNull();
    expect(await decryptPii(ENV, undefined)).toBeNull();
  });

  it("rejects tampered ciphertext", async () => {
    const ct = await encryptPii(ENV, "patient@example.com");
    // Flip a single bit in the body. Format: pii:v1:<kek>:<iv>:<ct>:<tag>.
    // We swap one character of the ciphertext segment.
    const prefix = "pii:v1:kek-2026-01:";
    const rest = ct.slice(prefix.length);
    const iv = rest.slice(0, rest.indexOf(":"));
    const afterIv = rest.slice(iv.length + 1);
    const colon = afterIv.indexOf(":");
    const cipherSeg = afterIv.slice(0, colon);
    const tagSeg = afterIv.slice(colon + 1);
    // Mutate the first base64 char of the cipher segment.
    const swapped = cipherSeg[0] === "A" ? "B" : "A";
    const tampered = `${prefix}${iv}:${swapped}${cipherSeg.slice(1)}:${tagSeg}`;
    await expect(decryptPii(ENV, tampered)).rejects.toThrow(/tamper|wrong key/);
  });

  it("is idempotent — re-encrypting the same blob returns it unchanged", async () => {
    const first = await encryptPii(ENV, "dup@example.com");
    const second = await encryptPii(ENV, first);
    expect(second).toBe(first);
    expect(isPiiCipher(first)).toBe(true);
  });

  it("isPiiCipher matches the v1 prefix only", () => {
    expect(isPiiCipher("pii:v1:kek-2026-01:abc:def:ghi")).toBe(true);
    expect(isPiiCipher("plaintext@x.com")).toBe(false);
    expect(isPiiCipher("pii:v0:legacy")).toBe(false);
    expect(isPiiCipher(null)).toBe(false);
    expect(isPiiCipher(undefined)).toBe(false);
  });

  it("decrypts with a different KEK byte → tamper", async () => {
    const ct = await encryptPii(ENV, "x@y.com");
    const wrongEnv = { RECORD_KEK_PRIMARY: Buffer.alloc(32, 8).toString("base64") };
    await expect(decryptPii(wrongEnv, ct)).rejects.toThrow(/tamper|wrong key/);
  });

  it("uses fallback KEK id when primary is not configured", async () => {
    const onlyLegacy = { DOCTOR_KEY_KEK: Buffer.alloc(32, 9).toString("base64") };
    const ct = await encryptPii(onlyLegacy, "fallback@example.com");
    expect(ct).toStartWith("pii:v1:");
    // Wire id matches whatever the active KEK reports — both
    // `RECORD_KEK_PRIMARY` and `DOCTOR_KEY_KEK` map to `kek-2026-01` for
    // backwards compat with rows wrapped under either env var.
    expect(ct).toStartWith("pii:v1:kek-2026-01:");
    const pt = await decryptPii(onlyLegacy, ct);
    expect(pt).toBe("fallback@example.com");
  });

  it("rejects an envelope that has the wrong part count", async () => {
    await expect(decryptPii(ENV, "pii:v1:abc:def")).rejects.toThrow(/malformed/);
  });
});
