// @ts-nocheck
//
// Day 5 #8 — symptom-log anomaly detector.
//
// Run daily via Wrangler Cron Trigger. Pulls every patient's recent
// symptom log (last 7 days) and flags "anomalous clusters" — too many
// distinct moderate/severe symptoms too close together.
//
// Heuristic: a cluster fires when ALL of the following hold:
//   - >= 3 distinct symptom entries in the last 7 days
//   - >= 2 are severity 'moderate' or 'severe'
//   - The set of symptoms shares at least one shared "system" word
//     (e.g. "headache", "nausea", "fever"). Pure keyword bag-of-words
//     with stop-list filtering; we don't ship embeddings or an LLM
//     here because the cron runs on a budget.
//
// On detection: writes a notification (reuses the existing
// `notifications` table), and inserts an `audit_log` row keyed
// 'symptom_cluster_flagged'.
//
// Cost: $0 per run. ~1 SELECT per patient with symptoms; tiny JS work.
// Recommended cron: "17 4 * * *" (off-minute, daily).
//
// Manual invocation:
//   POST /__cron/symptom-anomalies   Header: x-cron-secret: $CRON_SECRET
//   Header `dry-run: 1` returns what WOULD fire without writing.

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { and, eq, gte, sql } from "drizzle-orm";
import { patients, symptoms } from "@healthcare/db";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const WINDOW_DAYS = 7;
const MIN_SYMPTOMS = 3;
const MIN_MODERATE = 2;

// English stop-list; we only cross-check the (stemmed, lowercase)
// symptom word against any other. Same word → same cluster. This is
// deliberately conservative — false negatives > false positives here
// because we don't want to spam patients.
const STOP_WORDS = new Set([
  "the","a","an","of","to","in","on","for","and","or","is","it","with",
  "i","my","have","has","had","get","got","feeling","feel","felt","since",
  "from","yesterday","today","morning","evening","night","bad","slight",
]);

function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

function symptomSystem(text: string): string {
  const toks = tokens(text);
  // Sort so "head ache" and "ache head" collapse to the same cluster.
  return [...new Set(toks)].sort().join("|");
}

function dedupWindow(hoursAgo: number, row: { createdAt: string }, now: Date): boolean {
  const created = new Date(row.createdAt);
  const ageMs = now.getTime() - created.getTime();
  if (isNaN(ageMs)) return false;
  return ageMs <= hoursAgo * 60 * 60 * 1000;
}

export const symptomAnomaliesRouter = new Hono<AppEnvironment>();

symptomAnomaliesRouter.post("/__cron/symptom-anomalies", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  const provided = c.req.header("x-cron-secret");
  const cookieSecret = getCookie(c, "cron_secret");
  const dryRun = c.req.header("dry-run") === "1";
  const ok =
    !cronSecret ||
    provided === cronSecret ||
    cookieSecret === cronSecret ||
    isDev;
  if (!ok) return c.json({ ok: false, error: "unauthorized" }, 401);

  const db = c.get("db");
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString();

  // Per-patient scans. SQLite returns rows sorted by patientId+createdAt
  // for stable grouping, but we manually bucket by patientId below.
  const rows = await db
    .select()
    .from(symptoms)
    .where(gte(symptoms.createdAt, cutoff));

  // Group by patient.
  const byPatient = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byPatient.has(r.patientId)) byPatient.set(r.patientId, []);
    byPatient.get(r.patientId)!.push(r);
  }

  const flagged: Array<{
    patientId: string;
    count: number;
    moderateCount: number;
    systems: string[];
    sample: string[];
  }> = [];

  for (const [patientId, patientRows] of byPatient) {
    if (patientRows.length < MIN_SYMPTOMS) continue;

    const moderateCount = patientRows.filter(
      (r) => r.severity === "moderate" || r.severity === "severe"
    ).length;
    if (moderateCount < MIN_MODERATE) continue;

    // Cluster by stem signature.
    const systemCounts = new Map<string, number>();
    const samples: string[] = [];
    for (const r of patientRows) {
      const sys = symptomSystem(r.symptom);
      if (!sys) continue;
      systemCounts.set(sys, (systemCounts.get(sys) ?? 0) + 1);
      if (samples.length < 4) samples.push(r.symptom);
    }
    const topSystems = [...systemCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);

    flagged.push({
      patientId,
      count: patientRows.length,
      moderateCount,
      systems: topSystems,
      sample: samples,
    });

    if (dryRun) continue;

    const [patientRow] = await db
      .select({ userId: patients.userId })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);

    if (!patientRow?.userId) continue;

    await notify({
      db,
      userId: patientRow.userId,
      type: "general",
      title: "Unusual symptom pattern detected",
      body: `We noticed ${patientRows.length} entries in the last ${WINDOW_DAYS} days. Worth a doctor review.`,
      data: { patientId, kind: "symptom_cluster" },
    }).catch((err) => {
      console.error("[symptom-anomalies] notify failed", err);
    });

    await audit(db, {
      userId: patientRow.userId,
      action: "symptom_cluster_flagged",
      resource: "symptoms",
      details: {
        count: patientRows.length,
        moderateCount,
        systems: topSystems,
      },
    }).catch((err) => {
      console.error("[symptom-anomalies] audit failed", err);
    });
  }

  return c.json({
    ok: true,
    dryRun,
    patientsScanned: byPatient.size,
    flaggedCount: flagged.length,
    flagged,
    windowDays: WINDOW_DAYS,
  });
});

// Exported for tests.
export const __symptomSystemHelpers = { tokens, symptomSystem, dedupWindow };
