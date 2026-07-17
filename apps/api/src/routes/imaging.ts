// @ts-nocheck
// Phase IMG-1: DICOM imaging study surface for the doctor / patient
// portal. Reuses the existing `files` + `document_dicom_metadata` tables
// (no schema changes — only the indexes added in migration 0061) and
// exposes:
//
//   GET  /imaging/studies?patientId=&modality=&from=&to=
//     → list of studies (one row per StudyInstanceUID) for the patient
//
//   GET  /imaging/studies/:studyUid
//     → study detail with series + instances + per-file viewer URLs
//
//   GET  /imaging/fhir/:studyUid
//     → single FHIR R4 ImagingStudy resource as application/fhir+json
//
//   GET  /imaging/presign?fileId=
//     → mints a 5-min single-use download token that the in-browser
//       Cornerstone3D viewer can wadouri:-load through the existing
//       /files/download/:token proxy.
//
// All endpoints route through canAccessPatient — the same RBAC used by
// /medical-records and /files. Audit rows are written for every read.

import { Hono } from "hono";
import { and, eq, sql, desc, inArray } from "drizzle-orm";
import {
  files,
  medicalRecords,
  patients,
  fileDownloadTokens,
  documentDicomMetadata,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { canAccessPatient } from "../lib/access";
import { audit } from "../lib/audit";
import { presignFileDownload } from "../lib/imaging-presign";
import type { AppEnvironment } from "../types";

const imagingRouter = new Hono<AppEnvironment>();

/**
 * List studies for a patient. Groups all DICOM instances sharing the same
 * StudyInstanceUID, joined with file count + earliest study date + dominant
 * modality (modalities[] if a study mixes e.g. CT + SR).
 */
imagingRouter.get("/studies", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = c.get("userRole") ?? "patient";

  const patientId = c.req.query("patientId");
  if (!patientId) return c.json({ error: "patientId_required" }, 400);

  const access = await canAccessPatient(db, userId, role, patientId);
  if (!access.allowed) return c.json({ error: "forbidden", reason: access.reason }, 403);

  const modality = c.req.query("modality");
  const from = c.req.query("from"); // ISO date
  const to = c.req.query("to");

  // Build the join: files (patient_id on medical_records) → document_dicom_metadata.
  const rows = await db
    .select({
      studyInstanceUid: documentDicomMetadata.studyInstanceUid,
      modalities: sql<string>`GROUP_CONCAT(DISTINCT ${documentDicomMetadata.modality})`,
      bodyParts: sql<string>`GROUP_CONCAT(DISTINCT ${documentDicomMetadata.bodyPart})`,
      earliestStudyDate: sql<string>`MIN(${documentDicomMetadata.studyDate})`,
      seriesCount: sql<number>`COUNT(DISTINCT ${documentDicomMetadata.seriesInstanceUid})`,
      instanceCount: sql<number>`COUNT(${documentDicomMetadata.fileId})`,
      earliestCreatedAt: sql<string>`MIN(${files.createdAt})`,
    })
    .from(documentDicomMetadata)
    .innerJoin(files, eq(files.id, documentDicomMetadata.fileId))
    .innerJoin(medicalRecords, eq(medicalRecords.id, files.recordId))
    .where(
      and(
        eq(medicalRecords.patientId, patientId),
        modality
          ? sql`${documentDicomMetadata.modality} = ${modality}`
          : sql`1=1`,
        from
          ? sql`${documentDicomMetadata.studyDate} >= ${from.replace(/-/g, "")}`
          : sql`1=1`,
        to
          ? sql`${documentDicomMetadata.studyDate} <= ${to.replace(/-/g, "")}`
          : sql`1=1`
      )
    )
    .groupBy(documentDicomMetadata.studyInstanceUid)
    .orderBy(sql`MIN(${documentDicomMetadata.studyDate}) DESC`);

  await audit(db, {
    userId,
    action: "imaging_studies_list",
    resource: "imaging_study",
    details: { patientId, count: rows.length, modality, from, to },
  });

  return c.json({
    studies: rows.map((r: any) => ({
      studyInstanceUid: r.studyInstanceUid,
      modalities: (r.modalities || "").split(",").filter(Boolean),
      bodyParts: (r.bodyParts || "").split(",").filter(Boolean),
      studyDate: r.earliestStudyDate,
      seriesCount: Number(r.seriesCount) || 0,
      instanceCount: Number(r.instanceCount) || 0,
      uploadedAt: r.earliestCreatedAt,
    })),
  });
});

/**
 * Study detail — returns every instance grouped under series, each with a
 * fresh presigned viewer URL. Token TTL is 5 min; Cornerstone3D fetches
 * bytes once per stack load and caches in-memory, so this is fine.
 */
imagingRouter.get("/studies/:studyUid", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = c.get("userRole") ?? "patient";
  const studyUid = c.req.param("studyUid");

  // Find the study by joining on metadata, then resolve the patient.
  const instances = await db
    .select({
      file: files,
      record: medicalRecords,
      meta: documentDicomMetadata,
    })
    .from(documentDicomMetadata)
    .innerJoin(files, eq(files.id, documentDicomMetadata.fileId))
    .innerJoin(medicalRecords, eq(medicalRecords.id, files.recordId))
    .where(eq(documentDicomMetadata.studyInstanceUid, studyUid));

  if (instances.length === 0) {
    return c.json({ error: "study_not_found" }, 404);
  }

  const patientId = instances[0].record.patientId;
  const access = await canAccessPatient(db, userId, role, patientId);
  if (!access.allowed) return c.json({ error: "forbidden", reason: access.reason }, 403);

  // Group by seriesInstanceUid.
  const seriesMap = new Map<string, any>();
  for (const inst of instances) {
    const sUid = inst.meta.seriesInstanceUid || "unknown";
    if (!seriesMap.has(sUid)) {
      seriesMap.set(sUid, {
        seriesInstanceUid: sUid,
        modality: inst.meta.modality,
        bodyPart: inst.meta.bodyPart,
        instances: [],
      });
    }
    seriesMap.get(sUid).instances.push({
      sopInstanceUid: inst.meta.sopInstanceUid,
      sopClassUid: inst.meta.sopClassUid,
      fileId: inst.file.id,
      fileName: inst.file.fileName,
      fileSize: inst.file.fileSize,
    });
  }

  // Mint presigned URLs for the viewer. We do NOT auto-consume them — the
  // viewer may fetch on each stack load; consumption is enforced at the
  // /files/download/:token endpoint itself.
  const seriesWithUrls: any[] = [];
  for (const s of seriesMap.values()) {
    const instancesWithUrls = [];
    for (const inst of s.instances) {
      const presigned = await presignFileDownload(
        c.env,
        db,
        userId,
        inst.fileId,
        role
      );
      if (presigned) {
        instancesWithUrls.push({
          ...inst,
          viewerUrl: presigned.url, // /files/download/<token>
        });
      }
    }
    seriesWithUrls.push({
      ...s,
      instances: instancesWithUrls,
    });
  }

  await audit(db, {
    userId,
    action: "imaging_study_view",
    resource: "imaging_study",
    resourceId: studyUid,
    details: { patientId, instanceCount: instances.length },
  });

  return c.json({
    studyInstanceUid: studyUid,
    patientId,
    series: seriesWithUrls,
  });
});

/**
 * Mint a single-use download token for a DICOM file. Thin wrapper around
 * the existing /files/presign logic — kept on its own path so the viewer
 * can hit /imaging/presign without having to know the generic file-id
 * presign flow.
 */
imagingRouter.get("/presign", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = c.get("userRole") ?? "patient";
  const fileId = c.req.query("fileId");
  if (!fileId) return c.json({ error: "fileId_required" }, 400);

  const result = await presignFileDownload(c.env, db, userId, fileId, role);
  if (!result) return c.json({ error: "forbidden" }, 403);

  await audit(db, {
    userId,
    action: "imaging_presign",
    resource: "file",
    resourceId: fileId,
    details: { purpose: "viewer" },
  });

  return c.json(result);
});

/**
 * FHIR R4 ImagingStudy resource for a single study. Content type is the
 * canonical `application/fhir+json` so external EHR consumers can detect
 * it without sniffing.
 */
imagingRouter.get("/fhir/:studyUid", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = c.get("userRole") ?? "patient";
  const studyUid = c.req.param("studyUid");

  const instances = await db
    .select({
      file: files,
      record: medicalRecords,
      meta: documentDicomMetadata,
    })
    .from(documentDicomMetadata)
    .innerJoin(files, eq(files.id, documentDicomMetadata.fileId))
    .innerJoin(medicalRecords, eq(medicalRecords.id, files.recordId))
    .where(eq(documentDicomMetadata.studyInstanceUid, studyUid));

  if (instances.length === 0) {
    return c.json({ error: "study_not_found" }, 404);
  }

  const patientId = instances[0].record.patientId;
  const access = await canAccessPatient(db, userId, role, patientId);
  if (!access.allowed) return c.json({ error: "forbidden", reason: access.reason }, 403);

  const first = instances[0];
  const seriesMap = new Map<string, any>();
  for (const inst of instances) {
    const sUid = inst.meta.seriesInstanceUid || "unknown";
    if (!seriesMap.has(sUid)) {
      seriesMap.set(sUid, {
        uid: sUid,
        modality: inst.meta.modality || "unknown",
        bodySite: inst.meta.bodyPart
          ? {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  display: inst.meta.bodyPart,
                },
              ],
            }
          : undefined,
        instance: [],
      });
    }
    seriesMap.get(sUid).instance.push({
      uid: inst.meta.sopInstanceUid || `unknown-${inst.file.id}`,
      sopClass: inst.meta.sopClassUid
        ? { system: "urn:ietf:rfc:3986", code: inst.meta.sopClassUid }
        : undefined,
    });
  }

  const allModalities = Array.from(
    new Set(
      instances
        .map((i: any) => i.meta.modality)
        .filter(Boolean) as string[]
    )
  );

  const resource = {
    resourceType: "ImagingStudy",
    id: studyUid,
    meta: {
      profile: [
        "http://hl7.org/fhir/StructureDefinition/ImagingStudy",
      ],
    },
    status: "available",
    subject: { reference: `Patient/${patientId}` },
    identifier: [
      {
        system: "urn:dicom:uid",
        value: studyUid,
      },
    ],
    started: first.meta.studyDate
      ? `${first.meta.studyDate.slice(0, 4)}-${first.meta.studyDate.slice(
          4,
          6
      )}-${first.meta.studyDate.slice(6, 8)}`
      : undefined,
    modality: allModalities.map((m) => ({
      system: "http://dicom.nema.org/resources/ontology/DCM",
      code: m,
    })),
    numberOfSeries: seriesMap.size,
    numberOfInstances: instances.length,
    series: Array.from(seriesMap.values()),
  };

  c.header("Content-Type", "application/fhir+json; charset=utf-8");
  return c.body(JSON.stringify(resource));
});

export default imagingRouter;
