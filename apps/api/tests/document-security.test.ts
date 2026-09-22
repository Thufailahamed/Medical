// tests/document-security.test.ts
// Guards the medical-document hardening:
// - MIME alias normalization (image/jpg -> image/jpeg)
// - safe filename sanitization (path traversal, weird extensions)
// - DICOM sniff still requires offset-128 bytes

import { describe, it, expect } from "vitest";
import {
  sniffMagicType,
  normalizeDeclaredMime,
  safeFileName,
} from "../src/routes/files";

describe("document upload hardening", () => {
  it("normalizes image/jpg alias to image/jpeg", () => {
    expect(normalizeDeclaredMime("image/jpg")).toBe("image/jpeg");
    expect(normalizeDeclaredMime("image/JPG")).toBe("image/jpeg");
    expect(normalizeDeclaredMime("application/pdf")).toBe("application/pdf");
    expect(normalizeDeclaredMime(null)).toBe("");
  });

  it("sanitizes path traversal filenames", () => {
    const { base, ext } = safeFileName("../../etc/passwd.pdf", "application/pdf");
    expect(base).not.toContain("/");
    expect(base).not.toContain("..");
    expect(ext).toBe("pdf");
  });

  it("falls back to MIME-derived extension for disallowed ext", () => {
    const { ext } = safeFileName("scan.exe", "application/pdf");
    expect(ext).toBe("pdf");
  });

  it("keeps allowed dicom extension", () => {
    const { ext } = safeFileName("study.dcm", "application/dicom");
    expect(ext).toBe("dcm");
  });

  it("sniff detects DICOM only with 132-byte header", () => {
    const short = new Uint8Array(12);
    expect(sniffMagicType(short)).toBeNull();
    const full = new Uint8Array(132);
    full[128] = 0x44;
    full[129] = 0x49;
    full[130] = 0x43;
    full[131] = 0x4d;
    expect(sniffMagicType(full)).toBe("application/dicom");
  });

  it("sniff rejects exe renamed to pdf", () => {
    expect(sniffMagicType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });
});
