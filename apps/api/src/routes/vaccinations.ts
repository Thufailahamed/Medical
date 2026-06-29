// @ts-nocheck
// Structured vaccinations — admin record + due/overdue based on WHO catalog.
// Backed by `medical_records.recordType='vaccination'` (existing) + `vaccine_catalog` (V3).

import { Hono } from "hono";
import { eq, and, desc, like } from "drizzle-orm";
import {
  medicalRecords,
  vaccineCatalog,
  patients,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { canAccessPatient } from "../lib/access";
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

function ageInMonths(dob: string | null, ref: Date): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const ms = ref.getTime() - birth.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 30.4375));
}

function parseSchedule(scheduleJson: string): { monthsFromBirth: number; label: string }[] {
  try {
    const arr = JSON.parse(scheduleJson);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
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

  const now = new Date();
  const ageMonths = ageInMonths(patient.dateOfBirth, now);

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

  // For each catalog vaccine, find latest administered matching name
  // (loose match: name contains or is contained in record title)
  const due: any[] = [];
  const overdue: any[] = [];
  const upcoming: any[] = [];

  for (const v of catalog) {
    const schedule = parseSchedule(v.schedule);
    if (schedule.length === 0) continue;

    // last dose date
    const matched = administered.filter((a: any) => {
      const t = (a.title || "").toLowerCase();
      return (
        t.includes(v.name.toLowerCase()) ||
        v.name.toLowerCase().includes(t) ||
        (v.shortName && t.includes(v.shortName.toLowerCase()))
      );
    });
    const lastDate = matched.length
      ? new Date(
          matched
            .map((m: any) => m.recordDate || m.createdAt)
            .sort()
            .slice(-1)[0]
        )
      : null;

    const lastDoseIndex = matched.length; // assume one per schedule slot

    for (let i = lastDoseIndex; i < schedule.length; i++) {
      const slot = schedule[i];
      if (ageMonths == null) continue;
      const slotDate = new Date(patient.dateOfBirth || now);
      slotDate.setMonth(slotDate.getMonth() + (slot.monthsFromBirth || 0));

      const diffMs = slotDate.getTime() - now.getTime();
      const daysUntil = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const item = {
        vaccineId: v.id,
        vaccine: v.name,
        shortName: v.shortName,
        dose: i + 1,
        doseLabel: slot.label,
        dueDate: slotDate.toISOString(),
        daysUntil,
        targetDisease: v.targetDisease,
      };

      if (daysUntil < 0) {
        overdue.push(item);
      } else if (daysUntil <= 30) {
        due.push(item);
      } else {
        upcoming.push(item);
      }
    }
  }

  overdue.sort((a, b) => a.daysUntil - b.daysUntil);
  due.sort((a, b) => a.daysUntil - b.daysUntil);
  upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

  return c.json({ due, overdue, upcoming });
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
