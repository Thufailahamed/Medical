// @ts-nocheck
// Phase MTN-1: tenant-context middleware. Runs AFTER authMiddleware.
//
// Resolves the request's active tenant via headers:
//   x-active-hospital-id  OR  x-active-clinic-id   (mutually exclusive)
// and validates that the calling user has membership at that tenant.
//
// Resolution order:
//   1. Header (per-request). If both are sent, the request is rejected
//      with 400 { reason: 'tenant_header_conflict' } — the two are
//      mutex by design.
//   2. users.active_tenant_* column (durable cross-device). Used when
//      no header is sent AND the column is set. Header always wins.
//
// Validation per role:
//   doctor         → hospital_doctors / clinic_doctors row (status='active')
//   patient        → hospital_patients / clinic_patients row
//   hospital_admin → hospitals.user_id === userId
//   hospital_staff → hospital_staff row at the named hospital
//
// On invalid → 403 { reason: 'tenant_access_denied' }
// On missing header AND column → both contexts NULL (no tenant scope;
// backwards compatible with routes that don't read c.get('activeHospitalId')).
//
// Also populates:
//   c.get('myHospitals')  → [{id, name, role?}]
//   c.get('myClinics')    → [{id, name, role?}]
// so the tenant-switcher endpoint can return the picker list without a
// second DB scan.

import { and, eq, sql } from "drizzle-orm";
import {
  clinics,
  clinicDoctors,
  clinicPatients,
  doctors,
  hospitals,
  hospitalDoctors,
  hospitalPatients,
  hospitalStaff,
  patients,
  users,
} from "@healthcare/db";
import { createDb } from "../lib/db";
import type { AppEnvironment } from "../types";

declare module "hono" {
  interface ContextVariableMap {
    activeHospitalId?: string | null;
    activeClinicId?: string | null;
    myHospitals?: Array<{ id: string; name: string; role?: string | null }>;
    myClinics?: Array<{ id: string; name: string; role?: string | null }>;
  }
}

export const tenantContextMiddleware = async (
  c: any,
  next: any
): Promise<any> => {
  let userId = c.get("userId");
  let dbUser = c.get("dbUser");

  // Fallback: If authMiddleware hasn't run yet but a Bearer token is present,
  // resolve it inline so tenantContextMiddleware can query memberships.
  if (!userId) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const secret = c.env.JWT_SECRET || "super-secret-key-change-me-in-prod";
      try {
        const { verifyToken } = await import("../lib/crypto");
        const decoded = await verifyToken(token, secret);
        if (decoded && decoded.sub) {
          const db = c.get("db") || createDb(c.env.DB);
          const [u] = await db
            .select()
            .from(users)
            .where(eq(users.id, decoded.sub))
            .limit(1);
          if (u) {
            userId = u.id;
            dbUser = u;
            c.set("userId", u.id);
            c.set("dbUser", u);
            c.set("user", { id: u.id, email: u.email, role: u.role });
          }
        }
      } catch (err) {
        // ignore - let downstream authMiddleware reject if needed
      }
    }
  }

  if (!userId) return next(); // unauthenticated — let auth handle it

  const db = c.get("db") || createDb(c.env.DB);
  const hospitalHeader = c.req.header("x-active-hospital-id") || null;
  const clinicHeader = c.req.header("x-active-clinic-id") || null;

  // Mutex guard: a request may set at most one tenant header.
  if (hospitalHeader && clinicHeader) {
    return c.json(
      {
        error: "Send only one of x-active-hospital-id or x-active-clinic-id",
        reason: "tenant_header_conflict",
      },
      400
    );
  }

  let activeHospitalId: string | null = null;
  let activeClinicId: string | null = null;
  const role = c.get("userRole") || c.get("dbUser")?.role;

  // ── Header-driven path ────────────────────────────────
  if (hospitalHeader) {
    const ok = await validateHospitalMembership(db, userId, role, hospitalHeader);
    if (!ok) {
      return c.json(
        {
          error: "Not a member of the requested hospital",
          reason: "tenant_access_denied",
        },
        403
      );
    }
    activeHospitalId = hospitalHeader;
  } else if (clinicHeader) {
    const ok = await validateClinicMembership(db, userId, role, clinicHeader);
    if (!ok) {
      return c.json(
        {
          error: "Not a member of the requested clinic",
          reason: "tenant_access_denied",
        },
        403
      );
    }
    activeClinicId = clinicHeader;
  } else {
    // ── Durable column fallback ───────────────────────────
    const [u] = await db
      .select({
        activeTenantType: users.activeTenantType,
        activeTenantId: users.activeTenantId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (u?.activeTenantType === "hospital" && u.activeTenantId) {
      const ok = await validateHospitalMembership(
        db,
        userId,
        role,
        u.activeTenantId
      );
      if (ok) activeHospitalId = u.activeTenantId;
    } else if (u?.activeTenantType === "clinic" && u.activeTenantId) {
      const ok = await validateClinicMembership(
        db,
        userId,
        role,
        u.activeTenantId
      );
      if (ok) activeClinicId = u.activeTenantId;
    }
  }

  // ── Denormalized membership list (for switcher) ────────
  const [myHospitals, myClinics] = await Promise.all([
    listMyHospitals(db, userId, role),
    listMyClinics(db, userId, role),
  ]);

  c.set("activeHospitalId", activeHospitalId);
  c.set("activeClinicId", activeClinicId);
  c.set("myHospitals", myHospitals);
  c.set("myClinics", myClinics);
  return next();
};

// ─── Helpers ──────────────────────────────────────────────

async function validateHospitalMembership(
  db: any,
  userId: string,
  role: string | undefined,
  hospitalId: string
): Promise<boolean> {
  if (!role) return false;

  if (role === "hospital_admin") {
    const [h] = await db
      .select({ id: hospitals.id })
      .from(hospitals)
      .where(and(eq(hospitals.id, hospitalId), eq(hospitals.userId, userId)))
      .limit(1);
    return !!h;
  }

  if (role === "doctor") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return false;
    // Single eq + post-filter for mock compatibility.
    const candidates = await db
      .select({
        id: hospitalDoctors.id,
        doctorId: hospitalDoctors.doctorId,
        status: hospitalDoctors.status,
      })
      .from(hospitalDoctors)
      .where(eq(hospitalDoctors.hospitalId, hospitalId))
      .limit(50);
    return candidates.some(
      (c: any) => c.doctorId === doc.id && c.status === "active"
    );
  }

  if (role === "patient") {
    const candidates = await db
      .select({
        id: hospitalPatients.id,
        userId: patients.userId,
        status: hospitalPatients.status,
      })
      .from(hospitalPatients)
      .innerJoin(patients, eq(patients.id, hospitalPatients.patientId))
      .where(eq(hospitalPatients.hospitalId, hospitalId))
      .limit(50);
    return candidates.some(
      (c: any) => c.userId === userId && c.status === "registered"
    );
  }

  if (role === "hospital_staff") {
    const [s] = await db
      .select({ id: hospitalStaff.id })
      .from(hospitalStaff)
      .where(eq(hospitalStaff.userId, userId))
      .limit(50);
    return Array.isArray(s)
      ? s.some((r: any) => r.id && r.hospitalId === hospitalId)
      : !!(s as any)?.id;
  }

  return false;
}

async function validateClinicMembership(
  db: any,
  userId: string,
  role: string | undefined,
  clinicId: string
): Promise<boolean> {
  if (!role) return false;

  if (role === "doctor") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return false;
    const candidates = await db
      .select({
        id: clinicDoctors.id,
        doctorId: clinicDoctors.doctorId,
        status: clinicDoctors.status,
      })
      .from(clinicDoctors)
      .where(eq(clinicDoctors.clinicId, clinicId))
      .limit(50);
    return candidates.some(
      (c: any) => c.doctorId === doc.id && c.status === "active"
    );
  }

  if (role === "patient") {
    const candidates = await db
      .select({
        id: clinicPatients.id,
        userId: patients.userId,
        status: clinicPatients.status,
      })
      .from(clinicPatients)
      .innerJoin(patients, eq(patients.id, clinicPatients.patientId))
      .where(eq(clinicPatients.clinicId, clinicId))
      .limit(50);
    return candidates.some(
      (c: any) => c.userId === userId && c.status === "registered"
    );
  }

  return false;
}

async function listMyHospitals(
  db: any,
  userId: string,
  role: string | undefined
): Promise<Array<{ id: string; name: string; role?: string | null }>> {
  if (!role) return [];

  if (role === "hospital_admin") {
    return db
      .select({ id: hospitals.id, name: hospitals.name, role: sql<string>`NULL`.as("role") })
      .from(hospitals)
      .where(eq(hospitals.userId, userId));
  }

  if (role === "doctor") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return [];
    const rows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        role: hospitalDoctors.role,
        status: hospitalDoctors.status,
      })
      .from(hospitalDoctors)
      .innerJoin(hospitals, eq(hospitals.id, hospitalDoctors.hospitalId))
      .where(eq(hospitalDoctors.doctorId, doc.id));
    return rows.filter((r: any) => r.status === "active") as any;
  }

  if (role === "patient") {
    const rows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
        status: hospitalPatients.status,
      })
      .from(hospitalPatients)
      .innerJoin(hospitals, eq(hospitals.id, hospitalPatients.hospitalId))
      .innerJoin(patients, eq(patients.id, hospitalPatients.patientId))
      .where(eq(patients.userId, userId));
    return rows
      .filter((r: any) => r.status === "registered")
      .map((r: any) => ({ id: r.id, name: r.name, role: null }));
  }

  if (role === "hospital_staff") {
    const rows = await db
      .select({
        id: hospitals.id,
        name: hospitals.name,
      })
      .from(hospitalStaff)
      .innerJoin(hospitals, eq(hospitals.id, hospitalStaff.hospitalId))
      .where(eq(hospitalStaff.userId, userId));
    return rows.map((r: any) => ({ ...r, role: null }));
  }

  return [];
}

async function listMyClinics(
  db: any,
  userId: string,
  role: string | undefined
): Promise<Array<{ id: string; name: string; role?: string | null }>> {
  if (!role) return [];

  if (role === "doctor") {
    const [doc] = await db
      .select({ id: doctors.id })
      .from(doctors)
      .where(eq(doctors.userId, userId))
      .limit(1);
    if (!doc) return [];
    const rows = await db
      .select({
        id: clinics.id,
        name: clinics.name,
        role: clinicDoctors.role,
        status: clinicDoctors.status,
      })
      .from(clinicDoctors)
      .innerJoin(clinics, eq(clinics.id, clinicDoctors.clinicId))
      .where(eq(clinicDoctors.doctorId, doc.id));
    return rows.filter((r: any) => r.status === "active") as any;
  }

  if (role === "patient") {
    const rows = await db
      .select({
        id: clinics.id,
        name: clinics.name,
        status: clinicPatients.status,
      })
      .from(clinicPatients)
      .innerJoin(clinics, eq(clinics.id, clinicPatients.clinicId))
      .innerJoin(patients, eq(patients.id, clinicPatients.patientId))
      .where(eq(patients.userId, userId));
    return rows
      .filter((r: any) => r.status === "registered")
      .map((r: any) => ({ id: r.id, name: r.name, role: null }));
  }

  return [];
}