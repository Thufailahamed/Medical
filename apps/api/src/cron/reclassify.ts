// @ts-nocheck
// Phase 2.1: nightly re-classification sweep.
// Scans medical_records WHERE recordType='other' AND created_at > now-30d.
// For each: fetch the first attachment from R2, run classify(), persist
// with the cron threshold (default 0.7 — stricter than the live threshold
// so we don't churn low-confidence flips on old records).
//
// Manual invocation:
//   POST /__cron/reclassify
//   Header: x-cron-secret: $CRON_SECRET
// Bypassed in dev mode or when CRON_SECRET is unset.

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { eq, and, gt, sql, inArray } from "drizzle-orm";
import { medicalRecords, files } from "@healthcare/db";
import { createDb } from "../lib/db";
import { classify, persistClassification } from "../lib/classifier";
import type { AppEnvironment } from "../types";

export const reclassifyRouter = new Hono<AppEnvironment>();

reclassifyRouter.post("/__cron/reclassify", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";

  const provided = c.req.header("x-cron-secret");
  const cookieSecret = getCookie(c, "cron_secret");
  const ok =
    !cronSecret ||
    provided === cronSecret ||
    cookieSecret === cronSecret ||
    isDev;
  if (!ok) return c.json({ ok: false, error: "unauthorized" }, 401);

  const db = createDb(c.env.DB);
  const threshold = parseFloat(
    c.env.CLASSIFY_CRON_THRESHOLD || c.env.CLASSIFY_THRESHOLD || "0.7"
  );
  const lookbackDays = 30;
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // 1. Find candidate records: recordType='other', created in the last 30d.
  const candidates = await db
    .select({
      id: medicalRecords.id,
      title: medicalRecords.title,
      patientId: medicalRecords.patientId,
      source: medicalRecords.source,
    })
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.recordType, "other"),
        gt(medicalRecords.createdAt, cutoff)
      )
    )
    .limit(500); // Cap per run so we don't blow CPU/time budgets.

  if (candidates.length === 0) {
    return c.json({ ok: true, scanned: 0, reclassified: 0, skipped: 0, errors: 0 });
  }

  // 2. Pull the first attachment per candidate (the one that matters for classification).
  const ids = candidates.map((r: any) => r.id);
  const attachments = await db
    .select({
      recordId: files.recordId,
      r2Key: files.r2Key,
    })
    .from(files)
    .where(inArray(files.recordId, ids));
  const attByRecord = new Map<string, string>();
  for (const a of attachments) {
    if (a.recordId && a.r2Key && !attByRecord.has(a.recordId)) {
      attByRecord.set(a.recordId, a.r2Key);
    }
  }

  const env = { AI: c.env.AI, R2: c.env.R2, DB: db };
  let reclassified = 0;
  let skipped = 0;
  let errors = 0;

  for (const rec of candidates) {
    const r2Key = attByRecord.get(rec.id);
    if (!r2Key) {
      skipped++;
      continue;
    }
    try {
      const result = await classify(env, {
        fileUrl: r2Key,
        recordId: rec.id,
        source: "cron",
        threshold,
      });
      const persisted = await persistClassification(db, rec.id, result, threshold);
      if (persisted && persisted.recordType !== "other") {
        reclassified++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error("[reclassify] failed", rec.id, err);
    }
  }

  return c.json({
    ok: true,
    scanned: candidates.length,
    reclassified,
    skipped,
    errors,
    threshold,
    lookbackDays,
  });
});

reclassifyRouter.get("/__cron/reclassify/preview", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  const provided = c.req.header("x-cron-secret");
  const ok = !cronSecret || provided === cronSecret || isDev;
  if (!ok) return c.json({ ok: false, error: "unauthorized" }, 401);

  const db = createDb(c.env.DB);
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows = await db
    .select({
      id: medicalRecords.id,
      title: medicalRecords.title,
      source: medicalRecords.source,
      createdAt: medicalRecords.createdAt,
    })
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.recordType, "other"),
        gt(medicalRecords.createdAt, cutoff)
      )
    )
    .limit(50);

  return c.json({ count: rows.length, sample: rows });
});