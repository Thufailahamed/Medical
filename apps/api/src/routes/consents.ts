// @ts-nocheck
//
// Phase v3: Granular per-purpose consent (issue / list / revoke / audit).
//
// Endpoints:
//   POST   /consents/             — patient issues a consent grant
//   GET    /consents/me           — grants where I am the patient
//   GET    /consents/issued       — grants where I am the recipient
//   DELETE /consents/:id          — patient revokes
//   GET    /consents/audit        — patient: full grant/revoke timeline

import { Hono } from "hono";
import { and, eq, isNull, or, gt } from "drizzle-orm";
import { patients, consentGrants } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import { issueConsent, revokeConsent, listConsentAudit } from "../lib/consent";
import { issueConsentSchema, classifyConsent } from "@healthcare/shared/records";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const consents = new Hono<AppEnvironment>();

consents.use("*", authMiddleware);

function genId(): string {
  const c = crypto as unknown as { randomUUID?: () => string };
  return c.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2);
}

// POST /consents/ — patient issues
consents.post("/", requireRole("patient"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = issueConsentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "validation_failed", details: flattenTranslated(parsed.error) }, 400);
  }
  const input = parsed.data;
  const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  if (!patient) return c.json({ error: "patient_not_found" }, 404);

  try {
    const result = await issueConsent({
      db,
      patientId: patient.id,
      familyMemberId: input.familyMemberId,
      recipientUserId: input.recipientUserId,
      recipientToken: input.recipientToken,
      purpose: input.purpose,
      scope: input.scope ?? {},
      durationDays: input.durationDays,
      expiresAt: input.expiresAt,
      label: input.label,
      grantedByUserId: userId,
    });
    await audit(db, {
      userId,
      action: "consent_granted",
      resource: "consent_grant",
      resourceId: result.id,
      details: { purpose: input.purpose, recipient: input.recipientUserId ?? input.recipientToken },
    });
    return c.json({ id: result.id, expiresAt: result.expiresAt }, 201);
  } catch (err) {
    return c.json({ error: "issue_failed", reason: (err as Error).message }, 400);
  }
});

// GET /consents/me — grants I (patient) have issued
consents.get("/me", requireRole("patient"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  if (!patient) return c.json({ items: [] });
  const rows = await db
    .select()
    .from(consentGrants)
    .where(eq(consentGrants.patientId, patient.id));
  const now = new Date();
  return c.json({
    items: rows.map((r: any) => ({
      id: r.id,
      purpose: r.purpose,
      scope: safeParse(r.scopeJson, {}),
      recipientUserId: r.grantedToUserId,
      recipientToken: r.grantedToToken,
      familyMemberId: r.familyMemberId,
      grantedAt: r.grantedAt,
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      label: r.label,
      status: classifyConsent(r.expiresAt, r.revokedAt, now),
    })),
  });
});

// GET /consents/issued — grants I (recipient) hold
consents.get("/issued", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(consentGrants)
    .where(
      and(
        eq(consentGrants.grantedToUserId, userId),
        isNull(consentGrants.revokedAt),
        gt(consentGrants.expiresAt, new Date().toISOString()),
      ),
    );
  return c.json({
    items: rows.map((r: any) => ({
      id: r.id,
      patientId: r.patientId,
      familyMemberId: r.familyMemberId,
      grantedToUserId: r.grantedToUserId,
      grantedToToken: r.grantedToToken,
      purpose: r.purpose,
      scope: safeParse(r.scopeJson, {}),
      expiresAt: r.expiresAt,
      revokedAt: r.revokedAt,
      grantedAt: r.grantedAt,
      label: r.label,
    })),
  });
});

// DELETE /consents/:id — patient revokes
consents.delete("/:id", requireRole("patient"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  if (!patient) return c.json({ error: "patient_not_found" }, 404);
  const [row] = await db
    .select()
    .from(consentGrants)
    .where(and(eq(consentGrants.id, id), eq(consentGrants.patientId, patient.id)))
    .limit(1);
  if (!row) return c.json({ error: "not_found" }, 404);
  const result = await revokeConsent(db, id, userId);
  if (!result.revoked) {
    return c.json({ error: "revoke_failed", reason: result.reason }, 400);
  }
  await audit(db, {
    userId,
    action: "consent_revoked",
    resource: "consent_grant",
    resourceId: id,
  });
  return c.json({ revoked: true });
});

// GET /consents/audit — full patient timeline
consents.get("/audit", requireRole("patient"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
  if (!patient) return c.json({ items: [] });
  const items = await listConsentAudit(db, patient.id);
  return c.json({ items });
});

function safeParse<T>(s: string | null | undefined, fb: T): T {
  if (!s) return fb;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fb;
  }
}

export default consents;