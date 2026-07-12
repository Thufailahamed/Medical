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
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { computeVaccineDueSlots } from "../lib/vaccine-schedule";
import { parseAcceptLanguage, type Locale } from "../lib/locale";
import { resolvePatientContext } from "../lib/caretaker";
import type { AppEnvironment } from "../types";

const vaccinationsRouter = new Hono<AppEnvironment>();

/** Resolve a vaccine's display name in the user's preferred locale.
 *  Mirrors the same lookup in cron/vaccination-reminders.ts; falls back to
 *  English (`name`) when the locale column is NULL. */
function vaccineNameFor(
  v: any,
  locale: Locale
): string {
  if (locale === "si" && v.nameSi) return v.nameSi;
  if (locale === "ta" && v.nameTa) return v.nameTa;
  return v.name;
}

/** Resolve a vaccine's target disease name in the user's preferred locale. */
function diseaseNameFor(v: any, locale: Locale): string | undefined {
  if (locale === "si" && v.targetDiseaseSi) return v.targetDiseaseSi;
  if (locale === "ta" && v.targetDiseaseTa) return v.targetDiseaseTa;
  return v.targetDisease;
}

// Caretaker Profiles: getOwnPatient removed in favor of resolvePatientContext
// which respects the active-principal header for caretakers.

// ─── List my administered + catalog ──────────────────────
vaccinationsRouter.get("/me", authMiddleware, requireRole("patient", "caretaker"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
  if (!patient) return c.json({ administered: [], catalog: [] });

  // Phase 2.3: family-context filter — when active FM is set, scope to
  // that member's records. Without active FM, list the principal + family
  // union (the historical default — keeps existing installs working).
  const activeFm = (c.get("activeFamilyMemberId") as string | null) || null;
  const fmFilter = activeFm ? eq(medicalRecords.familyMemberId, activeFm) : undefined;

  const administered = await db
    .select()
    .from(medicalRecords)
    .where(
      fmFilter
        ? and(
            eq(medicalRecords.patientId, patient.id),
            eq(medicalRecords.recordType, "vaccination"),
            fmFilter
          )
        : and(
            eq(medicalRecords.patientId, patient.id),
            eq(medicalRecords.recordType, "vaccination")
          )
    )
    .orderBy(desc(medicalRecords.recordDate));

  // Catalog
  const catalog = await db.select().from(vaccineCatalog);

  // Phase 2.2.2: localize `name` + `targetDisease` projection for chips.
  const acceptLocale = parseAcceptLanguage(c.req.header("Accept-Language"));
  const [u] = await db
    .select({ preferredLocale: users.preferredLocale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const locale: Locale =
    (u?.preferredLocale === "si" || u?.preferredLocale === "ta")
      ? (u.preferredLocale as Locale)
      : acceptLocale;

  const localizedCatalog = (catalog as any[]).map((v) => ({
    ...v,
    name: vaccineNameFor(v, locale),
    targetDisease: diseaseNameFor(v, locale),
  }));

  return c.json({ administered, catalog: localizedCatalog });
});

// ─── Due / overdue / upcoming ────────────────────────────
vaccinationsRouter.get("/me/due", authMiddleware, requireRole("patient", "caretaker"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
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

  // Phase 2.2.2: localize slot `vaccine` and `targetDisease` for the
  // user. Source = Accept-Language header (preferred on this path) with
  // fall-through to `users.preferred_locale` so the cron push and the
  // GET list agree.
  const acceptLocale = parseAcceptLanguage(c.req.header("Accept-Language"));
  const [u] = await db
    .select({ preferredLocale: users.preferredLocale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const locale: Locale =
    (u?.preferredLocale === "si" || u?.preferredLocale === "ta")
      ? (u.preferredLocale as Locale)
      : acceptLocale;

  const localize = (s: any) => {
    const v = (catalog as any[]).find((x) => x.id === s.vaccineId);
    if (!v) return s;
    return {
      ...s,
      vaccine: vaccineNameFor(v, locale),
      targetDisease: diseaseNameFor(v, locale) ?? s.targetDisease,
    };
  };

  return c.json({
    due: slots.due.map(localize),
    overdue: slots.overdue.map(localize),
    upcoming: slots.upcoming.map(localize),
  });
});

// ─── Add a vaccination record ────────────────────────────
vaccinationsRouter.post("/me", authMiddleware, requireRole("patient", "caretaker"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await resolvePatientContext(c);
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

// Phase 2.3: explicit body.familyMemberId wins; otherwise active FM
  // resolves to a default. NULL stays NULL.
  const explicitFm = (body as any).familyMemberId ?? null;
  const activeFm = (c.get("activeFamilyMemberId") as string | null) || null;
  const familyMemberId = explicitFm || activeFm || null;

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
      familyMemberId,
    } as any)
    .returning();

  return c.json({ vaccination: row }, 201);
});

// ─── Tiny RBAC helper (avoids extra import cycle) ────────
export default vaccinationsRouter;
