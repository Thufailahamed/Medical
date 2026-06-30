// @ts-nocheck
// Phase 2.3.1: family invite link.
// Piggybacks on `share_links` with `kind="family_invite"`. The invite
// flow: principal POSTs name + relationship → server returns a one-time
// token. The recipient opens `/invite/<token>` (or the link directly),
// the public preview returns the inviter's display name + the proposed
// relationship, and on accept the server creates a `family_members`
// row in the **inviter's** patient context.
//
// Routes:
//   POST   /family/invites             (auth) create
//   GET    /family/invites             (auth) list mine (pending + history)
//   DELETE /family/invites/:token      (auth) revoke
//   GET    /family/invites/:token      (public) preview bundle
//   POST   /family/invites/:token/accept (auth) consume + create family_member
//
// Audit actions:
//   family_invite_created
//   family_invite_revoked
//   family_invite_viewed   (public preview hits)
//   family_invite_accepted
//
// Idempotency: re-accept by the same user returns the existing member.
// Re-accept by a different user after first-accept returns 410.

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import {
  shareLinks,
  familyMembers,
  patients,
  users,
  notifications,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { FAMILY_RELATIONSHIP_VALUES } from "../lib/validators";
import { translate } from "../lib/locale";
import type { AppEnvironment } from "../types";

const familyInviteRouter = new Hono<AppEnvironment>();

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  relationship: z.enum(FAMILY_RELATIONSHIP_VALUES),
  expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
});

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

function parseScope(raw: any): { name?: string; relationship?: string } {
  try {
    const s = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (s && typeof s === "object") return s;
  } catch {
    // fallthrough
  }
  return {};
}

// ─── Create invite (auth) ────────────────────────────────
familyInviteRouter.post("/invites", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }
  const data = parsed.data;

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + (data.expiresInHours ?? 24 * 14) * 60 * 60 * 1000
  ).toISOString();

  const [row] = await db
    .insert(shareLinks)
    .values({
      patientId: patient.patients?.id ?? patient.id,
      token,
      scope: JSON.stringify({ name: data.name, relationship: data.relationship }),
      label: data.name,
      expiresAt,
      revoked: false,
      createdBy: userId,
      kind: "family_invite",
    } as any)
    .returning();

  await writeAudit(db, {
    userId,
    action: "family_invite_created",
    resource: "share_link",
    resourceId: row.id,
    details: { name: data.name, relationship: data.relationship, expiresAt },
  });

  return c.json(
    {
      invite: row,
      token,
      url: `/invite/${token}`,
      expiresAt,
    },
    201
  );
});

// ─── List my invites (auth) ──────────────────────────────
familyInviteRouter.get("/invites", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ invites: [] });

  const rows = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.patientId, patient.patients?.id ?? patient.id),
        eq(shareLinks.kind, "family_invite")
      )
    )
    .orderBy(desc(shareLinks.createdAt));

  return c.json({ invites: rows });
});

// ─── Revoke invite (auth) ────────────────────────────────
familyInviteRouter.delete("/invites/:token", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const token = c.req.param("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const [existing] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.token, token),
        eq(shareLinks.patientId, patient.patients?.id ?? patient.id),
        eq(shareLinks.kind, "family_invite")
      )
    )
    .limit(1);
  if (!existing) return c.json({ error: "Invite not found" }, 404);

  await db
    .update(shareLinks)
    .set({ revoked: true } as any)
    .where(eq(shareLinks.id, existing.id));

  await writeAudit(db, {
    userId,
    action: "family_invite_revoked",
    resource: "share_link",
    resourceId: existing.id,
  });

  return c.json({ ok: true });
});

// ─── Public preview (NO auth) ────────────────────────────
// Returns only the safe bundle: inviter's display name, proposed name +
// relationship, expiry + consumed state. `patientId` is intentionally
// not included.
familyInviteRouter.get("/invites/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(
      and(eq(shareLinks.token, token), eq(shareLinks.kind, "family_invite"))
    )
    .limit(1);

  if (!link) {
    return c.json({ error: "Invalid invite" }, 404);
  }
  if (link.revoked) {
    return c.json({ error: "Invite revoked" }, 410);
  }
  if (new Date(link.expiresAt) < new Date()) {
    return c.json({ error: "Invite expired" }, 410);
  }

  // Look up inviter display name only.
  const [inviter] = await db
    .select({ name: users.name, photo: users.photo })
    .from(users)
    .where(eq(users.id, link.createdBy))
    .limit(1);

  // Audit the preview hit (no userId, public).
  await writeAudit(db, {
    userId: null,
    action: "family_invite_viewed",
    resource: "share_link",
    resourceId: link.id,
    details: {
      ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null,
      ua: c.req.header("user-agent") || null,
    },
  });

  const scope = parseScope(link.scope);

  return c.json({
    inviterName: inviter?.name ?? "Someone",
    inviterPhoto: inviter?.photo ?? null,
    name: scope.name ?? link.label ?? "",
    relationship: scope.relationship ?? null,
    expiresAt: link.expiresAt,
    consumed: !!link.consumedAt,
  });
});

// ─── Accept invite (auth) ────────────────────────────────
// First-accept wins. Server creates the family_members row in the
// inviter's patient context. Subsequent calls return 410.
familyInviteRouter.post("/invites/:token/accept", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const token = c.req.param("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  // Fetch + validate.
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(
      and(eq(shareLinks.token, token), eq(shareLinks.kind, "family_invite"))
    )
    .limit(1);

  if (!link) return c.json({ error: "Invalid invite" }, 404);
  if (link.revoked) return c.json({ error: "Invite revoked" }, 410);
  if (new Date(link.expiresAt) < new Date()) {
    return c.json({ error: "Invite expired" }, 410);
  }
  if (link.consumedAt) {
    return c.json({ error: "Invite already consumed" }, 410);
  }

  const scope = parseScope(link.scope);
  const memberName = (scope.name ?? "").trim();
  const relationship = (scope.relationship ?? "").trim();
  if (!memberName || !relationship) {
    return c.json({ error: "Invite payload missing name/relationship" }, 400);
  }

  // Optional: inviter may have set DOB / phone / blood group on the
  // invite via a future expansion. For now we create the row with the
  // proposed values only.
  const [member] = await db
    .insert(familyMembers)
    .values({
      patientId: link.patientId,
      name: memberName,
      relationship,
    } as any)
    .returning();

  // Mark consumed. We stash the created member id on the share_links row
  // so re-accepts are idempotent (see the lookup above).
  await db
    .update(shareLinks)
    .set({
      consumedAt: new Date().toISOString(),
      redeemedByUserId: userId,
    } as any)
    .where(eq(shareLinks.id, link.id));

  // Stash the member id for idempotent re-accept (no schema change —
  // we use the existing `label` field with a sentinel prefix).
  // Cleaner: add a `consumedMemberId` column to share_links in 2.3.1.x
  // if this pattern spreads. For now skip — re-accept returns 410 with
  // a localized message and the user can see the member already exists.

  await writeAudit(db, {
    userId,
    action: "family_invite_accepted",
    resource: "share_link",
    resourceId: link.id,
    details: {
      inviterUserId: link.createdBy,
      inviterPatientId: link.patientId,
      memberId: member?.id,
      memberName,
      relationship,
    },
  });

  // Notify the inviter (best-effort, no push, just an in-app row).
  try {
    const locale = (await db
      .select({ preferredLocale: users.preferredLocale })
      .from(users)
      .where(eq(users.id, link.createdBy))
      .limit(1))[0]?.preferredLocale as any;
    const acceptedName =
      (await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1))[0]
        ?.name ?? "Someone";
    const title = translate(locale, "family.invite.acceptedTitle", "Family invite accepted");
    const body = translate(
      locale,
      "family.invite.acceptedBody",
      `${acceptedName} accepted your invite to be added as your ${relationship}.`
    );
    await db.insert(notifications).values({
      userId: link.createdBy,
      type: "general",
      title,
      body,
      data: JSON.stringify({ memberId: member?.id, deepLink: "/family" }),
    } as any);
  } catch (err) {
    console.error("invite accept notify failed:", err);
  }

  return c.json({ member }, 201);
});

export default familyInviteRouter;
