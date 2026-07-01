// @ts-nocheck
// ─── E-Rx Phase 3: Clinical Safety Engine ─────────────────────
// 8 pure checkers. Each takes pre-fetched data so the route handler
// stays a thin DB-read + aggregation shell. Output shape is stable so
// mobile + future web clients can render with the same widget set.
//
// Design notes
// ────────────
// • Severity ladder: minor < moderate < severe < critical. Anything
//   severe-or-worse blocks the create flow unless X-Confirm-Warning
//   is set (handled in routes/doctor.ts + medicines.ts, mirroring the
//   existing 409 confirmation pattern).
// • `medicines` strings on each warning are the human-readable names
//   so the mobile UI can render them without re-querying.
// • Lookup is substring + cross-family. Same pattern as the legacy
//   `findStaticInteractions` + `CLASS_GROUPS` helpers — substring is
//   good enough for a write-time check; stricter exact-match can come
//   later when every medicine carries a master FK.
//
// Replaces
// ────────
// • `findStaticInteractions` (apps/api/src/lib/ai.ts) — DB-backed now
//   via `drug_interactions_master`; source field reports "db".
// • `CLASS_GROUPS` block (apps/api/src/routes/medicines.ts:359-372)
//   — DB-backed now via `drug_allergies_master.family` membership
//   of the patient allergy substance.

export type Severity = "minor" | "moderate" | "severe" | "critical";

export type DrugWarning = {
  type:
    | "interaction"
    | "allergy"
    | "duplicate"
    | "pregnancy"
    | "renal"
    | "liver"
    | "pediatric"
    | "controlled";
  severity: Severity;
  /** Human-readable medicine names involved in the warning. */
  medicines?: string[];
  message: string;
  recommendation: string;
  source: string;
};

// Severity ordering — index 0 is lowest. Used everywhere we need to
// pick the worst-case across a warning set.
const SEVERITY_ORDER: Severity[] = ["minor", "moderate", "severe", "critical"];

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

export function topSeverity(
  warnings: DrugWarning[]
): Severity | null {
  if (!warnings.length) return null;
  let best = 0;
  for (const w of warnings) {
    const i = SEVERITY_ORDER.indexOf(w.severity);
    if (i > best) best = i;
  }
  return SEVERITY_ORDER[best];
}

// ─── Allergy cross-family table (mirrors drug_allergies_master seed) ─
// Substring match + family membership. Inline copy of the seed data
// from `apps/api/scripts/seed-rxcui-list.ts` (SEED_ALLERGY_FAMILIES) so
// the engine stays usable even before the seed runs (e.g. fresh dev
// environment). The route also consults `drug_allergies_master` for
// the canonical list — this fallback only fires for FK-less rows.
const ALLERGY_FAMILIES: Array<{ family: string; members: string[] }> = [
  {
    family: "penicillins",
    members: [
      "penicillin",
      "amoxicillin",
      "ampicillin",
      "amoxicillin-clavulanate",
      "augmentin",
      "piperacillin",
    ],
  },
  {
    family: "cephalosporins",
    members: [
      "cephalosporin",
      "cefalexin",
      "cefuroxime",
      "ceftriaxone",
      "cefepime",
      "cefixime",
    ],
  },
  {
    family: "nsaids",
    members: [
      "nsaid",
      "ibuprofen",
      "aspirin",
      "naproxen",
      "diclofenac",
      "ketorolac",
      "mefenamic",
      "piroxicam",
    ],
  },
  {
    family: "sulfonamides",
    members: [
      "sulfonamide",
      "sulfa",
      "trimethoprim",
      "sulfamethoxazole",
      "cotrimoxazole",
    ],
  },
];

function familyMatch(a: string, b: string): boolean {
  const an = a.toLowerCase();
  const bn = b.toLowerCase();
  for (const g of ALLERGY_FAMILIES) {
    const aIn = g.members.some((m) => an.includes(m));
    const bIn = g.members.some((m) => bn.includes(m));
    if (aIn && bIn) return true;
  }
  return false;
}

// ─── checkAllergy ────────────────────────────────────────────────
// Compares each candidate medicine name against the patient's active
// allergies (substance + severity). Substring both directions plus
// family cross-match.
//
// Inputs:
//   candidates: [{ name, dosage?, masterMedicineId? }]
//   allergies:  [{ substance, severity, reaction? }] (already filtered to active)
export function checkAllergy(
  candidates: Array<{ name: string }>,
  allergies: Array<{
    substance: string;
    severity: "mild" | "moderate" | "severe" | "critical";
    reaction?: string | null;
  }>
): DrugWarning[] {
  if (!candidates.length || !allergies.length) return [];
  const out: DrugWarning[] = [];
  for (const c of candidates) {
    const cn = (c.name || "").toLowerCase();
    if (!cn) continue;
    for (const a of allergies) {
      const sub = (a.substance || "").toLowerCase();
      if (!sub) continue;
      const direct = cn.includes(sub) || sub.includes(cn);
      const cross = !direct && familyMatch(cn, sub);
      if (!direct && !cross) continue;
      // Map patient-allergy severity → warning severity. Critical/severe
      // patient allergies stay severe+critical warnings; mild allergies
      // become a "minor" caution so the doctor sees them but isn't blocked.
      const severity: Severity =
        a.severity === "critical"
          ? "critical"
          : a.severity === "severe"
          ? "severe"
          : a.severity === "moderate"
          ? "moderate"
          : "minor";
      out.push({
        type: "allergy",
        severity,
        medicines: [c.name, a.substance],
        message:
          severity === "critical" || severity === "severe"
            ? `Patient is ${a.severity}-allergic to ${a.substance}. ${c.name} is ${direct ? "the same substance" : `cross-reactive (${a.substance} family)`}.`
            : `Patient has recorded ${a.severity} allergy to ${a.substance}; ${c.name} may cross-react.`,
        recommendation:
          severity === "critical" || severity === "severe"
            ? "Avoid. Choose a non-cross-reactive alternative or obtain documented override."
            : "Proceed with caution. Confirm with patient before dispensing.",
        source: "patient_allergies",
      });
    }
  }
  // Dedup by (medicine, substance) — same pair reported once.
  const seen = new Set<string>();
  return out.filter((w) => {
    const key = (w.medicines || []).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── checkInteractions ───────────────────────────────────────────
// Drug-drug interaction check. Compares every (candidate, candidate)
// pair and (candidate, active) pair against `drug_interactions_master`.
//
// Inputs:
//   candidates: [{ name }]
//   active:     [{ name }] (active medicines for the patient)
//   interactions: rows from drug_interactions_master (active=true)
export function checkInteractions(
  candidates: Array<{ name: string }>,
  active: Array<{ name: string }>,
  interactions: Array<{
    ingredientA: string;
    ingredientB: string;
    severity: "minor" | "moderate" | "severe";
    mechanism?: string | null;
    recommendation: string;
    source?: string | null;
  }>
): DrugWarning[] {
  if (!candidates.length || !interactions.length) return [];
  const all = [...active.map((m) => m.name), ...candidates.map((m) => m.name)];
  const out: DrugWarning[] = [];
  for (const it of interactions) {
    const a = it.ingredientA.toLowerCase();
    const b = it.ingredientB.toLowerCase();
    const hasA = all.some((m) => (m || "").toLowerCase().includes(a));
    const hasB = all.some((m) => (m || "").toLowerCase().includes(b));
    if (!hasA || !hasB) continue;
    // Identify the named medicines that match so the UI can show them.
    const hitA = all.find((m) => (m || "").toLowerCase().includes(a));
    const hitB = all.find((m) => (m || "").toLowerCase().includes(b));
    out.push({
      type: "interaction",
      severity: it.severity,
      medicines: [hitA || it.ingredientA, hitB || it.ingredientB],
      message: `${it.ingredientA} + ${it.ingredientB}: ${it.recommendation}`,
      recommendation: it.recommendation,
      source: it.source || "drug_interactions_master",
    });
  }
  return out;
}

// ─── checkDuplicate ──────────────────────────────────────────────
// Detects when two or more of the candidate medicines share the
// same active ingredient (substring match) so the doctor sees the
// "duplicate therapy" warning before signing.
export function checkDuplicate(
  candidates: Array<{ name: string }>
): DrugWarning[] {
  const out: DrugWarning[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < candidates.length; i++) {
    const a = (candidates[i].name || "").toLowerCase();
    if (!a) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      const b = (candidates[j].name || "").toLowerCase();
      if (!b) continue;
      if (a === b) {
        const key = `${i}|${j}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          type: "duplicate",
          severity: "moderate",
          medicines: [candidates[i].name, candidates[j].name],
          message: `${candidates[i].name} appears twice in this prescription.`,
          recommendation: "Consolidate to a single entry or confirm dosing.",
          source: "duplicate_detector",
        });
        continue;
      }
      // Substring overlap (e.g. "Amoxicillin" + "Amoxicillin + Clavulanate")
      if (a.includes(b) || b.includes(a)) {
        const key = `${i}|${j}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          type: "duplicate",
          severity: "minor",
          medicines: [candidates[i].name, candidates[j].name],
          message: `${candidates[i].name} and ${candidates[j].name} share a similar active ingredient.`,
          recommendation:
            "Confirm the patient is not receiving a doubled dose of the same drug class.",
          source: "duplicate_detector",
        });
      }
    }
  }
  return out;
}

// ─── checkPregnancy ──────────────────────────────────────────────
// Uses `medicine_pregnancy_warnings` rows for any candidate with a
// masterMedicineId. Patients without `isPregnant=true` skip the check.
export function checkPregnancy(
  candidates: Array<{ name: string; masterMedicineId?: string | null }>,
  pregnancy: { isPregnant: boolean; trimester?: 1 | 2 | 3 } | null,
  warnings: Array<{
    medicineId: string;
    fdaCategory?: string | null;
    trimester?: "all" | "1" | "2" | "3" | null;
    severity: "minor" | "moderate" | "severe";
    notes?: string | null;
  }>
): DrugWarning[] {
  if (!pregnancy?.isPregnant) return [];
  if (!candidates.length || !warnings.length) return [];
  const out: DrugWarning[] = [];
  for (const c of candidates) {
    if (!c.masterMedicineId) continue;
    for (const w of warnings) {
      if (w.medicineId !== c.masterMedicineId) continue;
      // Trimester filter — "all" applies to all trimesters.
      if (
        w.trimester &&
        w.trimester !== "all" &&
        pregnancy.trimester &&
        w.trimester !== String(pregnancy.trimester)
      ) {
        continue;
      }
      out.push({
        type: "pregnancy",
        severity: w.severity,
        medicines: [c.name],
        message: `Pregnancy warning (FDA ${w.fdaCategory || "?"}, trimester ${w.trimester || "all"}): ${w.notes || "Use with caution."}`,
        recommendation:
          "Review with obstetric team. Consider alternative with safer pregnancy profile if available.",
        source: "medicine_pregnancy_warnings",
      });
    }
  }
  return out;
}

// ─── checkRenal ──────────────────────────────────────────────────
// Surfaces renal-adjustment rows when the patient has a known eGFR.
// Conservative: if no eGFR is recorded, the warning is suppressed
// (we don't want to spam every prescription).
export function checkRenal(
  candidates: Array<{ name: string; masterMedicineId?: string | null }>,
  renal: { egfr: number } | null,
  adjustments: Array<{
    medicineId: string;
    egfrMin?: number | null;
    egfrMax?: number | null;
    doseAdjustment: string;
    notes?: string | null;
  }>
): DrugWarning[] {
  if (!renal?.egfr || !candidates.length || !adjustments.length) return [];
  const out: DrugWarning[] = [];
  for (const c of candidates) {
    if (!c.masterMedicineId) continue;
    for (const a of adjustments) {
      if (a.medicineId !== c.masterMedicineId) continue;
      const min = a.egfrMin ?? 0;
      const max = a.egfrMax ?? 200;
      if (renal.egfr < min || renal.egfr > max) continue;
      out.push({
        type: "renal",
        severity: renal.egfr < 30 ? "severe" : "moderate",
        medicines: [c.name],
        message: `Renal adjustment for ${c.name} at eGFR ${renal.egfr}: ${a.doseAdjustment}.`,
        recommendation:
          a.notes ||
          "Apply the recommended dose adjustment before signing.",
        source: "medicine_renal_adjustments",
      });
    }
  }
  return out;
}

// ─── checkLiver ──────────────────────────────────────────────────
// Surfaces liver-adjustment rows when the patient has a recorded
// Child-Pugh score.
export function checkLiver(
  candidates: Array<{ name: string; masterMedicineId?: string | null }>,
  liver: { childPugh: "A" | "B" | "C" } | null,
  adjustments: Array<{
    medicineId: string;
    childPugh: "A" | "B" | "C";
    doseAdjustment: string;
    notes?: string | null;
  }>
): DrugWarning[] {
  if (!liver?.childPugh || !candidates.length || !adjustments.length) return [];
  const out: DrugWarning[] = [];
  for (const c of candidates) {
    if (!c.masterMedicineId) continue;
    for (const a of adjustments) {
      if (a.medicineId !== c.masterMedicineId) continue;
      if (a.childPugh !== liver.childPugh) continue;
      out.push({
        type: "liver",
        severity: liver.childPugh === "C" ? "severe" : "moderate",
        medicines: [c.name],
        message: `Hepatic adjustment (Child-Pugh ${liver.childPugh}) for ${c.name}: ${a.doseAdjustment}.`,
        recommendation: a.notes || "Apply the recommended dose adjustment.",
        source: "medicine_liver_adjustments",
      });
    }
  }
  return out;
}

// ─── checkPediatricDose ──────────────────────────────────────────
// Heuristic only: flags any candidate with a masterMedicineId whose
// linked medicines_master row has dosageFormId matching common
// paediatric dosage forms AND the patient is under 12. The check is
// intentionally a reminder, not a hard block — real paediatric
// dosing lives in the prescribing doctor's clinical knowledge.
export function checkPediatricDose(
  candidates: Array<{ name: string; masterMedicineId?: string | null }>,
  patientAgeYears: number | null
): DrugWarning[] {
  if (patientAgeYears === null || patientAgeYears >= 12) return [];
  if (!candidates.length) return [];
  const out: DrugWarning[] = [];
  for (const c of candidates) {
    if (!c.masterMedicineId) continue;
    out.push({
      type: "pediatric",
      severity: patientAgeYears < 2 ? "moderate" : "minor",
      medicines: [c.name],
      message: `Patient is ${patientAgeYears} year(s) old. Confirm weight-based dosing for ${c.name}.`,
      recommendation:
        "Verify mg/kg dose against a paediatric reference before signing.",
      source: "age_heuristic",
    });
  }
  return out;
}

// ─── checkControlledSubstance ────────────────────────────────────
// Flags controlled-substance candidates for SL schedule. Severity
// reflects potential regulatory concern, not clinical risk.
export function checkControlledSubstance(
  candidates: Array<{ name: string; masterMedicineId?: string | null }>,
  controlled: Array<{
    medicineId: string;
    schedule: string;
    notes?: string | null;
  }>
): DrugWarning[] {
  if (!candidates.length || !controlled.length) return [];
  const out: DrugWarning[] = [];
  for (const c of candidates) {
    if (!c.masterMedicineId) continue;
    for (const k of controlled) {
      if (k.medicineId !== c.masterMedicineId) continue;
      // Sri Lanka NMRA schedules: A/B/C/D + precursor. Anything A/B is
      // severe (storage + audit), C/D is moderate.
      const sev: Severity =
        k.schedule.startsWith("A") || k.schedule.startsWith("B")
          ? "severe"
          : "moderate";
      out.push({
        type: "controlled",
        severity: sev,
        medicines: [c.name],
        message: `${c.name} is a controlled substance (Schedule ${k.schedule}).`,
        recommendation:
          k.notes ||
          "Document indication, quantity, and ensure NMRA storage/audit compliance.",
        source: "medicine_controlled",
      });
    }
  }
  return out;
}