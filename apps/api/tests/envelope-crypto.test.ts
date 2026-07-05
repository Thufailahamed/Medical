// tests/envelope-crypto.test.ts
//
// Phase v3 envelope encryption: AES-256-GCM with per-record DEK wrapped
// by KEK. Uses Node WebCrypto; identical to Cloudflare Workers subtle.

import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import {
  encryptEnvelope,
  decryptEnvelope,
  wrapDek,
  unwrapDek,
  recordChainHash,
  hasEnvelope,
  sha256,
} from "../src/lib/envelope-crypto";

// Node test env lacks global crypto.subtle on some platforms.
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

const ENV = (() => {
  const bytes = new Uint8Array(32);
  webcrypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return { RECORD_KEK_PRIMARY: Buffer.from(s, "binary").toString("base64") };
})();

describe("envelope-crypto", () => {
  it("roundtrip encrypts + decrypts payload", async () => {
    const row = await encryptEnvelope(ENV, { hello: "world", n: 42 });
    expect(row.envelopeVersion).toBe("v1");
    expect(row.schemaVersion).toBe("healthhub.record.v3");
    expect(row.encryptedPayload).toBeTruthy();
    expect(row.authTag).toBeTruthy();
    const decrypted = await decryptEnvelope(ENV, row);
    expect(decrypted).toEqual({ hello: "world", n: 42 });
  });

  it("rejects payload above MAX_ENCRYPTED_PAYLOAD_BYTES", async () => {
    const big = { x: "a".repeat(6 * 1024 * 1024) };
    await expect(encryptEnvelope(ENV, big)).rejects.toThrow(/MAX_ENCRYPTED_PAYLOAD_BYTES/);
  });

  it("tamper detection: mutated ciphertext fails", async () => {
    const row = await encryptEnvelope(ENV, { v: 1 });
    const tampered = {
      ...row,
      encryptedPayload: Buffer.from(
        Buffer.from(row.encryptedPayload, "base64").map((b) => b ^ 0xff),
      ).toString("base64"),
    };
    await expect(decryptEnvelope(ENV, tampered)).rejects.toThrow(/decryption failed/);
  });

  it("DEK unwrap rejects bad KEK", async () => {
    const dek = new Uint8Array(32);
    webcrypto.getRandomValues(dek);
    const wrapped = await wrapDek(ENV, dek);
    const wrongEnv = (() => {
      const bytes = new Uint8Array(32);
      webcrypto.getRandomValues(bytes);
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return { RECORD_KEK_PRIMARY: Buffer.from(s, "binary").toString("base64") };
    })();
    await expect(unwrapDek(wrongEnv, wrapped)).rejects.toThrow();
  });

  it("chain hash is deterministic for same inputs", async () => {
    const args = {
      patientId: "p1",
      recordId: "r1",
      envelope: "abc",
      prevHash: null as string | null,
    };
    const a = await recordChainHash(args);
    const b = await recordChainHash(args);
    expect(a).toBe(b);
    const c = await recordChainHash({ ...args, prevHash: "h0" });
    expect(c).not.toBe(a);
  });

  it("sha256 base64 output", async () => {
    const h = await sha256("hello");
    // sha256("hello") base64 (RFC 4648)
    expect(h).toBe("LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=");
  });

  it("hasEnvelope flags rows correctly", () => {
    expect(
      hasEnvelope({
        encryptedPayload: "x",
        encryptedPayloadDekWrapped: "y",
        envelopeVersion: "v1",
      }),
    ).toBe(true);
    expect(hasEnvelope({})).toBe(false);
    expect(hasEnvelope({ encryptedPayload: "x", envelopeVersion: "v0" })).toBe(false);
  });
});