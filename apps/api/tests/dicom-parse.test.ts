// Pure unit tests for the DICOM header parser. No DB, no fixtures on
// disk — boundary conditions on the magic-byte guard + a minimal
// hand-crafted dataset (the only DICOM byte layout we can construct
// without an actual scanner dump).

import { describe, expect, it } from "vitest";
import { parseDicomHeader } from "../src/lib/dicom-parse";

function bufferWithMagic(extraBytes = 0): Uint8Array {
  const buf = new Uint8Array(132 + extraBytes);
  buf[128] = 0x44; // D
  buf[129] = 0x49; // I
  buf[130] = 0x43; // C
  buf[131] = 0x4d; // M
  return buf;
}

describe("parseDicomHeader", () => {
  it("returns null when buffer is shorter than 132 bytes", () => {
    expect(parseDicomHeader(new Uint8Array(100))).toBeNull();
    expect(parseDicomHeader(new Uint8Array(0))).toBeNull();
  });

  it("returns null when DICM magic is missing at offset 128", () => {
    const buf = new Uint8Array(256);
    buf[128] = 0x41; // wrong byte
    buf[129] = 0x42;
    buf[130] = 0x43;
    buf[131] = 0x44;
    expect(parseDicomHeader(buf)).toBeNull();
  });

  it("returns null when dicom-parser rejects an obviously truncated dataset", () => {
    // Magic is present but the rest of the buffer is zeros — the
    // library expects File Meta Information (group 0002) which won't
    // be present, so parseDicom should throw and we should return null.
    const buf = bufferWithMagic(16);
    expect(parseDicomHeader(buf)).toBeNull();
  });

  it("returns null when studyInstanceUid cannot be extracted", () => {
    // The header guard rejects any parse that didn't surface the
    // StudyInstanceUID — we treat that as an invalid file even if the
    // DICM magic parsed.
    const buf = bufferWithMagic(1024);
    expect(parseDicomHeader(buf)).toBeNull();
  });
});
