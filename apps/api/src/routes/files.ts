// @ts-nocheck

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { files, medicalRecords, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
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

  if (!file || !recordType || !title || !date || !patientId) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: "File too large (max 50MB)" }, 400);
  }

  // Ownership check: patients can only create for themselves
  if (userRole === "patient") {
    const ownershipPatientId = await getPatientIdFromUser(db, userId);
    if (ownershipPatientId !== patientId) {
      return c.json({ error: "Cannot create records for other patients" }, 403);
    }
  }

  // Create medical record
  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId,
      recordType: recordType as any,
      title,
      diagnosis,
      date,
    })
    .returning();

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

  const [fileRecord] = await db
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

export default filesRouter;
