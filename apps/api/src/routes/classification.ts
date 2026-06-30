// @ts-nocheck
// Phase 2.1: AI auto-classification + trilingual FTS5 search.
//   POST /ai/classify                        — one-shot classify (called from waitUntil blocks)
//   GET  /medical-records/me/search?q=...    — trilingual FTS5 search

import { Hono } from "hono";
import { z } from "zod";
import { eq, inArray, desc } from "drizzle-orm";
import { medicalRecords, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { flattenTranslated } from "../lib/validation-error";
import { classify, persistClassification } from "../lib/classifier";
import { searchRecordsFts } from "../lib/fts";
import { getOwnPatient } from "../lib/users";
import type { AppEnvironment } from "../types";

const classificationRouter = new Hono<AppEnvironment>();

// ─── POST /ai/classify ────────────────────────────────────
// Called from `waitUntil` blocks after upload + from cron reclassify.
// Auth-guarded (patient role), but in practice the caller passes the
// JWT of the user who owns the record.
const classifySchema = z.object({
  fileUrl: z.string().min(1),
  recordId: z.string().min(1).optional(),
  source: z.enum(["upload", "email-import", "cron", "manual"]).default("upload"),
  threshold: z.number().min(0).max(1).optional(),
});

classificationRouter.post(
  "/ai/classify",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = classifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
        400,
      );
    }
    const { fileUrl, recordId, source, threshold } = parsed.data;
    const userId = c.get("userId");
    const db = c.get("db");
    const env = {
      AI: c.env.AI,
      R2: c.env.R2,
      DB: db,
    };

    const result = await classify(env, {
      fileUrl,
      recordId,
      source,
      userId,
      threshold: threshold ?? parseFloat(c.env.CLASSIFY_THRESHOLD ?? "0.6"),
    });

    if (recordId) {
      const persisted = await persistClassification(
        db,
        recordId,
        result,
        threshold ?? parseFloat(c.env.CLASSIFY_THRESHOLD ?? "0.6"),
      );
      return c.json({ result, persisted });
    }

    return c.json({ result });
  }
);

// ─── GET /medical-records/me/search ────────────────────────
// Trilingual smart search powered by FTS5. Returns matching records in
// BM25-ranked order, scoped to the calling patient (and family).
classificationRouter.get(
  "/medical-records/me/search",
  authMiddleware,
  requireRole("patient"),
  async (c) => {
    const q = c.req.query("q")?.trim() ?? "";
    const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 200);
    const userId = c.get("userId");
    const db = c.get("db");

    if (!q) {
      return c.json({ q, records: [], total: 0 });
    }

    // 1. Patient scope: get own patient + family members.
    const me = await getOwnPatient(db, userId);
    if (!me) {
      return c.json({ q, records: [], total: 0 });
    }
    const { familyMembers } = await import("@healthcare/db");
    const family = await db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(eq(familyMembers.patientId, me.id));
    const scopedIds = [me.id, ...family.map((f) => f.id)];

    // 2. FTS match returns record IDs in BM25 order.
    const matchedIds = await searchRecordsFts(db, q, limit);
    if (matchedIds.length === 0) {
      return c.json({ q, records: [], total: 0 });
    }

    // 3. Hydrate matching records, filter to patient scope, preserve FTS order.
    const rows = await db
      .select()
      .from(medicalRecords)
      .where(inArray(medicalRecords.id, matchedIds));
    const orderIndex = new Map(matchedIds.map((id, i) => [id, i]));
    const filtered = rows
      .filter((r) => scopedIds.includes(r.patientId))
      .sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0))
      .slice(0, limit);

    return c.json({ q, records: filtered, total: filtered.length });
  }
);

export default classificationRouter;