// @ts-nocheck
//
// Tier 2 — Hospital PACS pull sync engine.
//
// Runs every 5 minutes via the existing `*/5 * * * *` cron slot. For
// each `hospital_pacs_integrations` row whose `enabled=true` AND whose
// `last_sync_at + sync_interval_minutes` has elapsed, fetches studies
// for each registered hospital patient via QIDO-RS and pulls each
// instance via WADO-RS into our R2 bucket. Pulled studies flow into the
// existing imaging surfaces without any frontend changes (they share
// the `document_dicom_metadata` upsert path used by manual uploads).
//
// Lock model: per-row lease via `lastSyncAttemptAt` + `status='running'`.
// Self-heals if a Worker crashes mid-pass (next tick after
// `2 × syncIntervalMinutes` will reclaim). Circuit breaker trips after
// 5 consecutive failures → 30-min cool-off via deferred `lastSyncAt`.
//
// `POST /hospital-admin/pacs/integrations/:id/sync-now` exposes the same
// core function with manual trigger + RBAC, so hospital admins can force
// an out-of-band pull when a patient shows up at the clinic.

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq } from "drizzle-orm";
import {
  documentDicomMetadata,
  files,
  hospitalPacsIntegrations,
  hospitalPacsSyncCursors,
  hospitalPatients,
  medicalRecords,
} from "@healthcare/db";
import { audit } from "../lib/audit";
import {
  decryptPacsCredential,
  type EncryptedPayloadRow,
} from "../lib/envelope-crypto";
import {
  PacsClient,
  PacsAuthError,
  PacsTransientError,
} from "../lib/pacs-client";
import { parseDicomHeader } from "../lib/dicom-parse";
import type { AppEnvironment } from "../types";

type SyncTotals = {
  patients: number;
  studies: number;
  instances: number;
  skipped: number;
  failures: number;
};

type SyncResult = SyncTotals & {
  durationMs: number;
};

const COOL_OFF_AFTER_FAILURES = 5;
const COOL_OFF_MULTIPLIER = 6; // cool-off = syncIntervalMinutes × this

/**
 * Sanitize an error message so we never leak credentials, fragment
 * tokens, or PII into the audit log / integration row.
 */
function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message || err.name;
    // Strip URLs to just the host (in case creds appeared in the path
    // — defensive, shouldn't happen but cheap).
    return msg.replace(
      /\/\/[^/\s:@]+:[^/@\s]+@/g,
      "//[redacted]@[redacted]"
    ).slice(0, 500);
  }
  return "unknown";
}

/**
 * Insert (or find) the medical_records bucket row that holds PACS
 * imports for a (patient, integration) pair. Idempotent — uses the
 * `notes='pacs:<integrationId>'` filter to find an existing row.
 */
async function ensurePacsRecord(
  db: any,
  patientId: string,
  integrationId: string,
  hospitalId: string | null
): Promise<string> {
  const tag = `pacs:${integrationId}`;
  const [existing] = await db
    .select({ id: medicalRecords.id })
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.patientId, patientId),
        eq(medicalRecords.notes, tag)
      )
    )
    .limit(1);
  if (existing?.id) return existing.id;

  const [created] = await db
    .insert(medicalRecords)
    .values({
      patientId,
      hospitalId: hospitalId ?? null,
      recordType: "imaging",
      title: "PACS: imported studies",
      date: new Date().toISOString().slice(0, 10),
      notes: tag,
      source: "pacs",
    })
    .returning({ id: medicalRecords.id });
  return created?.id ?? tag;
}

/**
 * Pull one study's instances from the PACS, upload to R2, register a
 * `files` row + upsert `documentDicomMetadata`. Idempotent on `(study,
 * sop)` — same R2 key on retry lands the same file id when a re-pull
 * races with a previous pass.
 */
async function pullStudy(
  env: { R2: R2Bucket; DB: D1Database },
  db: any,
  client: PacsClient,
  patientId: string,
  recordId: string,
  studyUid: string,
  studyDate: string | null
): Promise<{ instances: number; failures: number }> {
  const series = await client.listStudyInstances(studyUid);
  let instances = 0;
  let failures = 0;
  for (const seriesRow of series) {
    for (const sop of seriesRow.instances) {
      const sopUid = sop.sopInstanceUid;
      const r2Key = `medical/${patientId}/pacs/${encodeURIComponent(studyUid)}/${encodeURIComponent(sopUid)}.dcm`;
      try {
        // Skip if file already exists in DB (avoid double pull + R2 upload + duplicate files rows)
        const [existingFile] = await db
          .select({ id: files.id })
          .from(files)
          .where(eq(files.r2Key, r2Key))
          .limit(1);

        if (existingFile) {
          continue;
        }

        const buf = await client.fetchInstance(studyUid, sopUid);
        // Upload to R2 (overwrite if re-pull). 16 KB prefix parse for metadata.
        await env.R2.put(r2Key, buf, {
          httpMetadata: { contentType: "application/dicom" },
        });
        const placeholderId = (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${r2Key}-${Date.now()}`;
        const [fileRow] = await db
          .insert(files)
          .values({
            id: placeholderId,
            recordId,
            url: r2Key,
            r2Key,
            type: "dicom",
            fileName: `${sopUid}.dcm`,
            fileSize: buf.byteLength,
            mimeType: "application/dicom",
          })
          .onConflictDoNothing({ target: files.id })
          .returning({ id: files.id });
        const fileId = fileRow?.id ?? placeholderId;
        // Parse header from first 16 KB and upsert metadata.
        const head = buf.byteLength > 16 * 1024 ? buf.slice(0, 16 * 1024) : buf;
        const summary = parseDicomHeader(new Uint8Array(head));
        if (summary) {
          // Prefer live values from PACS over parsed-from-bytes where
          // the parser and the QIDO summary disagree — series/sop UID
          // come from the WADO URL, study UID from the cursor row.
          await db
            .insert(documentDicomMetadata)
            .values({
              fileId,
              studyInstanceUid: studyUid,
              seriesInstanceUid: summary.seriesInstanceUid,
              sopInstanceUid: sopUid,
              modality: summary.modality ?? seriesRow.modality,
              bodyPart: summary.bodyPart,
              studyDate: summary.studyDate ?? studyDate,
              manufacturer: summary.manufacturer,
              metadataJson: summary.metadataJson,
            })
            .onConflictDoUpdate({
              target: documentDicomMetadata.fileId,
              set: {
                studyInstanceUid: studyUid,
                seriesInstanceUid: summary.seriesInstanceUid,
                sopInstanceUid: sopUid,
                modality: summary.modality ?? seriesRow.modality,
                bodyPart: summary.bodyPart,
                studyDate: summary.studyDate ?? studyDate,
                manufacturer: summary.manufacturer,
                metadataJson: summary.metadataJson,
              },
            });
        }
        await audit(db, {
          action: "pacs_study_pulled",
          resource: "file",
          resourceId: fileId,
          userId: patientId,
          details: {
            studyInstanceUid: studyUid,
            sopInstanceUid: sopUid,
            studyDate,
          },
        });
        instances++;
      } catch (err) {
        // Auth errors abort the entire study; transient errors skip just
        // the instance and continue.
        if (err instanceof PacsAuthError) throw err;
        failures++;
      }
    }
  }
  return { instances, failures };
}

// (no placeholders left)

export const pacsSyncRouter = new Hono<AppEnvironment>();

// ─── Cron entry point ───────────────────────────────────────────
pacsSyncRouter.post("/__cron/pacs-sync", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev =
    c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  const provided = c.req.header("x-cron-secret");
  const cookieSecret = getCookie(c, "cron_secret");
  const ok =
    !cronSecret ||
    provided === cronSecret ||
    cookieSecret === cronSecret ||
    isDev;
  if (!ok) return c.json({ ok: false, error: "unauthorized" }, 401);

  const db = c.get("db");
  const allIntegrations = await db.select().from(hospitalPacsIntegrations);
  const now = Date.now();
  const due = allIntegrations.filter((row: any) => {
    if (!row.enabled) return false;

    // Active lease check: if running and within lease duration, skip
    if (row.lastSyncStatus === "running" && row.lastSyncAttemptAt) {
      const leaseElapsedMin =
        (now - new Date(row.lastSyncAttemptAt).getTime()) / 60_000;
      const leaseDurationMin = 2 * row.syncIntervalMinutes;
      if (leaseElapsedMin < leaseDurationMin) {
        return false;
      }
    }

    if (!row.lastSyncAt) return true;
    const elapsedMin =
      (now - new Date(row.lastSyncAt).getTime()) / 60_000;
    return elapsedMin >= row.syncIntervalMinutes;
  });

  const summary: SyncResult & { integrations: number } = {
    integrations: due.length,
    durationMs: 0,
    patients: 0,
    studies: 0,
    instances: 0,
    skipped: 0,
    failures: 0,
  };
  const t0 = now;
  for (const integ of due) {
    const result = await runSyncPass(c.env, db, integ, "cron");
    summary.patients += result.patients;
    summary.studies += result.studies;
    summary.instances += result.instances;
    summary.skipped += result.skipped;
    summary.failures += result.failures;
  }
  summary.durationMs = Date.now() - t0;
  return c.json({ ok: true, ...summary });
});

// ─── Manual hospital-admin trigger ──────────────────────────────
pacsSyncRouter.post(
  "/hospital-admin/pacs/integrations/:id/sync-now",
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const role = c.get("userRole");
    const activeHospitalId = c.get("activeHospitalId");
    if (role !== "hospital_admin" || !activeHospitalId) {
      return c.json({ error: "forbidden" }, 403);
    }
    const id = c.req.param("id");
    const [integ] = await db
      .select()
      .from(hospitalPacsIntegrations)
      .where(eq(hospitalPacsIntegrations.id, id))
      .limit(1);
    if (!integ) return c.json({ error: "not_found" }, 404);
    if (integ.hospitalId !== activeHospitalId) {
      return c.json({ error: "forbidden" }, 403);
    }

    // Active lease check: if running and within lease duration, skip manual sync
    if (integ.lastSyncStatus === "running" && integ.lastSyncAttemptAt) {
      const leaseElapsedMin =
        (Date.now() - new Date(integ.lastSyncAttemptAt).getTime()) / 60_000;
      const leaseDurationMin = 2 * integ.syncIntervalMinutes;
      if (leaseElapsedMin < leaseDurationMin) {
        return c.json({ error: "sync_already_running" }, 409);
      }
    }

    await audit(db, {
      actorUserId: userId,
      action: "pacs_sync_manual_triggered",
      resource: "hospital_pacs_integration",
      resourceId: id,
    });
    const result = await runSyncPass(c.env, db, integ, "manual");
    return c.json({ ok: true, ...result });
  }
);

/**
 * Sync one integration from start to finish. Lease-protected:
 *   1. Claim the row by setting status='running' if no other tick is
 *      still inside `2 × syncIntervalMinutes`.
 *   2. Pull the patient list, decrypt creds, fan out QIDO+WADO.
 *   3. On success: status='succeeded', lastSyncAt=now,
 *      consecutiveFailures=0. On failure: status='failed', counter++,
 *      optional cool-off by deferring lastSyncAt.
 */
async function runSyncPass(
  env: AppEnvironment,
  db: any,
  integ: any,
  trigger: "cron" | "manual"
): Promise<SyncResult> {
  const t0 = Date.now();
  await db
    .update(hospitalPacsIntegrations)
    .set({
      lastSyncStatus: "running",
      lastSyncAttemptAt: new Date().toISOString(),
    })
    .where(eq(hospitalPacsIntegrations.id, integ.id));
  await audit(db, {
    action: "pacs_sync_started",
    resource: "hospital_pacs_integration",
    resourceId: integ.id,
    details: { trigger },
  });

  const totals: SyncTotals = {
    patients: 0,
    studies: 0,
    instances: 0,
    skipped: 0,
    failures: 0,
  };

  try {
    // 1. Decrypt creds.
    const username = await decryptPacsCredential(
      env,
      integ.usernameEnc as EncryptedPayloadRow
    );
    const password = await decryptPacsCredential(
      env,
      integ.passwordEnc as EncryptedPayloadRow
    );

    // 2. Resolve hospital patients.
    const patientRows = await db
      .select({
        patientId: hospitalPatients.patientId,
        mrn: hospitalPatients.mrn,
      })
      .from(hospitalPatients)
      .where(
        and(
          eq(hospitalPatients.hospitalId, integ.hospitalId),
          eq(hospitalPatients.status, "registered")
        )
      );

    // 3. Build PACS client.
    const client = new PacsClient(integ.baseUrl, { username, password });

    // 4. For each patient, run QIDO → WADO → R2 + metadata upsert.
    for (const pr of patientRows) {
      totals.patients++;
      try {
        // Read per-patient cursor → fromDate.
        const [cursor] = await db
          .select()
          .from(hospitalPacsSyncCursors)
          .where(
            and(
              eq(hospitalPacsSyncCursors.integrationId, integ.id),
              eq(hospitalPacsSyncCursors.patientMrn, pr.mrn)
            )
          )
          .limit(1);
        const fromDate = cursor?.lastStudyDate ?? "19700101";
        const studies = await client.listStudies(pr.mrn, { fromDate });
        if (!studies.length) {
          totals.skipped++;
          continue;
        }
        // Ensure medical_records bucket row.
        const recordId = await ensurePacsRecord(
          db,
          pr.patientId,
          integ.id,
          integ.hospitalId
        );
        let maxStudyDate = cursor?.lastStudyDate ?? null;
        for (const study of studies) {
          try {
            const r = await pullStudy(
              env,
              db,
              client,
              pr.patientId,
              recordId,
              study.studyInstanceUid,
              study.studyDate
            );
            totals.instances += r.instances;
            totals.failures += r.failures;
            totals.studies++;
            // Advance cursor to max studyDate seen in this pass.
            if (study.studyDate) {
              if (!maxStudyDate || study.studyDate > maxStudyDate) {
                maxStudyDate = study.studyDate;
              }
            }
          } catch (studyErr) {
            if (studyErr instanceof PacsAuthError) throw studyErr;
            totals.failures++;
          }
        }
        // Upsert cursor.
        if (maxStudyDate) {
          if (cursor) {
            await db
              .update(hospitalPacsSyncCursors)
              .set({
                lastStudyDate: maxStudyDate,
                lastPulledAt: new Date().toISOString(),
              })
              .where(eq(hospitalPacsSyncCursors.id, cursor.id));
          } else {
            try {
              await db
                .insert(hospitalPacsSyncCursors)
                .values({
                  id: (crypto as any).randomUUID(),
                  integrationId: integ.id,
                  patientMrn: pr.mrn,
                  lastStudyDate: maxStudyDate,
                });
            } catch (err) {
              // Fallback update in case of insert conflict
              const [cursorRetry] = await db
                .select()
                .from(hospitalPacsSyncCursors)
                .where(
                  and(
                    eq(hospitalPacsSyncCursors.integrationId, integ.id),
                    eq(hospitalPacsSyncCursors.patientMrn, pr.mrn)
                  )
                )
                .limit(1);
              if (cursorRetry) {
                await db
                  .update(hospitalPacsSyncCursors)
                  .set({
                    lastStudyDate: maxStudyDate,
                    lastPulledAt: new Date().toISOString(),
                  })
                  .where(eq(hospitalPacsSyncCursors.id, cursorRetry.id));
              }
            }
          }
        }
      } catch (patientErr) {
        // Skip patient on auth/transient — keep going for the rest.
        totals.failures++;
      }
    }

    // 5. Mark succeeded + reset failure counter.
    await db
      .update(hospitalPacsIntegrations)
      .set({
        lastSyncStatus: "succeeded",
        lastSyncAt: new Date().toISOString(),
        lastSyncError: null,
        consecutiveFailures: 0,
      })
      .where(eq(hospitalPacsIntegrations.id, integ.id));
    await audit(db, {
      action: "pacs_sync_completed",
      resource: "hospital_pacs_integration",
      resourceId: integ.id,
      details: { ...totals, durationMs: Date.now() - t0 },
    });
  } catch (err) {
    const isAuth = err instanceof PacsAuthError;
    const nextFailures = (integ.consecutiveFailures ?? 0) + 1;
    const shouldCoolOff = nextFailures >= COOL_OFF_AFTER_FAILURES;
    const update: any = {
      lastSyncStatus: "failed",
      lastSyncError: sanitizeError(err),
      consecutiveFailures: nextFailures,
    };
    if (shouldCoolOff) {
      const coolOffMs =
        integ.syncIntervalMinutes * COOL_OFF_MULTIPLIER * 60_000;
      update.lastSyncAt = new Date(Date.now() + coolOffMs).toISOString();
    } else {
      update.lastSyncAt = new Date().toISOString();
    }
    await db
      .update(hospitalPacsIntegrations)
      .set(update)
      .where(eq(hospitalPacsIntegrations.id, integ.id));
    await audit(db, {
      action: "pacs_sync_failed",
      resource: "hospital_pacs_integration",
      resourceId: integ.id,
      details: {
        error: sanitizeError(err),
        consecutiveFailures: nextFailures,
        coolOffApplied: shouldCoolOff,
        isAuth,
      },
    });
  }

  return {
    ...totals,
    durationMs: Date.now() - t0,
  };
}
