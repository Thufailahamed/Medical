// lib/snapshot.ts
//
// Tier 1 records: Patient Health Snapshot derivation.
//
// Pure function — no HTTP concerns. Builds an at-a-glance patient view
// from existing tables (medicalRecords, allergies, vitals, medicines,
// prescriptions, labReports, labOrders, patientNotes). Returns a flat
// shape that both the patient mobile hub and the doctor portal can
// render without further massaging.
//
// Re-used by:
//   - GET /medical-records/me/snapshot                  (patient + caretaker)
//   - GET /doctor-portal/patients/:id/snapshot          (doctor)
//   - POST /ai/explain/pre-visit-summary (PR3)          (doctor pre-visit)
//
// Design notes:
//   - We do NOT add a new SQL aggregate view. D1 is read-heavy but
//     cheap; the Promise.all of 9 table fetches already powers
//     /me/canonical (medical-records.ts:1184-1232). We re-use the
//     same fetches here and derive client-side — keeps the query
//     count at one round-trip per request.
//   - `chronicConditions` is a heuristic. Real chronic-condition
//     tracking lives in a future PHR column; for now we surface
//     anything tagged "chronic" plus a small keyword list on the
//     diagnosis field.
//   - Drug-allergy warnings are a substring match (medicine.name ⊂
//     allergy.substance). It's not a clinical-grade cross-reference
//     but it's a useful safety nudge — see PR3's pre-visit summary
//     for the AI-grade version.

import { eq, and, desc, asc, gte, inArray } from "drizzle-orm";
import {
  medicalRecords,
  allergies,
  vitals,
  medicines,
  prescriptions,
  doctors,
  users,
  hospitals,
} from "@healthcare/db";

// ─── Types ──────────────────────────────────────────────────────────

export interface SnapshotAllergy {
  id: string;
  substance: string;
  severity: "mild" | "moderate" | "severe" | "critical";
  reaction: string | null;
}

export interface SnapshotDrugAllergyWarning {
  medicine: string;
  allergen: string;
  severity: SnapshotAllergy["severity"];
}

export interface SnapshotChronicCondition {
  id: string;
  title: string;
  since: string | null;
  diagnosis: string | null;
}

export interface SnapshotActiveMedicine {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  startedAt: string | null;
  prescriberName: string | null;
}

export interface SnapshotVital {
  id: string;
  type: string;
  value: number;
  secondaryValue: number | null;
  unit: string | null;
  recordedAt: string;
}

export interface SnapshotFollowUp {
  id: string;
  title: string;
  date: string | null;
  doctorName: string | null;
}

export interface SnapshotVisit {
  id: string;
  title: string;
  date: string | null;
  hospitalName: string | null;
  diagnosis: string | null;
}

export interface HealthSnapshot {
  redBanner: SnapshotAllergy[];
  drugAllergyWarnings: SnapshotDrugAllergyWarning[];
  chronicConditions: SnapshotChronicCondition[];
  activeMedicines: SnapshotActiveMedicine[];
  recentVitals: {
    bp: SnapshotVital[];
    hr: SnapshotVital[];
    glucose: SnapshotVital[];
    weight: SnapshotVital[];
    spo2: SnapshotVital[];
    temp: SnapshotVital[];
  };
  upcomingFollowUps: SnapshotFollowUp[];
  recentVisits: SnapshotVisit[];
  fetchedAt: string;
}

// ─── Heuristics ─────────────────────────────────────────────────────

// Substring overlap for drug-allergy warnings. Lower-cased.
function medicineMatchesAllergy(medName: string, allergen: string): boolean {
  const m = medName.toLowerCase();
  const a = allergen.toLowerCase();
  if (!m || !a) return false;
  return m.includes(a) || a.includes(m);
}

// Chronic-condition keywords. Anything in this list appearing in a
// record's diagnosis or summary flags it as chronic. Kept tight on
// purpose — too loose and every prescription becomes "chronic".
const CHRONIC_KEYWORDS = [
  "diabetes",
  "hypertension",
  "asthma",
  "copd",
  "thyroid",
  "cholesterol",
  "ckd",
  "chronic kidney",
  "heart failure",
  "coronary",
  "epilepsy",
  "rheumatoid",
  "cancer",
  "hiv",
  "depression",
];

function isChronicRecord(record: any): boolean {
  // `tags` arrives as a JSON array column (D1 stores as TEXT — see
  // share_links_kind_check triggers for context). Normalise to an
  // array of strings before scanning.
  let tagList: string[] = [];
  const raw = record.tags;
  if (Array.isArray(raw)) {
    tagList = raw;
  } else if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) tagList = parsed.map(String);
    } catch {
      // fall through — treat as empty
    }
  }
  if (tagList.some((t) => t.toLowerCase() === "chronic")) return true;
  const blob = `${record.diagnosis ?? ""} ${record.summary ?? ""} ${record.title ?? ""}`.toLowerCase();
  return CHRONIC_KEYWORDS.some((k) => blob.includes(k));
}

// Vital-type buckets for the snapshot's mini-grid.
const VITAL_BUCKETS = {
  bp: "blood_pressure",
  hr: "heart_rate",
  glucose: "blood_sugar",
  weight: "weight",
  spo2: "spo2",
  temp: "temperature",
} as const;

type VitalBucket = keyof typeof VITAL_BUCKETS;

// ─── Main builder ───────────────────────────────────────────────────

export async function buildSnapshot(
  db: any,
  patientId: string
): Promise<HealthSnapshot> {
  // Single round-trip — 9 table fetches in parallel, same shape as
  // /me/canonical so the two endpoints never drift.
  const [
    records,
    allergyRows,
    vitalsRows,
    rxRows,
    medRows,
    doctorRows,
  ] = await Promise.all([
    db.select().from(medicalRecords).where(eq(medicalRecords.patientId, patientId)),
    db.select().from(allergies).where(eq(allergies.patientId, patientId)),
    db.select().from(vitals).where(eq(vitals.patientId, patientId)),
    db.select().from(prescriptions).where(eq(prescriptions.patientId, patientId)),
    db.select().from(medicines).where(eq(medicines.patientId, patientId)),
    // Doctors referenced by records/prescriptions — one join to attach
    // names to active medicines + visits without N+1.
    db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        name: users.name,
      })
      .from(doctors)
      .innerJoin(users, eq(users.id, doctors.userId)),
  ]);

  const doctorById = new Map<string, { id: string; name: string | null }>();
  for (const d of doctorRows) {
    doctorById.set(d.id, { id: d.id, name: d.name });
  }

  // ─── Red banner (severe/critical active allergies) ─────────────
  const redBanner: SnapshotAllergy[] = allergyRows
    .filter(
      (a: any) =>
        a.active &&
        (a.severity === "severe" || a.severity === "critical")
    )
    .map((a: any) => ({
      id: a.id,
      substance: a.substance,
      severity: a.severity,
      reaction: a.reaction ?? null,
    }));

  // ─── Drug-allergy warnings (active meds × active allergies) ────
  const activeAllergies: SnapshotAllergy[] = allergyRows
    .filter((a: any) => a.active)
    .map((a: any) => ({
      id: a.id,
      substance: a.substance,
      severity: a.severity,
      reaction: a.reaction ?? null,
    }));
  const activeMeds: SnapshotActiveMedicine[] = medRows
    .filter((m: any) => m.active)
    .map((m: any) => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      startedAt: m.startDate ?? null,
      prescriberName: null,
    }));

  const drugAllergyWarnings: SnapshotDrugAllergyWarning[] = [];
  for (const med of activeMeds) {
    for (const a of activeAllergies) {
      if (medicineMatchesAllergy(med.name, a.substance)) {
        drugAllergyWarnings.push({
          medicine: med.name,
          allergen: a.substance,
          severity: a.severity,
        });
      }
    }
  }

  // Attach prescriber names from prescriptions.doctorId. Best-effort:
  // some meds lack a prescription (manual entry) and won't get a name.
  const rxById = new Map<string, any>();
  for (const rx of rxRows) rxById.set(rx.id, rx);
  for (const med of medRows.filter((m: any) => m.active)) {
    if (!med.prescriptionId) continue;
    const rx = rxById.get(med.prescriptionId);
    if (!rx) continue;
    const doc = doctorById.get(rx.doctorId);
    const target = activeMeds.find((m) => m.id === med.id);
    if (target) target.prescriberName = doc?.name ?? null;
  }

  // ─── Chronic conditions (records) ──────────────────────────────
  const chronicRecords = records.filter(isChronicRecord);
  const chronicConditions: SnapshotChronicCondition[] = chronicRecords
    .sort(
      (a: any, b: any) =>
        new Date(b.date ?? b.createdAt ?? 0).getTime() -
        new Date(a.date ?? a.createdAt ?? 0).getTime()
    )
    .slice(0, 10)
    .map((r: any) => ({
      id: r.id,
      title: r.title ?? r.diagnosis ?? "Condition",
      since: r.date ?? r.createdAt ?? null,
      diagnosis: r.diagnosis ?? null,
    }));

  // ─── Recent vitals (last 3 per bucket) ─────────────────────────
  const recentVitals: HealthSnapshot["recentVitals"] = {
    bp: [],
    hr: [],
    glucose: [],
    weight: [],
    spo2: [],
    temp: [],
  };
  for (const bucket of Object.keys(VITAL_BUCKETS) as VitalBucket[]) {
    const typeKey = VITAL_BUCKETS[bucket];
    const rows = vitalsRows
      .filter((v: any) => v.type === typeKey)
      .sort(
        (a: any, b: any) =>
          new Date(b.recordedAt ?? 0).getTime() -
          new Date(a.recordedAt ?? 0).getTime()
      )
      .slice(0, 3)
      .map((v: any) => ({
        id: v.id,
        type: v.type,
        value: v.value,
        secondaryValue: v.secondaryValue ?? null,
        unit: v.unit ?? null,
        recordedAt: v.recordedAt,
      }));
    recentVitals[bucket] = rows;
  }

  // ─── Upcoming follow-ups ──────────────────────────────────────
  const nowIso = new Date().toISOString();
  const upcomingFollowUps: SnapshotFollowUp[] = records
    .filter(
      (r: any) =>
        (r.kind === "follow_up" || r.recordType === "follow_up") &&
        (r.followUpDate ?? r.date ?? "") >= nowIso.slice(0, 10)
    )
    .sort((a: any, b: any) =>
      (a.followUpDate ?? a.date ?? "").localeCompare(b.followUpDate ?? b.date ?? "")
    )
    .slice(0, 5)
    .map((r: any) => ({
      id: r.id,
      title: r.title ?? r.diagnosis ?? "Follow-up",
      date: r.followUpDate ?? r.date ?? null,
      doctorName: r.doctorId ? doctorById.get(r.doctorId)?.name ?? null : null,
    }));

  // ─── Recent visits (last 3) ───────────────────────────────────
  const recentVisits: SnapshotVisit[] = records
    .filter(
      (r: any) =>
        r.kind === "hospital_visit" ||
        r.recordType === "hospital_visit" ||
        r.kind === "discharge_summary" ||
        r.recordType === "discharge_summary"
    )
    .sort(
      (a: any, b: any) =>
        new Date(b.date ?? b.createdAt ?? 0).getTime() -
        new Date(a.date ?? a.createdAt ?? 0).getTime()
    )
    .slice(0, 3)
    .map((r: any) => ({
      id: r.id,
      title: r.title ?? "Visit",
      date: r.date ?? null,
      hospitalName: r.hospitalName ?? null,
      diagnosis: r.diagnosis ?? null,
    }));

  return {
    redBanner,
    drugAllergyWarnings,
    chronicConditions,
    activeMedicines: activeMeds.sort((a, b) =>
      (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
    ),
    recentVitals,
    upcomingFollowUps,
    recentVisits,
    fetchedAt: new Date().toISOString(),
  };
}