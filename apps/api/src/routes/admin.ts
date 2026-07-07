// @ts-nocheck
// ─── Admin portal API (Phase ADM-1) ───────────────────────────
//
// Every route here is gated by `requireAdmin` (super_admin only).
// `adminRouter.use("*", requireAdmin)` is mounted at index.ts and
// runs before any inner route fires.
//
// Module layout (logical sections in this single file):
//   1. Dashboard     — KPI tiles for the admin landing page
//   2. Approvals     — pending user applications → approve/reject
//   3. Users         — list + suspend + edit + delete
//   4. Doctors       — list + SLMC verify / revoke
//   5. Tenants       — hospitals / clinics (other roles share the users table)
//   6. Waitlist      — already had read; now invite / remove
//   7. Demo requests — respond + status transitions
//   8. Audit         — system-wide, paginated, filterable
//   9. Payouts       — mark paid / failed
//  10. Insurance     — approve / reject claims
//  11. DSAR          — approve / complete privacy requests
//  12. Notifications — broadcast to a role / user filter
//  13. Medicines master — admin CRUD proxy to /medicines-master surface
//
// All write actions call `recordAdminAction` which appends a row to
// `audit_logs` with `action="admin.<verb>"`, the actor + IP.

import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, gte, like, lte, ne, or, sql } from "drizzle-orm";
import {
  users,
  doctors,
  hospitals,
  clinics,
  marketingWaitlist,
  demoRequests,
  auditLogs,
  doctorPayouts,
  insuranceClaims,
  dsarRequests,
  notifications,
  medicinesMaster,
  prescriptions,
  appointments,
} from "@healthcare/db";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const adminRouter = new Hono<AppEnvironment>();

// Single guard for every endpoint below.
adminRouter.use("*", requireAdmin);

// ─────────────────────────────────────────────────────────────
// 1. Dashboard
// ─────────────────────────────────────────────────────────────
adminRouter.get("/dashboard", async (c) => {
  const db = c.get("db");
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  // Run small, indexed queries in parallel.
  const [
    usersByRole,
    pendingApprovals,
    activeDoctors,
    pendingDoctors,
    todayAuditCount,
    pendingPayouts,
    openInsuranceClaims,
    openDsarRequests,
    newDemoRequests,
    activeRxLast7d,
    appointmentsToday,
  ] = await Promise.all([
    db
      .select({ role: users.role, status: users.status, count: sql<number>`count(*)` })
      .from(users)
      .groupBy(users.role, users.status),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(doctors)
      .where(sql`${doctors.slmcVerifiedAt} IS NOT NULL`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(doctors)
      .where(sql`${doctors.slmcVerifiedAt} IS NULL`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(gte(auditLogs.createdAt, todayIso)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(doctorPayouts)
      .where(eq(doctorPayouts.status, "pending")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(insuranceClaims)
      .where(or(eq(insuranceClaims.status, "submitted"), eq(insuranceClaims.status, "under_review"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(dsarRequests)
      .where(or(eq(dsarRequests.status, "queued"), eq(dsarRequests.status, "approved"))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(demoRequests)
      .where(eq(demoRequests.status, "new")),
    db
      .select({ count: sql<number>`count(*)` })
      .from(prescriptions)
      .where(gte(prescriptions.createdAt, new Date(Date.now() - 7 * 86400_000).toISOString())),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(eq(appointments.date, new Date().toISOString().slice(0, 10))),
  ]);

  return c.json({
    generatedAt: new Date().toISOString(),
    users: {
      byRoleAndStatus: usersByRole,
      pendingApprovals: pendingApprovals[0]?.count ?? 0,
    },
    doctors: {
      slmcVerified: activeDoctors[0]?.count ?? 0,
      slmcUnverified: pendingDoctors[0]?.count ?? 0,
    },
    today: {
      auditEvents: todayAuditCount[0]?.count ?? 0,
      appointments: appointmentsToday[0]?.count ?? 0,
      prescriptionsLast7d: activeRxLast7d[0]?.count ?? 0,
    },
    operations: {
      pendingPayouts: pendingPayouts[0]?.count ?? 0,
      openInsuranceClaims: openInsuranceClaims[0]?.count ?? 0,
      openDsarRequests: openDsarRequests[0]?.count ?? 0,
      newDemoRequests: newDemoRequests[0]?.count ?? 0,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Approvals queue
// ─────────────────────────────────────────────────────────────
adminRouter.get("/approvals", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status") || "pending";
  const role = c.req.query("role");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10) || 100, 500);

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.status, status as any),
        role ? eq(users.role, role as any) : undefined,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);

  // Hydrate doctor profiles for doctor applicants so the queue shows
  // specialization + SLMC number alongside the user row.
  const doctorUserIds = rows.filter((u) => u.role === "doctor").map((u) => u.id);
  const doctorProfiles = doctorUserIds.length
    ? await db.select().from(doctors).where(or(...doctorUserIds.map((id) => eq(doctors.userId, id)))!)
    : [];

  const byUser = new Map(doctorProfiles.map((d) => [d.userId, d]));

  return c.json({
    items: rows.map((u) => ({
      user: u,
      doctorProfile: u.role === "doctor" ? byUser.get(u.id) ?? null : null,
    })),
    total: rows.length,
  });
});

const approvalDecisionSchema = z.object({
  reason: z.string().max(500).optional(),
});

adminRouter.post("/approvals/:userId/approve", async (c) => {
  const db = c.get("db");
  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = approvalDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return c.json({ error: "User not found" }, 404);
  if ((existing as any).status !== "pending") {
    return c.json({ error: `User is ${(existing as any).status}, not pending` }, 409);
  }

  const now = new Date().toISOString();
  const actor = c.get("adminActor");
  await db
    .update(users)
    .set({
      status: "active",
      approvedAt: now,
      approvedByUserId: actor?.id ?? null,
      // Clear any prior rejection fields so the row reflects the new state.
      rejectedAt: null,
      rejectionReason: null,
      suspendedAt: null,
      suspendedReason: null,
      suspendedByUserId: null,
    } as any)
    .where(eq(users.id, userId));

  await recordAdminAction(c, {
    action: "approve_user",
    resource: "user",
    resourceId: userId,
    details: { role: existing.role, name: existing.name },
  });

  // Notify the user their account is live.
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    type: "general",
    title: "Your account is approved",
    body: "You can now sign in to the platform.",
    data: null,
    read: 0,
  });

  return c.json({ ok: true, userId, status: "active" });
});

adminRouter.post("/approvals/:userId/reject", async (c) => {
  const db = c.get("db");
  const userId = c.req.param("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = approvalDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  if (!parsed.data.reason) {
    return c.json({ error: "reason is required to reject" }, 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return c.json({ error: "User not found" }, 404);
  if ((existing as any).status !== "pending") {
    return c.json({ error: `User is ${(existing as any).status}, not pending` }, 409);
  }

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({
      status: "rejected",
      rejectedAt: now,
      rejectionReason: parsed.data.reason,
    } as any)
    .where(eq(users.id, userId));

  await recordAdminAction(c, {
    action: "reject_user",
    resource: "user",
    resourceId: userId,
    details: { role: existing.role, name: existing.name, reason: parsed.data.reason },
  });

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId,
    type: "general",
    title: "Your application was not approved",
    body: parsed.data.reason,
    data: null,
    read: 0,
  });

  return c.json({ ok: true, userId, status: "rejected" });
});

// ─────────────────────────────────────────────────────────────
// 3. Users — list, get, edit, suspend, unsuspend, delete
// ─────────────────────────────────────────────────────────────
adminRouter.get("/users", async (c) => {
  const db = c.get("db");
  const role = c.req.query("role");
  const status = c.req.query("status");
  const q = c.req.query("q");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);

  const where = and(
    role ? eq(users.role, role as any) : undefined,
    status ? eq(users.status, status as any) : undefined,
    q
      ? or(
          like(users.name, `%${q}%`),
          like(users.email, `%${q}%`),
          like(users.phone, `%${q}%`),
        )
      : undefined,
  );

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        name: users.name,
        role: users.role,
        status: users.status,
        approvedAt: users.approvedAt,
        rejectedAt: users.rejectedAt,
        rejectionReason: users.rejectionReason,
        suspendedAt: users.suspendedAt,
        suspendedReason: users.suspendedReason,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where),
  ]);

  return c.json({ items: rows, total: totalRow[0]?.count ?? 0, limit, offset });
});

adminRouter.get("/users/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!row) return c.json({ error: "User not found" }, 404);

  // Hydrate role-specific profile in a single batch.
  const [doctor] = row.role === "doctor"
    ? await db.select().from(doctors).where(eq(doctors.userId, id)).limit(1)
    : [null];
  const [hospital] = row.role === "hospital_admin"
    ? await db.select().from(hospitals).where(eq(hospitals.userId, id)).limit(1)
    : [null];
  const [clinic] = row.role === "hospital_admin" || row.role === "doctor"
    ? await db.select().from(clinics).where(eq(clinics.userId, id)).limit(1)
    : [null];

  return c.json({
    user: row,
    profiles: { doctor: doctor ?? null, hospital: hospital ?? null, clinic: clinic ?? null },
  });
});

const patchUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(32).nullable().optional(),
  role: z
    .enum(["patient", "doctor", "hospital_admin", "hospital_staff", "laboratory", "pharmacy", "insurance", "ambulance", "super_admin"])
    .optional(),
});

adminRouter.patch("/users/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: "User not found" }, 404);

  await db.update(users).set(parsed.data as any).where(eq(users.id, id));

  await recordAdminAction(c, {
    action: "edit_user",
    resource: "user",
    resourceId: id,
    details: { before: existing, after: parsed.data },
  });

  return c.json({ ok: true });
});

const suspendSchema = z.object({ reason: z.string().min(3).max(500) });

adminRouter.post("/users/:id/suspend", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = suspendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: "User not found" }, 404);
  if (existing.role === "super_admin" && existing.id === c.get("adminActor")?.id) {
    return c.json({ error: "Cannot suspend yourself" }, 400);
  }

  const now = new Date().toISOString();
  const actor = c.get("adminActor");
  await db
    .update(users)
    .set({
      status: "suspended",
      suspendedAt: now,
      suspendedReason: parsed.data.reason,
      suspendedByUserId: actor?.id ?? null,
    } as any)
    .where(eq(users.id, id));

  await recordAdminAction(c, {
    action: "suspend_user",
    resource: "user",
    resourceId: id,
    details: { role: existing.role, name: existing.name, reason: parsed.data.reason },
  });

  return c.json({ ok: true });
});

adminRouter.post("/users/:id/unsuspend", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: "User not found" }, 404);
  if ((existing as any).status !== "suspended") {
    return c.json({ error: "User is not suspended" }, 409);
  }

  await db
    .update(users)
    .set({
      status: "active",
      suspendedAt: null,
      suspendedReason: null,
      suspendedByUserId: null,
    } as any)
    .where(eq(users.id, id));

  await recordAdminAction(c, {
    action: "unsuspend_user",
    resource: "user",
    resourceId: id,
    details: { role: existing.role, name: existing.name },
  });

  return c.json({ ok: true });
});

adminRouter.delete("/users/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const actor = c.get("adminActor");
  if (id === actor?.id) {
    return c.json({ error: "Cannot delete yourself" }, 400);
  }
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: "User not found" }, 404);

  // Cascade the most obvious 1:1 profile rows. Tenant / clinical tables
  // intentionally kept — admins should re-assign ownership, not silently
  // break doctors and patients downstream.
  if (existing.role === "doctor") {
    await db.delete(doctors).where(eq(doctors.userId, id));
  } else if (existing.role === "patient") {
    // Patients table is 1:1 to user; orphan left for clinical safety.
  }

  await db.delete(users).where(eq(users.id, id));

  await recordAdminAction(c, {
    action: "delete_user",
    resource: "user",
    resourceId: id,
    details: { role: existing.role, name: existing.name, email: existing.email },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 4. Doctors — list + SLMC verify / revoke
// ─────────────────────────────────────────────────────────────
adminRouter.get("/doctors", async (c) => {
  const db = c.get("db");
  const slmc = c.req.query("slmc"); // "verified" | "unverified" | "all"
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);

  const where = and(
    eq(users.role, "doctor"),
    slmc === "verified" ? sql`${doctors.slmcVerifiedAt} IS NOT NULL` :
    slmc === "unverified" ? sql`${doctors.slmcVerifiedAt} IS NULL` :
    undefined,
  );

  const rows = await db
    .select({
      doctorId: doctors.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: users.status,
      specialization: doctors.specialization,
      registrationNumber: doctors.registrationNumber,
      slmcRegistrationNo: doctors.slmcRegistrationNo,
      slmcVerifiedAt: doctors.slmcVerifiedAt,
      hospitalId: doctors.hospitalId,
      rating: doctors.rating,
      experience: doctors.experience,
      createdAt: users.createdAt,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ items: rows, total: rows.length, limit, offset });
});

adminRouter.get("/doctors/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [row] = await db
    .select({
      doctor: doctors,
      user: users,
    })
    .from(doctors)
    .innerJoin(users, eq(doctors.userId, users.id))
    .where(eq(doctors.id, id))
    .limit(1);
  if (!row) return c.json({ error: "Doctor not found" }, 404);
  return c.json(row);
});

adminRouter.post("/doctors/:id/verify-slmc", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
  if (!existing) return c.json({ error: "Doctor not found" }, 404);

  await db
    .update(doctors)
    .set({ slmcVerifiedAt: new Date().toISOString() } as any)
    .where(eq(doctors.id, id));

  await recordAdminAction(c, {
    action: "verify_slmc",
    resource: "doctor",
    resourceId: id,
    details: { slmcRegistrationNo: existing.slmcRegistrationNo },
  });

  return c.json({ ok: true });
});

adminRouter.post("/doctors/:id/revoke-slmc", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
  if (!existing) return c.json({ error: "Doctor not found" }, 404);

  await db
    .update(doctors)
    .set({ slmcVerifiedAt: null } as any)
    .where(eq(doctors.id, id));

  await recordAdminAction(c, {
    action: "revoke_slmc",
    resource: "doctor",
    resourceId: id,
    details: { slmcRegistrationNo: existing.slmcRegistrationNo },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 5. Tenants — hospitals + clinics (other roles share users table)
// ─────────────────────────────────────────────────────────────
adminRouter.get("/tenants", async (c) => {
  const db = c.get("db");
  const type = c.req.query("type") || "hospital";
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);

  if (type === "hospital") {
    const rows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        license: hospitals.license,
        address: hospitals.address,
        phone: hospitals.phone,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerStatus: users.status,
        rating: hospitals.rating,
        createdAt: hospitals.createdAt,
      })
      .from(hospitals)
      .innerJoin(users, eq(hospitals.userId, users.id))
      .orderBy(desc(hospitals.createdAt))
      .limit(limit);
    return c.json({ items: rows, total: rows.length });
  }
  if (type === "clinic") {
    const rows = await db
      .select({
        id: clinics.id,
        name: clinics.name,
        license: clinics.license,
        address: clinics.address,
        phone: clinics.phone,
        shortCode: clinics.shortCode,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerStatus: users.status,
        rating: clinics.rating,
        createdAt: clinics.createdAt,
      })
      .from(clinics)
      .innerJoin(users, eq(clinics.userId, users.id))
      .orderBy(desc(clinics.createdAt))
      .limit(limit);
    return c.json({ items: rows, total: rows.length });
  }
  return c.json({ error: "type must be 'hospital' or 'clinic'" }, 400);
});

// ─────────────────────────────────────────────────────────────
// 6. Waitlist — list, invite, remove
// ─────────────────────────────────────────────────────────────
adminRouter.get("/waitlist", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status") || "all";
  const limit = Math.min(parseInt(c.req.query("limit") || "200", 10) || 200, 1000);

  const where =
    status === "pending" ? isNull(marketingWaitlist.invitedAt) :
    status === "invited" ? sql`${marketingWaitlist.invitedAt} IS NOT NULL` :
    undefined;

  const rows = await db
    .select()
    .from(marketingWaitlist)
    .where(where as any)
    .orderBy(desc(marketingWaitlist.createdAt))
    .limit(limit);

  return c.json({ items: rows, total: rows.length });
});

adminRouter.post("/waitlist/:id/invite", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const slot = (body?.slot as string | undefined) ?? null;

  const [existing] = await db.select().from(marketingWaitlist).where(eq(marketingWaitlist.id, id)).limit(1);
  if (!existing) return c.json({ error: "Waitlist entry not found" }, 404);

  await db
    .update(marketingWaitlist)
    .set({ invitedAt: new Date().toISOString(), invitedSlot: slot } as any)
    .where(eq(marketingWaitlist.id, id));

  await recordAdminAction(c, {
    action: "invite_waitlist",
    resource: "waitlist",
    resourceId: id,
    details: { email: existing.email, slot },
  });

  return c.json({ ok: true });
});

adminRouter.delete("/waitlist/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db.select().from(marketingWaitlist).where(eq(marketingWaitlist.id, id)).limit(1);
  if (!existing) return c.json({ error: "Waitlist entry not found" }, 404);

  await db.delete(marketingWaitlist).where(eq(marketingWaitlist.id, id));
  await recordAdminAction(c, {
    action: "remove_waitlist",
    resource: "waitlist",
    resourceId: id,
    details: { email: existing.email },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 7. Demo requests — list + respond
// ─────────────────────────────────────────────────────────────
adminRouter.get("/demo-requests", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10) || 100, 500);

  const rows = await db
    .select()
    .from(demoRequests)
    .where(status ? eq(demoRequests.status, status) : undefined)
    .orderBy(desc(demoRequests.createdAt))
    .limit(limit);

  return c.json({ items: rows, total: rows.length });
});

const demoRespondSchema = z.object({
  status: z.enum(["contacted", "closed", "new"]),
  reply: z.string().max(2000).optional(),
});

adminRouter.post("/demo-requests/:id/respond", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = demoRespondSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [existing] = await db.select().from(demoRequests).where(eq(demoRequests.id, id)).limit(1);
  if (!existing) return c.json({ error: "Demo request not found" }, 404);

  await db
    .update(demoRequests)
    .set({ status: parsed.data.status } as any)
    .where(eq(demoRequests.id, id));

  await recordAdminAction(c, {
    action: "respond_demo_request",
    resource: "demo_request",
    resourceId: id,
    details: { from: existing.status, to: parsed.data.status, reply: parsed.data.reply ?? null },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 8. Audit — system-wide paginated log
// ─────────────────────────────────────────────────────────────
adminRouter.get("/audit", async (c) => {
  const db = c.get("db");
  const userId = c.req.query("userId");
  const action = c.req.query("action");
  const resource = c.req.query("resource");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);

  const where = and(
    userId ? eq(auditLogs.userId, userId) : undefined,
    action ? like(auditLogs.action, `${action}%`) : undefined,
    resource ? eq(auditLogs.resource, resource) : undefined,
    from ? gte(auditLogs.createdAt, from) : undefined,
    to ? lte(auditLogs.createdAt, to) : undefined,
  );

  const [rows, total] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        details: auditLogs.details,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(where),
  ]);

  return c.json({ items: rows, total: total[0]?.count ?? 0, limit, offset });
});

// ─────────────────────────────────────────────────────────────
// 9. Payouts — mark paid / failed
// ─────────────────────────────────────────────────────────────
adminRouter.get("/payouts", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10) || 100, 500);

  const rows = await db
    .select()
    .from(doctorPayouts)
    .where(status ? eq(doctorPayouts.status, status as any) : undefined)
    .orderBy(desc(doctorPayouts.periodEnd))
    .limit(limit);

  return c.json({ items: rows, total: rows.length });
});

const markPaidSchema = z.object({ reference: z.string().min(1).max(200) });
const markFailedSchema = z.object({ reason: z.string().min(3).max(500) });

adminRouter.post("/payouts/:id/mark-paid", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = markPaidSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const [existing] = await db.select().from(doctorPayouts).where(eq(doctorPayouts.id, id)).limit(1);
  if (!existing) return c.json({ error: "Payout not found" }, 404);

  await db
    .update(doctorPayouts)
    .set({
      status: "paid",
      reference: parsed.data.reference,
      paidAt: new Date().toISOString(),
    } as any)
    .where(eq(doctorPayouts.id, id));

  await recordAdminAction(c, {
    action: "mark_payout_paid",
    resource: "payout",
    resourceId: id,
    details: { doctorId: existing.doctorId, amountLkr: existing.amountLkr, reference: parsed.data.reference },
  });

  return c.json({ ok: true });
});

adminRouter.post("/payouts/:id/mark-failed", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = markFailedSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const [existing] = await db.select().from(doctorPayouts).where(eq(doctorPayouts.id, id)).limit(1);
  if (!existing) return c.json({ error: "Payout not found" }, 404);

  await db
    .update(doctorPayouts)
    .set({ status: "failed" } as any)
    .where(eq(doctorPayouts.id, id));

  await recordAdminAction(c, {
    action: "mark_payout_failed",
    resource: "payout",
    resourceId: id,
    details: { doctorId: existing.doctorId, amountLkr: existing.amountLkr, reason: parsed.data.reason },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 10. Insurance claims
// ─────────────────────────────────────────────────────────────
adminRouter.get("/insurance-claims", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10) || 100, 500);

  const rows = await db
    .select()
    .from(insuranceClaims)
    .where(status ? eq(insuranceClaims.status, status as any) : undefined)
    .orderBy(desc(insuranceClaims.id))
    .limit(limit);

  return c.json({ items: rows, total: rows.length });
});

const claimDecisionSchema = z.object({ reason: z.string().max(500).optional() });

adminRouter.post("/insurance-claims/:id/approve", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = claimDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const [existing] = await db.select().from(insuranceClaims).where(eq(insuranceClaims.id, id)).limit(1);
  if (!existing) return c.json({ error: "Claim not found" }, 404);

  await db
    .update(insuranceClaims)
    .set({ status: "approved" } as any)
    .where(eq(insuranceClaims.id, id));

  await recordAdminAction(c, {
    action: "approve_claim",
    resource: "insurance_claim",
    resourceId: id,
    details: { amount: existing.amount },
  });

  return c.json({ ok: true });
});

adminRouter.post("/insurance-claims/:id/reject", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = claimDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  if (!parsed.data.reason) return c.json({ error: "reason is required" }, 400);

  const [existing] = await db.select().from(insuranceClaims).where(eq(insuranceClaims.id, id)).limit(1);
  if (!existing) return c.json({ error: "Claim not found" }, 404);

  await db
    .update(insuranceClaims)
    .set({ status: "rejected", notes: parsed.data.reason } as any)
    .where(eq(insuranceClaims.id, id));

  await recordAdminAction(c, {
    action: "reject_claim",
    resource: "insurance_claim",
    resourceId: id,
    details: { amount: existing.amount, reason: parsed.data.reason },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 11. DSAR — privacy requests
// ─────────────────────────────────────────────────────────────
adminRouter.get("/dsar", async (c) => {
  const db = c.get("db");
  const status = c.req.query("status");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10) || 100, 500);

  const rows = await db
    .select()
    .from(dsarRequests)
    .where(status ? eq(dsarRequests.status, status as any) : undefined)
    .orderBy(desc(dsarRequests.requestedAt))
    .limit(limit);

  return c.json({ items: rows, total: rows.length });
});

adminRouter.post("/dsar/:id/approve", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const actor = c.get("adminActor");
  const [existing] = await db.select().from(dsarRequests).where(eq(dsarRequests.id, id)).limit(1);
  if (!existing) return c.json({ error: "DSAR request not found" }, 404);

  await db
    .update(dsarRequests)
    .set({
      status: "approved",
      approvedAt: new Date().toISOString(),
      approverUserId: actor?.id ?? null,
    } as any)
    .where(eq(dsarRequests.id, id));

  await recordAdminAction(c, {
    action: "approve_dsar",
    resource: "dsar",
    resourceId: id,
    details: { purpose: existing.purpose, userId: existing.userId },
  });

  return c.json({ ok: true });
});

const dsarCompleteSchema = z.object({ resultUrl: z.string().url().max(2048) });

adminRouter.post("/dsar/:id/complete", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = dsarCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }
  const [existing] = await db.select().from(dsarRequests).where(eq(dsarRequests.id, id)).limit(1);
  if (!existing) return c.json({ error: "DSAR request not found" }, 404);

  const expires = new Date(Date.now() + 14 * 86400_000).toISOString();
  await db
    .update(dsarRequests)
    .set({
      status: "completed",
      completedAt: new Date().toISOString(),
      resultUrl: parsed.data.resultUrl,
      resultExpiresAt: expires,
    } as any)
    .where(eq(dsarRequests.id, id));

  await recordAdminAction(c, {
    action: "complete_dsar",
    resource: "dsar",
    resourceId: id,
    details: { purpose: existing.purpose, resultUrl: parsed.data.resultUrl },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 12. Notifications — broadcast
// ─────────────────────────────────────────────────────────────
const broadcastSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  role: z.enum(["patient", "doctor", "hospital_admin", "hospital_staff", "laboratory", "pharmacy", "insurance", "ambulance", "super_admin"]).optional(),
  audience: z.enum(["all", "active"]).default("all"),
});

adminRouter.post("/notifications/broadcast", async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = broadcastSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const where = and(
    parsed.data.role ? eq(users.role, parsed.data.role) : undefined,
    parsed.data.audience === "active" ? eq(users.status, "active") : undefined,
    ne(users.role, "super_admin" as any), // never broadcast to other admins by default
  );

  const targets = await db
    .select({ id: users.id })
    .from(users)
    .where(where);

  if (targets.length === 0) {
    return c.json({ ok: true, sent: 0 });
  }

  await db.insert(notifications).values(
    targets.map((t) => ({
      id: crypto.randomUUID(),
      userId: t.id,
      type: "general" as const,
      title: parsed.data.title,
      body: parsed.data.body,
      data: JSON.stringify({ broadcast: true }),
      read: 0,
    })),
  );

  await recordAdminAction(c, {
    action: "broadcast_notification",
    resource: "notification",
    resourceId: null,
    details: {
      title: parsed.data.title,
      role: parsed.data.role ?? null,
      audience: parsed.data.audience,
      sent: targets.length,
    },
  });

  return c.json({ ok: true, sent: targets.length });
});

// ─────────────────────────────────────────────────────────────
// 13. Medicines master — admin CRUD proxy
//
// The existing /medicines-master routes already gate writes on
// `requireRole("super_admin")`. We add a thin admin-only listing
// here so the admin UI can paginate the full catalogue with
// server-side filter — the existing endpoint is optimized for
// typeahead search and limits results to 50 by default.
// ─────────────────────────────────────────────────────────────
adminRouter.get("/medicines-master", async (c) => {
  const db = c.get("db");
  const q = c.req.query("q");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10) || 100, 500);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);

  const where = q
    ? or(
        like(medicinesMaster.genericName, `%${q}%`),
        like(medicinesMaster.brandName, `%${q}%`),
      )
    : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(medicinesMaster)
      .where(where)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(medicinesMaster),
  ]);

  return c.json({ items: rows, total: total[0]?.count ?? 0, limit, offset });
});

export default adminRouter;