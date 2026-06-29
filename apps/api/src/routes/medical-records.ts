// @ts-nocheck

import { Hono } from "hono";
import {
  eq,
  and,
  desc,
  inArray,
  isNull,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import {
  medicalRecords,
  files,
  patients,
  users,
  doctors,
  hospitals,
  familyMembers,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  medicalRecordSchema,
  medicalRecordBulkIdsSchema,
  medicalRecordBulkTagSchema,
  medicalRecordBulkMoveSchema,
} from "../lib/validators";
import { canAccessPatient, canAccessRecord } from "../lib/access";
import { audit } from "../lib/audit";
import type { AppEnvironment } from "../types";

const medicalRecordsRouter = new Hono<AppEnvironment>();

// ─── Ownership helper ────────────────────────────────────
// Returns the patient row for the current patient user, or null if the
// caller is not a patient or has no patient row.
async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// Returns the doctor row for the current doctor user, or null.
async function getOwnDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d || null;
}

// ─── V4 helpers ───────────────────────────────────────────
// Escape SQL LIKE wildcards in user-supplied search text.
function escapeLike(s: string): string {
  return s.replace(/[%_]/g, "\\$&");
}

// Safe JSON-parse that returns [] on null/bad input.
function safeTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === "string");
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Resolve a family_members row → { id, name, relationship }. Returns
// null when the row doesn't exist or doesn't belong to the owning patient.
async function resolveFamilyMember(db: any, familyMemberId: string | null | undefined, owningPatientId: string) {
  if (!familyMemberId) return null;
  const [fm] = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.id, familyMemberId),
        eq(familyMembers.patientId, owningPatientId)
      )
    )
    .limit(1);
  if (!fm) return null;
  return { id: fm.id, name: fm.name, relationship: fm.relationship };
}

// ─── Get my records (with pagination) ────────────────────
// GET /medical-records/me?limit=50&offset=0&type=lab_report
medicalRecordsRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const patient = await getOwnPatient(db, userId);
  if (!patient) {
    return c.json({ error: "Patient profile not found" }, 404);
  }

  // Pagination — default 50, max 200.
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  const typeFilter = c.req.query("type");
  const qRaw = (c.req.query("q") || "").trim();
  const tagsCsv = (c.req.query("tags") || "").trim();
  const archivedParam = c.req.query("archived"); // "true" (default active only), "all", "only"
  const scope = (c.req.query("scope") || "family") as "own" | "family";
  const familyMemberId = c.req.query("familyMemberId") || "";
  const sortMode = (c.req.query("sort") || "newest") as
    | "newest"
    | "oldest"
    | "relevance";

  // ─── Build WHERE ─────────────────────────────────────
  const whereParts: any[] = [];

  // 1. Scope: own vs own + family members' records
  if (familyMemberId) {
    // Ownership-check: the family member must belong to this patient.
    const [fm] = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, familyMemberId),
          eq(familyMembers.patientId, patient.id)
        )
      )
      .limit(1);
    if (!fm) {
      return c.json({ error: "Family member not found" }, 404);
    }
    whereParts.push(eq(medicalRecords.familyMemberId, familyMemberId));
  } else if (scope === "own") {
    whereParts.push(eq(medicalRecords.patientId, patient.id));
  } else {
    // scope === "family": union of own + family member records
    const fams = await db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(eq(familyMembers.patientId, patient.id));
    const famIds = fams.map((f: any) => f.id);
    whereParts.push(
      famIds.length
        ? or(
            eq(medicalRecords.patientId, patient.id),
            inArray(medicalRecords.familyMemberId, famIds)
          )
        : eq(medicalRecords.patientId, patient.id)
    );
  }

  // 2. Archived filter. Default = active only (archived_at IS NULL).
  if (archivedParam === "only") {
    whereParts.push(isNotNull(medicalRecords.archivedAt));
  } else if (archivedParam === "all") {
    // no predicate — include both active and archived
  } else {
    whereParts.push(isNull(medicalRecords.archivedAt));
  }

  // 3. Type filter
  if (typeFilter) {
    whereParts.push(eq(medicalRecords.recordType, typeFilter as any));
  }

  // 4. Tags filter (OR match against the JSON text column).
  // Tags are stored as JSON arrays in a single TEXT column. SQLite's JSON1
  // is available in D1; we use json_each to expand the array and match any
  // of the requested tags.
  if (tagsCsv) {
    const wanted = tagsCsv
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (wanted.length) {
      // json_each(tag, '$') flattens the JSON array; we match against values
      // in the requested list. SQLite doesn't bind JSON paths directly via
      // Drizzle so we use raw SQL fragment.
      const jsonCond = sql`EXISTS (
        SELECT 1 FROM json_each(${medicalRecords.tags}) AS je
        WHERE je.value IN (${sql.join(
          wanted.map((t) => sql`${t}`),
          sql`, `
        )})
      )`;
      whereParts.push(jsonCond);
    }
  }

  // 5. Free-text search across canonical columns + extractedData JSON.
  if (qRaw) {
    const like = `%${escapeLike(qRaw)}%`;
    const likeCol = (col: any) => sql`${col} LIKE ${like} ESCAPE '\\'`;
    whereParts.push(
      or(
        likeCol(medicalRecords.title),
        likeCol(medicalRecords.diagnosis),
        likeCol(medicalRecords.summary),
        likeCol(medicalRecords.notes),
        likeCol(medicalRecords.recordType),
        likeCol(medicalRecords.extractedData)
      )
    );
  }

  // ─── ORDER BY ────────────────────────────────────────
  let orderClause: any[] = [
    desc(medicalRecords.date),
    desc(medicalRecords.createdAt),
  ];
  if (sortMode === "oldest") {
    orderClause = [sql`${medicalRecords.date} ASC`];
  }
  // For "relevance" we keep date sort as a stable fallback. Client-side
  // scoring in recordSearch.ts handles the actual relevance ranking.

  const records = await db
    .select()
    .from(medicalRecords)
    .where(and(...whereParts))
    .orderBy(...orderClause)
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ c: sql<number>`count(*)` })
    .from(medicalRecords)
    .where(and(...whereParts));
  const total = Number(totalRows[0]?.c ?? 0);

  // Attach file counts + first attachment meta + doctor/hospital names.
  const recordIds = records.map((r: any) => r.id);
  const fileCounts: Record<string, { count: number; first?: any }> = {};
  if (recordIds.length) {
    const allFiles = await db
      .select()
      .from(files)
      .where(inArray(files.recordId, recordIds));
    for (const f of allFiles as any[]) {
      if (!f.recordId) continue;
      const bucket = fileCounts[f.recordId] || { count: 0 };
      bucket.count += 1;
      if (!bucket.first) bucket.first = f;
      fileCounts[f.recordId] = bucket;
    }
  }

  const doctorIds = Array.from(
    new Set(records.map((r: any) => r.doctorId).filter(Boolean))
  ) as string[];
  const hospitalIds = Array.from(
    new Set(records.map((r: any) => r.hospitalId).filter(Boolean))
  ) as string[];

  const doctorMap: Record<string, any> = {};
  if (doctorIds.length) {
    const rows = await db
      .select({ id: doctors.id, userId: doctors.userId, specialization: doctors.specialization })
      .from(doctors)
      .where(inArray(doctors.id, doctorIds));
    const userIds = rows.map((r) => r.userId);
    const userRows = userIds.length
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));
    for (const d of rows) {
      doctorMap[d.id] = {
        id: d.id,
        name: userMap[d.userId]?.name ?? "Doctor",
        specialization: d.specialization,
      };
    }
  }

  const hospitalMap: Record<string, any> = {};
  if (hospitalIds.length) {
    const rows = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .where(inArray(hospitals.id, hospitalIds));
    for (const h of rows) hospitalMap[h.id] = { id: h.id, name: h.name };
  }

  // Resolve family members in batch (only the ones that appear in this slice).
  const fmIds = Array.from(
    new Set(records.map((r: any) => r.familyMemberId).filter(Boolean))
  ) as string[];
  const fmMap: Record<string, any> = {};
  if (fmIds.length) {
    const rows = await db
      .select({
        id: familyMembers.id,
        name: familyMembers.name,
        relationship: familyMembers.relationship,
      })
      .from(familyMembers)
      .where(inArray(familyMembers.id, fmIds));
    for (const fm of rows) {
      fmMap[fm.id] = { id: fm.id, name: fm.name, relationship: fm.relationship };
    }
  }

  const enriched = records.map((r: any) => ({
    ...r,
    tags: safeTags(r.tags),
    attachments: fileCounts[r.id] || { count: 0 },
    doctor: r.doctorId ? doctorMap[r.doctorId] || null : null,
    hospital: r.hospitalId ? hospitalMap[r.hospitalId] || null : null,
    familyMember: r.familyMemberId ? fmMap[r.familyMemberId] || null : null,
  }));

  return c.json({ records: enriched, total, limit, offset });
});

// ─── Stats for filter chips ───────────────────────────────
// GET /medical-records/me/stats
medicalRecordsRouter.get("/me/stats", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ total: 0, byType: {}, lastDate: null });

  const rows = await db
    .select({
      type: medicalRecords.recordType,
      c: sql<number>`count(*)`,
    })
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patient.id))
    .groupBy(medicalRecords.recordType);

  const byType: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.c);
    byType[r.type] = n;
    total += n;
  }

  const [latest] = await db
    .select({ date: medicalRecords.date })
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patient.id))
    .orderBy(desc(medicalRecords.date))
    .limit(1);

  return c.json({
    total,
    byType,
    lastDate: latest?.date ?? null,
  });
});

// ─── Get single record (with ownership check) ────────────
medicalRecordsRouter.get("/:id", authMiddleware, async (c) => {
  const recordId = c.req.param("id");
  if (!recordId) return c.json({ error: "Missing id" }, 400);
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const [record] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);

  if (!record) {
    return c.json({ error: "Record not found" }, 404);
  }

  // Access check: patient must own it; doctors/staff need a relationship.
  const access = await canAccessPatient(db, userId, userRole, record.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // Get attached files
  const attachedFiles = await db
    .select()
    .from(files)
    .where(eq(files.recordId, recordId));

  // Resolve doctor/hospital names for the detail view.
  let doctor: any = null;
  if (record.doctorId) {
    const [d] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, record.doctorId))
      .limit(1);
    if (d) {
      const [u] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, d.userId))
        .limit(1);
      doctor = {
        id: d.id,
        name: u?.name ?? "Doctor",
        specialization: d.specialization,
      };
    }
  }

  let hospital: any = null;
  if (record.hospitalId) {
    const [h] = await db
      .select({ id: hospitals.id, name: hospitals.name })
      .from(hospitals)
      .where(eq(hospitals.id, record.hospitalId))
      .limit(1);
    if (h) hospital = { id: h.id, name: h.name };
  }

  const familyMember = await resolveFamilyMember(
    db,
    (record as any).familyMemberId,
    record.patientId
  );

  return c.json({
    record: {
      ...record,
      tags: safeTags((record as any).tags),
      files: attachedFiles,
      doctor,
      hospital,
      familyMember,
    },
  });
});

// ─── Create record (doctor / hospital staff) ─────────────
medicalRecordsRouter.post("/", authMiddleware, requireRole("doctor", "hospital_staff", "hospital_admin"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = await c.req.json();
  const parsed = medicalRecordSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const targetPatientId: string | undefined = body.patientId;
  if (!targetPatientId) {
    return c.json({ error: "patientId is required" }, 400);
  }

  // RBAC: doctor/staff must have a relationship with the target patient.
  const access = await canAccessPatient(db, userId, userRole, targetPatientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const [record] = await db
    .insert(medicalRecords)
    .values({
      patientId: targetPatientId,
      hospitalId: parsed.data.hospitalId,
      doctorId: parsed.data.doctorId,
      recordType: parsed.data.recordType,
      title: parsed.data.title,
      diagnosis: parsed.data.diagnosis,
      summary: parsed.data.summary,
      notes: parsed.data.notes,
      date: parsed.data.date,
      followUpDate: parsed.data.followUpDate,
    })
    .returning();

  return c.json({ record }, 201);
});

// ─── Update record (patient or doctor) ───────────────────
medicalRecordsRouter.patch("/:id", authMiddleware, async (c) => {
  const recordId = c.req.param("id");
  if (!recordId) return c.json({ error: "Missing id" }, 400);
  const db = c.get("db");
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const [record] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);
  if (!record) return c.json({ error: "Record not found" }, 404);

  const access = await canAccessPatient(db, userId, userRole, record.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const partial: Record<string, any> = {};
  if (typeof body.title === "string") partial.title = body.title;
  if (typeof body.diagnosis === "string") partial.diagnosis = body.diagnosis;
  if (typeof body.summary === "string") partial.summary = body.summary;
  if (typeof body.notes === "string") partial.notes = body.notes;
  if (typeof body.date === "string") partial.date = body.date;
  if (typeof body.followUpDate === "string") partial.followUpDate = body.followUpDate;
  if (typeof body.recordType === "string") partial.recordType = body.recordType;

  // ─── V4: tags (string[]), archive flag, family member reassignment ───
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || !body.tags.every((t: any) => typeof t === "string")) {
      return c.json({ error: "tags must be string[]" }, 400);
    }
    const normalised = body.tags
      .map((t: string) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 50);
    partial.tags = JSON.stringify(Array.from(new Set(normalised)));
  }

  if (body.archived !== undefined) {
    if (typeof body.archived !== "boolean") {
      return c.json({ error: "archived must be boolean" }, 400);
    }
    partial.archivedAt = body.archived ? new Date().toISOString() : null;
  }

  if (body.familyMemberId !== undefined) {
    if (body.familyMemberId === null) {
      partial.familyMemberId = null;
    } else if (typeof body.familyMemberId === "string") {
      // Ownership rule: the target family member must belong to the same
      // parent patient that owns this record.
      const fm = await resolveFamilyMember(db, body.familyMemberId, record.patientId);
      if (!fm) {
        return c.json(
          { error: "Family member not owned by this patient" },
          400
        );
      }
      partial.familyMemberId = fm.id;
    } else {
      return c.json({ error: "familyMemberId must be string or null" }, 400);
    }
  }

  if (Object.keys(partial).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  const [updated] = await db
    .update(medicalRecords)
    .set(partial)
    .where(eq(medicalRecords.id, recordId))
    .returning();

  return c.json({ record: updated });
});

// ─── Bulk operations (V4) ────────────────────────────────
// Each endpoint accepts { ids: string[] } (max 200), loops canAccessRecord
// per id, applies the action to allowed ids, and returns
// { <count_key>: <n>, denied: [{id, reason}] }. One audit row per call.

// ─── POST /medical-records/bulk-delete ───────────────────
medicalRecordsRouter.post(
  "/bulk-delete",
  authMiddleware,
  async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const db = c.get("db");
    const env = c.env;

    const body = await c.req.json().catch(() => ({}));
    const parsed = medicalRecordBulkIdsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const ids = parsed.data.ids;

    const allowed: string[] = [];
    const denied: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      const access = await canAccessRecord(db, userId, userRole, id);
      if (access.allowed) allowed.push(id);
      else denied.push({ id, reason: access.reason || "Access denied" });
    }

    if (allowed.length) {
      // Cascade: R2 best-effort → files rows → record rows.
      const attachedFiles = await db
        .select()
        .from(files)
        .where(inArray(files.recordId, allowed));
      for (const f of attachedFiles as any[]) {
        if (env?.R2 && f.r2Key) {
          try {
            await env.R2.delete(f.r2Key);
          } catch {
            // best-effort
          }
        }
      }
      await db.delete(files).where(inArray(files.recordId, allowed));
      await db.delete(medicalRecords).where(inArray(medicalRecords.id, allowed));
    }

    await audit(db, {
      userId,
      action: "records.bulk_delete",
      resource: "medical_record",
      resourceId: `bulk:${allowed.length}`,
      details: { ids: allowed, denied },
    });

    return c.json({ deleted: allowed.length, denied });
  }
);

// ─── POST /medical-records/bulk-archive ──────────────────
medicalRecordsRouter.post(
  "/bulk-archive",
  authMiddleware,
  async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = medicalRecordBulkIdsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const ids = parsed.data.ids;

    const allowed: string[] = [];
    const denied: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      const access = await canAccessRecord(db, userId, userRole, id);
      if (access.allowed) allowed.push(id);
      else denied.push({ id, reason: access.reason || "Access denied" });
    }

    if (allowed.length) {
      const stamp = new Date().toISOString();
      await db
        .update(medicalRecords)
        .set({ archivedAt: stamp })
        .where(inArray(medicalRecords.id, allowed));
    }

    await audit(db, {
      userId,
      action: "records.bulk_archive",
      resource: "medical_record",
      resourceId: `bulk:${allowed.length}`,
      details: { ids: allowed, denied },
    });

    return c.json({ archived: allowed.length, denied });
  }
);

// ─── POST /medical-records/bulk-restore ──────────────────
medicalRecordsRouter.post(
  "/bulk-restore",
  authMiddleware,
  async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = medicalRecordBulkIdsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const ids = parsed.data.ids;

    const allowed: string[] = [];
    const denied: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      const access = await canAccessRecord(db, userId, userRole, id);
      if (access.allowed) allowed.push(id);
      else denied.push({ id, reason: access.reason || "Access denied" });
    }

    if (allowed.length) {
      await db
        .update(medicalRecords)
        .set({ archivedAt: null })
        .where(inArray(medicalRecords.id, allowed));
    }

    await audit(db, {
      userId,
      action: "records.bulk_restore",
      resource: "medical_record",
      resourceId: `bulk:${allowed.length}`,
      details: { ids: allowed, denied },
    });

    return c.json({ restored: allowed.length, denied });
  }
);

// ─── POST /medical-records/bulk-tag ──────────────────────
medicalRecordsRouter.post(
  "/bulk-tag",
  authMiddleware,
  async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = medicalRecordBulkTagSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const { ids, add = [], remove = [] } = parsed.data;
    if (!add.length && !remove.length) {
      return c.json({ error: "add or remove is required" }, 400);
    }
    const addSet = new Set(
      add.map((t) => t.trim().toLowerCase()).filter(Boolean)
    );
    const removeSet = new Set(
      remove.map((t) => t.trim().toLowerCase()).filter(Boolean)
    );

    const allowed: string[] = [];
    const denied: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      const access = await canAccessRecord(db, userId, userRole, id);
      if (access.allowed) allowed.push(id);
      else denied.push({ id, reason: access.reason || "Access denied" });
    }

    let updated = 0;
    if (allowed.length) {
      const rows = await db
        .select({ id: medicalRecords.id, tags: medicalRecords.tags })
        .from(medicalRecords)
        .where(inArray(medicalRecords.id, allowed));
      for (const row of rows) {
        const cur = new Set(safeTags(row.tags));
        for (const t of addSet) cur.add(t);
        for (const t of removeSet) cur.delete(t);
        const next = JSON.stringify(Array.from(cur));
        if (next !== row.tags) {
          await db
            .update(medicalRecords)
            .set({ tags: next })
            .where(eq(medicalRecords.id, row.id));
        }
        updated++;
      }
    }

    await audit(db, {
      userId,
      action: "records.bulk_tag",
      resource: "medical_record",
      resourceId: `bulk:${allowed.length}`,
      details: { add: Array.from(addSet), remove: Array.from(removeSet), updated },
    });

    return c.json({ updated, denied });
  }
);

// ─── POST /medical-records/bulk-move ──────────────────────
medicalRecordsRouter.post(
  "/bulk-move",
  authMiddleware,
  async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = medicalRecordBulkMoveSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const { ids, familyMemberId } = parsed.data;

    // If a target family member is given, pre-validate it belongs to the
    // calling patient (i.e. they have rights to move into it). Unassign
    // (null) needs no pre-check.
    if (familyMemberId) {
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.userId, userId))
        .limit(1);
      if (!patient) {
        return c.json({ error: "Patient profile not found" }, 404);
      }
      const fm = await resolveFamilyMember(db, familyMemberId, patient.id);
      if (!fm) {
        return c.json(
          { error: "Family member not owned by this patient" },
          400
        );
      }
    }

    const allowed: string[] = [];
    const denied: Array<{ id: string; reason: string }> = [];
    for (const id of ids) {
      const access = await canAccessRecord(db, userId, userRole, id);
      if (access.allowed) allowed.push(id);
      else denied.push({ id, reason: access.reason || "Access denied" });
    }

    if (allowed.length) {
      await db
        .update(medicalRecords)
        .set({ familyMemberId })
        .where(inArray(medicalRecords.id, allowed));
    }

    await audit(db, {
      userId,
      action: "records.bulk_move",
      resource: "medical_record",
      resourceId: `bulk:${allowed.length}`,
      details: { familyMemberId, ids: allowed, denied },
    });

    return c.json({ moved: allowed.length, denied });
  }
);

// ─── Delete record (patient or doctor) — cascades files ─
medicalRecordsRouter.delete("/:id", authMiddleware, async (c) => {
  const recordId = c.req.param("id");
  if (!recordId) return c.json({ error: "Missing id" }, 400);
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");
  const env = c.env;

  const [record] = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.id, recordId))
    .limit(1);

  if (!record) return c.json({ error: "Record not found" }, 404);

  // Use shared access helper
  const access = await canAccessPatient(db, userId, userRole, record.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // Delete attachments from R2 + DB
  const attachedFiles = await db
    .select()
    .from(files)
    .where(eq(files.recordId, recordId));
  for (const f of attachedFiles as any[]) {
    if (env?.R2 && f.r2Key) {
      try {
        await env.R2.delete(f.r2Key);
      } catch {
        // best-effort; carry on
      }
    }
  }
  await db.delete(files).where(eq(files.recordId, recordId));
  await db.delete(medicalRecords).where(eq(medicalRecords.id, recordId));

  return c.json({ message: "Record deleted", deletedAttachments: attachedFiles.length });
});

// ─── Timeline view (with ownership check) ────────────────
medicalRecordsRouter.get("/timeline/:patientId", authMiddleware, async (c) => {
  const patientId = c.req.param("patientId");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const records = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patientId))
    .orderBy(desc(medicalRecords.date));

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const timeline: Record<string, Record<string, typeof records>> = {};

  for (const record of records) {
    const date = new Date((record as any).date);
    const year = date.getFullYear().toString();
    const month = MONTH_NAMES[date.getMonth()];

    if (!timeline[year]) timeline[year] = {};
    if (!timeline[year][month]) timeline[year][month] = [];
    timeline[year][month].push(record);
  }

  return c.json({ timeline });
});

// ─── My prescriptions shortcut ───────────────────────────
medicalRecordsRouter.get("/me/prescriptions", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ prescriptions: [] });

  const records = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.patientId, patient.id),
        eq(medicalRecords.recordType, "prescription")
      )
    )
    .orderBy(desc(medicalRecords.date));

  return c.json({ prescriptions: records });
});

export default medicalRecordsRouter;
