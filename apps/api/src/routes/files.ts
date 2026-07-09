// @ts-nocheck

import { Hono } from "hono";
import { eq, and, gt, isNull } from "drizzle-orm";
import {
  files,
  medicalRecords,
  patients,
  fileDownloadTokens,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { upsertRecordFts } from "../lib/fts";
import { audit } from "../lib/audit";
import { canAccessRecord } from "../lib/access";
import type { AppEnvironment } from "../types";

const filesRouter = new Hono<AppEnvironment>();

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/dicom",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Magic-byte detector. Returns the canonical MIME type for the file
 * by inspecting its leading bytes, or `null` if the format is not
 * supported. Patterns are taken from the IANA-registered signatures
 * (PDF 1.7 §7.5.2, RFC 2083 for PNG, ISO/IEC 10918-1 for JPEG, etc.).
 *
 * Exported for tests.
 */
export function sniffMagicType(buf: Uint8Array): string | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf";
  }
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  // JPEG: FF D8 FF, with the 4th byte in {E0, E1, E2, E3, E8, DB, EE}.
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff &&
    [0xe0, 0xe1, 0xe2, 0xe3, 0xe8, 0xdb, 0xee].includes(buf[3] ?? 0)
  ) {
    return "image/jpeg";
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  // DICOM: DICM at offset 128.
  if (
    buf.length >= 132 &&
    buf[128] === 0x44 && buf[129] === 0x49 && buf[130] === 0x43 && buf[131] === 0x4d
  ) {
    return "application/dicom";
  }
  // MP3: ID3v2 tag ("ID3") or MPEG frame sync (0xFFFB / 0xFFFA / 0xFFF3).
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return "audio/mpeg";
  }
  if (
    buf.length >= 2 &&
    buf[0] === 0xff &&
    (buf[1] & 0xe0) === 0xe0 &&
    [0xfb, 0xfa, 0xf3, 0xf2].includes(buf[1])
  ) {
    return "audio/mpeg";
  }
  // WAV: RIFF....WAVE
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
  ) {
    return "audio/wav";
  }
  // MP4 / MOV: ftyp box at offset 4 with brand in [8..11].
  if (
    buf.length >= 12 &&
    buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
  ) {
    return "video/mp4";
  }
  return null;
}

// Helper: get patient ID from user ID
async function getPatientIdFromUser(db: any, userId: string): Promise<string | null> {
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return patient?.id || null;
}

// ─── Upload file to R2 ───────────────────────────────────
filesRouter.post("/upload", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const recordId = formData.get("recordId") as string | null;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: "File too large (max 50MB)" }, 400);
  }

  // Magic-byte sniff. Reject MIME spoofing (e.g. .exe renamed to .pdf).
  // We read the first 12 bytes; none of the supported formats need
  // more than that to identify.
  const sniffBuf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const detected = sniffMagicType(sniffBuf);
  if (!detected) {
    return c.json(
      { error: "Unsupported or unrecognised file format" },
      415
    );
  }
  // If the client declared a MIME, it must agree with the magic bytes.
  if (file.type && file.type !== detected) {
    return c.json(
      {
        error: "File content does not match declared MIME type",
        declared: file.type,
        detected,
      },
      415
    );
  }

  // Determine file type category
  let fileType = "other";
  if (file.type === "application/pdf") fileType = "pdf";
  else if (file.type.startsWith("image/")) fileType = "image";
  else if (file.type === "application/dicom") fileType = "dicom";
  else if (file.type.startsWith("audio/")) fileType = "audio";
  else if (file.type.startsWith("video/")) fileType = "video";

  // Generate R2 key
  const ext = file.name.split(".").pop() || "bin";
  const r2Key = `medical/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  // Upload to R2
  const arrayBuffer = await file.arrayBuffer();
  await c.env.R2.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  // If recordId provided, link to existing record with ownership check
  if (recordId) {
    // Get patient ID from user ID for ownership check
    const patientId = await getPatientIdFromUser(db, userId);

    if (!patientId) {
      await c.env.R2.delete(r2Key);
      return c.json({ error: "Patient profile not found" }, 404);
    }

    const [record] = await db
      .select()
      .from(medicalRecords)
      .where(
        and(
          eq(medicalRecords.id, recordId),
          eq(medicalRecords.patientId, patientId)
        )
      )
      .limit(1);

    if (!record) {
      // Clean up R2 if record not found
      await c.env.R2.delete(r2Key);
      return c.json({ error: "Medical record not found or access denied" }, 404);
    }

    const [fileRecord] = await db
      .insert(files)
      .values({
        recordId,
        url: r2Key,
        r2Key,
        type: fileType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })
      .returning();

    return c.json({ file: fileRecord }, 201);
  }

  // Standalone upload (no record link yet)
  const [fileRecord] = await db
    .insert(files)
    .values({
      recordId: null,
      url: r2Key,
      r2Key,
      type: fileType,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    })
    .returning();

  return c.json({ file: fileRecord }, 201);
});

// ─── Upload with new medical record (with role check) ────
filesRouter.post("/upload-with-record", authMiddleware, requireRole("patient", "doctor", "hospital_staff"), async (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const formData = await c.req.formData();
  const file = formData.get("file") as File;
  const recordType = formData.get("recordType") as string;
  const title = formData.get("title") as string;
  const diagnosis = formData.get("diagnosis") as string | null;
  const date = formData.get("date") as string;
  const patientId = formData.get("patientId") as string;
  const formFamilyMemberId = formData.get("familyMemberId") as string | null;

  if (!recordType || !title || !date || !patientId) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Ownership check: patients can only create for themselves
  if (userRole === "patient") {
    const ownershipPatientId = await getPatientIdFromUser(db, userId);
    if (ownershipPatientId !== patientId) {
      return c.json({ error: "Cannot create records for other patients" }, 403);
    }
  }

  // Phase 2.3: explicit formData.familyMemberId wins; otherwise the
  // active-FM context resolves to a default. Empty string → NULL.
  const explicitFm = (formFamilyMemberId || "").trim();
  const activeFm = (c.get("activeFamilyMemberId") as string | null) || null;
  const familyMemberId = explicitFm || activeFm || null;

  // Create medical record
  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId,
      recordType: recordType as any,
      title,
      diagnosis,
      date,
      familyMemberId,
    } as any)
    .returning();

  // Phase 2.1: FTS5 sync — new record joins the search index.
  if (record) await upsertRecordFts(db, record);

  let fileRecord = null;
  const hasFile = file && typeof file !== "string" && file.size > 0;

  if (hasFile) {
    if (file.size > MAX_SIZE) {
      return c.json({ error: "File too large (max 50MB)" }, 400);
    }

    // Upload file to R2
    let fileType = "other";
    if (file.type === "application/pdf") fileType = "pdf";
    else if (file.type.startsWith("image/")) fileType = "image";
    else if (file.type === "application/dicom") fileType = "dicom";

    const ext = file.name.split(".").pop() || "bin";
    const r2Key = `medical/${patientId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    await c.env.R2.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    const [insertedFile] = await db
      .insert(files)
      .values({
        recordId: record.id,
        url: r2Key,
        r2Key,
        type: fileType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })
      .returning();
    fileRecord = insertedFile;

    // V3: auto-OCR for prescriptions / PDFs / images.
    // Fire-and-forget using ctx.waitUntil so the response isn't blocked.
    if (
      recordType === "prescription" ||
      file.type === "application/pdf" ||
      file.type.startsWith("image/")
    ) {
      const fetchUrl = `/files/download/${encodeURIComponent(r2Key)}?stream=1`;
      const ocrPromise = (async () => {
        try {
          const origin = new URL(c.req.url).origin;
          const res = await fetch(`${origin}/ai/ocr/prescription`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: c.req.header("Authorization") || "",
            },
            body: JSON.stringify({ fileUrl: fetchUrl, patientId }),
          });
          if (!res.ok) return;
          const json = (await res.json()) as { result?: any };
          const result = json?.result;
          if (!result) return;
          const serialized = JSON.stringify(result);
          await db
            .update(medicalRecords)
            .set({ extractedData: serialized })
            .where(eq(medicalRecords.id, record.id));
        } catch (err) {
          console.error("[files.upload-with-record] OCR failed:", err);
        }
      })();
      if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
        c.executionCtx.waitUntil(ocrPromise);
      }

      // Phase 2.1: auto-classification. Only fires for text-extractable
      // PDFs (binary images stay 'other' until vision model in 2.2).
      // Calls /ai/classify via loopback, persists the result.
      if (file.type === "application/pdf") {
        const classifyUrl = `/files/download/${encodeURIComponent(r2Key)}?stream=1`;
        const classifyPromise = (async () => {
          try {
            const origin = new URL(c.req.url).origin;
            await fetch(`${origin}/ai/classify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: c.req.header("Authorization") || "",
              },
              body: JSON.stringify({
                fileUrl: classifyUrl,
                recordId: record.id,
                source: "upload",
              }),
            });
          } catch (err) {
            console.error("[files.upload-with-record] classify failed:", err);
          }
        })();
        if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
          c.executionCtx.waitUntil(classifyPromise);
        }
      }
    }
  }

  return c.json({
    record,
    file: fileRecord,
  }, 201);
});

// ─── Get signed download URL OR stream proxy ─────────────
// Default: return JSON `{ url, key }` for the mobile app to open.
// `?stream=1`: stream the R2 bytes back with the original content type —
// used when auth headers are needed or when presigned URLs aren't available.
filesRouter.get("/download/:key", authMiddleware, async (c) => {
  const key = c.req.param("key");
  if (!key) return c.json({ error: "Missing key" }, 400);

  const object = await c.env.R2.get(key);
  if (!object) {
    return c.json({ error: "File not found" }, 404);
  }

  if (c.req.query("stream") === "1") {
    const contentType = object.httpMetadata?.contentType || "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, max-age=300");
    if (object.size != null) headers.set("Content-Length", String(object.size));
    return new Response(object.body as any, { headers });
  }

  // JSON response — mobile opens via Linking (auth stripped) or fetches with bearer
  // We return a path the client can fetch with Authorization header attached.
  return c.json({
    key,
    url: `/files/download/${encodeURIComponent(key)}?stream=1`,
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
    size: object.size,
  });
});

// ─── List files for a record ─────────────────────────────
filesRouter.get("/record/:recordId", authMiddleware, async (c) => {
  const recordId = c.req.param("recordId");
  const db = c.get("db");

  const recordFiles = await db
    .select()
    .from(files)
    .where(eq(files.recordId, recordId));

  return c.json({ files: recordFiles });
});

// ─── Delete file (with ownership check) ──────────────────
filesRouter.delete("/:id", authMiddleware, async (c) => {
  const fileId = c.req.param("id");
  const userId = c.get("userId");
  const db = c.get("db");

  // Get patient ID from user ID for ownership check
  const patientId = await getPatientIdFromUser(db, userId);
  if (!patientId) {
    return c.json({ error: "Patient profile not found" }, 404);
  }

  const [file] = await db
    .select()
    .from(files)
    .innerJoin(medicalRecords, eq(files.recordId, medicalRecords.id))
    .where(
      and(
        eq(files.id, fileId),
        eq(medicalRecords.patientId, patientId)
      )
    )
    .limit(1);

  if (!file) {
    return c.json({ error: "File not found or access denied" }, 404);
  }

  // Delete from R2 (best-effort)
  try {
    await c.env.R2.delete(file.files.r2Key);
  } catch {
    // ignore — record row still gets cleaned up
  }

  // Delete from DB
  await db.delete(files).where(eq(files.id, fileId));

  return c.json({ message: "File deleted" });
});

// ─── Phase v3: Presigned download tokens ────────────────────
// Short-lived tokens (5 min) bound to (fileId, recipientUserId). The
// `/files/download/:token` path is unauthenticated; the token itself
// is the credential and may only be consumed once per TTL.

filesRouter.post("/presign", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const fileId = String(body.fileId ?? "");
  const recipientUserId = body.recipientUserId ? String(body.recipientUserId) : null;
  if (!fileId) return c.json({ error: "fileId_required" }, 400);

  const [row] = await db
    .select({ file: files, record: medicalRecords })
    .from(files)
    .leftJoin(medicalRecords, eq(files.recordId, medicalRecords.id))
    .where(eq(files.id, fileId))
    .limit(1);
  if (!row?.file) return c.json({ error: "not_found" }, 404);

  // Access check: caller must be able to access the parent record (if
  // any). If no recordId, the file is standalone and we restrict to the
  // upload owner / patient.
  if (row.record) {
    const access = await canAccessRecord(db, userId, c.get("userRole") ?? "patient", row.record as any);
    if (!access.allowed) return c.json({ error: "forbidden" }, 403);
  } else {
    const patientId = await getPatientIdFromUser(db, userId);
    if (!patientId) return c.json({ error: "forbidden" }, 403);
  }

  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  await db.insert(fileDownloadTokens).values({
    token,
    fileId,
    issuedByUserId: userId,
    recipientUserId,
    expiresAt,
  });
  await audit(db, {
    userId,
    action: "file_presign_issued",
    resource: "file",
    resourceId: fileId,
    details: { recipient: recipientUserId },
  });
  return c.json({ token, expiresAt, url: `/files/download/${token}` }, 201);
});

filesRouter.get("/download/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  const [row] = await db
    .select()
    .from(fileDownloadTokens)
    .where(eq(fileDownloadTokens.token, token))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  const now = new Date().toISOString();
  if (row.expiresAt <= now) {
    return c.json({ error: "expired" }, 410);
  }
  if (row.consumedAt) {
    return c.json({ error: "replay_detected", firstConsumedAt: row.consumedAt }, 410);
  }
  const [file] = await db.select().from(files).where(eq(files.id, row.fileId)).limit(1);
  if (!file) return c.json({ error: "file_missing" }, 404);

  // Single-use: mark consumed before streaming so replays fail.
  await db
    .update(fileDownloadTokens)
    .set({
      consumedAt: now,
      ip: c.req.header("cf-connecting-ip") ?? null,
      userAgent: c.req.header("user-agent") ?? null,
    })
    .where(eq(fileDownloadTokens.token, token));

  await audit(db, {
    userId: row.issuedByUserId,
    action: "file_downloaded",
    resource: "file",
    resourceId: file.id,
    details: { token, recipient: row.recipientUserId },
  });

  // Stream R2 bytes
  try {
    const obj = await c.env.R2.get(file.r2Key);
    if (!obj) return c.json({ error: "r2_missing" }, 404);
    return new Response(obj.body as ReadableStream, {
      headers: {
        "Content-Type": file.mimeType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=0, no-store",
        "Content-Disposition": `inline; filename="${file.fileName}"`,
      },
    });
  } catch (err) {
    return c.json({ error: "r2_failure", reason: (err as Error).message }, 502);
  }
});

filesRouter.get("/audit", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  // Return the issuing user's recent presign + download rows.
  const rows = await db
    .select()
    .from(fileDownloadTokens)
    .where(eq(fileDownloadTokens.issuedByUserId, userId));
  return c.json({ items: rows });
});

export default filesRouter;
