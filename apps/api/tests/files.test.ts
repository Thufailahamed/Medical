// tests/files.test.ts
//
// Magic-byte detection: every supported upload format must be
// identified by its leading bytes. The same `sniffMagicType` is wired
// into the upload route to reject MIME spoofing, so a regression
// here is a security regression.
//
// Run alongside the existing files-presigned test to lock the upload
// contract.

import { describe, it, expect } from "vitest";

import { sniffMagicType } from "../src/routes/files";

function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

describe("sniffMagicType", () => {
  it("detects PDF by %PDF header", () => {
    expect(sniffMagicType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37))).toBe(
      "application/pdf"
    );
  });

  it("detects PNG by 89 50 4E 47 header", () => {
    expect(sniffMagicType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
  });

  it("detects JPEG by FF D8 FF marker + JFIF/Exif/CIELab tag", () => {
    expect(sniffMagicType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toBe("image/jpeg");
    expect(sniffMagicType(bytes(0xff, 0xd8, 0xff, 0xe1))).toBe("image/jpeg");
    expect(sniffMagicType(bytes(0xff, 0xd8, 0xff, 0xdb))).toBe("image/jpeg");
  });

  it("detects WebP via RIFF....WEBP", () => {
    const buf = new Uint8Array(12);
    buf.set(bytes(0x52, 0x49, 0x46, 0x46), 0);
    buf.set(bytes(0x57, 0x45, 0x42, 0x50), 8);
    expect(sniffMagicType(buf)).toBe("image/webp");
  });

  it("detects DICOM via DICM at offset 128", () => {
    const buf = new Uint8Array(132);
    buf[128] = 0x44;
    buf[129] = 0x49;
    buf[130] = 0x43;
    buf[131] = 0x4d;
    expect(sniffMagicType(buf)).toBe("application/dicom");
  });

  it("detects MP3 via ID3 tag or MPEG sync", () => {
    expect(sniffMagicType(bytes(0x49, 0x44, 0x33, 0x04, 0x00))).toBe("audio/mpeg");
    expect(sniffMagicType(bytes(0xff, 0xfb, 0x90, 0x00))).toBe("audio/mpeg");
  });

  it("detects WAV via RIFF....WAVE", () => {
    const buf = new Uint8Array(12);
    buf.set(bytes(0x52, 0x49, 0x46, 0x46), 0);
    buf.set(bytes(0x57, 0x41, 0x56, 0x45), 8);
    expect(sniffMagicType(buf)).toBe("audio/wav");
  });

  it("detects MP4 via ftyp box", () => {
    const buf = new Uint8Array(12);
    buf.set(bytes(0x00, 0x00, 0x00, 0x18), 0);
    buf.set(bytes(0x66, 0x74, 0x79, 0x70), 4);
    buf.set(bytes(0x69, 0x73, 0x6f, 0x6d), 8); // "isom"
    expect(sniffMagicType(buf)).toBe("video/mp4");
  });

  it("rejects a renamed .exe — not a supported format", () => {
    // MZ header (Windows PE)
    expect(sniffMagicType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
  });

  it("rejects random / corrupt bytes", () => {
    expect(sniffMagicType(bytes(0x00, 0x00, 0x00, 0x00, 0x00))).toBeNull();
    expect(sniffMagicType(new Uint8Array())).toBeNull();
  });

  it("treats a JPEG with unknown 4th byte as null (strict)", () => {
    // FF D8 FF C0 is technically a SOF0 marker but rare; we are
    // strict on the supported set to keep the contract testable.
    expect(sniffMagicType(bytes(0xff, 0xd8, 0xff, 0xc0))).toBeNull();
  });
});