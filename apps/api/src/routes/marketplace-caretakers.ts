// @ts-nocheck
//
// Caretaker Profiles: Caretaker Marketplace — patient-side discovery.
//
// Lets patients browse verified, available caretakers and send an
// inquiry. Trust gate is `users.verified=true` (not a new column) —
// the listing row is only returned if the caretaker has cleared
// identity verification.
//
// Idempotency: a patient can only have one pending inquiry to a
// given caretaker at a time. Already-linked patients are redirected
// to their existing caretakers list (the marketplace is for hiring,
// not for re-onboarding someone you already have).
//
// Routes (mounted at /marketplace/caretakers):
//   GET    /                          list available verified caretakers
//   GET    /:userId                   single profile view
//   POST   /:userId/inquire           patient opens inquiry
//   GET    /inquiries/mine            patient's own sent inquiries
//   (note: /inquiries/mine is mounted at /marketplace/inquiries by the
//          index.ts; this router exposes it at the same level)

import { Hono } from "hono";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
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
import { createMarketplaceInquirySchema } from "../lib/validators";
import type { AppEnvironment } from "../types";

const marketplaceCaretakersRouter = new Hono<AppEnvironment>();

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function shapeCaretaker(row: any) {
  return {
    id: row.caretakerUserId,
    caretakerUserId: row.caretakerUserId,
    name: row.name,
    photo: row.photo ?? null,
    bio: row.bio,
    district: row.district,
    careRolesOffered: parseJsonArray(row.careRolesOffered),
    languages: parseJsonArray(row.languages),
    hourlyRateLkr: row.hourlyRateLkr ?? null,
    experienceYears: row.experienceYears ?? 0,
    verified: !!row.verified,
    ...(row.createdAt !== undefined ? { createdAt: row.createdAt } : {}),
    ...(row.isAvailable !== undefined ? { isAvailable: !!row.isAvailable } : {}),
  };
}

// ─── List available verified caretakers ────────────────────
//
// Filters: ?district=Colombo, ?role=nurse, ?language=en.
// `role` and `language` are JSON-array intersections — we use LIKE
// to match a quoted entry so caretakers offering ["nurse", "other"]
// match ?role=nurse but not ?role=nurse_aide.
marketplaceCaretakersRouter.get(
  "/",
  authMiddleware,
  requireRole("patient", "caretaker", "super_admin"),
  async (c) => {
    const db = c.get("db");
    const district = c.req.query("district");
    const role = c.req.query("role");
    const language = c.req.query("language");

    const conds: any[] = [
      eq(caretakerMarketplaceProfiles.isAvailable, true),
      eq(users.verified, true),
    ];
    if (district) conds.push(eq(caretakerMarketplaceProfiles.district, district));
    if (role) {
      conds.push(sql`${caretakerMarketplaceProfiles.careRolesOffered} LIKE ${'%"' + role + '"%'}`);
    }
    if (language) {
      conds.push(sql`${caretakerMarketplaceProfiles.languages} LIKE ${'%"' + language + '"%'}`);
    }

    const rows = await db
      .select({
        caretakerUserId: caretakerMarketplaceProfiles.caretakerUserId,
        bio: caretakerMarketplaceProfiles.bio,
        languages: caretakerMarketplaceProfiles.languages,
        careRolesOffered: caretakerMarketplaceProfiles.careRolesOffered,
        district: caretakerMarketplaceProfiles.district,
        hourlyRateLkr: caretakerMarketplaceProfiles.hourlyRateLkr,
        experienceYears: caretakerMarketplaceProfiles.experienceYears,
        createdAt: caretakerMarketplaceProfiles.createdAt,
        name: users.name,
        photo: users.photo,
        verified: users.verified,
      })
      .from(caretakerMarketplaceProfiles)
      .innerJoin(users, eq(users.id, caretakerMarketplaceProfiles.caretakerUserId))
      .where(and(...conds));

    return c.json({
      caretakers: rows.map((r: any) => shapeCaretaker(r)),
    });
  }
);

// ─── Single profile view ───────────────────────────────────
//
// Same shape as the list, plus isAvailable + createdAt. 404 if
// hidden or unverified — don't leak off-market listings.
marketplaceCaretakersRouter.get(
  "/:userId",
  authMiddleware,
  requireRole("patient", "caretaker", "super_admin"),
  async (c) => {
    const db = c.get("db");
    const userId = c.req.param("userId");

    const [row] = await db
      .select({
        caretakerUserId: caretakerMarketplaceProfiles.caretakerUserId,
        bio: caretakerMarketplaceProfiles.bio,
        languages: caretakerMarketplaceProfiles.languages,
        careRolesOffered: caretakerMarketplaceProfiles.careRolesOffered,
        district: caretakerMarketplaceProfiles.district,
        hourlyRateLkr: caretakerMarketplaceProfiles.hourlyRateLkr,
        experienceYears: caretakerMarketplaceProfiles.experienceYears,
        isAvailable: caretakerMarketplaceProfiles.isAvailable,
        createdAt: caretakerMarketplaceProfiles.createdAt,
        name: users.name,
        photo: users.photo,
        verified: users.verified,
      })
      .from(caretakerMarketplaceProfiles)
      .innerJoin(users, eq(users.id, caretakerMarketplaceProfiles.caretakerUserId))
      .where(
        and(
          eq(caretakerMarketplaceProfiles.caretakerUserId, userId),
          eq(caretakerMarketplaceProfiles.isAvailable, true),
          eq(users.verified, true)
        )
      )
      .limit(1);

    if (!row) return c.json({ error: "Caretaker not found" }, 404);
    return c.json({ caretaker: shapeCaretaker(row) });
  }
);

// ─── Send an inquiry ───────────────────────────────────────
//
// Refuses:
//   - target has no profile or is unavailable
//   - target is unverified (defense in depth — list shouldn't have shown them)
//   - already-linked (redirect to /caretakers)
//   - already-pending (idempotency — keep one open inquiry per pair)
marketplaceCaretakersRouter.post(
  "/:userId/inquire",
  authMiddleware,
  requireRole("patient", "caretaker", "super_admin"),
  async (c) => {
    const userId = c.get("userId"); // caller
    const db = c.get("db");
    const targetUserId = c.req.param("userId");

    if (targetUserId === userId) {
      return c.json({ error: "Cannot inquire yourself", code: "self_inquiry" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = createMarketplaceInquirySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const [profile] = await db
      .select()
      .from(caretakerMarketplaceProfiles)
      .where(eq(caretakerMarketplaceProfiles.caretakerUserId, targetUserId))
      .limit(1);
    if (!profile || !(profile as any).isAvailable) {
      return c.json({ error: "Caretaker not available", code: "not_available" }, 404);
    }

    const [targetUser] = await db
      .select({ verified: users.verified })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!(targetUser as any)?.verified) {
      return c.json({ error: "Caretaker not verified", code: "not_verified" }, 404);
    }

    // Resolve the caller's patient row to test the already-linked check.
    const [callerPatient] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (callerPatient) {
      const [existingLink] = await db
        .select()
        .from(patientLinks)
        .where(
          and(
            eq(patientLinks.caretakerUserId, targetUserId),
            eq(patientLinks.principalPatientId, callerPatient.id),
            or(
              eq(patientLinks.status, "active"),
              eq(patientLinks.status, "paused")
            )
          )
        )
        .limit(1);
      if (existingLink) {
        return c.json(
          { error: "Already linked to this caretaker", code: "already_linked" },
          409
        );
      }
    }

    // Idempotency: one open inquiry per (patient, caretaker) pair.
    const [existingPending] = await db
      .select()
      .from(caretakerMarketplaceInquiries)
      .where(
        and(
          eq(caretakerMarketplaceInquiries.caretakerUserId, targetUserId),
          eq(caretakerMarketplaceInquiries.patientUserId, userId),
          eq(caretakerMarketplaceInquiries.status, "pending")
        )
      )
      .limit(1);
    if (existingPending) {
      return c.json(
        { error: "Inquiry already pending", code: "already_pending" },
        409
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(caretakerMarketplaceInquiries).values({
      id,
      marketplaceProfileId: (profile as any).id,
      caretakerUserId: targetUserId,
      patientUserId: userId,
      patientMessage: parsed.data.patientMessage,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    } as any);

    await writeAudit(db, {
      userId,
      action: "caretaker_marketplace_inquiry_sent",
      resource: "caretaker_marketplace_inquiry",
      resourceId: id,
    });

    await notify({
      db,
      userId: targetUserId,
      type: "general",
      title: "New caretaker marketplace inquiry",
      body: "A patient wants to connect with you. Open the marketplace tab to respond.",
      data: { inquiryId: id },
    });

    return c.json(
      {
        inquiry: {
          id,
          caretakerUserId: targetUserId,
          status: "pending",
          createdAt: now,
        },
      },
      201
    );
  }
);

// ─── Patient's own sent inquiries ──────────────────────────
//
// Separate router file? No — co-located on /marketplace so the
// prefix matches the read/write of inquiries on the caretaker side.
// Mounted at /marketplace/inquiries/mine via index.ts.
const marketplaceInquiriesRouter = new Hono<AppEnvironment>();

marketplaceInquiriesRouter.get(
  "/mine",
  authMiddleware,
  requireRole("patient", "caretaker", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const statusFilter = c.req.query("status");

    const whereParts: any[] = [
      eq(caretakerMarketplaceInquiries.patientUserId, userId),
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
        caretakerUserId: caretakerMarketplaceInquiries.caretakerUserId,
        patientMessage: caretakerMarketplaceInquiries.patientMessage,
        status: caretakerMarketplaceInquiries.status,
        createdAt: caretakerMarketplaceInquiries.createdAt,
        decidedAt: caretakerMarketplaceInquiries.decidedAt,
        linkId: caretakerMarketplaceInquiries.linkId,
        caretakerName: users.name,
        caretakerPhoto: users.photo,
      })
      .from(caretakerMarketplaceInquiries)
      .innerJoin(users, eq(users.id, caretakerMarketplaceInquiries.caretakerUserId))
      .where(and(...whereParts))
      .orderBy(desc(caretakerMarketplaceInquiries.createdAt));

    return c.json({
      inquiries: rows.map((r: any) => ({
        id: r.id,
        caretakerUserId: r.caretakerUserId,
        caretakerName: r.caretakerName,
        caretakerPhoto: r.caretakerPhoto ?? null,
        patientMessage: r.patientMessage,
        status: r.status,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt ?? null,
        linkId: r.linkId ?? null,
      })),
    });
  }
);

export default marketplaceCaretakersRouter;
export { marketplaceInquiriesRouter };