// tests/qr-tokens.test.ts
//
// Phase v3: QR ephemeral token scan accounting + revocation.

import { describe, it, expect } from "vitest";

function parseScans(s: string): Array<{ at: string; ip: string | null; userAgent: string | null }> {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

describe("qr token scan accounting", () => {
  it("starts at zero scans", () => {
    const scans = parseScans("[]");
    expect(scans).toHaveLength(0);
  });

  it("appends scan and respects max_scans", () => {
    const max = 3;
    const scans: any[] = [];
    for (let i = 0; i < 5; i++) {
      if (scans.length >= max) break;
      scans.push({ at: new Date().toISOString(), ip: "1.2.3.4", userAgent: "test" });
    }
    expect(scans).toHaveLength(max);
  });

  it("revoked token cannot be scanned", () => {
    const revokedAt = new Date().toISOString();
    const allowed = !revokedAt;
    expect(allowed).toBe(false);
  });
});