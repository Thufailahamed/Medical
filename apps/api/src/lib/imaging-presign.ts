// @ts-nocheck
// Shared helper for minting a single-use download token that the
// in-browser Cornerstone3D viewer can wadouri:-load. Returns the URL the
// viewer should plug into its image loader.
//
// Extracted from routes/imaging.ts so the upload completion flow can
// reuse it without circular imports. Mirrors the logic in /files/presign
// but is tightened for the viewer-only use case (5-min TTL, no
// recipient, audit row is written by the caller).

import {
  files,
  medicalRecords,
  fileDownloadTokens,
} from "@healthcare/db";
import { eq } from "drizzle-orm";
import { canAccessRecord } from "./access";

export type PresignedDownload = {
  url: string; // /files/download/<token>
  token: string;
  expiresAt: string; // ISO
};

/**
 * Mint a fresh single-use download token for `fileId`. Returns null when
 * the file doesn't exist or the caller can't access it.
 */
export async function presignFileDownload(
  env: any,
  db: any,
  userId: string,
  fileId: string,
  role: string
): Promise<PresignedDownload | null> {
  const [row] = await db
    .select({ file: files, record: medicalRecords })
    .from(files)
    .leftJoin(medicalRecords, eq(files.recordId, medicalRecords.id))
    .where(eq(files.id, fileId))
    .limit(1);

  if (!row?.file) return null;

  if (row.record) {
    const access = await canAccessRecord(db, userId, role, row.record.id);
    if (!access.allowed) return null;
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
    recipientUserId: null,
    expiresAt,
  });

  return {
    token,
    expiresAt,
    url: `/files/download/${token}`,
  };
}
