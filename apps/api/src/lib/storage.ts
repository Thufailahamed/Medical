// @ts-nocheck
// Phase 1.4: R2 helpers. Consolidates the 5 inline `c.env.R2.put(...)`
// call sites that pre-existed in files.ts / medical-records.ts / ai.ts.
// Future calls should reach for `uploadBuffer(...)` instead of inlining.

/**
 * Sniff a coarse file-type bucket from a MIME string.
 * Returns one of: `pdf` | `image` | `dicom` | `audio` | `video` | `other`.
 * Mirrors the legacy inline branches in files.ts:53-58 / :177-181.
 */
export function sniffFileType(mime: string | null | undefined): string {
  if (!mime) return "other";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/dicom") return "dicom";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "other";
}

/**
 * Key for files uploaded via the user's own session (mobile upload).
 * Shape matches the legacy pattern in files.ts:62.
 */
export function r2KeyForUpload(userId: string, ext: string): string {
  return `medical/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

/**
 * Key for files uploaded by a doctor on behalf of a patient.
 * Shape matches the legacy pattern in files.ts:183.
 */
export function r2KeyForRecord(patientId: string, ext: string): string {
  return `medical/${patientId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

/**
 * Key for files ingested via email (Phase 1.4). Distinct namespace so
 * we can apply retention/cleanup policies independently of user uploads.
 */
export function r2KeyForEmail(patientId: string, ext: string): string {
  return `email-ingest/${patientId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
}

/**
 * Best-effort extension guess from a MIME type. Used when the inbound
 * email attachment has a generic filename like "image001".
 */
export function extFromMime(mime: string | null | undefined): string {
  if (!mime) return "bin";
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "application/dicom") return "dcm";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "bin";
}

/**
 * Upload a binary blob to R2 with optional content-type.
 * Caller is responsible for the key shape — use `r2KeyFor*` above.
 */
export async function uploadBuffer(
  bucket: R2Bucket,
  key: string,
  bytes: ArrayBuffer | Uint8Array,
  contentType?: string | null
): Promise<void> {
  // R2.put accepts both ArrayBuffer and Uint8Array; cast to the union that
  // matches the underlying binding shape.
  const payload = bytes as unknown as ArrayBuffer;
  await bucket.put(key, payload, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
}

/**
 * Fetch raw bytes from R2. Bounded by `maxBytes` — if the object is
 * larger, only the prefix is returned. Returns `null` on missing object
 * or transport failure.
 *
 * Used by Phase 2.1 classifier for cache-hash input. The classifier
 * itself uses `fetchR2Text` (text-only) for the model prompt.
 */
export async function fetchBuffer(
  bucket: R2Bucket,
  key: string,
  maxBytes: number = 2 * 1024 * 1024
): Promise<Uint8Array | null> {
  if (!bucket || !key) return null;
  try {
    const obj = await bucket.get(key);
    if (!obj) return null;
    const size = obj.size ?? 0;
    if (size <= maxBytes) {
      const ab = await obj.arrayBuffer();
      return new Uint8Array(ab);
    }
    const stream = obj.body as ReadableStream | null;
    if (!stream) return null;
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      if (value.byteLength <= remaining) {
        chunks.push(value);
        total += value.byteLength;
      } else {
        chunks.push(value.slice(0, remaining));
        total = maxBytes;
        break;
      }
    }
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}
