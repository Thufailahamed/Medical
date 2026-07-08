// @ts-nocheck

import { Hono } from "hono";
import { eq, and, isNull, desc, asc, gte, lt, sql, or, like, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  hospitals,
  wards,
  beds,
  bedAssignments,
  admissions,
  hospitalStaff,
  hospitalStaffInvites,
  hospitalPatients,
  patients,
  users,
  doctors,
  medicalRecords,
  vitals,
  notifications,
  appointments,
  walkIns,
  prescriptions,
  labOrders,
  departments,
  medicines,
  doctorPatientRelationships,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  wardSchema,
  bedSchema,
  bedStatusSchema,
  bedAssignSchema,
  staffSchema,
  createStaffInviteSchema,
  departmentSchema,
} from "@healthcare/shared";
import type { AppEnvironment } from "../types";
import { notify } from "../lib/notifications";
import { flattenTranslated } from "../lib/validation-error";
import { writeAudit } from "../lib/audit";
import { latestByType, classifyAlerts } from "../lib/vitals-derived";

/** Opaque random token for staff-invite deep links. Same shape as
 * family-invite tokens (apps/api/src/routes/family-invites.ts:45-51). */
function generateStaffInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const hospitalPortalRouter = new Hono<AppEnvironment>();

hospitalPortalRouter.use(
  "*",
  authMiddleware,
  requireRole("hospital_admin", "hospital_staff")
);

// ─── helpers ─────────────────────────────────────────────
// Phase MTN-1: tenant resolution chain — header → JWT user → null.
// Header takes priority so a super-admin / chain admin can switch
// context per request without changing the JWT. Returns null if no
// tenant can be resolved.
async function resolveHospital(
  db: any,
  userId: string,
  headerId: string | null,
  middlewareSetId: string | null
) {
  if (headerId) {
    const [h] = await db
      .select()
      .from(hospitals)
      .where(and(eq(hospitals.id, headerId), eq(hospitals.userId, userId)))
      .limit(1);
    if (h) return h;
  }
  if (middlewareSetId) {
    const [h] = await db
      .select()
      .from(hospitals)
      .where(and(eq(hospitals.id, middlewareSetId), eq(hospitals.userId, userId)))
      .limit(1);
    if (h) return h;
  }
  // Fall back to "any hospital owned by this user".
  const [h] = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.userId, userId))
    .limit(1);
  return h;
}

// ─── Dashboard ───────────────────────────────────────────
// GET /hospital-portal/dashboard
hospitalPortalRouter.get("/dashboard", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const headerId = c.req.header("x-active-hospital-id") || null;
  const middlewareId = c.get("activeHospitalId") || null;
  const hospital = await resolveHospital(db, userId, headerId, middlewareId);

  // If the caller isn't a hospital principal, return aggregate across all
  // hospitals (super-admin style). For v2 we scope to the caller's hospital
  // when one exists.
  let scopeId = hospital?.id || null;
  if (!scopeId) {
    const [anyH] = await db.select().from(hospitals).limit(1);
    scopeId = anyH?.id || null;
  }
  if (!scopeId) {
    return c.json({
      hospital: null,
      occupancy: { totalBeds: 0, occupied: 0, available: 0, cleaning: 0, maintenance: 0 },
      staffOnShift: [],
      admissions: [],
    });
  }

  // Bed counts
  const allBeds = await db
    .select()
    .from(beds)
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .where(eq(wards.hospitalId, scopeId));

  const occupancy = {
    totalBeds: allBeds.length,
    occupied: allBeds.filter((r: any) => r.beds.status === "occupied").length,
    available: allBeds.filter((r: any) => r.beds.status === "available").length,
    cleaning: allBeds.filter((r: any) => r.beds.status === "cleaning").length,
    maintenance: allBeds.filter(
      (r: any) => r.beds.status === "maintenance"
    ).length,
    occupancyRate:
      allBeds.length === 0
        ? 0
        : Math.round(
            (allBeds.filter((r: any) => r.beds.status === "occupied").length /
              allBeds.length) *
              100
        ),
  };

  // Staff on shift today (simple: count active staff, no per-day rotation table)
  const staffRows = await db
    .select()
    .from(hospitalStaff)
    .where(
      and(
        eq(hospitalStaff.hospitalId, scopeId),
        eq(hospitalStaff.active, true)
      )
    );

  const shiftNow = (() => {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return "morning";
    if (h >= 14 && h < 22) return "evening";
    return "night";
  })();

  const staffOnShift = staffRows.filter(
    (s: any) => s.shift === shiftNow || s.shift === "rotating"
  );

  // Active admissions (open bed_assignments in this hospital's wards)
  const admissionRows = await db
    .select({
      assignmentId: bedAssignments.id,
      bedId: bedAssignments.bedId,
      bedNumber: beds.bedNumber,
      wardId: wards.id,
      wardName: wards.name,
      patientId: patients.id,
      patientName: users.name,
      patientPhoto: users.photo,
      assignedAt: bedAssignments.assignedAt,
    })
    .from(bedAssignments)
    .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .innerJoin(patients, eq(bedAssignments.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .where(
      and(
        eq(wards.hospitalId, scopeId),
        isNull(bedAssignments.dischargedAt)
      )
    )
    .orderBy(desc(bedAssignments.assignedAt));

  // Doctor count from the doctors table (hospital_staff covers nurses/receptionists/techs).
  const doctorRows = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(eq(doctors.hospitalId, scopeId));

  // ── HOS-2: dashboard KPI tiles ─────────────────────────
  // Cheap counts only — no joins needed beyond the tenant scope.
  // Revenue + low-stock tiles return 0 until HOS-7 / HOS-9 land the
  // supporting tables.
  const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [opdRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(appointments)
    .where(
      and(
        eq(appointments.hospitalId, scopeId),
        eq(appointments.date, todayIso)
      )
    );
  const opdToday = Number(opdRow?.n ?? 0);

  const [walkInRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(walkIns)
    .where(
      and(
        eq(walkIns.hospitalId, scopeId),
        eq(walkIns.status, "waiting")
      )
    );
  const walkInsWaiting = Number(walkInRow?.n ?? 0);

  const [pendingLabRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(labOrders)
    .where(
      and(
        eq(labOrders.hospitalId, scopeId),
        sql`${labOrders.status} in ('ordered','sample_collected','in_progress')`
      )
    );
  const pendingLabs = Number(pendingLabRow?.n ?? 0);

  const [pendingRxRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.hospitalId, scopeId),
        eq(prescriptions.status, "signed"),
        isNull(prescriptions.dispensedAt)
      )
    );
  const pendingRx = Number(pendingRxRow?.n ?? 0);

  const ipdCensus = admissionRows.length;

  const tiles = [
    {
      key: "opdToday",
      label: "OPD today",
      value: opdToday,
      href: "/hospital/reception/appointments",
    },
    {
      key: "ipdCensus",
      label: "IPD census",
      value: ipdCensus,
      href: "/hospital/ipd",
    },
    {
      key: "beds",
      label: "Beds occupied",
      value: occupancy.occupied,
      total: occupancy.totalBeds,
      unit: `${occupancy.occupancyRate}%`,
      href: "/hospital/beds",
    },
    {
      key: "revenueToday",
      label: "Revenue today",
      value: 0,
      unit: "LKR",
      available: false,
      href: "/hospital/billing",
    },
    {
      key: "pendingLabs",
      label: "Pending labs",
      value: pendingLabs,
      href: "/hospital/lab",
    },
    {
      key: "pendingRx",
      label: "Pending Rx to dispense",
      value: pendingRx,
      href: "/hospital/pharmacy",
    },
    {
      key: "walkInsWaiting",
      label: "Walk-ins waiting",
      value: walkInsWaiting,
      href: "/hospital/reception/walk-ins",
    },
    {
      key: "lowStock",
      label: "Low-stock alerts",
      value: 0,
      available: false,
      href: "/hospital/pharmacy",
    },
  ];

  return c.json({
    hospital: hospital || (await db.select().from(hospitals).where(eq(hospitals.id, scopeId)).limit(1))[0],
    occupancy,
    shift: shiftNow,
    staffOnShift,
    staffTotals: {
      total: staffRows.length + doctorRows.length,
      nurses: staffRows.filter((s: any) => s.role === "nurse").length,
      doctors: doctorRows.length,
    },
    admissions: admissionRows,
    tiles,
  });
});

// ─── Wards ───────────────────────────────────────────────
// GET /hospital-portal/wards
hospitalPortalRouter.get("/wards", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ wards: [] });

  const rows = await db
    .select()
    .from(wards)
    .where(eq(wards.hospitalId, hospital.id))
    .orderBy(asc(wards.name));

  return c.json({ wards: rows });
});

// POST /hospital-portal/wards
hospitalPortalRouter.post("/wards", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const body = await c.req.json();
  const parsed = wardSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const [row] = await db
    .insert(wards)
    .values({
      hospitalId: hospital.id,
      name: parsed.data.name,
      type: parsed.data.type,
      capacity: parsed.data.capacity,
      floor: parsed.data.floor,
    })
    .returning();

  return c.json({ ward: row }, 201);
});

// PUT /hospital-portal/wards/:id
hospitalPortalRouter.put("/wards/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const id = c.req.param("id");
  const body = await c.req.json();

  const [own] = await db
    .select()
    .from(wards)
    .where(and(eq(wards.id, id), eq(wards.hospitalId, hospital.id)))
    .limit(1);
  if (!own) return c.json({ error: "Ward not found" }, 404);

  const update: any = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.type !== undefined) update.type = body.type;
  if (body.capacity !== undefined) update.capacity = body.capacity;
  if (body.floor !== undefined) update.floor = body.floor;
  if (body.active !== undefined) update.active = !!body.active;

  const [row] = await db
    .update(wards)
    .set(update)
    .where(eq(wards.id, id))
    .returning();

  return c.json({ ward: row });
});

// DELETE /hospital-portal/wards/:id  — soft delete (active=false)
hospitalPortalRouter.delete("/wards/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const id = c.req.param("id");
  const [own] = await db
    .select()
    .from(wards)
    .where(and(eq(wards.id, id), eq(wards.hospitalId, hospital.id)))
    .limit(1);
  if (!own) return c.json({ error: "Ward not found" }, 404);

  // Refuse if any bed is occupied
  const occupied = await db
    .select()
    .from(beds)
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .where(and(eq(wards.id, id), eq(beds.status, "occupied")))
    .limit(1);

  if (occupied.length > 0) {
    return c.json(
      { error: "Cannot delete ward with occupied beds" },
      409
    );
  }

  await db.update(wards).set({ active: false }).where(eq(wards.id, id));
  return c.json({ ok: true });
});

// ─── Beds ────────────────────────────────────────────────
// GET /hospital-portal/beds?wardId=...
hospitalPortalRouter.get("/beds", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ beds: [] });

  const wardId = c.req.query("wardId");

  const conditions: any[] = [];
  if (wardId) {
    conditions.push(eq(beds.wardId, wardId));
  } else {
    const hospitalWards = await db
      .select({ id: wards.id })
      .from(wards)
      .where(eq(wards.hospitalId, hospital.id));
    if (hospitalWards.length === 0) return c.json({ beds: [] });
    // No single-ward-id filter when listing all; we just join via wards
  }

  let rows;
  if (wardId) {
    rows = await db
      .select()
      .from(beds)
      .where(eq(beds.wardId, wardId))
      .orderBy(asc(beds.bedNumber));
  } else {
    rows = await db
      .select({
        bed: beds,
        ward: wards,
      })
      .from(beds)
      .innerJoin(wards, eq(beds.wardId, wards.id))
      .where(eq(wards.hospitalId, hospital.id))
      .orderBy(asc(wards.name), asc(beds.bedNumber));
  }

  return c.json({ beds: rows });
});

// POST /hospital-portal/beds
hospitalPortalRouter.post("/beds", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const body = await c.req.json();
  const parsed = bedSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  // Verify ward belongs to this hospital
  const [ward] = await db
    .select()
    .from(wards)
    .where(
      and(eq(wards.id, parsed.data.wardId), eq(wards.hospitalId, hospital.id))
    )
    .limit(1);
  if (!ward) return c.json({ error: "Ward not found in your hospital" }, 404);

  const [row] = await db
    .insert(beds)
    .values({
      wardId: parsed.data.wardId,
      bedNumber: parsed.data.bedNumber,
      status: parsed.data.status,
      notes: parsed.data.notes || null,
    })
    .returning();

  return c.json({ bed: row }, 201);
});

// PUT /hospital-portal/beds/:id/status
hospitalPortalRouter.put("/beds/:id/status", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = bedStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  // Ownership
  const [own] = await db
    .select({ bed: beds })
    .from(beds)
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .where(and(eq(beds.id, id), eq(wards.hospitalId, hospital.id)))
    .limit(1);
  if (!own) return c.json({ error: "Bed not found" }, 404);

  const [row] = await db
    .update(beds)
    .set({ status: parsed.data.status })
    .where(eq(beds.id, id))
    .returning();

  return c.json({ bed: row });
});

// POST /hospital-portal/beds/:id/assign
hospitalPortalRouter.post("/beds/:id/assign", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const bedId = c.req.param("id");
  const body = await c.req.json();
  const parsed = bedAssignSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  // Ownership check
  const [own] = await db
    .select({ bed: beds })
    .from(beds)
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .where(and(eq(beds.id, bedId), eq(wards.hospitalId, hospital.id)))
    .limit(1);
  if (!own) return c.json({ error: "Bed not found" }, 404);

  if (own.bed.status === "occupied") {
    return c.json({ error: "Bed is already occupied" }, 409);
  }

  // Ensure no active assignment exists for this bed (defensive)
  const existing = await db
    .select()
    .from(bedAssignments)
    .where(
      and(eq(bedAssignments.bedId, bedId), isNull(bedAssignments.dischargedAt))
    )
    .limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Bed already has an open assignment" }, 409);
  }

  // Verify patient exists
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, parsed.data.patientId))
    .limit(1);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const [assignment] = await db
    .insert(bedAssignments)
    .values({
      bedId,
      patientId: parsed.data.patientId,
      assignedBy: userId,
      notes: parsed.data.notes || null,
    })
    .returning();

  // Mark bed occupied
  await db
    .update(beds)
    .set({ status: "occupied" })
    .where(eq(beds.id, bedId));

  // Add a hospital_visit record so timeline reflects admission
  await db.insert(medicalRecords).values({
    patientId: parsed.data.patientId,
    hospitalId: hospital.id,
    recordType: "hospital_visit",
    title: "Admitted",
    notes: parsed.data.notes || `Admitted to bed`,
    date: new Date().toISOString().split("T")[0],
  });

  // Notify patient
  await notify({
    db,
    userId: patient.userId,
    type: "hospital",
    title: "Admitted",
    body: `You have been admitted to ${hospital.name}`,
    data: { bedId, assignmentId: assignment?.id },
  });

  return c.json({ assignment }, 201);
});

// POST /hospital-portal/beds/:id/discharge
hospitalPortalRouter.post("/beds/:id/discharge", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const bedId = c.req.param("id");

  // Ownership
  const [own] = await db
    .select({ bed: beds })
    .from(beds)
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .where(and(eq(beds.id, bedId), eq(wards.hospitalId, hospital.id)))
    .limit(1);
  if (!own) return c.json({ error: "Bed not found" }, 404);

  // Find active assignment
  const [open] = await db
    .select()
    .from(bedAssignments)
    .where(
      and(eq(bedAssignments.bedId, bedId), isNull(bedAssignments.dischargedAt))
    )
    .limit(1);
  if (!open) return c.json({ error: "No active assignment to discharge" }, 404);

  const now = new Date().toISOString();
  const [closed] = await db
    .update(bedAssignments)
    .set({ dischargedAt: now })
    .where(eq(bedAssignments.id, open.id))
    .returning();

  // Move bed to cleaning
  await db
    .update(beds)
    .set({ status: "cleaning" })
    .where(eq(beds.id, bedId));

  // Discharge record on patient timeline
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, open.patientId))
    .limit(1);

  if (patient) {
    await db.insert(medicalRecords).values({
      patientId: patient.id,
      hospitalId: hospital.id,
      recordType: "discharge_summary",
      title: "Discharged",
      notes: `Discharged from ${hospital.name}`,
      date: now.split("T")[0],
    });

    await notify({
      db,
      userId: patient.userId,
      type: "hospital",
      title: "Discharged",
      body: `You have been discharged from ${hospital.name}`,
      data: { bedId },
    });
  }

  return c.json({ assignment: closed });
});

// ─── Staff ───────────────────────────────────────────────
// GET /hospital-portal/staff
hospitalPortalRouter.get("/staff", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ staff: [] });

  const rows = await db
    .select()
    .from(hospitalStaff)
    .where(eq(hospitalStaff.hospitalId, hospital.id))
    .orderBy(asc(hospitalStaff.fullName));

  return c.json({ staff: rows });
});

// POST /hospital-portal/staff
hospitalPortalRouter.post("/staff", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const body = await c.req.json();
  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const [row] = await db
    .insert(hospitalStaff)
    .values({
      hospitalId: hospital.id,
      userId: parsed.data.userId || null,
      fullName: parsed.data.fullName,
      role: parsed.data.role,
      shift: parsed.data.shift,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
    })
    .returning();

  return c.json({ staff: row }, 201);
});

// PUT /hospital-portal/staff/:id
hospitalPortalRouter.put("/staff/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const id = c.req.param("id");
  const body = await c.req.json();

  const [own] = await db
    .select()
    .from(hospitalStaff)
    .where(
      and(eq(hospitalStaff.id, id), eq(hospitalStaff.hospitalId, hospital.id))
    )
    .limit(1);
  if (!own) return c.json({ error: "Staff not found" }, 404);

  const update: any = {};
  for (const k of ["fullName", "role", "shift", "phone", "email", "userId"]) {
    if (body[k] !== undefined) update[k] = body[k] || null;
  }
  if (body.active !== undefined) update.active = !!body.active;

  const [row] = await db
    .update(hospitalStaff)
    .set(update)
    .where(eq(hospitalStaff.id, id))
    .returning();

  return c.json({ staff: row });
});

// DELETE /hospital-portal/staff/:id  — soft delete
hospitalPortalRouter.delete("/staff/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const id = c.req.param("id");
  const [own] = await db
    .select()
    .from(hospitalStaff)
    .where(
      and(eq(hospitalStaff.id, id), eq(hospitalStaff.hospitalId, hospital.id))
    )
    .limit(1);
  if (!own) return c.json({ error: "Staff not found" }, 404);

  await db
    .update(hospitalStaff)
    .set({ active: false })
    .where(eq(hospitalStaff.id, id));
  return c.json({ ok: true });
});

// ─── Patient directory + 360 bundle (HOS-13) ──────────────
//
// GET /hospital-portal/patients            — full directory of patients
//                                          registered with this hospital,
//                                          with optional ?q=, ?status=,
//                                          ?admitted=true|false filters.
// POST /hospital-portal/patients           — create user + patient + register
//                                          at this hospital, auto-MRN.
// GET /hospital-portal/patients/:id        — Patient 360 bundle scoped to
//                                          this hospital (admissions,
//                                          records, prescriptions, lab
//                                          orders all filter on
//                                          hospital_id = scope.id).
//                                          Vitals are patient-scoped because
//                                          the vitals table is patient-owned.

// MRN generator — duplicates hospital-patients.ts:47-65 deliberately so we
// don't have to extract a shared helper for ~10 lines. Format:
// `<3-letter hospital-name>-<6-digit seq>`. Falls back to "HSP" if the
// hospital name has zero ASCII letters.
async function generateMrn(db: any, hospitalId: string): Promise<string> {
  const [h] = await db
    .select({ id: hospitals.id, name: hospitals.name })
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);
  const prefix =
    (h?.name || "")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3) || "HSP";
  const [count] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(hospitalPatients)
    .where(eq(hospitalPatients.hospitalId, hospitalId));
  const seq = String((Number(count?.n) || 0) + 1).padStart(6, "0");
  return `${prefix}-${seq}`;
}

// GET /hospital-portal/patients
hospitalPortalRouter.get("/patients", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ patients: [] });

  const q = (c.req.query("q") ?? "").trim();
  const status = c.req.query("status") ?? null;
  const admitted = c.req.query("admitted") ?? null;

  const whereParts: any[] = [eq(hospitalPatients.hospitalId, hospital.id)];
  if (status === "registered" || status === "discharged" || status === "deceased") {
    whereParts.push(eq(hospitalPatients.status, status));
  }
  if (q) {
    const pattern = `%${q}%`;
    whereParts.push(
      or(
        like(users.name, pattern),
        like(users.phone, pattern),
        like(users.email, pattern),
        like(hospitalPatients.mrn, pattern)
      )
    );
  }

  // Pull every registration for this hospital. Then for each, optionally
  // resolve the currently-open bed assignment (one row per active
  // admission). Two simple queries — easier to reason about than a single
  // fan-out LEFT JOIN that Drizzle composes awkwardly with row filters.
  const rows = await db
    .select({
      id: patients.id,
      userId: patients.userId,
      name: users.name,
      phone: users.phone,
      email: users.email,
      photo: users.photo,
      gender: patients.gender,
      bloodGroup: patients.bloodGroup,
      dateOfBirth: patients.dateOfBirth,
      mrn: hospitalPatients.mrn,
      status: hospitalPatients.status,
      registeredAt: hospitalPatients.registeredAt,
      dischargedAt: hospitalPatients.dischargedAt,
    })
    .from(hospitalPatients)
    .innerJoin(patients, eq(patients.id, hospitalPatients.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(...whereParts))
    .orderBy(desc(hospitalPatients.registeredAt));

  // Resolve current open admissions for this hospital in one query, then
  // join in memory. Bed-assignment join not needed because the
  // admission-row carries the ward already.
  const openAdmissions = await db
    .select({
      patientId: admissions.patientId,
      admissionId: admissions.id,
      wardName: wards.name,
      wardId: wards.id,
      admittedAt: admissions.admittedAt,
      reason: admissions.reason,
    })
    .from(admissions)
    .leftJoin(wards, eq(wards.id, admissions.wardId))
    .where(
      and(
        eq(admissions.hospitalId, hospital.id),
        eq(admissions.status, "admitted")
      )
    );

  const admitByPatient = new Map(openAdmissions.map((o: any) => [o.patientId, o]));

  const enriched = rows.map((r: any) => {
    const a = admitByPatient.get(r.id);
    return {
      ...r,
      currentlyAdmitted: !!a,
      admissionId: a?.admissionId ?? null,
      wardName: a?.wardName ?? null,
      admittedAt: a?.admittedAt ?? null,
      reason: a?.reason ?? null,
    };
  });

  const filtered = admitted === "true"
    ? enriched.filter((r: any) => r.currentlyAdmitted)
    : admitted === "false"
      ? enriched.filter((r: any) => !r.currentlyAdmitted)
      : enriched;

  return c.json({ patients: filtered });
});

// POST /hospital-portal/patients — create + register
const createPatientSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  bloodGroup: z.string().max(8).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  nic: z.string().max(20).optional().nullable(),
});

hospitalPortalRouter.post("/patients", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const data = parsed.data;

  // Phone / email uniqueness is enforced by UNIQUE indexes on `users`.
  // Pre-check to return a friendly 409 instead of a raw constraint blow-up.
  if (data.phone) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, data.phone))
      .limit(1);
    if (existing) return c.json({ error: "Phone already registered" }, 409);
  }
  if (data.email) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);
    if (existing) return c.json({ error: "Email already registered" }, 409);
  }

  const newUserId = crypto.randomUUID();
  const locale = c.get("locale") ?? "en";

  await db.insert(users).values({
    id: newUserId,
    supabaseId: newUserId,
    role: "patient",
    name: data.name,
    phone: data.phone ?? null,
    email: data.email ?? null,
    nic: data.nic ?? null,
    dateOfBirth: data.dob ?? null,
    verified: false,
    status: "active",
    preferredLocale: locale,
  } as any);

  const [patientRow] = await db
    .insert(patients)
    .values({
      userId: newUserId,
      gender: data.gender ?? null,
      bloodGroup: data.bloodGroup ?? null,
      dateOfBirth: data.dob ?? null,
      // Address lands in emergencyContacts as a freeform note — keeps the
      // schema unchanged without losing the field.
      emergencyContacts: data.address
        ? JSON.stringify([{ type: "note", value: data.address }])
        : null,
    } as any)
    .returning();

  const mrn = await generateMrn(db, hospital.id);
  const [regRow] = await db
    .insert(hospitalPatients)
    .values({
      hospitalId: hospital.id,
      patientId: patientRow.id,
      mrn,
      status: "registered",
    } as any)
    .returning();

  await writeAudit(db, {
    userId,
    action: "patient.create",
    resource: "patient",
    resourceId: patientRow.id,
    details: { hospitalId: hospital.id, mrn, source: "hospital_portal" },
  });

  return c.json(
    {
      patient: {
        id: patientRow.id,
        userId: newUserId,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        mrn,
        status: regRow.status,
        registeredAt: regRow.registeredAt,
      },
    },
    201
  );
});

// GET /hospital-portal/patients/:id — Patient 360 bundle
hospitalPortalRouter.get("/patients/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const patientId = c.req.param("id");

  // Verify the patient is registered at THIS hospital — guards cross-tenant reads.
  const [registration] = await db
    .select()
    .from(hospitalPatients)
    .where(
      and(
        eq(hospitalPatients.hospitalId, hospital.id),
        eq(hospitalPatients.patientId, patientId)
      )
    )
    .limit(1);
  if (!registration) {
    return c.json({ error: "Patient not registered at this hospital" }, 404);
  }

  const [patientRow] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patientRow) {
    return c.json({ error: "Patient profile missing" }, 404);
  }

  // Current admission (open at this hospital).
  const [currentAdmission] = await db
    .select({
      id: admissions.id,
      wardId: wards.id,
      wardName: wards.name,
      admittedAt: admissions.admittedAt,
      admissionType: admissions.admissionType,
      reason: admissions.reason,
      diagnosisAtAdmission: admissions.diagnosisAtAdmission,
    })
    .from(admissions)
    .leftJoin(wards, eq(wards.id, admissions.wardId))
    .where(
      and(
        eq(admissions.patientId, patientId),
        eq(admissions.hospitalId, hospital.id),
        eq(admissions.status, "admitted")
      )
    )
    .limit(1);

  // All past admissions across every hospital the patient has visited.
  // Scoped by patient_id only — hospital_staff must be able to see a
  // patient's full admission history, not just this hospital's slice.
  // The `hospitalId` field is included so the UI can label the source.
  const admissionRows = await db
    .select({
      id: admissions.id,
      admittedAt: admissions.admittedAt,
      dischargedAt: admissions.dischargedAt,
      status: admissions.status,
      reason: admissions.reason,
      diagnosisAtAdmission: admissions.diagnosisAtAdmission,
      dischargeDiagnosis: admissions.dischargeDiagnosis,
      wardName: wards.name,
      hospitalId: admissions.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(admissions)
    .leftJoin(wards, eq(wards.id, admissions.wardId))
    .leftJoin(hospitals, eq(hospitals.id, admissions.hospitalId))
    .where(eq(admissions.patientId, patientId))
    .orderBy(desc(admissions.admittedAt))
    .limit(50);

  // All medical records across every hospital (last 50).
  const recordRows = await db
    .select({
      id: medicalRecords.id,
      recordType: medicalRecords.recordType,
      title: medicalRecords.title,
      diagnosis: medicalRecords.diagnosis,
      summary: medicalRecords.summary,
      date: medicalRecords.date,
      status: medicalRecords.status,
      doctorId: medicalRecords.doctorId,
      hospitalId: medicalRecords.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(medicalRecords)
    .leftJoin(hospitals, eq(hospitals.id, medicalRecords.hospitalId))
    .where(
      and(
        eq(medicalRecords.patientId, patientId),
        isNull(medicalRecords.archivedAt)
      )
    )
    .orderBy(desc(medicalRecords.date))
    .limit(50);

  // Resolve doctor names in one query (skip nulls).
  const doctorIds = Array.from(
    new Set(
      recordRows
        .map((r: any) => r.doctorId)
        .filter((x: any) => !!x)
    )
  );
  const doctorUserMap = new Map<string, string>();
  if (doctorIds.length) {
    const docs = await db
      .select({ id: doctors.id, name: users.name })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId));
    for (const d of docs) {
      if (doctorIds.includes(d.id)) doctorUserMap.set(d.id, d.name);
    }
  }
  const records = recordRows.map((r: any) => ({
    ...r,
    doctorName: r.doctorId ? doctorUserMap.get(r.doctorId) ?? null : null,
  }));

  // All prescriptions across every hospital (last 50) with medicines inline.
  const prescriptionRows = await db
    .select({
      id: prescriptions.id,
      doctorId: prescriptions.doctorId,
      diagnosis: prescriptions.diagnosis,
      notes: prescriptions.notes,
      date: prescriptions.date,
      status: prescriptions.status,
      signedAt: prescriptions.signedAt,
      dispensedAt: prescriptions.dispensedAt,
      hospitalId: prescriptions.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(prescriptions)
    .leftJoin(hospitals, eq(hospitals.id, prescriptions.hospitalId))
    .where(eq(prescriptions.patientId, patientId))
    .orderBy(desc(prescriptions.date))
    .limit(50);

  const prescDoctorIds = Array.from(
    new Set(prescriptionRows.map((r) => r.doctorId).filter((x) => !!x))
  );
  const prescDocMap = new Map<string, string>();
  if (prescDoctorIds.length) {
    const docs = await db
      .select({ id: doctors.id, name: users.name })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId));
    for (const d of docs) {
      if (prescDoctorIds.includes(d.id)) prescDocMap.set(d.id, d.name);
    }
  }

  const prescIds = prescriptionRows.map((r) => r.id);
  const medsByPresc = new Map<string, any[]>();
  if (prescIds.length) {
    const meds = await db
      .select()
      .from(medicines)
      .where(inArray(medicines.prescriptionId, prescIds));
    for (const m of meds) {
      const arr = medsByPresc.get(m.prescriptionId!) ?? [];
      arr.push(m);
      medsByPresc.set(m.prescriptionId!, arr);
    }
  }

  const prescResult = prescriptionRows.map((p: any) => ({
    ...p,
    doctorName: p.doctorId ? prescDocMap.get(p.doctorId) ?? null : null,
    medicines: medsByPresc.get(p.id) ?? [],
  }));

  // All lab orders across every hospital (last 50).
  const labOrderRows = await db
    .select({
      id: labOrders.id,
      doctorId: labOrders.doctorId,
      tests: labOrders.tests,
      priority: labOrders.priority,
      status: labOrders.status,
      notes: labOrders.notes,
      orderedAt: labOrders.orderedAt,
      completedAt: labOrders.completedAt,
      resultSummary: labOrders.resultSummary,
      resultUrl: labOrders.resultUrl,
      hospitalId: labOrders.hospitalId,
      hospitalName: hospitals.name,
    })
    .from(labOrders)
    .leftJoin(hospitals, eq(hospitals.id, labOrders.hospitalId))
    .where(eq(labOrders.patientId, patientId))
    .orderBy(desc(labOrders.orderedAt))
    .limit(50);

  const labDoctorIds = Array.from(
    new Set(labOrderRows.map((r) => r.doctorId).filter((x) => !!x))
  );
  const labDocMap = new Map<string, string>();
  if (labDoctorIds.length) {
    const docs = await db
      .select({ id: doctors.id, name: users.name })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId));
    for (const d of docs) {
      if (labDoctorIds.includes(d.id)) labDocMap.set(d.id, d.name);
    }
  }
  const labOrderResult = labOrderRows.map((r: any) => ({
    ...r,
    doctorName: r.doctorId ? labDocMap.get(r.doctorId) ?? null : null,
  }));

  // Vitals are patient-owned (no hospital_id column). Reuse existing
  // latestByType + classifyAlerts derived helpers.
  const vitalRows = await db
    .select()
    .from(vitals)
    .where(eq(vitals.patientId, patientId))
    .orderBy(desc(vitals.recordedAt))
    .limit(30);
  const latestByTypeRows = latestByType(vitalRows as any[], { patient: patientRow.patient });
  const alertRows = classifyAlerts(vitalRows as any[], { patient: patientRow.patient });

  // Doctors linked to this patient via doctorPatientRelationships across
  // every hospital — full care team view. Each row carries its context
  // hospital name so the UI can label the source.
  const dprRows = await db
    .select({
      id: doctorPatientRelationships.id,
      doctorId: doctorPatientRelationships.doctorId,
      relationshipKind: doctorPatientRelationships.relationshipKind,
      status: doctorPatientRelationships.status,
      isPrimary: doctorPatientRelationships.isPrimary,
      startedAt: doctorPatientRelationships.startedAt,
      endedAt: doctorPatientRelationships.endedAt,
      contextId: doctorPatientRelationships.contextId,
      hospitalName: hospitals.name,
    })
    .from(doctorPatientRelationships)
    .leftJoin(hospitals, eq(hospitals.id, doctorPatientRelationships.contextId))
    .where(
      and(
        eq(doctorPatientRelationships.patientId, patientId),
        eq(doctorPatientRelationships.contextType, "hospital")
      )
    )
    .orderBy(desc(doctorPatientRelationships.startedAt));

  const dprDoctorIds = Array.from(new Set(dprRows.map((r) => r.doctorId)));
  const dprDocMap = new Map<string, string>();
  if (dprDoctorIds.length) {
    const docs = await db
      .select({ id: doctors.id, name: users.name })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId));
    for (const d of docs) {
      if (dprDoctorIds.includes(d.id)) dprDocMap.set(d.id, d.name);
    }
  }
  const linkedDoctors = dprRows.map((r: any) => ({
    ...r,
    doctorName: dprDocMap.get(r.doctorId) ?? null,
  }));

  return c.json({
    patient: patientRow.patient,
    user: patientRow.user,
    registration: {
      mrn: registration.mrn,
      status: registration.status,
      registeredAt: registration.registeredAt,
      dischargedAt: registration.dischargedAt,
      notes: registration.notes,
    },
    admission: currentAdmission ?? null,
    admissions: admissionRows,
    records,
    prescriptions: prescResult,
    labOrders: labOrderResult,
    vitals: vitalRows,
    latestVitals: latestByTypeRows,
    vitalsAlerts: {
      count: alertRows.length,
      items: alertRows.slice(0, 10),
    },
    doctors: linkedDoctors,
  });
});

// ─── Phase 3.1 slice 3: staff invites (admin only) ─────────
// The router-level middleware applies to hospital_admin AND hospital_staff;
// these three endpoints below are admin-only (receptionists can't
// invite new staff). We re-check the role inline rather than splitting
// into a second router because the layout mirrors the sibling routes.
function requireAdmin(c: any): boolean {
  return c.get("dbUser")?.role === "hospital_admin";
}

// POST /hospital-portal/staff/invites
hospitalPortalRouter.post("/staff/invites", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Admin only" }, 403);
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const parsed = createStaffInviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: flattenTranslated(parsed.error, c.get("locale")),
      },
      400
    );
  }
  const data = parsed.data;
  const token = generateStaffInviteToken();
  const expiresAt = new Date(
    Date.now() + (data.expiresInHours ?? 24 * 14) * 60 * 60 * 1000
  ).toISOString();

  const [row] = await db
    .insert(hospitalStaffInvites)
    .values({
      hospitalId: hospital.id,
      role: data.role,
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.replace(/\s/g, "") ?? null,
      token,
      expiresAt,
      revoked: false,
      createdByUserId: userId,
    } as any)
    .returning();

  await writeAudit(db, {
    userId,
    action: "staff_invite_created",
    resource: "hospital_staff_invite",
    resourceId: row.id,
    details: {
      role: data.role,
      email: data.email,
      hospitalId: hospital.id,
      expiresAt,
    },
  });

  return c.json(
    {
      id: row.id,
      token,
      // Deep link consumed by the mobile route at
      // apps/mobile/src/app/invite/staff-[token].tsx. Universal-link
      // HTTPS fallback is out of scope (see plan §Out of scope).
      deepLink: `healthcare://staff-invite/${token}`,
      expiresAt,
    },
    201
  );
});

// GET /hospital-portal/staff/invites
hospitalPortalRouter.get("/staff/invites", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Admin only" }, 403);
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);

  const rows = await db
    .select()
    .from(hospitalStaffInvites)
    .where(eq(hospitalStaffInvites.hospitalId, hospital.id))
    .orderBy(desc(hospitalStaffInvites.createdAt));

  // Strip the token for already-consumed or revoked rows so a leaked
  // history listing can't surface stale secrets. Pending entries
  // include the token because the admin is about to share it.
  const safeRows = rows.map((r: any) => ({
    id: r.id,
    hospitalId: r.hospitalId,
    role: r.role,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    expiresAt: r.expiresAt,
    consumedAt: r.consumedAt,
    consumedByUserId: r.consumedByUserId,
    revoked: !!r.revoked,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    token: r.consumedAt || r.revoked ? null : r.token,
    deepLink:
      r.consumedAt || r.revoked
        ? null
        : `healthcare://staff-invite/${r.token}`,
  }));

  return c.json({ invites: safeRows });
});

// DELETE /hospital-portal/staff/invites/:id
hospitalPortalRouter.delete("/staff/invites/:id", async (c) => {
  if (!requireAdmin(c)) return c.json({ error: "Admin only" }, 403);
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "Hospital not found" }, 404);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(hospitalStaffInvites)
    .where(
      and(
        eq(hospitalStaffInvites.id, id),
        eq(hospitalStaffInvites.hospitalId, hospital.id)
      )
    )
    .limit(1);
  if (!existing) return c.json({ error: "Invite not found" }, 404);
  if (existing.consumedAt) {
    return c.json({ error: "Invite already consumed" }, 410);
  }
  if (existing.revoked) {
    return c.json({ error: "Invite already revoked" }, 410);
  }

  await db
    .update(hospitalStaffInvites)
    .set({ revoked: true } as any)
    .where(eq(hospitalStaffInvites.id, id));

  await writeAudit(db, {
    userId,
    action: "staff_invite_revoked",
    resource: "hospital_staff_invite",
    resourceId: id,
    details: { hospitalId: hospital.id },
  });

  return c.json({ ok: true });
});

// ─── HOS-6: Departments CRUD ─────────────────────────────
hospitalPortalRouter.get("/departments", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ departments: [] });
  const rows = await db
    .select()
    .from(departments)
    .where(eq(departments.hospitalId, hospital.id))
    .orderBy(asc(departments.name));
  return c.json({ departments: rows });
});

hospitalPortalRouter.post("/departments", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ error: "No active hospital" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const parsed = departmentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  const [created] = await db
    .insert(departments)
    .values({
      hospitalId: hospital.id,
      name: parsed.data.name,
      headDoctorId: parsed.data.headDoctorId ?? null,
      active: parsed.data.active ?? true,
    })
    .returning();
  return c.json({ department: created }, 201);
});

hospitalPortalRouter.put("/departments/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = departmentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);
  await db
    .update(departments)
    .set({
      name: parsed.data.name,
      headDoctorId: parsed.data.headDoctorId ?? null,
      active: parsed.data.active ?? true,
    })
    .where(eq(departments.id, id));
  return c.json({ ok: true });
});

hospitalPortalRouter.delete("/departments/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await db.update(departments).set({ active: false }).where(eq(departments.id, id));
  return c.json({ ok: true });
});

// GET /hospital-portal/lab-orders — routable lab orders for active hospital
hospitalPortalRouter.get("/lab-orders", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const hospital = await resolveHospital(
    db,
    userId,
    c.req.header("x-active-hospital-id") || null,
    c.get("activeHospitalId") || null
  );
  if (!hospital) return c.json({ orders: [] });

  const statusParam =
    c.req.query("status") ?? "ordered,sample_collected,in_progress";
  const statuses = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const whereParts: any[] = [eq(labOrders.hospitalId, hospital.id)];
  if (statuses.length === 1) {
    whereParts.push(eq(labOrders.status, statuses[0]));
  } else if (statuses.length > 1) {
    whereParts.push(inArray(labOrders.status, statuses));
  }

  const rows = await db
    .select({
      id: labOrders.id,
      patientId: labOrders.patientId,
      tests: labOrders.tests,
      status: labOrders.status,
      priority: labOrders.priority,
      orderedAt: labOrders.orderedAt,
      patientName: users.name,
    })
    .from(labOrders)
    .innerJoin(patients, eq(patients.id, labOrders.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(...whereParts))
    .orderBy(desc(labOrders.orderedAt))
    .limit(100);

  const orders = rows.map((r: any) => {
    let tests: unknown = r.tests;
    if (typeof r.tests === "string") {
      try {
        tests = JSON.parse(r.tests);
      } catch {
        tests = r.tests;
      }
    }
    return { ...r, tests };
  });

  return c.json({ orders });
});

export default hospitalPortalRouter;