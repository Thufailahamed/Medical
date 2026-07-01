// @ts-nocheck
// Time-limited shareable links for a patient's record.
// POST /share/links                  create
// GET  /share/links                  list mine
// DELETE /share/links/:id            revoke
// GET  /share/links/:id              fetch summary (no auth)

import { Hono } from "hono";
import { eq, and, or, isNull, desc, gt } from "drizzle-orm";
import {
  shareLinks,
  shareLinkViews,
  patients,
  medicalRecords,
  allergies,
  medicines,
  vitals,
  appointments,
  familyMembers,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { createShareLinkSchema } from "../lib/validators";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const shareRouter = new Hono<AppEnvironment>();

const SCOPE_PRESETS: Record<string, string> = {
  all: "all",
  recent6m: "last6m",
};

function generateToken(): string {
  // 32-char URL-safe token
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// Phase 2.3: confirm a family-member id belongs to the caller's principal
// patient. Returns the FM row on success, null on mismatch. Mirrors the
// two-query pattern in family-context.ts:40-55 (cheaper than a JOIN on D1).
async function getOwnFamilyMember(
  db: any,
  fmId: string,
  patientId: string
) {
  const [fm] = await db
    .select()
    .from(familyMembers)
    .where(
      and(eq(familyMembers.id, fmId), eq(familyMembers.patientId, patientId))
    )
    .limit(1);
  return fm || null;
}

// ─── Create share link ──────────────────────────────────
shareRouter.post("/links", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  // Phase 2.3: shape-validate via Zod (was inline `.catch(() => ({}))` with
  // ad-hoc Math.min/Math.max clamping). `familyMemberId` is optional and
  // explicitly nullable — null = household / principal, UUID = scope to
  // that member. Server enforces FM ownership separately below.
  const body = await c.req.json().catch(() => ({}));
  const parsed = createShareLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }
  const data = parsed.data;

  // FM ownership check: only accept an explicit familyMemberId that the
  // caller actually owns. We deliberately do NOT consult
  // c.get("activeFamilyMemberId") here — share actions are high-stakes;
  // the body must carry the target explicitly. Returns 403 (not 410) on
  // mismatch because this is an action, not a context switch.
  if (data.familyMemberId) {
    const fm = await getOwnFamilyMember(db, data.familyMemberId, patient.id);
    if (!fm) {
      return c.json(
        { error: "Family member does not belong to this account" },
        403
      );
    }
  }

  // Apply defaults. Cap expiresInHours at 30 days server-side regardless
  // of what the client claims (schema already enforces 1-720 ≈ 30 days).
  const expiresInHours = data.expiresInHours ?? 168;
  const label = (data.label ?? "Shared record").toString().slice(0, 100);
  const scopeKind = data.scope ?? "all";
  const scope = JSON.stringify({ kind: scopeKind });

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + expiresInHours * 60 * 60 * 1000
  ).toISOString();

  const [row] = await db
    .insert(shareLinks)
    .values({
      patientId: patient.id,
      token,
      scope,
      label,
      expiresAt,
      revoked: false,
      createdBy: userId,
      // Explicit null when absent — Drizzle's column default does not
      // override nullability, and we want NULL to mean "household share".
      familyMemberId: data.familyMemberId ?? null,
    } as any)
    .returning();

  return c.json({ link: row, token, url: `/share/${token}`, expiresAt }, 201);
});

// ─── List my share links ────────────────────────────────
shareRouter.get("/links", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ links: [] });

  const rows = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.patientId, patient.id))
    .orderBy(desc(shareLinks.createdAt));

  return c.json({ links: rows });
});

// ─── Revoke share link ──────────────────────────────────
shareRouter.delete("/links/:id", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);

  const [existing] = await db
    .select()
    .from(shareLinks)
    .where(
      and(eq(shareLinks.id, id), eq(shareLinks.patientId, patient.id))
    )
    .limit(1);
  if (!existing) return c.json({ error: "Link not found" }, 404);

  await db
    .update(shareLinks)
    .set({ revoked: true })
    .where(eq(shareLinks.id, id));

  return c.json({ message: "Link revoked" });
});

// ─── PUBLIC: fetch by token (no auth) ───────────────────
shareRouter.get("/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.token, token))
    .limit(1);

  if (!link) return c.json({ error: "Invalid link" }, 404);
  // Phase 2.3.1: family invites have their own /family/invites/:token
  // route. Don't let the record-share bundle handler accidentally expose
  // them — treat as 404 to avoid leaking that the token exists.
  if ((link as any).kind && (link as any).kind !== "record_share") {
    return c.json({ error: "Invalid link" }, 404);
  }
  if (link.revoked) return c.json({ error: "Link has been revoked" }, 410);
  if (new Date(link.expiresAt) < new Date()) {
    return c.json({ error: "Link has expired" }, 410);
  }

  // Log view
  const ip =
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for") ||
    null;
  const ua = c.req.header("user-agent") || null;
  await db
    .insert(shareLinkViews)
    .values({
      linkId: link.id,
      ip,
      userAgent: ua,
    } as any);

  // Bundle: profile, allergies, medicines, recent records (last 6mo).
  // Phase 2.3: when the link is scoped to a family member, medicines +
  // records queries are FM-filtered so the recipient sees only that
  // member's data. Allergies + appointments + patient profile stay
  // patient-scoped (allergies table has no FM column — out of scope).
  const linkFmId = (link as any).familyMemberId as string | null | undefined;
  let scopedFm: { id: string; name: string; relationship: string | null } | null = null;
  if (linkFmId) {
    const [fm] = await db
      .select({
        id: familyMembers.id,
        name: familyMembers.name,
        relationship: familyMembers.relationship,
      })
      .from(familyMembers)
      .where(eq(familyMembers.id, linkFmId))
      .limit(1);
    scopedFm = fm ?? null;
  }

  // Bundle: profile, allergies, medicines, recent records (last 6mo)
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, link.patientId))
    .limit(1);

  const allr = await db
    .select()
    .from(allergies)
    .where(eq(allergies.patientId, link.patientId));

  // Medicines: FM-scoped link includes (a) rows tagged to that FM + (b)
  // household (NULL-tagged) rows, so the recipient still sees shared
  // household items like a paracetamol they need to remember. NULL = all
  // medicines for the patient (today's behavior, backward compat).
  const meds = await db
    .select()
    .from(medicines)
    .where(
      linkFmId
        ? and(
            eq(medicines.patientId, link.patientId),
            or(eq(medicines.familyMemberId, linkFmId), isNull(medicines.familyMemberId))
          )
        : eq(medicines.patientId, link.patientId)
    );

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  // Records: FM-scoped link filters strictly to the FM (records aren't
  // "household" the way medicines are). mirror medical-records.ts:152.
  const recs = await db
    .select()
    .from(medicalRecords)
    .where(
      linkFmId
        ? and(
            eq(medicalRecords.patientId, link.patientId),
            eq(medicalRecords.familyMemberId, linkFmId)
          )
        : eq(medicalRecords.patientId, link.patientId)
    );

  const recentRecs = recs.filter((r: any) => {
    if (!r.recordDate) return true;
    return new Date(r.recordDate) >= sixMonthsAgo;
  });

  const appts = await db
    .select()
    .from(appointments)
    .where(eq(appointments.patientId, link.patientId));

  return c.json({
    label: link.label,
    expiresAt: link.expiresAt,
    generatedAt: new Date().toISOString(),
    patient: patient
      ? {
          name: patient.fullName,
          dob: patient.dateOfBirth,
          bloodGroup: patient.bloodGroup,
          sex: patient.gender || patient.sex,
        }
      : null,
    // Phase 2.3: header for FM-scoped bundles so the recipient sees
    // whose records they're looking at. Null for household shares.
    familyMember: scopedFm,
    allergies: allr,
    medicines: meds,
    records: recentRecs,
    appointments: appts,
  });
});

export default shareRouter;