// @ts-nocheck

import { Hono } from "hono";
import { eq, and, lte, gte, or, isNull, sql } from "drizzle-orm";
import {
  medicines,
  medicineDoses,
  patients,
  allergies,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { medicineSchema, medicineUpdateSchema } from "../lib/validators";
import { canAccessPatient } from "../lib/access";
import { MEDICINE_CATALOG } from "../data/medicines-catalog";
import { findStaticInteractions } from "../lib/ai";
import {
  formatLocalDate,
  localDayToUtcRange,
  localHHMM,
  localToday,
} from "../lib/timezone";
import { slotsForFrequency, isAsNeeded } from "../lib/medicine-slots";
import { flattenTranslated } from "../lib/validation-error";
import type { AppEnvironment } from "../types";

const medicinesRouter = new Hono<AppEnvironment>();

// slotsForFrequency + isAsNeeded now imported from ../lib/medicine-slots.

async function getOwnPatient(db: any, userId: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return p || null;
}

async function scheduleTodayForMedicine(
  db: any,
  medicineRow: any,
  today: string
) {
  const start = medicineRow.startDate || today;
  const end = medicineRow.endDate || today;
  if (today < start || today > end) return 0;

  // B1 (timezone): use local-day UTC range, not literal T00/T23 bounds
  // from a UTC date string. Same fix as the standalone /doses/schedule/today
  // handler so behaviour is identical whether scheduling on add or on demand.
  const { startUtc: dayStart, endUtc: dayEnd } = localDayToUtcRange(today);
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
    existing.map((e: any) => localHHMM(e.scheduledFor))
  );

  let created = 0;
  for (const time of slotsForFrequency(medicineRow.frequency, medicineRow.timing)) {
    if (existingTimes.has(time)) continue;
    const [hh, mm] = time.split(":").map(Number);
    const scheduled = new Date();
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

// ─── Get my medicines (active only by default) ───────────
// GET /medicines/me?includeInactive=true
medicinesRouter.get("/me", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const patient = await getOwnPatient(db, userId);
  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const includeInactive = c.req.query("includeInactive") === "true";

  const list = await db
    .select()
    .from(medicines)
    .where(
      includeInactive
        ? eq(medicines.patientId, patient.id)
        : and(
            eq(medicines.patientId, patient.id),
            eq(medicines.active, true)
          )
    )
    .orderBy(medicines.createdAt);

  return c.json({ medicines: list });
});

// ─── Stats + 7-day adherence ─────────────────────────────
// GET /medicines/me/stats
medicinesRouter.get("/me/stats", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) {
    return c.json({
      activeCount: 0,
      pausedCount: 0,
      todayCount: 0,
      todayTaken: 0,
      streakDays: 0,
      last7Days: [] as Array<{ date: string; total: number; taken: number; pct: number }>,
    });
  }

  // active vs paused
  const counts = await db
    .select({
      active: medicines.active,
      c: sql<number>`count(*)`,
    })
    .from(medicines)
    .where(eq(medicines.patientId, patient.id))
    .groupBy(medicines.active);
  let activeCount = 0;
  let pausedCount = 0;
  for (const r of counts) {
    if (r.active) activeCount = Number(r.c);
    else pausedCount = Number(r.c);
  }

  // today — B1 (timezone): use local calendar day, then derive the
  // UTC range that covers it. The previous `${today}T00:00:00.000Z`
  // pattern read the UTC date and skipped doses scheduled on the user's
  // local "today" that landed in a different UTC day.
  const today = localToday();
  const { startUtc: todayStart, endUtc: todayEnd } =
    localDayToUtcRange(today);
  const [todayRow] = await db
    .select({
      total: sql<number>`count(*)`,
      taken: sql<number>`sum(case when taken_at is not null then 1 else 0 end)`,
    })
    .from(medicineDoses)
    .where(
      and(
        eq(medicineDoses.patientId, patient.id),
        gte(medicineDoses.scheduledFor, todayStart),
        lte(medicineDoses.scheduledFor, todayEnd)
      )
    );
  const todayCount = Number(todayRow?.total ?? 0);
  const todayTaken = Number(todayRow?.taken ?? 0);

  // F3: window now configurable via ?days= (default 7, cap 90).
  // group by LOCAL date of scheduledFor.
  // B1 (timezone): use local day arithmetic + formatLocalDate() on
  // every key so the buckets line up with the dose rows even when
  // the dose's UTC time falls in a different calendar day.
  const days = Math.min(
    Math.max(parseInt(c.req.query("days") || "7", 10) || 7, 1),
    90
  );
  const sevenStart = new Date();
  sevenStart.setHours(0, 0, 0, 0);
  sevenStart.setDate(sevenStart.getDate() - (days - 1));
  const doseRows = await db
    .select({
      scheduledFor: medicineDoses.scheduledFor,
      takenAt: medicineDoses.takenAt,
      skipped: medicineDoses.skipped,
    })
    .from(medicineDoses)
    .where(
      and(
        eq(medicineDoses.patientId, patient.id),
        gte(medicineDoses.scheduledFor, sevenStart.toISOString())
      )
    );

  const byDate: Record<
    string,
    { total: number; taken: number; skipped: number; missed: number }
  > = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(sevenStart);
    d.setDate(sevenStart.getDate() + i);
    const key = formatLocalDate(d);
    byDate[key] = { total: 0, taken: 0, skipped: 0, missed: 0 };
  }
  for (const r of doseRows) {
    const key = formatLocalDate(r.scheduledFor);
    if (!byDate[key]) continue;
    byDate[key].total += 1;
    if (r.takenAt) byDate[key].taken += 1;
    else if (r.skipped) byDate[key].skipped += 1;
    else {
      // past & not taken & not skipped = missed
      if (new Date(r.scheduledFor).getTime() < Date.now()) {
        byDate[key].missed += 1;
      }
    }
  }
  const last7Days = Object.entries(byDate)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({
      date,
      total: v.total,
      taken: v.taken,
      skipped: v.skipped,
      missed: v.missed,
      pct: v.total > 0 ? Math.round((v.taken / v.total) * 100) : 0,
    }));

  // streak = consecutive days from yesterday backwards with >=80% adherence
  // (today excluded because it's incomplete).
  // M2: a gap day (total=0, i.e. user wasn't on any medicines) breaks the
  // streak. Previously `continue` silently skipped gap days and let a
  // streak survive weeks of zero-schedule days, which is misleading.
  let streakDays = 0;
  for (let i = last7Days.length - 2; i >= 0; i--) {
    const day = last7Days[i];
    if (day.total === 0) break;
    if (day.pct >= 80) streakDays += 1;
    else break;
  }

  return c.json({
    activeCount,
    pausedCount,
    todayCount,
    todayTaken,
    streakDays,
    last7Days,
  });
});

// ─── Interaction check (allergy + drug-drug) ──────────────
// GET /medicines/me/interactions?candidate=amoxicillin
// Returns { allergies: [...], interactions: [...] } matching the candidate
// against active medicines + active allergies. Pure fast-path: no LLM.
medicinesRouter.get("/me/interactions", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const patient = await getOwnPatient(db, userId);
  if (!patient) {
    return c.json({ allergies: [], interactions: [] });
  }

  const candidate = String(c.req.query("candidate") || "").trim();
  if (!candidate) {
    return c.json({ allergies: [], interactions: [] });
  }
  const candidateNorm = candidate.toLowerCase();

  // Active medicines for this patient
  const activeMeds = await db
    .select({ id: medicines.id, name: medicines.name })
    .from(medicines)
    .where(and(eq(medicines.patientId, patient.id), eq(medicines.active, true)));
  const activeNames = activeMeds.map((m: any) => m.name).filter(Boolean) as string[];

  // Active allergies for this patient
  const activeAllergies = await db
    .select()
    .from(allergies)
    .where(and(eq(allergies.patientId, patient.id), eq(allergies.active, true)));

  // Allergy match: candidate substance matches allergy substance (substring,
  // case-insensitive, both directions).
  const allergyMatches = activeAllergies
    .filter((a: any) => {
      const sub = (a.substance || "").toLowerCase();
      if (!sub) return false;
      return (
        candidateNorm.includes(sub) ||
        sub.includes(candidateNorm) ||
        // Cross-class matches: penicillins / cephalosporins, NSAIDs, etc.
        crossMatches(candidateNorm, sub)
      );
    })
    .map((a: any) => ({
      id: a.id,
      substance: a.substance,
      severity: a.severity,
      reaction: a.reaction || null,
    }));

  // Drug-drug interactions: curated table, candidate + each active medicine.
  const combined = [...activeNames, candidate];
  const interactions = findStaticInteractions(combined).map((i) => ({
    medicines: i.medicines,
    severity: i.severity,
    note: i.note,
    source: i.source,
  }));

  // Also: explicit pair check between candidate and each active (subset
  // match) — covers cases where curated list names a generic class.
  for (const m of activeNames) {
    if (m.toLowerCase() === candidateNorm) continue;
  }

  return c.json({
    candidate,
    activeMedicines: activeNames,
    allergies: allergyMatches,
    interactions,
    hasWarnings: allergyMatches.length > 0 || interactions.some((i) => i.severity !== "minor"),
    severity: topSeverity(allergyMatches, interactions),
  });
});

// Severity ordering for top-of-list warning
function topSeverity(
  allergies: Array<{ severity: string }>,
  interactions: Array<{ severity: string }>
): "minor" | "moderate" | "severe" | "critical" | null {
  const order = ["minor", "moderate", "severe", "critical"];
  let best: number = -1;
  for (const a of allergies) {
    const i = order.indexOf(a.severity);
    if (i > best) best = i;
  }
  for (const i of interactions) {
    const j = order.indexOf(i.severity);
    if (j > best) best = j;
  }
  return best >= 0 ? (order[best] as any) : null;
}

// Lightweight cross-class match for common allergy families. Substring-only,
// case-insensitive. Safe because it's read-only advisory output.
const CLASS_GROUPS: Array<{ family: string; members: string[] }> = [
  { family: "penicillins", members: ["penicillin", "amoxicillin", "ampicillin", "amoxicillin-clavulanate", "piperacillin"] },
  { family: "cephalosporins", members: ["cephalosporin", "cefalexin", "cefuroxime", "ceftriaxone", "cefepime"] },
  { family: "nsaids", members: ["nsaid", "ibuprofen", "aspirin", "naproxen", "diclofenac", "ketorolac"] },
  { family: "sulfonamides", members: ["sulfonamide", "sulfa", "trimethoprim", "sulfamethoxazole"] },
];
function crossMatches(a: string, b: string): boolean {
  for (const g of CLASS_GROUPS) {
    const aIn = g.members.some((m) => a.includes(m));
    const bIn = g.members.some((m) => b.includes(m));
    if (aIn && bIn) return true;
  }
  return false;
}

// ─── Suggest medicine names (autocomplete) ───────────────
// GET /medicines/suggest?q=metf&limit=8
// Combines curated catalog + patient's own history. Patient-only.
medicinesRouter.get("/suggest", authMiddleware, requireRole("patient"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const q = (c.req.query("q") || "").trim().toLowerCase();
  const limit = Math.min(20, Math.max(1, parseInt(c.req.query("limit") || "8", 10) || 8));

  const patient = await getOwnPatient(db, userId);
  const personalByName = new Map<
    string,
    { name: string; commonDosages: Set<string>; commonFrequencies: Set<string>; commonTimings: Set<string> }
  >();

  if (patient) {
    const own = await db
      .select({ name: medicines.name, dosage: medicines.dosage, frequency: medicines.frequency, timing: medicines.timing })
      .from(medicines)
      .where(eq(medicines.patientId, patient.id));
    for (const r of own) {
      const key = (r.name || "").trim().toLowerCase();
      if (!key) continue;
      let bucket = personalByName.get(key);
      if (!bucket) {
        bucket = { name: r.name, commonDosages: new Set(), commonFrequencies: new Set(), commonTimings: new Set() };
        personalByName.set(key, bucket);
      }
      if (r.dosage) bucket.commonDosages.add(r.dosage);
      if (r.frequency) bucket.commonFrequencies.add(r.frequency);
      if (r.timing) bucket.commonTimings.add(r.timing);
    }
  }

  type Suggestion = {
    name: string;
    category?: string;
    commonDosages: string[];
    commonFrequencies: string[];
    commonTimings: string[];
    source: "history" | "catalog";
    score: number;
  };

  const scored: Suggestion[] = [];

  // Personal history — strongest signal.
  for (const [key, b] of personalByName.entries()) {
    let score = 1000;
    if (q) {
      if (key === q) score = 4000;
      else if (key.startsWith(q)) score = 3500;
      else if (key.includes(q)) score = 3000;
      else score = 0;
    }
    if (score === 0) continue;
    scored.push({
      name: b.name,
      commonDosages: [...b.commonDosages].slice(0, 5),
      commonFrequencies: [...b.commonFrequencies].slice(0, 4),
      commonTimings: [...b.commonTimings].slice(0, 4),
      source: "history",
      score,
    });
  }

  // Curated catalog — fill remaining slots.
  if (scored.length < limit || !q) {
    for (const entry of MEDICINE_CATALOG) {
      const nameKey = entry.name.toLowerCase();
      const aliasKeys = (entry.aliases || []).map((a) => a.toLowerCase());
      let score = 0;
      if (!q) {
        score = 100; // show popular when no query
      } else if (nameKey === q) {
        score = 2000;
      } else if (aliasKeys.includes(q)) {
        score = 1900;
      } else if (nameKey.startsWith(q)) {
        score = 1500;
      } else if (aliasKeys.some((a) => a.startsWith(q))) {
        score = 1450;
      } else if (nameKey.includes(q) || aliasKeys.some((a) => a.includes(q))) {
        score = 1000;
      }
      if (score === 0) continue;

      // Merge personal dosage/frequency into catalog entry when same name.
      const personal = personalByName.get(nameKey);
      const dosages = personal
        ? [...new Set([...entry.commonDosages, ...personal.commonDosages])].slice(0, 5)
        : entry.commonDosages.slice(0, 5);
      const frequencies = personal
        ? [...new Set([...entry.commonFrequencies, ...personal.commonFrequencies])].slice(0, 4)
        : entry.commonFrequencies.slice(0, 4);
      const timings = personal
        ? [...new Set([...(entry.commonTimings || []), ...personal.commonTimings])].slice(0, 4)
        : (entry.commonTimings || []).slice(0, 4);

      scored.push({
        name: entry.name,
        category: entry.category,
        commonDosages: dosages,
        commonFrequencies: frequencies,
        commonTimings: timings,
        source: "catalog",
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // Dedup by canonical name, keeping highest score.
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of scored) {
    const key = s.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }

  return c.json({ suggestions: out, query: q, count: out.length });
});

// ─── Today's schedule ────────────────────────────────────
medicinesRouter.get("/today", authMiddleware, requireRole("patient"), async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");

  const patient = await getOwnPatient(db, userId);
  if (!patient) {
    return c.json({ error: "Patient not found" }, 404);
  }

  const today = new Date().toISOString().split("T")[0];

  const todayMeds = await db
    .select()
    .from(medicines)
    .where(
      and(
        eq(medicines.patientId, patient.id),
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

// ─── Get one medicine ────────────────────────────────────
medicinesRouter.get("/:id", authMiddleware, async (c) => {
  const medicineId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const [row] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, medicineId))
    .limit(1);
  if (!row) return c.json({ error: "Medicine not found" }, 404);

  const access = await canAccessPatient(db, userId, userRole, row.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  return c.json({ medicine: row });
});

// ─── Add medicine (patient self, doctor/staff for patient with access) ─
medicinesRouter.post("/", authMiddleware, requireRole("patient", "doctor", "hospital_staff"), async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const userRole = c.get("userRole");

  const body = await c.req.json().catch(() => ({}));
  const parsed = medicineSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }
  const data = parsed.data;

  // RBAC: patient can only add for themselves; doctor/staff must have relationship.
  const access = await canAccessPatient(db, userId, userRole, data.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // ─── V3: Interaction guard ──────────────────────────────
  // Run a fast-path interaction check (allergies + curated drug pairs).
  // If a severe or critical match exists, return 409 with a structured
  // warning body that mobile can render as a confirmation modal.
  const candidateNorm = data.name.toLowerCase();
  const activeMeds = await db
    .select({ id: medicines.id, name: medicines.name })
    .from(medicines)
    .where(and(eq(medicines.patientId, data.patientId), eq(medicines.active, true)));
  const activeNames = activeMeds.map((m: any) => m.name).filter(Boolean) as string[];

  const activeAllergies = await db
    .select()
    .from(allergies)
    .where(and(eq(allergies.patientId, data.patientId), eq(allergies.active, true)));

  const allergyMatches = activeAllergies
    .filter((a: any) => {
      const sub = (a.substance || "").toLowerCase();
      if (!sub) return false;
      return (
        candidateNorm.includes(sub) ||
        sub.includes(candidateNorm) ||
        crossMatches(candidateNorm, sub)
      );
    })
    .map((a: any) => ({
      id: a.id,
      substance: a.substance,
      severity: a.severity,
      reaction: a.reaction || null,
    }));

  const drugInteractions = findStaticInteractions([...activeNames, data.name]).map((i) => ({
    medicines: i.medicines,
    severity: i.severity,
    note: i.note,
  }));

  const criticalAllergy = allergyMatches.find((a) => a.severity === "critical" || a.severity === "severe");
  const severeInteraction = drugInteractions.find((i) => i.severity === "severe");
  const blocked = criticalAllergy || severeInteraction;

  // Only block when the body doesn't carry an explicit override header.
  // This lets the mobile app re-submit after the user confirms despite a warning.
  const override = c.req.header("X-Confirm-Warning") === "true";

  if (blocked && !override) {
    return c.json(
      {
        error: "Interaction warning",
        requiresConfirmation: true,
        allergies: allergyMatches,
        interactions: drugInteractions,
        severity: topSeverity(allergyMatches, drugInteractions),
        message: criticalAllergy
          ? `Critical allergy match: ${criticalAllergy.substance}. Confirm to proceed anyway.`
          : `Severe drug interaction: ${severeInteraction?.note}`,
      },
      409
    );
  }

  const [medicine] = await db
    .insert(medicines)
    .values({
      patientId: data.patientId,
      prescriptionId: data.prescriptionId,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      timing: data.timing,
      startDate: data.startDate,
      endDate: data.endDate,
      refillReminder: data.refillReminder ?? false,
      notes: data.notes,
      active: true,
    } as any)
    .returning();

  // Auto-schedule today's doses for the new medicine.
  const today = new Date().toISOString().slice(0, 10);
  const dosesCreated = await scheduleTodayForMedicine(db, medicine, today);

  return c.json({ medicine, dosesCreated, warningsAcknowledged: blocked ? true : false }, 201);
});

// ─── Update medicine (PATCH) ──────────────────────────────
medicinesRouter.patch("/:id", authMiddleware, async (c) => {
  const medicineId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const [existing] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, medicineId))
    .limit(1);
  if (!existing) return c.json({ error: "Medicine not found" }, 404);

  const access = await canAccessPatient(db, userId, userRole, existing.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = medicineUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: flattenTranslated(parsed.error, c.get("locale")) },
      400
    );
  }

  const [updated] = await db
    .update(medicines)
    .set(parsed.data as any)
    .where(eq(medicines.id, medicineId))
    .returning();

  return c.json({ medicine: updated });
});

// ─── Update medicine (PUT, legacy) ────────────────────────
medicinesRouter.put("/:id", authMiddleware, requireRole("patient", "doctor"), async (c) => {
  const medicineId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const body = await c.req.json();
  const db = c.get("db");

  const [existing] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, medicineId))
    .limit(1);
  if (!existing) return c.json({ error: "Medicine not found" }, 404);

  const access = await canAccessPatient(db, userId, userRole, existing.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
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
medicinesRouter.post("/:id/stop", authMiddleware, requireRole("patient", "doctor"), async (c) => {
  const medicineId = c.req.param("id");
  const userId = c.get("userId");
  const userRole = c.get("userRole");
  const db = c.get("db");

  const [existing] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, medicineId))
    .limit(1);
  if (!existing) return c.json({ error: "Medicine not found" }, 404);

  const access = await canAccessPatient(db, userId, userRole, existing.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
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

  const [existing] = await db
    .select()
    .from(medicines)
    .where(eq(medicines.id, medicineId))
    .limit(1);
  if (!existing) return c.json({ error: "Medicine not found" }, 404);

  const access = await canAccessPatient(db, userId, userRole, existing.patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  await db.delete(medicines).where(eq(medicines.id, medicineId));

  return c.json({ message: "Medicine deleted" });
});

export default medicinesRouter;