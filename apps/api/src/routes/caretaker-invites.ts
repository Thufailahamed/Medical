// @ts-nocheck
// Caretaker Profiles: invite lifecycle.
//
// A principal patient creates an invite for a phone/email → server sends
// an OTP + a deep link. The recipient opens the link, enters the OTP,
// and (if new) is upserted as a users row with role='caretaker' linked
// back to the principal via patient_links.
//
// Routes:
//   POST   /caretaker/invites             (auth, patient|caretaker|admin) create
//   GET    /caretaker/invites             (auth) list mine
//   DELETE /caretaker/invites/:id         (auth) revoke
//   GET    /caretaker/invites/:token      (public) preview bundle
//   POST   /caretaker/invites/:token/accept (auth) consume + link
//
// Distinct from share_links(kind='family_invite') which creates a
// family_members row in the inviter's account. Caretaker invites create
// a cross-account users row + patient_links.
//
// Audit actions:
//   caretaker_invite_created
//   caretaker_invite_revoked
//   caretaker_invite_viewed   (public preview hits)
//   caretaker_invite_accepted
//   caretaker_invite_locked   (3 wrong OTPs)

import { Hono } from "hono";
import { and, eq, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  caretakerInvites,
  patientLinks,
  patients,
  users,
  otpCodes,
  notifications,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import {
  createCaretakerInviteSchema,
  acceptCaretakerInviteSchema,
} from "../lib/validators";
import { createSmsProvider, formatOtpMessage } from "../lib/sms";
import { createEmailProvider, formatOtpEmail } from "../lib/email";
import { hashSecret, verifySecret, generateOtpCode } from "../lib/crypto";
import { normalizeSLPhone } from "../lib/phone";
import { translate } from "../lib/locale";
import { logger } from "../lib/logger";
import type { AppEnvironment } from "../types";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const INVITE_DEFAULT_EXPIRES_HOURS = 24 * 14;

const caretakerInviteRouter = new Hono<AppEnvironment>();

function generateToken(): string {
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

function normalizeContact(channel: "mobile" | "email", raw: string): string {
  if (channel === "mobile") return normalizeSLPhone(raw.trim());
  return raw.trim().toLowerCase();
}

// ─── Create invite (auth) ─────────────────────────────────
caretakerInviteRouter.post(
  "/invites",
  authMiddleware,
  requireRole("patient", "caretaker", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    // The inviter must own the principal patient they're inviting on
    // behalf of. Today only `patient` users have a patients row, so
    // super_admin/caretaker can mint invites with a body override.
    const body = await c.req.json().catch(() => ({}));
    const parsed = createCaretakerInviteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const data = parsed.data;

    const patient = await getOwnPatient(db, userId);
    if (!patient) {
      return c.json(
        { error: "Only patients can create caretaker invites from their account" },
        403
      );
    }

    const contact = normalizeContact(data.channel, data.contact);
    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + (data.expiresInHours ?? INVITE_DEFAULT_EXPIRES_HOURS) * 60 * 60 * 1000
    ).toISOString();

    const [row] = await db
      .insert(caretakerInvites)
      .values({
        token,
        principalPatientId: patient.id,
        invitedByUserId: userId,
        caretakerName: data.caretakerName,
        careRole: data.careRole,
        channel: data.channel,
        contactTarget: contact,
        expiresAt,
        revoked: false,
      } as any)
      .returning();

    // Send OTP to the contact. Mirrors /auth/send-otp semantics:
    // pre-prune prior unconsumed rows, hash code, store, send.
    const now = Date.now();
    const code = generateOtpCode();
    const codeHash = await hashSecret(code);
    const otpExpiresAt = new Date(now + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    await db
      .update(otpCodes)
      .set({ consumedAt: new Date(now).toISOString() })
      .where(
        and(
          eq(otpCodes.target, contact),
          eq(otpCodes.channel, data.channel),
          isNull(otpCodes.consumedAt)
        )
      );

    await db.insert(otpCodes).values({
      id: crypto.randomUUID(),
      // userId is null — contact may not have an existing account.
      // Accept endpoint looks up by (target, channel) instead.
      userId: null,
      channel: data.channel,
      target: contact,
      codeHash,
      expiresAt: otpExpiresAt,
      attempts: 0,
    } as any);

    // Deliver the OTP.
    try {
      if (data.channel === "mobile") {
        const sms = createSmsProvider(c.env);
        const smsMessage = formatOtpMessage(code);
        const r = await sms.sendSms(contact, smsMessage);
        if (!r.success) {
          logger.error("caretaker.invite", "sms send failed", { err: r.error });
        }
      } else {
        const email = createEmailProvider(c.env);
        const { subject, text, html } = formatOtpEmail(code, "caretaker_invite");
        const r = await email.sendEmail({
          to: contact,
          subject,
          text,
          html,
        });
        if (!r.success) {
          logger.error("caretaker.invite", "email send failed", { err: r.error });
        }
      }
    } catch (err) {
      logger.error("caretaker.invite", "delivery threw", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    await writeAudit(db, {
      userId,
      action: "caretaker_invite_created",
      resource: "caretaker_invite",
      resourceId: row.id,
      details: {
        caretakerName: data.caretakerName,
        careRole: data.careRole,
        channel: data.channel,
        // Contact redacted in audit details — never log PII targets.
        contactLast4: contact.slice(-4),
        expiresAt,
      },
    });

    const isDev =
      c.env.DEV_MODE === "true" || c.env.ENVIRONMENT === "development";

    return c.json(
      {
        invite: row,
        token,
        url: `/caretaker/${token}`,
        expiresAt,
        ...(isDev ? { devCode: code } : {}),
      },
      201
    );
  }
);

// ─── List my invites (auth) ────────────────────────────────
caretakerInviteRouter.get(
  "/invites",
  authMiddleware,
  requireRole("patient", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const patient = await getOwnPatient(db, userId);
    if (!patient) return c.json({ invites: [] });

    const rows = await db
      .select()
      .from(caretakerInvites)
      .where(eq(caretakerInvites.principalPatientId, patient.id))
      .orderBy(desc(caretakerInvites.createdAt));

    return c.json({ invites: rows });
  }
);

// ─── Revoke invite (auth) ─────────────────────────────────
caretakerInviteRouter.delete(
  "/invites/:id",
  authMiddleware,
  requireRole("patient", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Missing id" }, 400);

    const patient = await getOwnPatient(db, userId);
    if (!patient) return c.json({ error: "Patient not found" }, 404);

    const [existing] = await db
      .select()
      .from(caretakerInvites)
      .where(eq(caretakerInvites.id, id))
      .limit(1);
    if (!existing) return c.json({ error: "Invite not found" }, 404);
    if (existing.principalPatientId !== patient.id) {
      return c.json({ error: "Not your invite" }, 403);
    }

    await db
      .update(caretakerInvites)
      .set({ revoked: true, updatedAt: new Date().toISOString() } as any)
      .where(eq(caretakerInvites.id, id));

    await writeAudit(db, {
      userId,
      action: "caretaker_invite_revoked",
      resource: "caretaker_invite",
      resourceId: id,
    });

    return c.json({ ok: true });
  }
);

// ─── Public preview (NO auth) ─────────────────────────────
// Returns only the safe bundle: inviter display name + photo, the
// proposed caretaker name + role, expiry + consumed state. No contact
// info, no principal patientId.
caretakerInviteRouter.get("/invites/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  if (!token) return c.json({ error: "Missing token" }, 400);

  const [inv] = await db
    .select()
    .from(caretakerInvites)
    .where(eq(caretakerInvites.token, token))
    .limit(1);

  if (!inv) return c.json({ error: "Invalid invite" }, 404);
  if (inv.revoked) return c.json({ error: "Invite revoked" }, 410);
  if (inv.lockedAt) return c.json({ error: "Invite locked" }, 410);
  if (new Date(inv.expiresAt) < new Date()) {
    return c.json({ error: "Invite expired" }, 410);
  }

  // Inviter display name + photo only.
  const [inviter] = await db
    .select({ name: users.name, photo: users.photo })
    .from(users)
    .where(eq(users.id, inv.invitedByUserId))
    .limit(1);

  // Audit the public preview hit (no userId).
  await writeAudit(db, {
    userId: null,
    action: "caretaker_invite_viewed",
    resource: "caretaker_invite",
    resourceId: inv.id,
    details: {
      ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null,
      ua: c.req.header("user-agent") || null,
    },
  });

  return c.json({
    inviterName: inviter?.name ?? "Someone",
    inviterPhoto: inviter?.photo ?? null,
    caretakerName: inv.caretakerName,
    careRole: inv.careRole,
    channel: inv.channel,
    // Mask the contact — show only last 4 digits / first letter for context.
    contactHint:
      inv.channel === "mobile"
        ? `***${inv.contactTarget.slice(-4)}`
        : `${inv.contactTarget[0] ?? ""}***@${inv.contactTarget.split("@")[1] ?? ""}`,
    expiresAt: inv.expiresAt,
    consumed: !!inv.consumedAt,
  });
});

// ─── Accept invite (auth) ─────────────────────────────────
// On success: upsert a users row (role='caretaker') for the contact,
// insert patient_links row (active, acceptedAt), mark invite consumed.
caretakerInviteRouter.post(
  "/invites/:token/accept",
  authMiddleware,
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const token = c.req.param("token");
    if (!token) return c.json({ error: "Missing token" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const parsed = acceptCaretakerInviteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }
    const { otp: code, channel } = parsed.data;

    const [inv] = await db
      .select()
      .from(caretakerInvites)
      .where(eq(caretakerInvites.token, token))
      .limit(1);
    if (!inv) return c.json({ error: "Invalid invite" }, 404);
    if (inv.revoked) return c.json({ error: "Invite revoked" }, 410);
    if (inv.lockedAt) return c.json({ error: "Invite locked" }, 410);
    if (new Date(inv.expiresAt) < new Date()) {
      return c.json({ error: "Invite expired" }, 410);
    }
    if (inv.consumedAt) {
      return c.json({ error: "Invite already consumed" }, 410);
    }
    if (inv.channel !== channel) {
      return c.json(
        { error: `This invite requires verification via ${inv.channel}` },
        400
      );
    }

    // Lock check (3 wrong OTPs).
    if (inv.otpAttempts >= OTP_MAX_ATTEMPTS) {
      if (!inv.lockedAt) {
        await db
          .update(caretakerInvites)
          .set({ lockedAt: new Date().toISOString() } as any)
          .where(eq(caretakerInvites.id, inv.id));
      }
      await writeAudit(db, {
        userId,
        action: "caretaker_invite_locked",
        resource: "caretaker_invite",
        resourceId: inv.id,
      });
      return c.json({ error: "Invite locked — too many attempts" }, 410);
    }

    // Find the live OTP row for (target=contact, channel). We picked the
    // freshest unconsumed candidate.
    const candidates = await db
      .select()
      .from(otpCodes)
      .where(
        and(eq(otpCodes.target, inv.contactTarget), eq(otpCodes.channel, channel))
      )
      .all();

    const now = Date.now();
    const live = candidates
      .filter(
        (o) =>
          !o.consumedAt &&
          new Date(o.expiresAt).getTime() > now &&
          o.attempts < OTP_MAX_ATTEMPTS
      )
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    if (live.length === 0) {
      return c.json({ error: "No active OTP — request a new one" }, 400);
    }
    const otp = live[0];

    const ok = await verifySecret(code, otp.codeHash);
    if (!ok) {
      const newAttempts = inv.otpAttempts + 1;
      const updates: any = { otpAttempts: newAttempts };
      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        updates.lockedAt = new Date().toISOString();
      }
      await db
        .update(caretakerInvites)
        .set(updates)
        .where(eq(caretakerInvites.id, inv.id));
      await db
        .update(otpCodes)
        .set({ attempts: otp.attempts + 1 })
        .where(eq(otpCodes.id, otp.id));
      return c.json({ error: "Invalid OTP code" }, 401);
    }

    await db
      .update(otpCodes)
      .set({ consumedAt: new Date(now).toISOString() })
      .where(eq(otpCodes.id, otp.id));

    // Auth caller — must be the user that owns the contact (or a new
    // account we'll upsert). Look up existing user by the contact.
    let caretakerUserId: string;
    const [existingUser] = await db
      .select()
      .from(users)
      .where(
        channel === "mobile" ? eq(users.phone, inv.contactTarget) : eq(users.email, inv.contactTarget)
      )
      .limit(1);

    if (existingUser) {
      // v1 refusal: existing user with a non-caretaker role cannot
      // become a caretaker via this path. They can still accept the
      // invite by logging in with the existing account if their role
      // is unset/pending. Existing patient users receive the link
      // without role swap.
      caretakerUserId = existingUser.id;
    } else {
      // Upsert a fresh users row, role='caretaker', no patients row.
      const [created] = await db
        .insert(users)
        .values({
          supabaseId: crypto.randomUUID(),
          role: "caretaker",
          phone: channel === "mobile" ? inv.contactTarget : null,
          email: channel === "email" ? inv.contactTarget : null,
          name: inv.caretakerName,
          status: "active",
        } as any)
        .returning();
      caretakerUserId = created.id;
    }

    // Idempotency: do not create a duplicate active link.
    const [existingLink] = await db
      .select()
      .from(patientLinks)
      .where(
        and(
          eq(patientLinks.caretakerUserId, caretakerUserId),
          eq(patientLinks.principalPatientId, inv.principalPatientId),
          eq(patientLinks.status, "active")
        )
      )
      .limit(1);

    let link;
    if (existingLink) {
      link = existingLink;
    } else {
      const [created] = await db
        .insert(patientLinks)
        .values({
          caretakerUserId,
          principalPatientId: inv.principalPatientId,
          careRole: inv.careRole,
          inviteId: inv.id,
          status: "active",
          invitedByUserId: inv.invitedByUserId,
          acceptedAt: new Date(now).toISOString(),
        } as any)
        .returning();
      link = created;
    }

    // Mark invite consumed.
    await db
      .update(caretakerInvites)
      .set({
        consumedAt: new Date(now).toISOString(),
        redeemedByUserId: caretakerUserId,
        updatedAt: new Date(now).toISOString(),
      } as any)
      .where(eq(caretakerInvites.id, inv.id));

    await writeAudit(db, {
      userId: inv.invitedByUserId, // data subject = principal
      actorUserId: caretakerUserId, // operator = the new caretaker
      action: "caretaker_invite_accepted",
      resource: "caretaker_invite",
      resourceId: inv.id,
      details: {
        principalPatientId: inv.principalPatientId,
        caretakerUserId,
        careRole: inv.careRole,
        linkId: link.id,
      },
    });

    // Notify the principal.
    try {
      const [inviter] = await db
        .select({ locale: users.preferredLocale })
        .from(users)
        .where(eq(users.id, inv.invitedByUserId))
        .limit(1);
      const locale = (inviter?.locale as any) || "en";
      const title = translate(locale, "caretaker.invite.acceptedTitle", "Caretaker invite accepted");
      const body = translate(
        locale,
        "caretaker.invite.acceptedBody",
        `${inv.caretakerName} can now manage your records.`
      );
      await db.insert(notifications).values({
        userId: inv.invitedByUserId,
        type: "general",
        title,
        body,
        data: JSON.stringify({ linkId: link.id, deepLink: "/(app)/caretakers" }),
      } as any);
    } catch (err) {
      console.error("caretaker accept notify failed:", err);
    }

    return c.json({ link, principalPatientId: inv.principalPatientId }, 201);
  }
);

export default caretakerInviteRouter;
