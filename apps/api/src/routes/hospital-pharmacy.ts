// @ts-nocheck
// HOS-7: Hospital pharmacy routes. Mounted at /hospital-portal/pharmacy.

import { Hono } from "hono";
import { and, desc, eq, isNull, sql, asc } from "drizzle-orm";
import {
  prescriptions,
  prescriptionItems,
  medicinesMaster,
  patients,
  users,
  doctors,
  hospitals,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";
import { notify } from "../lib/notifications";
import { writeAudit } from "../lib/audit";

const pharmacyRouter = new Hono<AppEnvironment>();

pharmacyRouter.use(
  "*",
  authMiddleware,
  requireRole("pharmacy", "hospital_admin", "hospital_staff", "super_admin")
);

async function resolveScopeId(c: any): Promise<string | null> {
  const db = c.get("db");
  const headerId = c.req.header("x-active-hospital-id") || null;
  const middlewareId = c.get("activeHospitalId") || null;
  const id = headerId || middlewareId;
  if (id) return id;
  const userId = c.get("userId");
  if (c.get("userRole") === "super_admin") {
    const [h] = await db.select().from(hospitals).limit(1);
    return h?.id ?? null;
  }
  const [h] = await db.select().from(hospitals).where(eq(hospitals.userId, userId)).limit(1);
  return h?.id ?? null;
}

// GET /hospital-portal/pharmacy/queue
pharmacyRouter.get("/queue", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ prescriptions: [] });

  const rows = await db
    .select({
      id: prescriptions.id,
      patientId: prescriptions.patientId,
      patientName: users.name,
      doctorName: sql<string>`doc_user.name`.as("doctor_name"),
      diagnosis: prescriptions.diagnosis,
      notes: prescriptions.notes,
      date: prescriptions.date,
      status: prescriptions.status,
      signedAt: prescriptions.signedAt,
      dispensedAt: prescriptions.dispensedAt,
    })
    .from(prescriptions)
    .innerJoin(patients, eq(patients.id, prescriptions.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .innerJoin(doctors, eq(doctors.id, prescriptions.doctorId))
    .innerJoin(sql`users doc_user`, sql`doc_user.id = ${doctors.userId}`)
    .where(
      and(
        eq(prescriptions.hospitalId, scopeId),
        eq(prescriptions.status, "signed"),
        isNull(prescriptions.dispensedAt)
      )
    )
    .orderBy(asc(prescriptions.signedAt));

  // Fetch items per prescription.
  const items = await db
    .select()
    .from(prescriptionItems)
    .where(sql`${prescriptionItems.prescriptionId} in (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)})`);

  const itemsByRx: Record<string, typeof items> = {};
  for (const it of items) {
    (itemsByRx[it.prescriptionId] ||= []).push(it as any);
  }
  return c.json({
    prescriptions: rows.map((r) => ({ ...r, items: itemsByRx[r.id] ?? [] })),
  });
});

// POST /hospital-portal/pharmacy/prescriptions/:id/dispense
pharmacyRouter.post("/prescriptions/:id/dispense", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const now = new Date().toISOString();
  await db
    .update(prescriptions)
    .set({ status: "dispensed", dispensedAt: now, updatedAt: now })
    .where(eq(prescriptions.id, id));
  const [row] = await db.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1);
  if (row) await notify(db, row.patientId, "prescription_dispensed", { prescriptionId: id });
  await writeAudit(db, userId, "prescription.dispense", { id });
  return c.json({ ok: true });
});

// POST /hospital-portal/pharmacy/prescriptions/:id/reject
pharmacyRouter.post("/prescriptions/:id/reject", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const reason: string = body?.reason || "Rejected by pharmacy";

  // Soft-reject: cancel + record reason.
  const now = new Date().toISOString();
  await db
    .update(prescriptions)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now,
    })
    .where(eq(prescriptions.id, id));
  const [row] = await db.select().from(prescriptions).where(eq(prescriptions.id, id)).limit(1);
  if (row) await notify(db, row.patientId, "prescription_rejected", { prescriptionId: id, reason });
  await writeAudit(db, userId, "prescription.reject", { id, reason });
  return c.json({ ok: true });
});

// GET /hospital-portal/pharmacy/inventory
// Derived from prescriptions + medicines master. Returns dispensed
// quantities per master medicine. No batch/expiry tracking for MVP.
pharmacyRouter.get("/inventory", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ rows: [] });

  // Aggregate per master medicine: count of items dispensed.
  // medicinesMaster is keyed by name; match loosely via JSON extraction
  // when stored as JSON, otherwise direct join on item name.
  const rows = await db
    .select({
      medicineName: prescriptionItems.medicineName,
      dispensedQty: sql<number>`coalesce(sum(case when ${prescriptions.status} = 'dispensed' then ${prescriptionItems.quantity} else 0 end), 0)`.as("dispensed_qty"),
      orderedQty: sql<number>`coalesce(sum(case when ${prescriptions.status} = 'signed' then ${prescriptionItems.quantity} else 0 end), 0)`.as("ordered_qty"),
      lastDispensedAt: sql<string>`max(case when ${prescriptions.status} = 'dispensed' then ${prescriptions.dispensedAt} else null end)`.as("last_dispensed"),
    })
    .from(prescriptionItems)
    .innerJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
    .where(eq(prescriptions.hospitalId, scopeId))
    .groupBy(prescriptionItems.medicineName)
    .orderBy(desc(sql`dispensed_qty`));

  return c.json({ rows });
});

export default pharmacyRouter;