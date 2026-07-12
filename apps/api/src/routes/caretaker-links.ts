// @ts-nocheck
// Caretaker Profiles: link management + active-principal switch.
//
// Routes:
//   GET    /caretaker/links                   (auth, principal) list links
//   PATCH  /caretaker/links/:linkId           (auth, principal) pause/resume
//   DELETE /caretaker/links/:linkId           (auth, principal) revoke
//   GET    /caretaker/me/principals           (auth, caretaker) list my principals
//   GET    /caretaker/me/active-principal     (auth, caretaker) resolve
//   PATCH  /caretaker/me/active-principal     (auth, caretaker) set active
//
// Audit actions:
//   caretaker_link_paused
//   caretaker_link_resumed
//   caretaker_link_revoked
//   caretaker_active_principal_set

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  patientLinks,
  patients,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import {
  patchCaretakerLinkSchema,
  setActivePrincipalSchema,
} from "../lib/validators";
import {
  accessibleCaretakersFor,
  accessiblePrincipalsFor,
  patchCaretakerLinkStatus,
  resolveCaretakerLink,
  revokeCaretakerLink,
} from "../lib/caretaker";
import type { AppEnvironment } from "../types";

const caretakerLinksRouter = new Hono<AppEnvironment>();

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// ─── Principal: list caretakers linked to me ──────────────
caretakerLinksRouter.get(
  "/links",
  authMiddleware,
  requireRole("patient", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const patient = await getOwnPatient(db, userId);
    if (!patient) return c.json({ links: [] });

    const statusFilter = c.req.query("status"); // 'active' | 'paused' | 'revoked'
    let rows = await accessibleCaretakersFor(db, patient.id);
    if (statusFilter) rows = rows.filter((r: any) => r.status === statusFilter);

    return c.json({ links: rows });
  }
);

// ─── Principal: pause/resume link ─────────────────────────
caretakerLinksRouter.patch(
  "/links/:linkId",
  authMiddleware,
  requireRole("patient", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const linkId = c.req.param("linkId");
    if (!linkId) return c.json({ error: "Missing linkId" }, 400);

    const patient = await getOwnPatient(db, userId);
    if (!patient) return c.json({ error: "Patient not found" }, 404);

    const body = await c.req.json().catch(() => ({}));
    const parsed = patchCaretakerLinkSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const [existing] = await db
      .select()
      .from(patientLinks)
      .where(eq(patientLinks.id, linkId))
      .limit(1);
    if (!existing) return c.json({ error: "Link not found" }, 404);
    if (existing.principalPatientId !== patient.id) {
      return c.json({ error: "Not your link" }, 403);
    }

    const updated = await patchCaretakerLinkStatus(
      db,
      linkId,
      parsed.data.status
    );
    if (!updated) return c.json({ error: "Link not patchable" }, 409);

    await writeAudit(db, {
      userId,
      action:
        parsed.data.status === "paused"
          ? "caretaker_link_paused"
          : "caretaker_link_resumed",
      resource: "patient_link",
      resourceId: linkId,
      details: {
        caretakerUserId: existing.caretakerUserId,
        reason: parsed.data.reason || null,
      },
    });

    return c.json({ link: updated });
  }
);

// ─── Principal: revoke link ───────────────────────────────
caretakerLinksRouter.delete(
  "/links/:linkId",
  authMiddleware,
  requireRole("patient", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const linkId = c.req.param("linkId");
    if (!linkId) return c.json({ error: "Missing linkId" }, 400);

    const patient = await getOwnPatient(db, userId);
    if (!patient) return c.json({ error: "Patient not found" }, 404);

    const [existing] = await db
      .select()
      .from(patientLinks)
      .where(eq(patientLinks.id, linkId))
      .limit(1);
    if (!existing) return c.json({ error: "Link not found" }, 404);
    if (existing.principalPatientId !== patient.id) {
      return c.json({ error: "Not your link" }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const reason = (body && (body as any).reason) || undefined;

    const ok = await revokeCaretakerLink(db, linkId, userId, reason);
    if (!ok) return c.json({ error: "Link not revocable" }, 409);

    // If the revoked principal was the caretaker's active principal,
    // clear the column so the next request resolves to no principal.
    await db
      .update(users)
      .set({ activePrincipalPatientId: null })
      .where(eq(users.id, existing.caretakerUserId));

    await writeAudit(db, {
      userId,
      actorUserId: userId,
      action: "caretaker_link_revoked",
      resource: "patient_link",
      resourceId: linkId,
      details: {
        caretakerUserId: existing.caretakerUserId,
        reason: reason || null,
      },
    });

    return c.json({ ok: true });
  }
);

// ─── Caretaker: list my principals ─────────────────────────
caretakerLinksRouter.get(
  "/me/principals",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const rows = await accessiblePrincipalsFor(db, userId);
    return c.json({ principals: rows });
  }
);

// ─── Caretaker: get active principal ──────────────────────
caretakerLinksRouter.get(
  "/me/active-principal",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const dbUser = c.get("dbUser");
    const activeId = dbUser?.activePrincipalPatientId || null;
    if (!activeId) return c.json({ activePatientId: null, principal: null });

    // Validate the link is still active.
    const link = await resolveCaretakerLink(db, userId, activeId);
    if (!link) {
      // Stale column.
      await db
        .update(users)
        .set({ activePrincipalPatientId: null })
        .where(eq(users.id, userId));
      return c.json({ activePatientId: null, principal: null });
    }

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, activeId))
      .limit(1);
    const [principalUser] = patient
      ? await db
          .select({ name: users.name, photo: users.photo })
          .from(users)
          .where(eq(users.id, patient.userId))
          .limit(1)
      : [null];

    return c.json({
      activePatientId: activeId,
      principal: patient && principalUser
        ? {
            patientId: patient.id,
            userId: patient.userId,
            name: principalUser.name,
            photo: principalUser.photo,
            careRole: link.careRole,
          }
        : null,
    });
  }
);

// ─── Caretaker: set active principal ──────────────────────
caretakerLinksRouter.patch(
  "/me/active-principal",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const body = await c.req.json().catch(() => ({}));
    const parsed = setActivePrincipalSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const { patientId } = parsed.data;

    // patientId=null clears active principal.
    if (patientId) {
      const link = await resolveCaretakerLink(db, userId, patientId);
      if (!link) {
        return c.json({ error: "No active link to that principal" }, 403);
      }
    }

    await db
      .update(users)
      .set({ activePrincipalPatientId: patientId })
      .where(eq(users.id, userId));

    await writeAudit(db, {
      userId,
      action: "caretaker_active_principal_set",
      resource: "user",
      resourceId: userId,
      details: { activePatientId: patientId },
    });

    return c.json({ activePatientId: patientId });
  }
);

export default caretakerLinksRouter;
