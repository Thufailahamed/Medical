// @ts-nocheck
// Structured vaccinations — admin record + due/overdue based on WHO catalog.
// Backed by `medical_records.recordType='vaccination'` (existing) + `vaccine_catalog` (V3).
// Phase 2.2: due-slot math extracted to lib/vaccine-schedule.ts so the
// cron worker and this route stay in lockstep.

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import {
  medicalRecords,
  vaccineCatalog,
  patients,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { computeVaccineDueSlots } from "../lib/vaccine-schedule";
import type { AppEnvironment } from "../types";

const vaccinationsRouter = new Hono<AppEnvironment>();

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

// ─── List my administered + catalog ──────────────────────
vaccinationsRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ administered: [], catalog: [] });

  // Administered: medical_records where recordType=vaccination
  const administered = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.patientId, patient.id),
        eq(medicalRecords.recordType, "vaccination")
      )
    )
    .orderBy(desc(medicalRecords.recordDate));

  // Catalog
  const catalog = await db.select().from(vaccineCatalog);

  return c.json({ administered, catalog });
});

// ─── Due / overdue / upcoming ────────────────────────────
vaccinationsRouter.get("/me/due", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ due: [], overdue: [], upcoming: [] });

  const administered = await db
    .select()
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.patientId, patient.id),
        eq(medicalRecords.recordType, "vaccination")
      )
    );

  const catalog = await db.select().from(vaccineCatalog);

  const slots = computeVaccineDueSlots({
    patient: { dateOfBirth: patient.dateOfBirth },
    catalog: catalog as any,
    administered: administered as any,
  });

  return c.json(slots);
});

// ─── Add a vaccination record ────────────────────────────
vaccinationsRouter.post("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) return c.json({ error: "Patient not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const vaccineName = String(body.vaccineName || body.title || "").trim();
  if (!vaccineName) return c.json({ error: "vaccineName is required" }, 400);

  const recordDate =
    body.recordDate ||
    body.administeredAt ||
    new Date().toISOString().slice(0, 10);

  // Find matching catalog entry
  let catalogEntry: any = null;
  if (body.vaccineId) {
    const [row] = await db
      .select()
      .from(vaccineCatalog)
      .where(eq(vaccineCatalog.id, body.vaccineId))
      .limit(1);
    catalogEntry = row || null;
  } else {
    const all = await db.select().from(vaccineCatalog);
    catalogEntry =
      all.find(
        (v: any) =>
          v.name.toLowerCase() === vaccineName.toLowerCase() ||
          (v.shortName &&
            v.shortName.toLowerCase() === vaccineName.toLowerCase())
      ) || null;
  }

  const title = catalogEntry ? catalogEntry.name : vaccineName;
  const description =
    body.dose != null
      ? `Dose ${body.dose}${catalogEntry?.targetDisease ? " • " + catalogEntry.targetDisease : ""}`
      : catalogEntry?.targetDisease
      ? catalogEntry.targetDisease
      : body.notes || null;

  const [row] = await db
    .insert(medicalRecords)
    .values({
      patientId: patient.id,
      recordType: "vaccination",
      title,
      description,
      recordDate,
      provider: body.provider || null,
      notes:
        body.notes ||
        (catalogEntry ? `Vaccine ID: ${catalogEntry.id}` : null),
    } as any)
    .returning();

  return c.json({ vaccination: row }, 201);
});

// ─── Tiny RBAC helper (avoids extra import cycle) ────────
export default vaccinationsRouter;
