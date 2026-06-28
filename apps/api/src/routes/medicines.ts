// @ts-nocheck

import { Hono } from "hono";
import { eq, and, lte, gte, or, isNull } from "drizzle-orm";
import { medicines, medicineDoses, patients } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const medicinesRouter = new Hono<AppEnvironment>();

function slotsForFrequency(freq: string | null): string[] {
  switch ((freq || "").toLowerCase()) {
    case "once daily":
      return ["09:00"];
    case "twice daily":
      return ["09:00", "21:00"];
    case "three times daily":
      return ["09:00", "15:00", "21:00"];
    case "four times daily":
      return ["08:00", "13:00", "18:00", "22:00"];
    default:
      return ["09:00"];
  }
}

async function scheduleTodayForMedicine(
  db: any,
  medicineRow: any,
  today: string
) {
  const start = medicineRow.startDate || today;
  const end = medicineRow.endDate || today;
  if (today < start || today > end) return 0;

  // Don't create duplicates if doses already exist for this medicine today
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;
  const existing = await db
    .select()
    .from(medicineDoses)
    .where(
      and(
        eq(medicineDoses.medicineId, medicineRow.id),
        gte(medicineDoses.scheduledFor, dayStart),
        lte(medicineDoses.scheduledFor, dayEnd)
      )
    );
  const existingTimes = new Set(
    existing.map((e: any) =>
      new Date(e.medicine_doses?.scheduledFor || e.scheduledFor).toTimeString().slice(0, 5)
    )
  );

  const now = new Date();
  let created = 0;
  for (const time of slotsForFrequency(medicineRow.frequency)) {
    if (existingTimes.has(time)) continue;
    const [hh, mm] = time.split(":").map(Number);
    const scheduled = new Date(now);
    scheduled.setHours(hh || 9, mm || 0, 0, 0);
    await db.insert(medicineDoses).values({
      medicineId: medicineRow.id,
      patientId: medicineRow.patientId,
      scheduledFor: scheduled.toISOString(),
    } as any);
    created += 1;
  }
  return created;
}

// ─── Get my medicines ────────────────────────────────────
medicinesRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const active = await db
    .select()
    .from(medicines)
    .where(eq(medicines.patientId, (patient.patients?.id ?? patient.id)));

  return c.json({ medicines: active });
});

// ─── Add medicine (patient can add for self, doctor for any) ──
medicinesRouter.post("/", authMiddleware, requireRole("patient", "doctor"), async (c) => {
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = await c.req.json();
  const db = c.get("db");

  // Ownership check: patients can only add for themselves
  if (userRole === "patient") {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient || (patient.patients?.id ?? patient.id) !== body.patientId) {
      return c.json({ error: "Cannot add medicines for other patients" }, 403);
    }
  }

  const [medicine] = await db
    .insert(medicines)
    .values({
      patientId: body.patientId,
      prescriptionId: body.prescriptionId,
      name: body.name,
      dosage: body.dosage,
      frequency: body.frequency,
      timing: body.timing,
      startDate: body.startDate,
      endDate: body.endDate,
      refillReminder: body.refillReminder ?? false,
      notes: body.notes,
    })
    .returning();

  // Auto-schedule today's doses for the new medicine (no-op if out of range).
  const today = new Date().toISOString().slice(0, 10);
  const medRow = (medicine as any).medicines || medicine;
  const dosesCreated = await scheduleTodayForMedicine(db, medRow, today);

  return c.json({ medicine, dosesCreated }, 201);
});

// ─── Update medicine (with ownership check) ──────────────
medicinesRouter.put("/:id", authMiddleware, requireRole("patient", "doctor"), async (c) => {
  const medicineId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = await c.req.json();
  const db = c.get("db");

  // Ownership check
  if (userRole === "patient") {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient) {
      return c.json({ error: "Patient not found" }, 404);
    }

    const [existing] = await db
      .select()
      .from(medicines)
      .where(eq(medicines.id, medicineId))
      .limit(1);

    if (!existing || (existing.medicines?.patientId ?? existing.patientId) !== (patient.patients?.id ?? patient.id)) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  const [updated] = await db
    .update(medicines)
    .set({
      name: body.name,
      dosage: body.dosage,
      frequency: body.frequency,
      timing: body.timing,
      endDate: body.endDate,
      refillReminder: body.refillReminder,
      notes: body.notes,
      active: body.active,
    })
    .where(eq(medicines.id, medicineId))
    .returning();

  return c.json({ medicine: updated });
});

// ─── Stop medicine (with ownership check) ────────────────
medicinesRouter.post("/:id/stop", authMiddleware, requireRole("patient"), async (c) => {
  const medicineId = c.req.param("id");
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const [existing] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, medicineId))
    .limit(1);

  if (!existing || (existing.medicines?.patientId ?? existing.patientId) !== (patient.patients?.id ?? patient.id)) {
    return c.json({ error: "Access denied" }, 403);
  }

  const [updated] = await db
    .update(medicines)
    .set({ active: false, endDate: new Date().toISOString().split("T")[0] })
    .where(eq(medicines.id, medicineId))
    .returning();

  return c.json({ medicine: updated });
});

// ─── Delete medicine (with ownership check) ──────────────
medicinesRouter.delete("/:id", authMiddleware, requireRole("patient", "doctor"), async (c) => {
  const medicineId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  if (userRole === "patient") {
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.userId, userId))
      .limit(1);

    if (!patient) {
      return c.json({ error: "Patient not found" }, 404);
    }

    const [existing] = await db
      .select()
      .from(medicines)
      .where(eq(medicines.id, medicineId))
      .limit(1);

    if (!existing || (existing.medicines?.patientId ?? existing.patientId) !== (patient.patients?.id ?? patient.id)) {
      return c.json({ error: "Access denied" }, 403);
    }
  }

  await db.delete(medicines).where(eq(medicines.id, medicineId));

  return c.json({ message: "Medicine deleted" });
});

// ─── Today's schedule ────────────────────────────────────
medicinesRouter.get("/today", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);

  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const today = new Date().toISOString().split("T")[0];

  const todayMeds = await db
    .select()
    .from(medicines)
    .where(
      and(
        eq(medicines.patientId, (patient.patients?.id ?? patient.id)),
        eq(medicines.active, true),
        lte(medicines.startDate, today),
        or(
          isNull(medicines.endDate),
          gte(medicines.endDate, today)
        )
      )
    );

  return c.json({ medicines: todayMeds });
});

export default medicinesRouter;
