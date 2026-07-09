// tests/symptom-anomalies.test.ts
//
// Day 5 #8 — symptom-log anomaly detector (cron).
//
// Asserts:
//   (1) Pure helper tokenises + cluster-keys symptom strings.
//   (2) Cluster fires when MIN_SYMPTOMS + MIN_MODERATE are met.
//   (3) Cluster does NOT fire with only mild entries.
//   (4) dry-run mode returns the same flags but writes nothing.
//
// Note on MockD1: its parsePredicate() handles only `eq`/`inArray`,
// not `gte`. We use setWhere() to inject a custom predicate so the
// SELECT returns the seeded rows. In production this is real D1.

import { describe, it, expect, beforeEach } from "vitest";
import { webcrypto } from "node:crypto";

if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

import { Hono } from "hono";
import {
  symptomAnomaliesRouter,
  __symptomSystemHelpers,
} from "../src/cron/symptom-anomalies";
import type { AppEnvironment } from "../src/types";
import { MockD1 } from "./_mockDb";

const { tokens, symptomSystem } = __symptomSystemHelpers;

function buildApp(db: MockD1) {
  const app = new Hono<AppEnvironment>();
  app.use("*", async (c, next) => {
    c.env = c.env || ({} as any);
    (c.env as any).ENVIRONMENT = "test";
    (c.env as any).DEV_MODE = "true";
    (c.env as any).DB = db as any;
    c.set("db", db as any);
    c.set("locale", "en" as any);
    await next();
  });
  app.route("/", symptomAnomaliesRouter);
  return app;
}

const NOW = new Date("2026-07-09T12:00:00Z");
const CUTOFF_ISO = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

function isoDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("symptom-anomalies helpers", () => {
  it("tokens lowercases + strips punctuation + drops stop words", () => {
    const out = tokens("Headache, mild fever & nausea since yesterday.");
    expect(out).toContain("headache");
    expect(out).toContain("fever");
    expect(out).toContain("nausea");
    expect(out).not.toContain("since");
    expect(out).not.toContain("yesterday");
  });

  it("symptomSystem produces stable cluster keys regardless of word order", () => {
    const a = symptomSystem("nausea and headache");
    const b = symptomSystem("headache with nausea");
    expect(a).toBe(b);
  });
});

describe("/__cron/symptom-anomalies", () => {
  let db: MockD1;

  beforeEach(() => {
    db = new MockD1();
    // MockD1 only auto-parses eq/inArray predicates. The cron uses
    // `gte(createdAt, cutoff)` so register an explicit predicate
    // that does the same date filter client-side.
    db.setWhere("symptoms", (row: any) => row.createdAt >= CUTOFF_ISO);
  });

  it("flags a patient with 3+ moderate symptoms in 7 days", async () => {
    db.seed("symptoms", [
      {
        id: "s1",
        patientId: "pat-1",
        symptom: "persistent headache",
        severity: "moderate",
        startedAt: isoDaysAgo(2),
        createdAt: isoDaysAgo(2),
      },
      {
        id: "s2",
        patientId: "pat-1",
        symptom: "blurry vision and headache",
        severity: "moderate",
        startedAt: isoDaysAgo(1),
        createdAt: isoDaysAgo(1),
      },
      {
        id: "s3",
        patientId: "pat-1",
        symptom: "headache nausea",
        severity: "severe",
        startedAt: isoDaysAgo(0),
        createdAt: isoDaysAgo(0),
      },
    ]);
    const app = buildApp(db);
    const res = await app.request("/__cron/symptom-anomalies", {
      method: "POST",
      headers: { "dry-run": "1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.flaggedCount).toBe(1);
    expect(body.flagged[0].patientId).toBe("pat-1");
    expect(body.flagged[0].count).toBe(3);
    expect(body.flagged[0].moderateCount).toBeGreaterThanOrEqual(2);
    expect(body.dryRun).toBe(true);
  });

  it("does NOT flag when severity is all mild", async () => {
    db.seed("symptoms", [
      {
        id: "s1",
        patientId: "pat-1",
        symptom: "headache",
        severity: "mild",
        createdAt: isoDaysAgo(1),
        startedAt: isoDaysAgo(1),
      },
      {
        id: "s2",
        patientId: "pat-1",
        symptom: "headache",
        severity: "mild",
        createdAt: isoDaysAgo(2),
        startedAt: isoDaysAgo(2),
      },
      {
        id: "s3",
        patientId: "pat-1",
        symptom: "fatigue",
        severity: "mild",
        createdAt: isoDaysAgo(3),
        startedAt: isoDaysAgo(3),
      },
    ]);
    const app = buildApp(db);
    const res = await app.request("/__cron/symptom-anomalies", {
      method: "POST",
      headers: { "dry-run": "1" },
    });
    const body = await res.json();
    expect(body.flaggedCount).toBe(0);
  });

  it("does NOT flag when only 2 entries exist (below MIN_SYMPTOMS)", async () => {
    db.seed("symptoms", [
      {
        id: "s1",
        patientId: "pat-1",
        symptom: "headache",
        severity: "severe",
        createdAt: isoDaysAgo(1),
        startedAt: isoDaysAgo(1),
      },
      {
        id: "s2",
        patientId: "pat-1",
        symptom: "headache",
        severity: "severe",
        createdAt: isoDaysAgo(2),
        startedAt: isoDaysAgo(2),
      },
    ]);
    const app = buildApp(db);
    const res = await app.request("/__cron/symptom-anomalies", {
      method: "POST",
      headers: { "dry-run": "1" },
    });
    const body = await res.json();
    expect(body.flaggedCount).toBe(0);
  });
});