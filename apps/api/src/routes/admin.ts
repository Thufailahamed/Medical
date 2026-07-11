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
//  14. Settings       — runtime config (Phase ADM-2)
//  15. Notes          — admin notes on user records (Phase ADM-2)
//
// All write actions call `recordAdminAction` which appends a row to
// `audit_logs` with `action="admin.<verb>"`, the actor + IP.

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, gte, isNull, like, lte, ne, or, sql } from "drizzle-orm";
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
  systemSettings,
  userAdminNotes,
  doctorVerificationDocs,
} from "@healthcare/db";
import { requireAdmin, recordAdminAction } from "../middleware/admin";
import { requirePasskeyFresh } from "../middleware/stepup";
import { anonymisePatient } from "../lib/dsar";
import { flattenTranslated } from "../lib/validation-error";
import { coerceSettingValue, getSetting, invalidateSetting } from "../lib/settings";
import { notify } from "../lib/notifications";
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
    waitlistTotal,
    broadcastsSent,
    broadcastsLast7d,
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
      .where(
        or(
          eq(dsarRequests.status, "queued"),
          eq(dsarRequests.status, "approved"),
          eq(dsarRequests.status, "processing"),
        ),
      ),
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
    db
      .select({ count: sql<number>`count(*)` })
      .from(marketingWaitlist),
    // Broadcasts = notifications authored by an admin. Broadcasts are
    // written with `type:"general"` + `data: JSON({broadcast:true})`
    // (see /admin/notifications/broadcast). Count them by the data
    // marker rather than introducing a new enum value.
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(like(notifications.data, '%"broadcast":true%')),
    db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          like(notifications.data, '%"broadcast":true%'),
          gte(notifications.createdAt, new Date(Date.now() - 7 * 86400_000).toISOString()),
        ),
      ),
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
    marketing: {
      waitlistTotal: Number(waitlistTotal[0]?.count ?? 0),
      broadcastsSent: Number(broadcastsSent[0]?.count ?? 0),
      broadcastsLast7d: Number(broadcastsLast7d[0]?.count ?? 0),
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

adminRouter.post("/approvals/:userId/approve", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/approvals/:userId/reject", requirePasskeyFresh, async (c) => {
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

adminRouter.patch("/users/:id", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/users/:id/suspend", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/users/:id/unsuspend", requirePasskeyFresh, async (c) => {
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

adminRouter.delete("/users/:id", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/doctors/:id/verify-slmc", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/doctors/:id/revoke-slmc", requirePasskeyFresh, async (c) => {
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

// Single-tenant detail. Phase C.14 closes the stub hospital/clinic rows
// by making them drill-in-able. Dispatches + related users are joined
// inline so the detail page is one round-trip.
adminRouter.get("/tenants/:type/:id", async (c) => {
  const db = c.get("db");
  const type = c.req.param("type");
  const id = c.req.param("id");

  if (type === "hospital") {
    const [row] = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        license: hospitals.license,
        address: hospitals.address,
        phone: hospitals.phone,
        rating: hospitals.rating,
        createdAt: hospitals.createdAt,
        ownerUserId: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerStatus: users.status,
        ownerLastLoginAt: users.lastLoginAt,
      })
      .from(hospitals)
      .innerJoin(users, eq(hospitals.userId, users.id))
      .where(eq(hospitals.id, id))
      .limit(1);
    if (!row) return c.json({ error: "Hospital not found" }, 404);
    return c.json({ type, tenant: row });
  }

  if (type === "clinic") {
    const [row] = await db
      .select({
        id: clinics.id,
        name: clinics.name,
        license: clinics.license,
        address: clinics.address,
        phone: clinics.phone,
        shortCode: clinics.shortCode,
        rating: clinics.rating,
        createdAt: clinics.createdAt,
        ownerUserId: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerStatus: users.status,
        ownerLastLoginAt: users.lastLoginAt,
      })
      .from(clinics)
      .innerJoin(users, eq(clinics.userId, users.id))
      .where(eq(clinics.id, id))
      .limit(1);
    if (!row) return c.json({ error: "Clinic not found" }, 404);
    return c.json({ type, tenant: row });
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

adminRouter.post("/demo-requests/:id/respond", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/payouts/:id/mark-paid", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/payouts/:id/mark-failed", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/insurance-claims/:id/approve", requirePasskeyFresh, async (c) => {
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

adminRouter.post("/insurance-claims/:id/reject", requirePasskeyFresh, async (c) => {
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

  await notifyDsarStateChange(c, existing, "approved");

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

  // Erasure is the one purpose that side-effects data on completion —
  // for everything else, the operator is just stamping a result URL.
  // We only run anonymisation when the request was approved; this
  // avoids a re-run on operator retries.
  if (existing.purpose === "erasure") {
    try {
      await anonymisePatient(db, existing.userId);
    } catch (err) {
      return c.json(
        { error: "erasure_failed", reason: (err as Error).message },
        500,
      );
    }
  }

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

  await notifyDsarStateChange(c, existing, "completed", {
    resultUrl: parsed.data.resultUrl,
    resultExpiresAt: expires,
  });

  return c.json({ ok: true });
});

const dsarRejectSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

adminRouter.post("/dsar/:id/reject", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = dsarRejectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const [existing] = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "DSAR request not found" }, 404);

  if (existing.status === "completed" || existing.status === "failed") {
    return c.json({ error: "Cannot reject a finalized DSAR request" }, 409);
  }

  await db
    .update(dsarRequests)
    .set({
      status: "failed",
      completedAt: new Date().toISOString(),
      notes: parsed.data.reason,
    } as any)
    .where(eq(dsarRequests.id, id));

  await recordAdminAction(c, {
    action: "reject_dsar",
    resource: "dsar",
    resourceId: id,
    details: { reason: parsed.data.reason, purpose: existing.purpose },
  });

  await notifyDsarStateChange(c, existing, "failed", {
    reason: parsed.data.reason,
  });

  return c.json({ ok: true });
});

adminRouter.post("/dsar/:id/requeue", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [existing] = await db
    .select()
    .from(dsarRequests)
    .where(eq(dsarRequests.id, id))
    .limit(1);
  if (!existing) return c.json({ error: "DSAR request not found" }, 404);

  if (existing.status !== "failed") {
    return c.json({ error: "Only failed requests can be requeued" }, 409);
  }

  await db
    .update(dsarRequests)
    .set({
      status: "queued",
      notes: null,
      completedAt: null,
    } as any)
    .where(eq(dsarRequests.id, id));

  await recordAdminAction(c, {
    action: "requeue_dsar",
    resource: "dsar",
    resourceId: id,
    details: { purpose: existing.purpose },
  });

  return c.json({ ok: true });
});

/**
 * Best-effort notification when a DSAR request changes state. Only
 * `approved`, `completed`, and `failed` notify the requester — the
 * queued/processing transitions are silent because they're noisy.
 *
 * Errors are swallowed: a notification failure must never block the
 * underlying admin action from completing.
 */
async function notifyDsarStateChange(
  c: Context<AppEnvironment>,
  dsar: { id: string; userId: string; purpose: string | null },
  newStatus: "approved" | "completed" | "failed",
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = c.get("db");
    if (!dsar.userId) return;
    const titleMap = {
      approved: "Your data request has been approved",
      completed: "Your data export is ready",
      failed: "Your data request was rejected",
    } as const;
    const bodyMap = {
      approved: "We are preparing your export — you'll get a notification when it's ready.",
      completed: "Tap to download. The link expires in 14 days.",
      failed: "Please contact support if you think this was a mistake.",
    } as const;
    await notify({
      db,
      userId: dsar.userId,
      type: "general",
      title: titleMap[newStatus],
      body: bodyMap[newStatus],
      data: { dsarId: dsar.id, status: newStatus, ...extra },
    });
  } catch (err) {
    console.error("notifyDsarStateChange failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// 11b. Multi-admin (Phase ADM-4) — promote / demote / suspend
//      super_admin accounts. Re-uses the `users` table; no schema
//      changes. All destructive mutations require a fresh step-up
//      token (requirePasskeyFresh).
// ─────────────────────────────────────────────────────────────

adminRouter.get("/admins", async (c) => {
  const db = c.get("db");
  const admins = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "super_admin"))
    .orderBy(asc(users.name));

  // Add audit activity count for last 30d.
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const rows = await Promise.all(
    admins.map(async (a) => {
      const countRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.userId, a.id),
            gte(auditLogs.createdAt, since),
            like(auditLogs.action, "admin.%"),
          ),
        );
      const count = countRes?.[0]?.count ?? 0;
      return { ...a, auditCountLast30d: Number(count) };
    }),
  );

  return c.json({ items: rows, total: rows.length });
});

const adminPromoteSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

adminRouter.post("/admins/promote", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = adminPromoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);
  if (!target) return c.json({ error: "User not found" }, 404);

  if (target.role === "super_admin") {
    return c.json({ error: "User is already a super_admin" }, 409);
  }

  const previousRole = target.role;
  await db
    .update(users)
    .set({ role: "super_admin", status: "active" } as any)
    .where(eq(users.id, parsed.data.userId));

  await recordAdminAction(c, {
    action: "promote_admin",
    resource: "user",
    resourceId: parsed.data.userId,
    details: {
      previousRole,
      reason: parsed.data.reason,
    },
  });

  return c.json({ ok: true, userId: parsed.data.userId, role: "super_admin" });
});

const adminDemoteSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

adminRouter.post("/admins/demote", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const actor = c.get("adminActor");
  const body = await c.req.json().catch(() => ({}));
  const parsed = adminDemoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  if (parsed.data.userId === actor?.id) {
    return c.json({ error: "You cannot demote yourself" }, 400);
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);
  if (!target) return c.json({ error: "User not found" }, 404);

  if (target.role !== "super_admin") {
    return c.json({ error: "User is not a super_admin" }, 409);
  }

  // Last-admin guard: count remaining active super_admins after this
  // demotion. If 0, block. Excludes the target from the count.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        eq(users.role, "super_admin"),
        ne(users.id, parsed.data.userId),
        or(eq(users.status, "active"), isNull(users.status)),
      ),
    );
  if (Number(count) === 0) {
    return c.json({ error: "Cannot demote the last active super_admin" }, 409);
  }

  const previousRole = target.role;
  await db
    .update(users)
    .set({ role: "patient" } as any)
    .where(eq(users.id, parsed.data.userId));

  await recordAdminAction(c, {
    action: "demote_admin",
    resource: "user",
    resourceId: parsed.data.userId,
    details: {
      previousRole,
      reason: parsed.data.reason,
    },
  });

  return c.json({ ok: true, userId: parsed.data.userId, role: "patient" });
});

const adminSuspendSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
});

adminRouter.post("/admins/suspend", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const actor = c.get("adminActor");
  const body = await c.req.json().catch(() => ({}));
  const parsed = adminSuspendSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  if (parsed.data.userId === actor?.id) {
    return c.json({ error: "You cannot suspend yourself" }, 400);
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, parsed.data.userId))
    .limit(1);
  if (!target) return c.json({ error: "User not found" }, 404);

  if (target.role !== "super_admin") {
    return c.json({ error: "User is not a super_admin" }, 409);
  }

  // Last-admin guard.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        eq(users.role, "super_admin"),
        ne(users.id, parsed.data.userId),
        or(eq(users.status, "active"), isNull(users.status)),
      ),
    );
  if (Number(count) === 0) {
    return c.json({ error: "Cannot suspend the last active super_admin" }, 409);
  }

  await db
    .update(users)
    .set({ status: "suspended" } as any)
    .where(eq(users.id, parsed.data.userId));

  await recordAdminAction(c, {
    action: "suspend_admin",
    resource: "user",
    resourceId: parsed.data.userId,
    details: { reason: parsed.data.reason },
  });

  return c.json({ ok: true });
});

adminRouter.post("/admins/unsuspend", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const userId = (body as any)?.userId;
  if (!userId) return c.json({ error: "userId required" }, 400);

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return c.json({ error: "User not found" }, 404);
  if (target.role !== "super_admin") {
    return c.json({ error: "User is not a super_admin" }, 409);
  }

  await db
    .update(users)
    .set({ status: "active" } as any)
    .where(eq(users.id, userId));

  await recordAdminAction(c, {
    action: "unsuspend_admin",
    resource: "user",
    resourceId: userId,
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
    db.select({ count: sql<number>`count(*)` }).from(medicinesMaster).where(where),
  ]);

  return c.json({ items: rows, total: total[0]?.count ?? 0, limit, offset });
});

const medicineSchema = z.object({
  genericName: z.string().min(1).max(200),
  brandName: z.string().max(200).optional().nullable(),
  strength: z.string().max(80).optional().nullable(),
  scheduleClass: z.string().max(80).optional().nullable(),
  isGeneric: z.boolean().optional(),
  active: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

adminRouter.post("/medicines-master", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const parsed = medicineSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed" }, 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(medicinesMaster).values({
    id,
    genericName: parsed.data.genericName,
    brandName: parsed.data.brandName ?? null,
    strength: parsed.data.strength ?? null,
    scheduleClass: parsed.data.scheduleClass ?? null,
    isGeneric: parsed.data.isGeneric ?? true,
    active: parsed.data.active ?? true,
    notes: parsed.data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });
  await recordAdminAction(c, {
    action: "medicines_master.create",
    resource: "medicine",
    resourceId: id,
    details: { genericName: parsed.data.genericName },
  });
  return c.json({ ok: true, id });
});

adminRouter.patch("/medicines-master/:id", requirePasskeyFresh, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = medicineSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed" }, 400);
  }
  const now = new Date().toISOString();
  await db
    .update(medicinesMaster)
    .set({
      ...(parsed.data.genericName !== undefined ? { genericName: parsed.data.genericName } : {}),
      ...(parsed.data.brandName !== undefined ? { brandName: parsed.data.brandName } : {}),
      ...(parsed.data.strength !== undefined ? { strength: parsed.data.strength } : {}),
      ...(parsed.data.scheduleClass !== undefined ? { scheduleClass: parsed.data.scheduleClass } : {}),
      ...(parsed.data.isGeneric !== undefined ? { isGeneric: parsed.data.isGeneric } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      updatedAt: now,
    })
    .where(eq(medicinesMaster.id, id));
  await recordAdminAction(c, {
    action: "medicines_master.update",
    resource: "medicine",
    resourceId: id,
  });
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 14. Settings — runtime config (Phase ADM-2)
// ─────────────────────────────────────────────────────────────

function decodeSettingValue(raw: string, type: string): unknown {
  switch (type) {
    case "boolean":
      return raw === "true";
    case "number":
      return Number(raw);
    case "string":
    case "json":
    default:
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
  }
}

adminRouter.get("/settings", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(systemSettings)
    .orderBy(asc(systemSettings.category), asc(systemSettings.key));

  const items = rows.map((r: any) => ({
    key: r.key,
    value: decodeSettingValue(r.value, r.valueType),
    rawValue: r.value,
    valueType: r.valueType,
    category: r.category,
    description: r.description,
    isSensitive: !!r.isSensitive,
    updatedAt: r.updatedAt,
    updatedByUserId: r.updatedByUserId,
  }));

  // Group by category for the UI.
  const grouped: Record<string, typeof items> = {};
  for (const it of items) {
    (grouped[it.category] ??= []).push(it);
  }
  return c.json({ items, grouped });
});

adminRouter.get("/settings/:key", async (c) => {
  const db = c.get("db");
  const key = c.req.param("key");
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  if (!row) return c.json({ error: "Setting not found" }, 404);
  return c.json({
    key: row.key,
    value: decodeSettingValue(row.value, row.valueType as string),
    rawValue: row.value,
    valueType: row.valueType,
    category: row.category,
    description: row.description,
    isSensitive: !!(row as any).isSensitive,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  });
});

const patchSettingSchema = z.object({
  value: z.unknown(),
  confirm: z.boolean().optional(),
});

adminRouter.patch("/settings/:key", async (c) => {
  const db = c.get("db");
  const key = c.req.param("key");
  const body = await c.req.json().catch(() => ({}));
  const parsed = patchSettingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  if (!existing) return c.json({ error: "Setting not found" }, 404);

  if ((existing as any).isSensitive && parsed.data.confirm !== true) {
    return c.json({ error: "Sensitive setting requires { confirm: true }" }, 400);
  }

  const coerced = coerceSettingValue(parsed.data.value, existing.valueType as any);
  if (!coerced.ok) {
    return c.json({ error: coerced.error }, 400);
  }

  const actor = c.get("adminActor");
  const now = new Date().toISOString();
  await db
    .update(systemSettings)
    .set({
      value: coerced.encoded,
      updatedAt: now,
      updatedByUserId: actor?.id ?? null,
    } as any)
    .where(eq(systemSettings.key, key));

  invalidateSetting(db, key);

  await recordAdminAction(c, {
    action: "update_setting",
    resource: "setting",
    resourceId: key,
    details: {
      before: decodeSettingValue(existing.value, existing.valueType as string),
      after: parsed.data.value,
      valueType: existing.valueType,
    },
  });

  return c.json({
    ok: true,
    key,
    value: decodeSettingValue(coerced.encoded, existing.valueType as string),
  });
});

// ─────────────────────────────────────────────────────────────
// 15. Notes — admin notes on user records (Phase ADM-2)
// ─────────────────────────────────────────────────────────────

adminRouter.get("/users/:id/notes", async (c) => {
  const db = c.get("db");
  const userId = c.req.param("id");

  // Verify user exists (404 is more useful than an empty list).
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return c.json({ error: "User not found" }, 404);

  // Join with admin author name.
  const rows = await db
    .select({
      id: userAdminNotes.id,
      userId: userAdminNotes.userId,
      adminUserId: userAdminNotes.adminUserId,
      body: userAdminNotes.body,
      createdAt: userAdminNotes.createdAt,
      updatedAt: userAdminNotes.updatedAt,
      deletedAt: userAdminNotes.deletedAt,
      adminName: users.name,
    })
    .from(userAdminNotes)
    .innerJoin(users, eq(users.id, userAdminNotes.adminUserId))
    .where(and(eq(userAdminNotes.userId, userId), isNull(userAdminNotes.deletedAt)))
    .orderBy(desc(userAdminNotes.createdAt));

  return c.json({ items: rows });
});

const createNoteSchema = z.object({
  body: z.string().min(1).max(2000),
});

adminRouter.post("/users/:id/notes", async (c) => {
  const db = c.get("db");
  const userId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return c.json({ error: "User not found" }, 404);

  const actor = c.get("adminActor");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(userAdminNotes).values({
    id,
    userId,
    adminUserId: actor?.id,
    body: parsed.data.body,
    createdAt: now,
  } as any);

  await recordAdminAction(c, {
    action: "create_note",
    resource: "user",
    resourceId: userId,
    details: { noteId: id, preview: parsed.data.body.slice(0, 100) },
  });

  return c.json({ ok: true, id });
});

const editNoteSchema = z.object({
  body: z.string().min(1).max(2000),
});

adminRouter.patch("/notes/:noteId", async (c) => {
  const db = c.get("db");
  const noteId = c.req.param("noteId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = editNoteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [existing] = await db
    .select()
    .from(userAdminNotes)
    .where(eq(userAdminNotes.id, noteId))
    .limit(1);
  if (!existing) return c.json({ error: "Note not found" }, 404);
  if (existing.deletedAt) return c.json({ error: "Note was deleted" }, 410);

  const actor = c.get("adminActor");
  // Author or any super_admin can edit. Both already pass
  // requireAdmin, so the only restriction is author-identity.
  if (existing.adminUserId !== actor?.id) {
    return c.json({ error: "Only the author can edit this note" }, 403);
  }

  const now = new Date().toISOString();
  await db
    .update(userAdminNotes)
    .set({ body: parsed.data.body, updatedAt: now } as any)
    .where(eq(userAdminNotes.id, noteId));

  await recordAdminAction(c, {
    action: "edit_note",
    resource: "user",
    resourceId: existing.userId,
    details: { noteId, preview: parsed.data.body.slice(0, 100) },
  });

  return c.json({ ok: true });
});

adminRouter.delete("/notes/:noteId", async (c) => {
  const db = c.get("db");
  const noteId = c.req.param("noteId");
  const [existing] = await db
    .select()
    .from(userAdminNotes)
    .where(eq(userAdminNotes.id, noteId))
    .limit(1);
  if (!existing) return c.json({ error: "Note not found" }, 404);
  if (existing.deletedAt) return c.json({ ok: true, alreadyDeleted: true });

  const actor = c.get("adminActor");
  if (existing.adminUserId !== actor?.id) {
    return c.json({ error: "Only the author can delete this note" }, 403);
  }

  const now = new Date().toISOString();
  await db
    .update(userAdminNotes)
    .set({ deletedAt: now } as any)
    .where(eq(userAdminNotes.id, noteId));

  await recordAdminAction(c, {
    action: "delete_note",
    resource: "user",
    resourceId: existing.userId,
    details: { noteId },
  });

  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────
// 16. SLMC verification docs (Phase ADM-3)
// ─────────────────────────────────────────────────────────────

const ALLOWED_DOC_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

adminRouter.post("/doctors/:id/docs", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [doc] = await db.select().from(doctors).where(eq(doctors.id, id)).limit(1);
  if (!doc) return c.json({ error: "Doctor not found" }, 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return c.json({ error: "Expected multipart/form-data" }, 400);

  const file = formData.get("file") as File | null;
  const kind = (formData.get("kind") as string | null) ?? "slmc_certificate";
  if (!file) return c.json({ error: "file is required" }, 400);
  if (!ALLOWED_DOC_MIME.has(file.type)) {
    return c.json({ error: `Unsupported MIME ${file.type}. Allowed: PDF, PNG, JPEG, WebP` }, 400);
  }
  if (!["slmc_certificate", "medical_license", "other"].includes(kind)) {
    return c.json({ error: "Invalid kind" }, 400);
  }

  const maxMb = await getSetting<number>(db, "uploads.maxFileSizeMb", 25);
  if (file.size > maxMb * 1024 * 1024) {
    return c.json({ error: `File exceeds ${maxMb}MB cap` }, 400);
  }

  const docId = crypto.randomUUID();
  const ext = file.name.split(".").pop() || "bin";
  const r2Key = `admin/slmc/${id}/${docId}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  try {
    await c.env.R2.put(r2Key, arrayBuffer, { httpMetadata: { contentType: file.type } });
  } catch (err: any) {
    return c.json({ error: `R2 upload failed: ${err.message}` }, 500);
  }

  const actor = c.get("adminActor");
  const now = new Date().toISOString();
  await db.insert(doctorVerificationDocs).values({
    id: docId,
    doctorId: id,
    uploadedByUserId: actor?.id,
    kind: kind as any,
    r2Key,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    createdAt: now,
  } as any);

  await recordAdminAction(c, {
    action: "upload_slmc_doc",
    resource: "doctor",
    resourceId: id,
    details: { docId, kind, fileName: file.name, fileSize: file.size },
  });

  return c.json({ ok: true, id: docId });
});

adminRouter.get("/doctors/:id/docs", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [doc] = await db.select({ id: doctors.id }).from(doctors).where(eq(doctors.id, id)).limit(1);
  if (!doc) return c.json({ error: "Doctor not found" }, 404);

  const uploader = { id: users.id, name: users.name };
  const decider = { id: users.id, name: users.name };

  const rows = await db
    .select({
      id: doctorVerificationDocs.id,
      doctorId: doctorVerificationDocs.doctorId,
      kind: doctorVerificationDocs.kind,
      r2Key: doctorVerificationDocs.r2Key,
      fileName: doctorVerificationDocs.fileName,
      mimeType: doctorVerificationDocs.mimeType,
      fileSize: doctorVerificationDocs.fileSize,
      decision: doctorVerificationDocs.decision,
      decisionNote: doctorVerificationDocs.decisionNote,
      decidedAt: doctorVerificationDocs.decidedAt,
      createdAt: doctorVerificationDocs.createdAt,
      uploadedById: doctorVerificationDocs.uploadedByUserId,
      decidedById: doctorVerificationDocs.decidedByUserId,
    })
    .from(doctorVerificationDocs)
    .where(eq(doctorVerificationDocs.doctorId, id))
    .orderBy(desc(doctorVerificationDocs.createdAt));

  // Hydrate names in a separate pass to keep the join simple.
  const userIds = Array.from(
    new Set(
      rows.flatMap((r: any) => [r.uploadedById, r.decidedById].filter(Boolean) as string[]),
    ),
  );
  const userRows = userIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users)
    : [];
  const nameById = new Map(userRows.map((u: any) => [u.id, u.name]));

  return c.json({
    items: rows.map((r: any) => ({
      ...r,
      uploadedByName: nameById.get(r.uploadedById) ?? null,
      decidedByName: nameById.get(r.decidedById) ?? null,
    })),
  });
});

adminRouter.get("/doctors/:id/docs/:docId/download", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const docId = c.req.param("docId");

  const [row] = await db
    .select()
    .from(doctorVerificationDocs)
    .where(and(eq(doctorVerificationDocs.id, docId), eq(doctorVerificationDocs.doctorId, id)))
    .limit(1);
  if (!row) return c.json({ error: "Document not found" }, 404);

  // R2 presigned URL with 5-min expiry.
  const url = await c.env.R2.createPresignedUrl(row.r2Key, { expiresIn: 300 });

  await recordAdminAction(c, {
    action: "download_slmc_doc",
    resource: "doctor",
    resourceId: id,
    details: { docId, fileName: row.fileName },
  });

  return c.redirect(url, 302);
});

adminRouter.post("/doctors/:id/docs/:docId/approve", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const docId = c.req.param("docId");

  const [row] = await db
    .select()
    .from(doctorVerificationDocs)
    .where(and(eq(doctorVerificationDocs.id, docId), eq(doctorVerificationDocs.doctorId, id)))
    .limit(1);
  if (!row) return c.json({ error: "Document not found" }, 404);
  if ((row as any).decision !== "pending") {
    return c.json({ error: `Document already ${(row as any).decision}` }, 409);
  }

  const actor = c.get("adminActor");
  const now = new Date().toISOString();
  await db
    .update(doctorVerificationDocs)
    .set({
      decision: "approved",
      decidedAt: now,
      decidedByUserId: actor?.id ?? null,
    } as any)
    .where(eq(doctorVerificationDocs.id, docId));

  // If the approved doc is an SLMC certificate, flip the doctor row.
  if ((row as any).kind === "slmc_certificate") {
    await db
      .update(doctors)
      .set({ slmcVerifiedAt: now } as any)
      .where(eq(doctors.id, id));
  }

  await recordAdminAction(c, {
    action: "approve_slmc_doc",
    resource: "doctor",
    resourceId: id,
    details: { docId, kind: (row as any).kind, fileName: row.fileName },
  });

  return c.json({ ok: true });
});

const rejectDocSchema = z.object({ note: z.string().min(1).max(500) });

adminRouter.post("/doctors/:id/docs/:docId/reject", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const docId = c.req.param("docId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = rejectDocSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) }, 400);
  }

  const [row] = await db
    .select()
    .from(doctorVerificationDocs)
    .where(and(eq(doctorVerificationDocs.id, docId), eq(doctorVerificationDocs.doctorId, id)))
    .limit(1);
  if (!row) return c.json({ error: "Document not found" }, 404);
  if ((row as any).decision !== "pending") {
    return c.json({ error: `Document already ${(row as any).decision}` }, 409);
  }

  const actor = c.get("adminActor");
  const now = new Date().toISOString();
  await db
    .update(doctorVerificationDocs)
    .set({
      decision: "rejected",
      decisionNote: parsed.data.note,
      decidedAt: now,
      decidedByUserId: actor?.id ?? null,
    } as any)
    .where(eq(doctorVerificationDocs.id, docId));

  await recordAdminAction(c, {
    action: "reject_slmc_doc",
    resource: "doctor",
    resourceId: id,
    details: { docId, kind: (row as any).kind, fileName: row.fileName, note: parsed.data.note },
  });

  return c.json({ ok: true });
});

export default adminRouter;