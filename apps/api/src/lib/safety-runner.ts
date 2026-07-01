// @ts-nocheck
// ─── E-Rx Phase 3: Safety runner (DB-side) ─────────────────────
// Shared pre-flight that aggregates all 8 safety-engine checkers
// against a (patient, candidates) pair. Used by:
//   • apps/api/src/routes/doctor.ts POST /prescriptions
//   • apps/api/src/routes/doctor-portal.ts POST /visit-summary
//
// Pure read + aggregate — does NOT write to D1. The caller decides
// whether to surface a 409 or proceed (with or without override).

import { eq, and, inArray } from "drizzle-orm";
import {
  patients,
  allergies,
  medicines,
  drugInteractionsMaster,
  patientConditions,
  medicinePregnancyWarnings,
  medicineRenalAdjustments,
  medicineLiverAdjustments,
  medicineControlled,
} from "@healthcare/db";
import {
  checkAllergy,
  checkInteractions,
  checkDuplicate,
  checkPregnancy,
  checkRenal,
  checkLiver,
  checkPediatricDose,
  checkControlledSubstance,
  type DrugWarning,
} from "./safety-engine";

export type Candidate = {
  name: string;
  dosage?: string;
  masterMedicineId?: string | null;
};

export async function runSafetyCheck(
  db: any,
  patientId: string,
  candidates: Candidate[]
): Promise<DrugWarning[]> {
  if (!patientId || !candidates.length) return [];
  const clean = candidates.filter((c) => c && c.name);
  if (!clean.length) return [];

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  const ageYears = patient?.dateOfBirth ? computeAge(patient.dateOfBirth) : null;

  const allergyRows = await db
    .select()
    .from(allergies)
    .where(and(eq(allergies.patientId, patientId), eq(allergies.active, true)));

  const activeMeds = await db
    .select({ name: medicines.name })
    .from(medicines)
    .where(and(eq(medicines.patientId, patientId), eq(medicines.active, true)));

  const interactions = await db
    .select()
    .from(drugInteractionsMaster)
    .where(eq(drugInteractionsMaster.active, true));

  const conditions = await db
    .select()
    .from(patientConditions)
    .where(
      and(eq(patientConditions.patientId, patientId), eq(patientConditions.active, true))
    );
  const condLower = conditions.map((c: any) => (c.conditionName || "").toLowerCase());
  const pregnancy = condLower.some((n: string) => n.includes("pregnan"))
    ? { isPregnant: true, trimester: 1 as 1 | 2 | 3 }
    : null;
  const renalRow = conditions.find((c: any) =>
    (c.conditionName || "").toLowerCase().match(/ckd|kidney|renal/)
  );
  const liverRow = conditions.find((c: any) =>
    (c.conditionName || "").toLowerCase().match(/cirrhosis|liver|hepatic/)
  );

  const masterIds = clean
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

  return [
    ...checkAllergy(clean, allergyRows),
    ...checkInteractions(clean, activeMeds, interactions),
    ...checkDuplicate(clean),
    ...checkPregnancy(clean, pregnancy, pregnancyRows),
    ...checkRenal(clean, renalRow ? { egfr: 30 } : null, renalRows),
    ...checkLiver(clean, liverRow ? { childPugh: "B" } : null, liverRows),
    ...checkPediatricDose(clean, ageYears),
    ...checkControlledSubstance(clean, controlledRows),
  ];
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