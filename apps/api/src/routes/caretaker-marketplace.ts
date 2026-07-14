// @ts-nocheck
//
// Caretaker Profiles: Caretaker Marketplace — caretaker-side endpoints.
//
// Lets a verified caretaker manage their own listing (profile) and
// respond to patient inquiries. Read + write of profiles, accept /
// decline of inquiries.
//
// Acceptance is the critical join point: when a caretaker accepts an
// inquiry we reuse the same `patient_links` upsert that the
// family-invite flow uses. No new access model. The `inquiry.linkId`
// gets stamped on accept so the inquiry row carries an audit trail
// back to the link that was created from it.
//
// Routes (mounted at /caretaker/marketplace):
//   GET    /me                          read caller's own profile (null if not listed)
//   PUT    /me                          upsert caller's profile (gated on users.verified=true)
//   GET    /inquiries                   list incoming inquiries (filter ?status=)
//   POST   /inquiries/:id/accept        accept inquiry → patient_links row + notify patient
//   POST   /inquiries/:id/decline       decline inquiry → closed silently
//
// Auto-expiry: pending inquiries older than 7 days are marked
// 'expired' on read. Stale rows stay in the DB for audit; they're
// hidden from /inquiries unless explicitly filtered for.

import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  caretakerMarketplaceProfiles,
  caretakerMarketplaceInquiries,
  patientLinks,
  patients,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { writeAudit } from "../lib/audit";
import { notify } from "../lib/notifications";
import { upsertMarketplaceProfileSchema } from "../lib/validators";
import type { AppEnvironment } from "../types";

const caretakerMarketplaceRouter = new Hono<AppEnvironment>();

// Lazy 7-day expiry. Pending → expired once the row crosses the
// threshold; happens on read so we don't need a cron.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ─── Read my own profile ───────────────────────────────────
//
// Caretaker-side dashboard uses this to decide whether to show
// "you're listed" or push the user through /caretaker/verification/me.
caretakerMarketplaceRouter.get(
  "/me",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const [self] = await db
      .select({ verified: users.verified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [profile] = await db
      .select()
      .from(caretakerMarketplaceProfiles)
      .where(eq(caretakerMarketplaceProfiles.caretakerUserId, userId))
      .limit(1);

    return c.json({
      verified: !!(self as any)?.verified,
      profile: profile
        ? {
            id: profile.id,
            bio: profile.bio,
            languages: parseJsonArray((profile as any).languages),
            careRolesOffered: parseJsonArray((profile as any).careRolesOffered),
            district: profile.district,
            hourlyRateLkr: (profile as any).hourlyRateLkr ?? null,
            experienceYears: (profile as any).experienceYears ?? 0,
            isAvailable: !!(profile as any).isAvailable,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          }
        : null,
    });
  }
);

// ─── Upsert my profile ─────────────────────────────────────
//
// Gated on `users.verified=true`. Refuses with 403 not_verified if
// the caretaker hasn't cleared identity verification yet — they get
// pushed through the existing verified-tier flow before they can
// list themselves.
caretakerMarketplaceRouter.put(
  "/me",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");

    const body = await c.req.json().catch(() => ({}));
    const parsed = upsertMarketplaceProfileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const [self] = await db
      .select({ verified: users.verified })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!(self as any)?.verified) {
      return c.json(
        {
          error: "Verify your identity before listing on the marketplace",
          code: "not_verified",
        },
        403
      );
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const [existing] = await db
      .select({ id: caretakerMarketplaceProfiles.id })
      .from(caretakerMarketplaceProfiles)
      .where(eq(caretakerMarketplaceProfiles.caretakerUserId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(caretakerMarketplaceProfiles)
        .set({
          bio: data.bio,
          languages: JSON.stringify(data.languages),
          careRolesOffered: JSON.stringify(data.careRolesOffered),
          district: data.district,
          hourlyRateLkr: data.hourlyRateLkr ?? null,
          experienceYears: data.experienceYears,
          isAvailable: data.isAvailable,
          updatedAt: now,
        } as any)
        .where(eq(caretakerMarketplaceProfiles.id, existing.id));
    } else {
      await db.insert(caretakerMarketplaceProfiles).values({
        id: crypto.randomUUID(),
        caretakerUserId: userId,
        bio: data.bio,
        languages: JSON.stringify(data.languages),
        careRolesOffered: JSON.stringify(data.careRolesOffered),
        district: data.district,
        hourlyRateLkr: data.hourlyRateLkr ?? null,
        experienceYears: data.experienceYears,
        isAvailable: data.isAvailable,
        createdAt: now,
        updatedAt: now,
      } as any);
    }

    await writeAudit(db, {
      userId,
      action: "caretaker_marketplace_profile_upserted",
      resource: "caretaker_marketplace_profile",
      resourceId: userId,
    });

    return c.json({ ok: true });
  }
);

// ─── List incoming inquiries ───────────────────────────────
//
// Joins patients + users for the patient's name + photo so the
// caretaker dashboard can render a row without a second roundtrip.
//
// Lazy-expires pending inquiries older than 7 days. Stale rows
// flip to 'expired' in place on read so the next list call doesn't
// have to redo it. We only mutate rows we are about to return, so
// the lazy write stays bounded.
caretakerMarketplaceRouter.get(
  "/inquiries",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const statusFilter = c.req.query("status");

    // Lazy expire: pending rows older than 7 days → expired.
    const now = Date.now();
    const pendingRows = await db
      .select({
        id: caretakerMarketplaceInquiries.id,
        createdAt: caretakerMarketplaceInquiries.createdAt,
      })
      .from(caretakerMarketplaceInquiries)
      .where(
        and(
          eq(caretakerMarketplaceInquiries.caretakerUserId, userId),
          eq(caretakerMarketplaceInquiries.status, "pending")
        )
      );
    for (const r of pendingRows) {
      const ageMs = now - new Date(String((r as any).createdAt)).getTime();
      if (ageMs > SEVEN_DAYS_MS) {
        await db
          .update(caretakerMarketplaceInquiries)
          .set({ status: "expired", updatedAt: new Date().toISOString() } as any)
          .where(eq(caretakerMarketplaceInquiries.id, r.id));
      }
    }

    const whereParts: any[] = [
      eq(caretakerMarketplaceInquiries.caretakerUserId, userId),
    ];
    if (
      statusFilter &&
      ["pending", "accepted", "declined", "expired"].includes(statusFilter)
    ) {
      whereParts.push(eq(caretakerMarketplaceInquiries.status, statusFilter as any));
    }

    const rows = await db
      .select({
        id: caretakerMarketplaceInquiries.id,
        patientUserId: caretakerMarketplaceInquiries.patientUserId,
        patientMessage: caretakerMarketplaceInquiries.patientMessage,
        status: caretakerMarketplaceInquiries.status,
        createdAt: caretakerMarketplaceInquiries.createdAt,
        decidedAt: caretakerMarketplaceInquiries.decidedAt,
        linkId: caretakerMarketplaceInquiries.linkId,
        patientName: users.name,
        patientPhoto: users.photo,
      })
      .from(caretakerMarketplaceInquiries)
      .innerJoin(users, eq(users.id, caretakerMarketplaceInquiries.patientUserId))
      .where(and(...whereParts))
      .orderBy(desc(caretakerMarketplaceInquiries.createdAt));

    return c.json({
      inquiries: rows.map((r: any) => ({
        id: r.id,
        patientUserId: r.patientUserId,
        patientName: r.patientName,
        patientPhoto: r.patientPhoto ?? null,
        patientMessage: r.patientMessage,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt ?? null,
        linkId: r.linkId ?? null,
      })),
    });
  }
);

// ─── Accept an inquiry ─────────────────────────────────────
//
// 1. Look up the inquiry; refuse if not pending or not the caller's.
// 2. Find the patient's patient row (links are patient_id-keyed, not
//    user_id-keyed).
// 3. Upsert an active patient_links row (same idempotency as
//    invite-accept).
// 4. Stamp the inquiry with status=accepted, linkId, decidedAt.
// 5. Notify the patient.
//
// careRole defaults to the first item in the profile's
// `careRolesOffered` (the caretaker's headline specialty). The
// principal can change it via a later re-invite if they want a
// different role on the link.
caretakerMarketplaceRouter.post(
  "/inquiries/:id/accept",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const inquiryId = c.req.param("id");

    const [inquiry] = await db
      .select()
      .from(caretakerMarketplaceInquiries)
      .where(eq(caretakerMarketplaceInquiries.id, inquiryId))
      .limit(1);
    if (!inquiry) {
      return c.json({ error: "Inquiry not found" }, 404);
    }
    if ((inquiry as any).caretakerUserId !== userId) {
      return c.json({ error: "Not your inquiry" }, 403);
    }
    if ((inquiry as any).status !== "pending") {
      return c.json(
        {
          error: `Inquiry already ${(inquiry as any).status}`,
          code: "not_pending",
        },
        409
      );
    }

    const [patient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, (inquiry as any).patientUserId))
      .limit(1);
    if (!patient) {
      return c.json(
        { error: "Patient has no patient record" },
        422
      );
    }

    // Pick the care role from the listing — first one offered.
    const [profile] = await db
      .select({ careRolesOffered: caretakerMarketplaceProfiles.careRolesOffered })
      .from(caretakerMarketplaceProfiles)
      .where(eq(caretakerMarketplaceProfiles.id, (inquiry as any).marketplaceProfileId))
      .limit(1);
    const offered = parseJsonArray((profile as any)?.careRolesOffered);
    const careRole: string = offered[0] ?? "other";

    // Upsert the patient_links row (idempotent).
    const [existingLink] = await db
      .select()
      .from(patientLinks)
      .where(
        and(
          eq(patientLinks.caretakerUserId, userId),
          eq(patientLinks.principalPatientId, patient.id),
          eq(patientLinks.status, "active")
        )
      )
      .limit(1);

    const now = new Date().toISOString();
    let linkId: string;
    if (existingLink) {
      linkId = (existingLink as any).id;
    } else {
      const [created] = await db
        .insert(patientLinks)
        .values({
          caretakerUserId: userId,
          principalPatientId: patient.id,
          careRole: careRole as any,
          status: "active",
          invitedByUserId: userId, // self-invite via marketplace accept
          acceptedAt: now,
          invitedAt: now,
        } as any)
        .returning();
      linkId = (created as any).id;
    }

    await db
      .update(caretakerMarketplaceInquiries)
      .set({
        status: "accepted",
        decidedAt: now,
        linkId,
        updatedAt: now,
      } as any)
      .where(eq(caretakerMarketplaceInquiries.id, inquiryId));

    await writeAudit(db, {
      userId,
      action: "caretaker_marketplace_inquiry_accepted",
      resource: "caretaker_marketplace_inquiry",
      resourceId: inquiryId,
    });

    // Patient is told their request was accepted.
    await notify({
      db,
      userId: (inquiry as any).patientUserId,
      type: "general",
      title: "Caretaker accepted your request",
      body: "Open the caretakers tab to view their details.",
      data: { inquiryId, linkId },
    });

    return c.json({ ok: true, linkId });
  }
);

// ─── Decline an inquiry ────────────────────────────────────
//
// Closes the inquiry silently. No notification (per Phase 2 scope).
caretakerMarketplaceRouter.post(
  "/inquiries/:id/decline",
  authMiddleware,
  requireRole("caretaker"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const inquiryId = c.req.param("id");

    const [inquiry] = await db
      .select()
      .from(caretakerMarketplaceInquiries)
      .where(eq(caretakerMarketplaceInquiries.id, inquiryId))
      .limit(1);
    if (!inquiry) {
      return c.json({ error: "Inquiry not found" }, 404);
    }
    if ((inquiry as any).caretakerUserId !== userId) {
      return c.json({ error: "Not your inquiry" }, 403);
    }
    if ((inquiry as any).status !== "pending") {
      return c.json(
        {
          error: `Inquiry already ${(inquiry as any).status}`,
          code: "not_pending",
        },
        409
      );
    }

    const now = new Date().toISOString();
    await db
      .update(caretakerMarketplaceInquiries)
      .set({
        status: "declined",
        decidedAt: now,
        updatedAt: now,
      } as any)
      .where(eq(caretakerMarketplaceInquiries.id, inquiryId));

    await writeAudit(db, {
      userId,
      action: "caretaker_marketplace_inquiry_declined",
      resource: "caretaker_marketplace_inquiry",
      resourceId: inquiryId,
    });

    return c.json({ ok: true });
  }
);

export default caretakerMarketplaceRouter;