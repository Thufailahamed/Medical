// @ts-nocheck

import { Hono } from "hono";
import { eq, and, desc, gte, lt, or, like, sql } from "drizzle-orm";
import {
  walkIns,
  doctors,
  patients,
  users,
  hospitals,
  hospitalStaff,
  medicalRecords,
  appointments,
  prescriptions,
  labOrders,
  messagesConversations,
  qrAccessTokens,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { notify } from "../lib/notifications";
import { audit } from "../lib/audit";
import { recordRevenueEvent } from "../lib/revenue";
import { upsertActiveCareTeam } from "../lib/status-guard";
import type { AppEnvironment } from "../types";

const walkInsRouter = new Hono<AppEnvironment>();

// ─── Helpers ─────────────────────────────────────────────
async function getHospitalForUser(db: any, userId: string) {
  const [staff] = await db
    .select()
    .from(hospitalStaff)
    .where(eq(hospitalStaff.userId, userId))
    .limit(1);
  if (staff) {
    return (staff as any).hospitalId;
  }
  // super_admin fallback: pick first hospital
  const [h] = await db.select().from(hospitals).limit(1);
  return (h as any)?.id || null;
}

async function getDoctorByUserId(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d;
}

// ─── List walk-ins ───────────────────────────────────────
// GET /walk-ins?date=YYYY-MM-DD&status=&doctorId=
//   - hospital_admin|staff: see their hospital's walk-ins
//   - doctor: see their own
//   - super_admin: see all (filterable)
//
// P0 audit fix: tightened with `requireRole` so patients (and any
// other authenticated caller without a clinical role) can't list
// walk-in queues. The downstream role-based filter still applies for
// row scoping; this is defense in depth.
walkInsRouter.get(
  "/",
  authMiddleware,
  requireRole("doctor", "hospital_admin", "hospital_staff", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const role = (c.get("dbUser") as any)?.role;
    const db = c.get("db");

    const dateQ = c.req.query("date");
    const statusQ = c.req.query("status");
    const doctorQ = c.req.query("doctorId");

    const filters: any[] = [];
    if (doctorQ) filters.push(eq(walkIns.doctorId, doctorQ));
    if (statusQ) filters.push(eq(walkIns.status, statusQ));
    if (dateQ) {
      filters.push(gte(walkIns.arrivedAt, `${dateQ} 00:00:00`));
      filters.push(lt(walkIns.arrivedAt, `${dateQ} 23:59:59`));
    }

    if (role === "doctor") {
      const doctor = await getDoctorByUserId(db, userId);
      if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
      filters.push(eq(walkIns.doctorId, (doctor as any).id));
    } else if (role === "hospital_admin" || role === "hospital_staff") {
      const hospitalId = await getHospitalForUser(db, userId);
      if (!hospitalId) return c.json({ error: "No hospital found" }, 404);
      filters.push(eq(walkIns.hospitalId, hospitalId));
    }

    const rows = await db
      .select()
      .from(walkIns)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(walkIns.arrivedAt))
      .limit(200);

    // Hydrate patient name + doctor name + hospital name
    const result = await Promise.all(
      rows.map(async (w: any) => {
        const [p] = await db
          .select()
          .from(patients)
          .where(eq(patients.id, w.patientId))
          .limit(1);
        const patientUserId = (p as any)?.patients?.userId ?? (p as any)?.userId;
        let patientName: string | null = null;
        let patientPhone: string | null = null;
        if (patientUserId) {
          const [u] = await db
            .select()
            .from(users)
            .where(eq(users.id, patientUserId))
            .limit(1);
          patientName = (u as any)?.name || null;
          patientPhone = (u as any)?.phone || null;
        }
        const [d] = await db
          .select()
          .from(doctors)
          .where(eq(doctors.id, w.doctorId))
          .limit(1);
        const doctorUserId = (d as any)?.userId;
        let doctorName: string | null = null;
        if (doctorUserId) {
          const [du] = await db
            .select()
            .from(users)
            .where(eq(users.id, doctorUserId))
            .limit(1);
          doctorName = (du as any)?.name || null;
        }
        const [h] = await db
          .select()
          .from(hospitals)
          .where(eq(hospitals.id, w.hospitalId))
          .limit(1);
        return {
          ...w,
          patientName,
          patientPhone,
          doctorName,
          hospitalName: (h as any)?.name || null,
        };
      })
    );

    return c.json({ walkIns: result });
  },
);

// ─── Create walk-in ──────────────────────────────────────
// POST /walk-ins  { patientId, doctorId, reason, priority }
//   - hospital_admin|staff creates for patients walking in
walkInsRouter.post(
  "/",
  authMiddleware,
  requireRole("hospital_admin", "hospital_staff", "doctor"),
  async (c) => {
    const userId = c.get("userId");
    const db = c.get("db");
    const body = await c.req.json().catch(() => ({}));
    const patientId = String(body?.patientId || "");
    const doctorId = String(body?.doctorId || "");
    const reason = body?.reason ? String(body.reason).slice(0, 500) : null;
    const priority =
      body?.priority === "urgent" ? "urgent" : "routine";
    // QR-Code Check-in: optional token from a resolved portal scan.
    // When present, we validate the token, mark the walk-in as
    // `origin: "qr_scan"`, and audit a separate event so the live
    // demo can filter to QR-triggered check-ins via SSE.
    const qrToken = body?.qrToken ? String(body.qrToken).trim() : null;
    let qrTokenTail: string | null = null;
    let qrTokenPurpose: string | null = null;
    if (qrToken) {
      const [tok] = await db
        .select()
        .from(qrAccessTokens)
        .where(eq(qrAccessTokens.token, qrToken))
        .limit(1);
      if (!tok || tok.revokedAt || tok.expiresAt <= new Date().toISOString()) {
        return c.json(
          { error: "invalid_qr_token", reason: "expired_or_revoked" },
          410,
        );
      }
      // QR-derived walk-in: the patient id from the token must
      // match the body. This blocks a stolen patientId from being
      // sneaked into a different patient's QR session.
      if ((tok as any).patientId !== patientId) {
        return c.json(
          { error: "qr_token_patient_mismatch" },
          403,
        );
      }
      qrTokenTail = tok.token.slice(0, 6) + "…" + tok.token.slice(-4);
      qrTokenPurpose = tok.purpose;
    }

    if (!patientId || !doctorId) {
      return c.json({ error: "patientId and doctorId required" }, 400);
    }

    // Phase MTN-1: tenant guard.
    const activeHospitalId = c.get("activeHospitalId") || null;
    const requestHospitalId = body?.hospitalId
      ? String(body.hospitalId)
      : null;
    if (
      activeHospitalId &&
      requestHospitalId &&
      activeHospitalId !== requestHospitalId
    ) {
      return c.json(
        {
          error: "hospitalId does not match active tenant",
          reason: "tenant_mismatch",
        },
        400
      );
    }

    // Validate patient + doctor exist
    const [p] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);
    if (!p) return c.json({ error: "Patient not found" }, 404);
    const [d] = await db
      .select()
      .from(doctors)
      .where(eq(doctors.id, doctorId))
      .limit(1);
    if (!d) return c.json({ error: "Doctor not found" }, 404);
    const hospitalId = (d as any).hospitalId;
    if (!hospitalId) return c.json({ error: "Doctor has no hospital" }, 400);

    const [row] = await db
      .insert(walkIns)
      .values({
        patientId,
        doctorId,
        hospitalId,
        reason,
        priority,
        status: "waiting",
        assignedByUserId: userId,
        origin: qrToken ? "qr_scan" : "manual",
      } as any)
      .returning();

    // Phase 1: backfill care team. Walk-ins to a different doctor
    // than the patient's primary become "covering" role automatically.
    await upsertActiveCareTeam(db, {
      patientId,
      doctorId,
      role: "covering",
      invitedByUserId: userId,
    });

    // Notify doctor
    const doctorUserId = (d as any)?.userId;
    if (doctorUserId) {
      await notify({
        db,
        userId: doctorUserId,
        type: "hospital",
        title: `New walk-in${priority === "urgent" ? " (urgent)" : ""}`,
        body: reason || "Patient waiting for consultation",
        data: {
          walkInId: row?.id,
          patientId,
          priority,
        },
      });
    }

    await audit(db, {
      userId,
      action: "walkin.create",
      resource: "walk_in",
      resourceId: row?.id,
      details: {
        patientId,
        doctorId,
        priority,
        origin: qrToken ? "qr_scan" : "manual",
        ...(qrToken ? { qrTokenTail, qrTokenPurpose } : {}),
      },
    });
    if (qrToken) {
      await audit(db, {
        userId,
        action: "walk_in.created_via_qr",
        resource: "walk_in",
        resourceId: row?.id,
        details: { qrTokenTail, qrTokenPurpose, patientId, doctorId },
      });
    }

    return c.json({ walkIn: row }, 201);
  }
);

// ─── Update walk-in (status, notes) ──────────────────────
// PATCH /walk-ins/:id  { status?, notes? }
//
// P0 audit fix: added `requireRole` so the inline ownership check
// below can rely on the caller being in a clinical role at all.
// Previously a logged-in patient could PATCH another patient's
// walk-in status and only the row-level guard rejected them — better
// to fail fast at the role gate.
walkInsRouter.patch(
  "/:id",
  authMiddleware,
  requireRole("doctor", "hospital_admin", "hospital_staff", "super_admin"),
  async (c) => {
    const userId = c.get("userId");
    const role = (c.get("dbUser") as any)?.role;
    const db = c.get("db");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));

    const [own] = await db
      .select()
      .from(walkIns)
      .where(eq(walkIns.id, id))
      .limit(1);
    if (!own) return c.json({ error: "Not found" }, 404);

    // Permission: doctor (assigned), hospital staff (their hospital), or super_admin.
    let allowed = role === "super_admin";
    if (!allowed && role === "doctor") {
      const d = await getDoctorByUserId(db, userId);
      allowed = !!d && ((d as any).id === own.doctorId || (d as any).doctors?.id === own.doctorId);
    }
    if (!allowed && (role === "hospital_admin" || role === "hospital_staff")) {
      const hospitalId = await getHospitalForUser(db, userId);
      allowed = hospitalId === own.hospitalId;
    }
    if (!allowed) return c.json({ error: "Access denied" }, 403);

    const updates: any = {};
    if (body.status) {
      const allowedStatus = [
        "waiting",
        "in_consultation",
        "completed",
        "no_show",
      ];
      if (!allowedStatus.includes(body.status)) {
        return c.json({ error: "invalid status" }, 400);
      }
      updates.status = body.status;
      if (body.status === "completed" || body.status === "no_show") {
        updates.consultationEndedAt = new Date().toISOString();
      }
    }
    if (typeof body.notes === "string") updates.notes = body.notes.slice(0, 1000);

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "no updates" }, 400);
    }

    const [updated] = await db
      .update(walkIns)
      .set(updates)
      .where(eq(walkIns.id, id))
      .returning();

    // Phase 4: billable event. Recorded when the walk-in flips to
    // `completed`; the unique index on (doctor, source_kind, source_id)
    // makes this safe to retry.
    if (body.status === "completed") {
      await recordRevenueEvent({
        db,
        doctorId: own.doctorId,
        sourceKind: "walkin",
        sourceId: id,
        patientId: own.patientId,
        occurredAt: updates.consultationEndedAt || undefined,
      });
    }

    await audit(db, {
      userId,
      action: "walkin.update",
      resource: "walk_in",
      resourceId: id,
      details: updates,
    });

    return c.json({ walkIn: updated });
  },
);

// ─── Search patients for walk-in registration ────────────
// GET /walk-ins/search?q=...
//
// P0 audit fix: previously this returned arbitrary patients matching
// the LIKE query to ANY caller with role doctor|staff|admin. For
// doctors — who should only see patients they have a relationship
// with — we now scope the LIKE results to the doctor's known patient
// set (same union as /doctor/search-patients). Hospital admin/staff
// keep the unscoped search since they're doing front-desk
// registration.
walkInsRouter.get(
  "/search",
  authMiddleware,
  requireRole(
    "hospital_admin",
    "hospital_staff",
    "doctor",
    "super_admin"
  ),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const role = (c.get("dbUser") as any)?.role;
    const q = (c.req.query("q") || "").trim();
    if (!q || q.length < 2) return c.json({ patients: [] });

    const pat = `%${q.replace(/[%_]/g, "")}%`;

    // Doctor: limit LIKE results to known-patient set.
    if (role === "doctor") {
      const [doctorRow] = await db
        .select({ id: doctors.id })
        .from(doctors)
        .where(eq(doctors.userId, userId))
        .limit(1);
      if (!doctorRow) return c.json({ patients: [] });

      const [a, b, c2, d, e, f] = await Promise.all([
        db
          .selectDistinct({ pid: appointments.patientId })
          .from(appointments)
          .where(eq(appointments.doctorId, doctorRow.id)),
        db
          .selectDistinct({ pid: prescriptions.patientId })
          .from(prescriptions)
          .where(eq(prescriptions.doctorId, doctorRow.id)),
        db
          .selectDistinct({ pid: labOrders.patientId })
          .from(labOrders)
          .where(eq(labOrders.doctorId, doctorRow.id)),
        db
          .selectDistinct({ pid: medicalRecords.patientId })
          .from(medicalRecords)
          .where(eq(medicalRecords.doctorId, doctorRow.id)),
        db
          .selectDistinct({ pid: walkIns.patientId })
          .from(walkIns)
          .where(eq(walkIns.doctorId, doctorRow.id)),
        db
          .selectDistinct({ pid: messagesConversations.patientId })
          .from(messagesConversations)
          .where(eq(messagesConversations.doctorId, doctorRow.id)),
      ]);
      const allowed = new Set<string>();
      for (const r of a) allowed.add((r as any).pid);
      for (const r of b) allowed.add((r as any).pid);
      for (const r of c2) allowed.add((r as any).pid);
      for (const r of d) allowed.add((r as any).pid);
      for (const r of e) allowed.add((r as any).pid);
      for (const r of f) allowed.add((r as any).pid);
      if (allowed.size === 0) return c.json({ patients: [] });

      const rows = await db
        .select({
          pid: patients.id,
          pname: users.name,
          pphone: users.phone,
          pnic: users.nic,
        })
        .from(patients)
        .innerJoin(users, eq(users.id, patients.userId))
        .where(
          and(
            or(
              like(users.name, pat),
              like(users.nic, pat),
              like(users.phone, pat)
            ),
            sql`${patients.id} IN (${sql.join(
              Array.from(allowed).map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        )
        .limit(20);
      return c.json({ patients: rows });
    }

    // Hospital admin / staff / super_admin: open search.
    const rows = await db
      .select()
      .from(patients)
      .innerJoin(users, eq(users.id, patients.userId))
      .where(
        or(
          like(users.name, pat),
          like(users.nic, pat),
          like(users.phone, pat)
        )
      )
      .limit(20);
    return c.json({
      patients: rows.map((r: any) => ({
        id: r.patients?.id ?? r.patients.id,
        name: r.users?.name ?? r.users.name,
        phone: r.users?.phone ?? r.users.phone,
        nic: r.users?.nic ?? r.users.nic,
      })),
    });
  }
);

export default walkInsRouter;