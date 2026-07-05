// @ts-nocheck

import { Hono } from "hono";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import {
  hospitals,
  wards,
  beds,
  bedAssignments,
  hospitalStaff,
  hospitalStaffInvites,
  patients,
  users,
  doctors,
  medicalRecords,
  vitals,
  notifications,
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

// ─── Currently admitted patients ─────────────────────────
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

  const rows = await db
    .select({
      assignmentId: bedAssignments.id,
      patientId: patients.id,
      patientName: users.name,
      patientPhoto: users.photo,
      patientPhone: users.phone,
      bloodGroup: patients.bloodGroup,
      gender: patients.gender,
      wardName: wards.name,
      bedNumber: beds.bedNumber,
      bedId: beds.id,
      assignedAt: bedAssignments.assignedAt,
    })
    .from(bedAssignments)
    .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .innerJoin(patients, eq(bedAssignments.patientId, patients.id))
    .innerJoin(users, eq(patients.userId, users.id))
    .where(
      and(
        eq(wards.hospitalId, hospital.id),
        isNull(bedAssignments.dischargedAt)
      )
    )
    .orderBy(desc(bedAssignments.assignedAt));

  return c.json({ patients: rows });
});

// GET /hospital-portal/patients/:id — admitted patient detail
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

  const [admission] = await db
    .select({
      assignmentId: bedAssignments.id,
      bedId: beds.id,
      bedNumber: beds.bedNumber,
      wardId: wards.id,
      wardName: wards.name,
      assignedAt: bedAssignments.assignedAt,
      notes: bedAssignments.notes,
    })
    .from(bedAssignments)
    .innerJoin(beds, eq(bedAssignments.bedId, beds.id))
    .innerJoin(wards, eq(beds.wardId, wards.id))
    .where(
      and(
        eq(bedAssignments.patientId, patientId),
        eq(wards.hospitalId, hospital.id),
        isNull(bedAssignments.dischargedAt)
      )
    )
    .limit(1);

  if (!admission) return c.json({ error: "Patient not currently admitted" }, 404);

  const [patientRow] = await db
    .select({ patient: patients, user: users })
    .from(patients)
    .innerJoin(users, eq(patients.userId, users.id))
    .where(eq(patients.id, patientId))
    .limit(1);

  const records = await db
    .select()
    .from(medicalRecords)
    .where(eq(medicalRecords.patientId, patientId))
    .orderBy(desc(medicalRecords.date))
    .limit(30);

  const vitalRows = await db
    .select()
    .from(vitals)
    .where(eq(vitals.patientId, patientId))
    .orderBy(desc(vitals.recordedAt))
    .limit(30);

  const latestByTypeRows = latestByType(vitalRows as any[], { patient: patientRow?.patient });
  const alertRows = classifyAlerts(vitalRows as any[], { patient: patientRow?.patient });

  return c.json({
    admission,
    patient: patientRow?.patient,
    user: patientRow?.user,
    records,
    vitals: vitalRows,
    latestVitals: latestByTypeRows,
    vitalsAlerts: {
      count: alertRows.length,
      items: alertRows.slice(0, 10),
    },
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

export default hospitalPortalRouter;