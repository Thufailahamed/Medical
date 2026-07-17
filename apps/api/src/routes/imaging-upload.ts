// @ts-nocheck
// Phase IMG-1: presigned R2 PUT for large DICOM instances. The default
// /files/upload path is capped at 50 MB (the existing MAX_SIZE constant)
// because Workers' request-body limit on the paid plan is 100 MB and
// some studies are multi-MR sequences >100 MB. This route bypasses the
// body cap by handing the browser a direct R2 PUT URL.
//
// Flow:
//   1. POST /imaging/presign-upload { patientId, recordId?, fileName }
//        → mints 5-min presigned R2 PUT URL + placeholder `files` row
//   2. Browser PUTs the .dcm bytes directly to the URL
//   3. POST /imaging/complete-upload { fileId }
//        → HEADs R2 for final size, re-fetches first 16 KB, parses DICOM
//          header, upserts `document_dicom_metadata`, audits
//
// We keep the placeholder file row open until step 3 fires so that
// /imaging/studies queries don't return half-uploaded studies.

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import {
  files,
  medicalRecords,
  documentDicomMetadata,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { canAccessPatient } from "../lib/access";
import { audit } from "../lib/audit";
import { parseDicomHeader } from "../lib/dicom-parse";
import type { AppEnvironment } from "../types";

const imagingUploadRouter = new Hono<AppEnvironment>();

imagingUploadRouter.post(
  "/presign-upload",
  authMiddleware,
  requireRole("doctor", "hospital_staff", "patient"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const role = c.get("userRole") ?? "patient";

    const body = await c.req.json().catch(() => ({}));
    const recordId = body.recordId ? String(body.recordId) : null;
    const fileName = String(body.fileName ?? "upload.dcm");

    if (!recordId) {
      return c.json(
        { error: "recordId_required" },
        400
      );
    }

    const [rec] = await db
      .select()
      .from(medicalRecords)
      .where(eq(medicalRecords.id, recordId))
      .limit(1);
    if (!rec) return c.json({ error: "record_not_found" }, 404);

    const access = await canAccessPatient(db, userId, role, rec.patientId);
    if (!access.allowed) {
      return c.json({ error: "forbidden", reason: access.reason }, 403);
    }

    const r2Key = `medical/${rec.patientId}/${Date.now()}-${crypto.randomUUID()}.dcm`;

    let presignedUrl: string;
    try {
      presignedUrl = await c.env.R2.createPresignedUrl(r2Key, {
        method: "PUT",
        expiresIn: 300,
        httpMetadata: { contentType: "application/dicom" },
      });
    } catch (err) {
      console.error("[imaging.presign-upload] R2 presign failed:", err);
      return c.json({ error: "presign_failed" }, 500);
    }

    // Placeholder row. fileSize null until complete-upload fires.
    const [placeholder] = await db
      .insert(files)
      .values({
        recordId,
        url: r2Key,
        r2Key,
        type: "dicom",
        fileName,
        fileSize: null,
        mimeType: "application/dicom",
      })
      .returning();

    await audit(db, {
      userId,
      action: "imaging_presign_upload",
      resource: "file",
      resourceId: placeholder?.id,
      details: { r2Key, recordId },
    });

    return c.json(
      {
        fileId: placeholder?.id,
        uploadUrl: presignedUrl,
        expiresIn: 300,
        completeUrl: "/imaging/complete-upload",
      },
      201
    );
  }
);

imagingUploadRouter.post(
  "/complete-upload",
  authMiddleware,
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const role = c.get("userRole") ?? "patient";

    const body = await c.req.json().catch(() => ({}));
    const fileId = String(body.fileId ?? "");
    if (!fileId) return c.json({ error: "fileId_required" }, 400);

    const [row] = await db
      .select({ file: files, record: medicalRecords })
      .from(files)
      .leftJoin(medicalRecords, eq(files.recordId, medicalRecords.id))
      .where(eq(files.id, fileId))
      .limit(1);
    if (!row?.file) return c.json({ error: "not_found" }, 404);
    if (!row.record) return c.json({ error: "record_missing" }, 400);

    const access = await canAccessPatient(db, userId, role, row.record.patientId);
    if (!access.allowed) {
      return c.json({ error: "forbidden", reason: access.reason }, 403);
    }

    const head = await c.env.R2.head(row.file.r2Key);
    const size = head?.size ?? null;

    let summary: ReturnType<typeof parseDicomHeader> = null;
    try {
      const obj = await c.env.R2.get(row.file.r2Key, {
        range: { offset: 0, length: 16 * 1024 },
      });
      if (obj) {
        const buf = new Uint8Array(await obj.arrayBuffer());
        summary = parseDicomHeader(buf);
      }
    } catch (err) {
      console.error("[imaging.complete-upload] R2 read failed:", err);
    }

    await db
      .update(files)
      .set({ fileSize: size })
      .where(eq(files.id, fileId));

    if (summary) {
      await db
        .insert(documentDicomMetadata)
        .values({
          fileId,
          studyInstanceUid: summary.studyInstanceUid,
          seriesInstanceUid: summary.seriesInstanceUid,
          sopInstanceUid: summary.sopInstanceUid,
          modality: summary.modality,
          bodyPart: summary.bodyPart,
          studyDate: summary.studyDate,
          manufacturer: summary.manufacturer,
          metadataJson: summary.metadataJson,
        })
        .onConflictDoUpdate({
          target: documentDicomMetadata.fileId,
          set: {
            studyInstanceUid: summary.studyInstanceUid,
            seriesInstanceUid: summary.seriesInstanceUid,
            sopInstanceUid: summary.sopInstanceUid,
            modality: summary.modality,
            bodyPart: summary.bodyPart,
            studyDate: summary.studyDate,
            manufacturer: summary.manufacturer,
            metadataJson: summary.metadataJson,
          },
        });
    }

    await audit(db, {
      userId,
      action: "imaging_upload_complete",
      resource: "file",
      resourceId: fileId,
      details: {
        size,
        studyUid: summary?.studyInstanceUid ?? null,
        modality: summary?.modality ?? null,
      },
    });

    return c.json({
      ok: true,
      fileId,
      size,
      studyInstanceUid: summary?.studyInstanceUid ?? null,
      modality: summary?.modality ?? null,
    });
  }
);

export default imagingUploadRouter;
