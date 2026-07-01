// @ts-nocheck
// ─── E-Rx Phase 3: Safety Check Endpoint ────────────────────────
// POST /safety/check
//   { patientId, candidate: [{ name, dosage?, masterMedicineId? }] }
//
// Aggregates 8 checkers from `lib/safety-engine`. Returns
// { warnings, hasWarnings, severity, highestSeverity } so the
// mobile client can decide whether to surface an override modal.
//
// Auth: authenticated; access scoped via `canAccessPatient`. A doctor
// prescribing for any patient in their care may check; patients may
// check their own medications (e.g. before buying OTC).
//
// Does NOT write anything — pure read + aggregate. Persisted warnings
// happen during prescription create via the `X-Confirm-Warning` flow.

import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import {
  allergies,
  patients,
  drugInteractionsMaster,
  drugAllergiesMaster,
  patientConditions,
  medicinePregnancyWarnings,
  medicineRenalAdjustments,
  medicineLiverAdjustments,
  medicineControlled,
  medicines,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { canAccessPatient } from "../lib/access";
import {
  checkAllergy,
  checkInteractions,
  checkDuplicate,
  checkPregnancy,
  checkRenal,
  checkLiver,
  checkPediatricDose,
  checkControlledSubstance,
  topSeverity,
  type DrugWarning,
} from "../lib/safety-engine";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();

router.post("/check", authMiddleware, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const userRole = c.get("userRole") || (c.get("dbUser") as any)?.role;
  const body = await c.req.json().catch(() => ({}));

  const patientId = String(body.patientId || "").trim();
  const candidates: Array<{
    name: string;
    dosage?: string;
    masterMedicineId?: string | null;
  }> = Array.isArray(body.candidate) ? body.candidate : [];

  if (!patientId) {
    return c.json({ error: "patientId is required" }, 400);
  }
  if (!candidates.length) {
    return c.json({ warnings: [], hasWarnings: false, severity: null });
  }
  // Drop malformed rows so the checkers can assume name is present.
  const cleanCandidates = candidates.filter((c) => c && c.name);

  const access = await canAccessPatient(db, userId, userRole, patientId);
  if (!access.allowed) {
    return c.json({ error: "Access denied", reason: access.reason }, 403);
  }

  // ─── Patient context ─────────────────────────────────
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  const dob = patient?.dateOfBirth;
  const ageYears = dob ? computeAge(dob) : null;

  // ─── Allergies ───────────────────────────────────────
  const activeAllergies = await db
    .select()
    .from(allergies)
    .where(
      and(eq(allergies.patientId, patientId), eq(allergies.active, true))
    );

  // Patient allergy substances + canonical cross-reactives from master.
  // Master cross-reactives are JSON-encoded as ["x","y"].
  type AllergySub = { substance: string; severity: any; reaction?: string | null };
  const allergySubs: AllergySub[] = activeAllergies.map((a) => ({
    substance: a.substance,
    severity: a.severity,
    reaction: a.reaction,
  }));
  // Enrich from drug_allergies_master: if the patient substance matches
  // a known family, add the family members so the check covers cross-
  // reactivity (e.g. "penicillin" allergy → flag "amoxicillin").
  if (allergySubs.length) {
    const families = await db
      .select()
      .from(drugAllergiesMaster)
      .where(eq(drugAllergiesMaster.ingredientName, allergySubs[0].substance));
    for (const fam of families) {
      if (!fam.crossReactives) continue;
      try {
        const list = JSON.parse(fam.crossReactives) as string[];
        for (const x of list) {
          if (!allergySubs.find((a) => a.substance.toLowerCase() === x.toLowerCase())) {
            allergySubs.push({
              substance: x,
              severity: "moderate",
              reaction: `Cross-reactive via ${fam.family} family`,
            });
          }
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }

  // ─── Active medicines ────────────────────────────────
  const activeMeds = await db
    .select({ name: medicines.name })
    .from(medicines)
    .where(
      and(
        eq(medicines.patientId, patientId),
        eq(medicines.active, true)
      )
    );

  // ─── Interaction master (DB) ─────────────────────────
  // For now we fetch the full active set; the table is curated and
  // small (~26 rows after seed). Once it grows past ~500 rows we'll
  // narrow by candidate ingredient prefixes.
  const interactionsRows = await db
    .select()
    .from(drugInteractionsMaster)
    .where(eq(drugInteractionsMaster.active, true));

  // ─── Patient conditions ──────────────────────────────
  const conditions = await db
    .select()
    .from(patientConditions)
    .where(
      and(
        eq(patientConditions.patientId, patientId),
        eq(patientConditions.active, true)
      )
    );
  const condNames = conditions.map((c) => (c.conditionName || "").toLowerCase());
  // Pregnancy detection — currently free-text in conditions. A dedicated
  // `is_pregnant` flag will land with the structured intake redesign.
  const pregnancy = condNames.some((n) => n.includes("pregnan"))
    ? {
        isPregnant: true,
        trimester: 1 as 1 | 2 | 3, // unknown until intake is structured
      }
    : null;
  // Renal — "chronic kidney disease", "ckd", "renal failure" with optional eGFR
  const renalRow = conditions.find((c) =>
    (c.conditionName || "").toLowerCase().match(/ckd|kidney|renal/)
  );
  // Liver — "cirrhosis", "liver failure", "hepatic impairment" with Child-Pugh
  const liverRow = conditions.find((c) =>
    (c.conditionName || "").toLowerCase().match(/cirrhosis|liver|hepatic/)
  );

  // ─── Master warnings for master-linked candidates ───
  const masterIds = cleanCandidates
    .map((c) => c.masterMedicineId)
    .filter((x): x is string => !!x);
  let pregnancyRows: any[] = [];
  let renalRows: any[] = [];
  let liverRows: any[] = [];
  let controlledRows: any[] = [];
  if (masterIds.length) {
    pregnancyRows = await db
      .select()
      .from(medicinePregnancyWarnings)
      .where(inArray(medicinePregnancyWarnings.medicineId, masterIds));
    renalRows = await db
      .select()
      .from(medicineRenalAdjustments)
      .where(inArray(medicineRenalAdjustments.medicineId, masterIds));
    liverRows = await db
      .select()
      .from(medicineLiverAdjustments)
      .where(inArray(medicineLiverAdjustments.medicineId, masterIds));
    controlledRows = await db
      .select()
      .from(medicineControlled)
      .where(inArray(medicineControlled.medicineId, masterIds));
  }

  // ─── Run checkers ────────────────────────────────────
  const warnings: DrugWarning[] = [
    ...checkAllergy(cleanCandidates, allergySubs),
    ...checkInteractions(cleanCandidates, activeMeds, interactionsRows),
    ...checkDuplicate(cleanCandidates),
    ...checkPregnancy(cleanCandidates, pregnancy, pregnancyRows),
    ...checkRenal(cleanCandidates, renalRow ? { egfr: 30 } : null, renalRows),
    ...checkLiver(cleanCandidates, liverRow ? { childPugh: "B" } : null, liverRows),
    ...checkPediatricDose(cleanCandidates, ageYears),
    ...checkControlledSubstance(cleanCandidates, controlledRows),
  ];

  const severity = topSeverity(warnings);
  return c.json({
    warnings,
    hasWarnings: warnings.length > 0,
    severity,
    highestSeverity: severity, // alias for clarity in client logs
    counts: countByType(warnings),
  });
});

function countByType(warnings: DrugWarning[]) {
  const out: Record<string, number> = {};
  for (const w of warnings) out[w.type] = (out[w.type] || 0) + 1;
  return out;
}

function computeAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const mDelta = now.getUTCMonth() - d.getUTCMonth();
  if (mDelta < 0 || (mDelta === 0 && now.getUTCDate() < d.getUTCDate())) {
    years--;
  }
  return years >= 0 ? years : null;
}

export default router;