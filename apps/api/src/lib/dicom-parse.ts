// @ts-nocheck
// Worker-side DICOM header parser. Reads the leading ~8 KB of an upload,
// decodes the File Meta + the tags we surface into the patient vault, and
// returns a plain object ready for upsert into `document_dicom_metadata`.
//
// We deliberately do NOT try to render pixels here — pixel decoding is the
// browser viewer's job (Cornerstone3D runs in the portal). This parser is
// a thin wrapper around the `dicom-parser` library that already supports
// arbitrary-length implicit/explicit VR transfer syntaxes.
//
// Failure mode: any exception returns `null`. Callers must NEVER block an
// upload on DICOM parse failure — the file is still usable as a generic
// medical record; we just lose structured metadata.

import dicomParser from "dicom-parser";

export type DicomHeaderSummary = {
  studyInstanceUid: string | null;
  seriesInstanceUid: string | null;
  sopInstanceUid: string | null;
  sopClassUid: string | null;
  modality: string | null;
  bodyPart: string | null;
  studyDate: string | null; // YYYYMMDD per DICOM DA VR, not converted
  studyDescription: string | null;
  manufacturer: string | null;
  // Cap at 4 KB to keep D1 row size bounded. Stored as JSON string.
  metadataJson: string;
};

/**
 * Parse a DICOM byte buffer (typically the first 8-16 KB of an upload).
 * Returns null if the buffer is missing the DICM magic at offset 128 or
 * the parser rejects it.
 */
export function parseDicomHeader(buf: Uint8Array): DicomHeaderSummary | null {
  // Magic-byte guard. We can't trust the HTTP-declared MIME alone — the
  // sniffer in files.ts confirms it, but we re-check here so this helper
  // is safe to call from anywhere.
  if (buf.length < 132) return null;
  if (
    buf[128] !== 0x44 ||
    buf[129] !== 0x49 ||
    buf[130] !== 0x43 ||
    buf[131] !== 0x4d
  ) {
    return null;
  }

  let dataSet: any;
  try {
    dataSet = dicomParser.parseDicom(new Uint8Array(buf));
  } catch {
    return null;
  }

  const get = (tag: string): string | undefined => {
    try {
      const v = dataSet.string(tag);
      return typeof v === "string" && v.length > 0 ? v.trim() : undefined;
    } catch {
      return undefined;
    }
  };

  const studyInstanceUid = get("x0020000d") ?? null;
  // We only surface a study if we actually found a UID — without it the
  // row is useless for grouping instances under a study.
  if (!studyInstanceUid) return null;

  const summary: DicomHeaderSummary = {
    studyInstanceUid,
    seriesInstanceUid: get("x0020000e") ?? null,
    sopInstanceUid: get("x00080018") ?? null,
    sopClassUid: get("x00080016") ?? null,
    modality: get("x00080060") ?? null,
    bodyPart: get("x00180015") ?? null,
    studyDate: get("x00080020") ?? null,
    studyDescription: get("x00081030") ?? null,
    manufacturer: get("x00080070") ?? null,
    metadataJson: "{}",
  };

  // Collect the first 4 KB of the tag dict as JSON. We deliberately cap
  // it — DICOM can carry hundreds of tags and D1 has a hard row size.
  try {
    const elements = dataSet.elements ?? {};
    const cap: Record<string, unknown> = {};
    let bytes = 0;
    const LIMIT = 4096;
    for (const tag of Object.keys(elements)) {
      if (bytes >= LIMIT) break;
      const el = elements[tag];
      if (!el || el.length == null) continue;
      const len = Number(el.length) || 0;
      if (len > 256) continue; // skip binary blobs (pixel data etc.)
      cap[tag] = get(tag) ?? null;
      bytes += len + tag.length;
    }
    summary.metadataJson = JSON.stringify(cap);
  } catch {
    // Leave the default `{}` if JSON serialisation fails.
  }

  return summary;
}

/**
 * Pull a specific DICOM tag's text value out of an already-parsed dataset.
 * Convenience wrapper for FHIR export — avoids re-parsing the bytes.
 */
export function dicomString(dataSet: any, tag: string): string | undefined {
  try {
    const v = dataSet.string(tag);
    return typeof v === "string" && v.length > 0 ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}
