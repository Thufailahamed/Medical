// @ts-nocheck
//
// Care team routes — Phase 1 of the doctor↔patient enterprise
// architecture. Care team membership is the primary access gate;
// patient self-service adds/removes doctors, doctors accept invites.
//
// Endpoints:
//   GET    /care-team?patientId=          — list active members
//   POST   /care-team                     — patient adds doctor (or
//                                            doctor requests to join
//                                            via consent token)
//   PATCH  /care-team/:id                 — flip status (pause/revoke)
//   DELETE /care-team/:id                 — hard remove (admin only)
//
// The endpoint path /care-team is shared with the patient /doctor
// apps; the auth + role gate keeps each side's actions scoped.

import { Hono } from "hono";
import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  careTeamMembers,
  doctors,
  patients,
  users,
  shareLinks,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { audit } from "../lib/audit";
import { notify } from "../lib/notifications";
import type { AppEnvironment } from "../types";

const careTeamRouter = new Hono<AppEnvironment>();

careTeamRouter.use("*", authMiddleware);

async function resolvePatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

async function resolveDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d || null;
}

// ─── GET /care-team?patientId= ────────────────────────────
// Returns active + paused members for one patient. Accessible to:
//   - the patient themselves
//   - any active care-team member of the same patient (specialist /
//     primary_care can see who else is on the team)
careTeamRouter.get("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = (c.get("dbUser") as any)?.role;
  const patientId = c.req.query("patientId");

  if (!patientId) {
    return c.json({ error: "patientId required" }, 400);
  }

  // Authorisation: patient-self or any active member.
  if (role === "patient") {
    const me = await resolvePatient(db, userId);
    if (!me || me.id !== patientId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else if (role === "doctor") {
    const doc = await resolveDoctor(db, userId);
    if (!doc) return c.json({ error: "Doctor profile not found" }, 404);
    const [own] = await db
      .select({ id: careTeamMembers.id })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.patientId, patientId),
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active")
        )
      )
      .limit(1);
    if (!own) return c.json({ error: "Forbidden" }, 403);
  } else {
    return c.json({ error: "Forbidden" }, 403);
  }

  const rows = await db
    .select({
      id: careTeamMembers.id,
      patientId: careTeamMembers.patientId,
      doctorId: careTeamMembers.doctorId,
      role: careTeamMembers.role,
      scope: careTeamMembers.scope,
      status: careTeamMembers.status,
      invitedAt: careTeamMembers.invitedAt,
      acceptedAt: careTeamMembers.acceptedAt,
      revokedAt: careTeamMembers.revokedAt,
      notes: careTeamMembers.notes,
      doctorName: users.name,
      doctorSpecialization: doctors.specialization,
    })
    .from(careTeamMembers)
    .innerJoin(doctors, eq(careTeamMembers.doctorId, doctors.id))
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(
      and(
        eq(careTeamMembers.patientId, patientId),
        or(
          eq(careTeamMembers.status, "active"),
          eq(careTeamMembers.status, "paused")
        )
      )
    )
    .orderBy(desc(careTeamMembers.invitedAt));

  return c.json({ members: rows });
});

// ─── POST /care-team ──────────────────────────────────────
// Patient self-service: add a doctor they have a relationship with.
// Two flows:
//
//   A) Patient-initiated: body = { doctorId, role: "primary_care" }
//      Inserts an active row. Idempotent on the partial UNIQUE.
//
//   B) Doctor-initiated: body = { patientId, role: "specialist",
//      consentToken } — patient must have generated a share_link of
//      kind="care_team_invite" (Phase 2) and shared the token with the
//      doctor. We resolve the link, verify it's not revoked/expired,
//      and insert.
careTeamRouter.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = (c.get("dbUser") as any)?.role;
  const body = await c.req.json();

  let patientId: string | null = null;
  let doctorId: string | null = body.doctorId || null;
  let consentRecordId: string | null = null;
  let insertedRole: string = body.role || "primary_care";

  if (role === "patient") {
    const me = await resolvePatient(db, userId);
    if (!me) return c.json({ error: "Patient profile not found" }, 404);
    patientId = me.id;
    if (!doctorId) {
      return c.json(
        { error: "doctorId required for patient-initiated invites" },
        400
      );
    }
  } else if (role === "doctor") {
    const doc = await resolveDoctor(db, userId);
    if (!doc) return c.json({ error: "Doctor profile not found" }, 404);
    doctorId = doc.id;
    patientId = body.patientId || null;
    if (!patientId || !body.consentToken) {
      return c.json(
        {
          error:
            "Doctors require both patientId and a consentToken (patient-issued share link)",
        },
        400
      );
    }
    // Resolve consent.
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.token, body.consentToken),
          eq(shareLinks.kind, "care_team_invite"),
          eq(shareLinks.revoked, false)
        )
      )
      .limit(1);
    if (!link || link.patientId !== patientId || link.expiresAt < sql`CURRENT_TIMESTAMP`) {
      return c.json({ error: "Consent token invalid or expired" }, 403);
    }
    consentRecordId = link.id;
    insertedRole = body.role || "specialist";
  } else {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!patientId || !doctorId) {
    return c.json({ error: "patientId and doctorId required" }, 400);
  }

  const validRoles = [
    "primary_care",
    "specialist",
    "covering",
    "on_call",
    "family_view",
  ];
  if (!validRoles.includes(insertedRole)) {
    return c.json({ error: `role must be one of: ${validRoles.join(", ")}` }, 400);
  }

  const validScopes = ["full", "episodes_only", "records_only"];
  const scope = validScopes.includes(body.scope) ? body.scope : "full";

  // Insert; the partial UNIQUE index (status='active') rejects
  // duplicates. We catch the unique-constraint error and return 409.
  try {
    const [row] = await db
      .insert(careTeamMembers)
      .values({
        patientId,
        doctorId,
        role: insertedRole as any,
        scope: scope as any,
        status: "active",
        invitedByUserId: userId,
        acceptedAt:
          role === "patient" ? sql`CURRENT_TIMESTAMP` : null,
        consentRecordId,
        notes: body.notes || null,
      })
      .returning();

    audit(db, userId, {
      action: "invite",
      resource: "care_team_member",
      resourceId: row?.id,
      details: { patientId, doctorId, role: insertedRole },
    }).catch(() => {});

    // Notify the invited doctor (if patient-initiated).
    if (role === "patient") {
      const [doc] = await db
        .select()
        .from(doctors)
        .where(eq(doctors.id, doctorId))
        .limit(1);
      if (doc) {
        notify(db, {
          userId: doc.userId,
          type: "general",
          title: "Patient added you to their care team",
          body: `Role: ${insertedRole}`,
          data: { patientId, kind: "care_team" },
        }).catch(() => {});
      }
    }

    return c.json({ member: row }, 201);
  } catch (err: any) {
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      return c.json(
        { error: "An active care team membership already exists for this (patient, doctor, role)" },
        409
      );
    }
    throw err;
  }
});

// ─── PATCH /care-team/:id ─────────────────────────────────
// Status transitions:
//   active → paused     (doctor or patient)
//   paused → active     (doctor or patient)
//   active → revoked    (patient only)
//   revoked → active    NOT ALLOWED — patient must POST a new row
//   { scope } change    (patient only)
careTeamRouter.patch("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = (c.get("dbUser") as any)?.role;
  const id = c.req.param("id");
  const body = await c.req.json();

  const [existing] = await db
    .select()
    .from(careTeamMembers)
    .where(eq(careTeamMembers.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "Member not found" }, 404);

  // Authorisation: patient-self or the doctor on the row.
  if (role === "patient") {
    const me = await resolvePatient(db, userId);
    if (!me || me.id !== existing.patientId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else if (role === "doctor") {
    const doc = await resolveDoctor(db, userId);
    if (!doc || doc.id !== existing.doctorId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  } else {
    return c.json({ error: "Forbidden" }, 403);
  }

  const update: Record<string, any> = {};
  const newStatus = body.status as string | undefined;
  if (newStatus) {
    const valid = ["active", "paused", "revoked"];
    if (!valid.includes(newStatus)) {
      return c.json({ error: `status must be one of: ${valid.join(", ")}` }, 400);
    }
    if (newStatus === "revoked") {
      // Only patients can revoke (patient-self is the consent holder).
      if (role !== "patient") {
        return c.json({ error: "Only patients may revoke care team membership" }, 403);
      }
      update.status = "revoked";
      update.revokedAt = sql`CURRENT_TIMESTAMP`;
      update.revokedByUserId = userId;
    } else if (newStatus === "active" && existing.status === "revoked") {
      return c.json(
        {
          error:
            "Cannot reactivate a revoked row — POST /care-team again to issue a new membership",
        },
        409
      );
    } else {
      update.status = newStatus;
      if (newStatus === "active" && !existing.acceptedAt) {
        update.acceptedAt = sql`CURRENT_TIMESTAMP`;
      }
    }
  }
  if (body.scope !== undefined && role === "patient") {
    const valid = ["full", "episodes_only", "records_only"];
    if (!valid.includes(body.scope)) {
      return c.json({ error: `scope must be one of: ${valid.join(", ")}` }, 400);
    }
    update.scope = body.scope;
  }
  if (body.notes !== undefined) update.notes = body.notes;
  update.updatedAt = sql`CURRENT_TIMESTAMP`;

  if (Object.keys(update).length === 1 && update.updatedAt) {
    return c.json({ error: "No changes supplied" }, 400);
  }

  const [row] = await db
    .update(careTeamMembers)
    .set(update)
    .where(eq(careTeamMembers.id, id))
    .returning();

  audit(db, userId, {
    action: `care_team.${newStatus || "update"}`,
    resource: "care_team_member",
    resourceId: id,
    details: { previousStatus: existing.status, ...body },
  }).catch(() => {});

  return c.json({ member: row });
});

// ─── DELETE /care-team/:id ────────────────────────────────
// Hard delete is admin-only. Patients use PATCH { status: "revoked" }
// instead — preserving the audit row.
careTeamRouter.delete(
  "/:id",
  requireRole("super_admin", "hospital_admin"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = c.req.param("id");
    await db
      .delete(careTeamMembers)
      .where(eq(careTeamMembers.id, id));
    audit(db, userId, {
      action: "care_team.delete",
      resource: "care_team_member",
      resourceId: id,
      details: null,
    }).catch(() => {});
    return c.json({ ok: true });
  }
);

export default careTeamRouter;