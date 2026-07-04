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
//   POST   /care-team/invites             — patient creates a
//                                            care_team_invite share
//                                            link the doctor redeems
//   GET    /care-team/reverse             — doctor: list patients
//                                            who have an active
//                                            care-team row for me
//
// The endpoint path /care-team is shared with the patient /doctor
// apps; the auth + role gate keeps each side's actions scoped.

import { Hono } from "hono";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";
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
import {
  careTeamAddSchema,
  careTeamJoinSchema,
  careTeamPatchSchema,
  careTeamInviteSchema,
} from "@healthcare/shared";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const validRoles = [
  "primary_care",
  "specialist",
  "covering",
  "on_call",
  "family_view",
];
const validScopes = ["full", "episodes_only", "records_only"];
const validStatuses = ["active", "paused", "revoked"];

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
//   A) Patient-initiated: body validated by careTeamAddSchema
//      ({ doctorId, role, scope, notes }). Inserts an active row.
//      Idempotent on the partial UNIQUE index.
//
//   B) Doctor-initiated: body validated by careTeamJoinSchema
//      ({ patientId, consentToken, role, scope, notes }) — patient
//      must have generated a share_link of kind="care_team_invite"
//      via POST /care-team/invites and shared the token with the
//      doctor. We resolve the link, verify it's not revoked/expired,
//      mark it consumed, and insert.
careTeamRouter.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = (c.get("dbUser") as any)?.role;
  const body = await c.req.json().catch(() => ({}));

  let patientId: string | null = null;
  let doctorId: string | null = null;
  let consentRecordId: string | null = null;
  let insertedRole: string = "primary_care";
  let insertedScope: string = "full";
  let notes: string | null = null;

  if (role === "patient") {
    const parsed = careTeamAddSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: flattenTranslated(parsed.error, c.get("locale")),
        },
        400
      );
    }
    const me = await resolvePatient(db, userId);
    if (!me) return c.json({ error: "Patient profile not found" }, 404);
    patientId = me.id;
    doctorId = parsed.data.doctorId;
    insertedRole = parsed.data.role;
    insertedScope = parsed.data.scope;
    notes = parsed.data.notes ?? null;
  } else if (role === "doctor") {
    const parsed = careTeamJoinSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: "Validation failed",
          details: flattenTranslated(parsed.error, c.get("locale")),
        },
        400
      );
    }
    const doc = await resolveDoctor(db, userId);
    if (!doc) return c.json({ error: "Doctor profile not found" }, 404);
    doctorId = doc.id;
    patientId = parsed.data.patientId;
    insertedRole = parsed.data.role;
    insertedScope = parsed.data.scope;
    notes = parsed.data.notes ?? null;

    // Resolve consent. Single-use: consumedAt set on first use; a
    // doctor who already redeemed a token can't reuse it.
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.token, parsed.data.consentToken),
          eq(shareLinks.kind, "care_team_invite"),
          eq(shareLinks.revoked, false)
        )
      )
      .limit(1);
    if (!link) {
      return c.json({ error: "Consent token invalid" }, 403);
    }
    if (link.patientId !== patientId) {
      return c.json(
        { error: "Consent token does not match patientId" },
        403
      );
    }
    if (link.consumedAt) {
      return c.json({ error: "Consent token already redeemed" }, 409);
    }
    if (link.expiresAt < sql`CURRENT_TIMESTAMP`) {
      return c.json({ error: "Consent token expired" }, 403);
    }
    consentRecordId = link.id;
  } else {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (!patientId || !doctorId) {
    return c.json({ error: "patientId and doctorId required" }, 400);
  }

  // Insert; the partial UNIQUE index (status='active') rejects
  // duplicates. We catch the unique-constraint error and return 409.
  try {
    const [row] = await db
      .insert(careTeamMembers)
      .values({
        patientId,
        doctorId,
        role: insertedRole as any,
        scope: insertedScope as any,
        status: "active",
        invitedByUserId: userId,
        acceptedAt:
          role === "patient" ? sql`CURRENT_TIMESTAMP` : null,
        consentRecordId,
        notes,
      })
      .returning();

    // Mark the invite token consumed (single-use) so it can't be
    // replayed by another doctor. Patient-initiated paths skip this.
    if (consentRecordId) {
      await db
        .update(shareLinks)
        .set({
          consumedAt: sql`CURRENT_TIMESTAMP`,
          redeemedByUserId: userId,
        } as any)
        .where(eq(shareLinks.id, consentRecordId));
    }

    audit(db, userId, {
      action: "care_team.invite",
      resource: "care_team_member",
      resourceId: row?.id,
      details: { patientId, doctorId, role: insertedRole, scope: insertedScope },
    }).catch(() => {});

    // Notify the invited doctor (if patient-initiated).
    if (role === "patient" && doctorId) {
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
    } else if (role === "doctor" && patientId) {
      const [p] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);
      if (p) {
        notify(db, {
          userId: p.userId,
          type: "general",
          title: "Doctor joined your care team",
          body: `Role: ${insertedRole}`,
          data: { doctorId, kind: "care_team" },
        }).catch(() => {});
      }
    }

    return c.json({ member: row }, 201);
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("unique") || msg.includes("constraint")) {
      return c.json(
        {
          error:
            "An active care team membership already exists for this (patient, doctor, role)",
        },
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
  const body = await c.req.json().catch(() => ({}));

  const parsed = careTeamPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }

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
  const newStatus = parsed.data.status;
  if (newStatus) {
    if (!validStatuses.includes(newStatus)) {
      return c.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        400
      );
    }
    if (newStatus === "revoked") {
      // Only patients can revoke (patient-self is the consent holder).
      if (role !== "patient") {
        return c.json(
          { error: "Only patients may revoke care team membership" },
          403
        );
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
  if (parsed.data.scope !== undefined && role === "patient") {
    if (!validScopes.includes(parsed.data.scope)) {
      return c.json(
        { error: `scope must be one of: ${validScopes.join(", ")}` },
        400
      );
    }
    update.scope = parsed.data.scope;
  }
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
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
    details: { previousStatus: existing.status, ...parsed.data },
  }).catch(() => {});

  return c.json({ member: row });
});

// ─── POST /care-team/invites ─────────────────────────────
// Patient issues a single-use token that a specific doctor (or any
// doctor they hand it to) redeems via POST /care-team with
// consentToken. The token is bound to this patient only — doctor
// cannot use it for another patient.
//
// Body: { role, scope, ttlHours }
// Returns: { token, expiresAt, patientName, role, scope }
careTeamRouter.post("/invites", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const role = (c.get("dbUser") as any)?.role;
  if (role !== "patient") {
    return c.json({ error: "Only patients may issue care team invites" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = careTeamInviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }

  const me = await resolvePatient(db, userId);
  if (!me) return c.json({ error: "Patient profile not found" }, 404);

  // Fetch patient name for the response payload (doctor sees this when
  // they're deciding whether to accept).
  const [u] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const token = generateToken();
  const ttlHours = parsed.data.ttlHours;
  // expiresAt: ISO string in UTC. SQLite compares lexically against
  // CURRENT_TIMESTAMP (also UTC). `+` with ms math gives a
  // reproducible expiry.
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000).toISOString();

  await db.insert(shareLinks).values({
    patientId: me.id,
    token,
    scope: JSON.stringify({
      kind: "care_team_invite",
      role: parsed.data.role,
      scope: parsed.data.scope,
    }),
    label: `Care team invite — ${parsed.data.role}`,
    expiresAt,
    revoked: false,
    createdBy: userId,
    kind: "care_team_invite",
  } as any);

  audit(db, userId, {
    action: "care_team.invite_create",
    resource: "share_link",
    resourceId: null,
    details: { ttlHours, role: parsed.data.role, scope: parsed.data.scope },
  }).catch(() => {});

  return c.json(
    {
      token,
      expiresAt,
      patientName: u?.name ?? null,
      role: parsed.data.role,
      scope: parsed.data.scope,
    },
    201
  );
});

// ─── GET /care-team/reverse ──────────────────────────────
// Doctor view: "which patients have added me to their care team?"
// Returns active rows + demographics, scoped to the calling doctor.
// Sorted by most-recent invite so the doctor's dashboard surfaces
// new additions at the top.
careTeamRouter.get(
  "/reverse",
  authMiddleware,
  requireRole("doctor"),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");

    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return c.json({ error: "Doctor profile not found" }, 404);

    const rows = await db
      .select({
        careTeamId: careTeamMembers.id,
        patientId: careTeamMembers.patientId,
        role: careTeamMembers.role,
        scope: careTeamMembers.scope,
        status: careTeamMembers.status,
        invitedAt: careTeamMembers.invitedAt,
        acceptedAt: careTeamMembers.acceptedAt,
        patientName: users.name,
        patientNic: users.nic,
        patientPhone: users.phone,
        patientPhoto: users.photo,
        patientDob: patients.dateOfBirth,
        patientGender: patients.gender,
      })
      .from(careTeamMembers)
      .innerJoin(patients, eq(patients.id, careTeamMembers.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(
        and(
          eq(careTeamMembers.doctorId, doc.id),
          eq(careTeamMembers.status, "active")
        )
      )
      .orderBy(desc(careTeamMembers.invitedAt));

    return c.json({ patients: rows, count: rows.length });
  }
);

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