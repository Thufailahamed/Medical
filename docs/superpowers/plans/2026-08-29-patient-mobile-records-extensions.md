# Patient Portal — Records Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 patient web pages + 1 medications enhancement that mirror the mobile app's records-extension surfaces (allergies, vaccinations, vitals, trends, notes, refill-due).

**Architecture:** Mirror the existing 12-page `/patient/(app)/*` pattern. New routes, per-domain component folders under `src/patient/components/{allergies,vitals,vaccinations,notes,trends}/`, hooks appended to `src/patient/hooks/index.ts`. No backend changes. Reuse existing primitives (`Card`, `StatTile`, `Pill`, `Sheet`, `QueryBoundary`, `TrendArea`, `Sparkline`).

**Tech Stack:** Next.js 16 (read `apps/marketing/AGENTS.md` + `node_modules/next/dist/docs/` before every code step), React 18, TanStack Query v5, Vitest + RTL, Zustand (auth only), Tailwind via portal globals.

## Global Constraints

- Next.js 16 is NOT the version from training data — read `apps/marketing/AGENTS.md` and check `node_modules/next/dist/docs/` before writing any route/handler code.
- Match existing patient portal copy density and component idiom (refer to `apps/marketing/src/app/patient/(app)/medications/page.tsx` as canonical example).
- All new routes must pass through `(app)/layout.tsx` role gate — never bypass `PatientShell`.
- Mutations must call `invalidateQueries` against the relevant `patientKeys.*` prefix.
- No backend changes. If an endpoint shape appears missing in tests, STOP and report — do not fabricate.
- Use the existing `useProtectedRoute` / patient auth store — do not introduce a second auth path.
- TDD: every component and page ships with `*.test.tsx` covering render-empty / render-loading / render-data / mutation flows.
- Every task ends with a commit. No multi-task commits.
- Caveman terseness for prose, normal style for code/commits.
- Reference code as `file_path:line_number`.

---

## File Map

| Path | Purpose |
|---|---|
| `apps/marketing/src/patient/types/patient.ts` | Extend: `AllergyRow`, `VaccinationRow`, `SymptomRow`, `NoteRow`, `LabResultRow`, `RefillDueRow` |
| `apps/marketing/src/patient/lib/query.ts` | Extend: `notes()`, `vaccinationsDue()`, `labResults()` keys |
| `apps/marketing/src/patient/hooks/index.ts` | Extend: ~21 new hooks |
| `apps/marketing/src/patient/components/allergies/{AllergyList,AllergyRow,AllergyFormSheet,SeverityPill}.tsx` | New |
| `apps/marketing/src/patient/components/vaccinations/{VaccinationList,DueList,VaccinationFormSheet,StatusPill}.tsx` | New |
| `apps/marketing/src/patient/components/vitals/{VitalsSparkCard,AddVitalSheet,SymptomDiary,SymptomRow,AddSymptomSheet,AlertsList}.tsx` | New |
| `apps/marketing/src/patient/components/trends/{TrendsDashboard,MetricTabs,RangeTabs,MetricChart}.tsx` | New |
| `apps/marketing/src/patient/components/notes/{NotesList,NoteRow,NoteFormSheet,PinnedHeader}.tsx` | New |
| `apps/marketing/src/app/patient/(app)/{allergies,vaccinations,vitals,trends,notes}/page.tsx` | New |
| `apps/marketing/src/app/patient/(app)/{allergies,vaccinations,vitals,trends,notes}/page.test.tsx` | New |
| `apps/marketing/src/app/patient/(app)/medications/page.tsx` | Modify — add refill CTA + sheet |
| `apps/marketing/src/app/patient/(app)/medications/page.test.tsx` | Extend — refill interaction |

---

## Task 1: Types + Query Keys

**Files:**
- Modify: `apps/marketing/src/patient/types/patient.ts:1-200`
- Modify: `apps/marketing/src/patient/lib/query.ts:60-62`

**Interfaces:**
- Consumes: nothing (foundation)
- Produces: types consumed by Tasks 2–5; query keys consumed by Tasks 2–5

- [ ] **Step 1: Read existing types and query files**

Read both files fully. Confirm there are no `Allergy`, `Vaccination`, `Symptom`, `Note`, `LabResult`, or `RefillDue` types already.

- [ ] **Step 2: Append types to `patient.ts`**

Append at end of file (after line 186):

```ts
/** GET /allergies/me */
export interface AllergyRow {
  id: string;
  substance: string;
  severity: "mild" | "moderate" | "severe" | "life_threatening" | null;
  reaction: string | null;
  notes: string | null;
  recordedAt: string;
}

/** GET /vaccinations/me and /vaccinations/me/due */
export interface VaccinationRow {
  id: string;
  vaccine: string;
  doseNumber: number | null;
  administeredAt: string;
  dueAt: string | null;
  status: "administered" | "due" | "overdue" | "upcoming";
  lotNumber: string | null;
  notes: string | null;
}

/** GET /vitals/symptoms/me */
export interface SymptomRow {
  id: string;
  symptom: string;
  severity: "mild" | "moderate" | "severe" | null;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
}

/** GET /notes/me */
export interface NoteRow {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /me/lab-results */
export interface LabResultRow {
  id: string;
  test: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  flag: "low" | "normal" | "high" | "critical" | null;
  collectedAt: string;
}

/** GET /medicines/refill-due?days=N */
export interface RefillDueRow {
  id: string;
  name: string;
  dosage: string;
  lastFillDate: string | null;
  daysUntilEmpty: number;
}
```

- [ ] **Step 3: Extend query keys**

In `apps/marketing/src/patient/lib/query.ts`, replace lines 60–62 with:

```ts
allergies: () => ["patient", "allergies"] as const,
vaccinations: () => ["patient", "vaccinations"] as const,
vaccinationsDue: () => ["patient", "vaccinations", "due"] as const,
family: () => ["patient", "family"] as const,
notes: () => ["patient", "notes"] as const,
labResults: (params: { months?: number } = {}) =>
  ["patient", "records", "lab-results", params] as const,
```

- [ ] **Step 4: Run typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS (no consumers yet, types are additive)

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/types/patient.ts apps/marketing/src/patient/lib/query.ts
git commit -m "feat(patient): add records-extensions types + query keys"
```

---

## Task 2: Allergies Hooks

**Files:**
- Modify: `apps/marketing/src/patient/hooks/index.ts` (append at end)

**Interfaces:**
- Consumes: `AllergyRow` (Task 1), `patientKeys.allergies()` (Task 1)
- Produces: `useAllergies`, `useAddAllergy`, `useEditAllergy`, `useDeleteAllergy` — consumed by Tasks 6, 11

- [ ] **Step 1: Append allergies hooks to `index.ts`**

Append:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Allergies ─────────────────────────────────────────────
export function useAllergies() {
  return useQuery<{ allergies: AllergyRow[] }>({
    queryKey: patientKeys.allergies(),
    queryFn: () => api<{ allergies: AllergyRow[] }>("/allergies/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AllergyRow, "id" | "recordedAt">) =>
      api<AllergyRow>("/allergies", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}

export function useEditAllergy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<AllergyRow, "id" | "recordedAt">>) =>
      api<AllergyRow>(`/allergies/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}

export function useDeleteAllergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/allergies/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.allergies() }),
  });
}
```

Add `AllergyRow` to the `import type` block at top of file:

```ts
import type {
  // ...existing
  AllergyRow,
} from "@/patient/types/patient";
```

- [ ] **Step 2: Run typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/patient/hooks/index.ts
git commit -m "feat(patient): allergies CRUD hooks"
```

---

## Task 3: Vaccinations Hooks

**Files:**
- Modify: `apps/marketing/src/patient/hooks/index.ts` (append after Task 2 block)

**Interfaces:**
- Consumes: `VaccinationRow` (Task 1), `patientKeys.vaccinations()` + `patientKeys.vaccinationsDue()` (Task 1)
- Produces: `useVaccinations`, `useVaccinationsDue`, `useAddVaccination` — consumed by Tasks 7, 12

- [ ] **Step 1: Append vaccinations hooks**

Append after the allergies block:

```ts
// ─── Vaccinations ──────────────────────────────────────────
export function useVaccinations() {
  return useQuery<{ vaccinations: VaccinationRow[] }>({
    queryKey: patientKeys.vaccinations(),
    queryFn: () => api<{ vaccinations: VaccinationRow[] }>("/vaccinations/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVaccinationsDue() {
  return useQuery<{ vaccinations: VaccinationRow[] }>({
    queryKey: patientKeys.vaccinationsDue(),
    queryFn: () => api<{ vaccinations: VaccinationRow[] }>("/vaccinations/me/due"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddVaccination() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<VaccinationRow, "id" | "status">) =>
      api<VaccinationRow>("/vaccinations/me", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.vaccinations() });
      qc.invalidateQueries({ queryKey: patientKeys.vaccinationsDue() });
    },
  });
}
```

Add `VaccinationRow` to the `import type` block.

- [ ] **Step 2: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/patient/hooks/index.ts
git commit -m "feat(patient): vaccinations hooks"
```

---

## Task 4: Vitals + Symptoms Hooks

**Files:**
- Modify: `apps/marketing/src/patient/hooks/index.ts` (append after Task 3)

**Interfaces:**
- Consumes: `SymptomRow` (Task 1), `patientKeys.symptoms()` (existing)
- Produces: `useSymptoms`, `useAddVital`, `useDeleteVital`, `useAddSymptom`, `useDeleteSymptom`, `useVitalsDerived`, `useVitalsSeriesRaw` — consumed by Tasks 8, 13, 14

- [ ] **Step 1: Append vitals + symptoms hooks**

```ts
import type {
  SymptomRow,
  VitalSeriesResponse,
} from "@/patient/types/patient";

// ─── Vitals + Symptoms ─────────────────────────────────────
export function useVitalsDerived() {
  return useQuery<{
    bmi: number | null;
    bmiCategory: string | null;
    map: number | null;
  }>({
    queryKey: patientKeys.vitalsDerived(),
    queryFn: () =>
      api<{ bmi: number | null; bmiCategory: string | null; map: number | null }>(
        "/vitals/me/derived"
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useVitalsSeriesRaw(type: VitalType, days: number) {
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  return useQuery<VitalSeriesResponse>({
    queryKey: [...patientKeys.vitalsSeries(type, "week"), "raw", days] as const,
    queryFn: () =>
      api<VitalSeriesResponse>(
        `/vitals/me/series?type=${encodeURIComponent(type)}&from=${encodeURIComponent(from)}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useSymptoms() {
  return useQuery<{ symptoms: SymptomRow[] }>({
    queryKey: patientKeys.symptoms(),
    queryFn: () => api<{ symptoms: SymptomRow[] }>("/vitals/symptoms/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: VitalType;
      value: number;
      secondary?: number | null;
      recordedAt?: string;
      context?: string | null;
    }) =>
      api<{ id: string }>("/vitals", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "vitals"] });
    },
  });
}

export function useDeleteVital() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/vitals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "vitals"] });
    },
  });
}

export function useAddSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SymptomRow, "id">) =>
      api<SymptomRow>("/vitals/symptoms", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.symptoms() }),
  });
}

export function useDeleteSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/vitals/symptoms/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.symptoms() }),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/patient/hooks/index.ts
git commit -m "feat(patient): vitals + symptoms hooks"
```

---

## Task 5: Notes + Lab Results + Refill Hooks

**Files:**
- Modify: `apps/marketing/src/patient/hooks/index.ts` (append after Task 4)

**Interfaces:**
- Consumes: `NoteRow`, `LabResultRow`, `RefillDueRow` (Task 1), `patientKeys.notes()` + `patientKeys.labResults()` + `patientKeys.medicineRefills()` (existing or Task 1)
- Produces: `useNotes`, `useAddNote`, `useEditNote`, `useDeleteNote`, `useLabResults`, `useRefillDue` — consumed by Tasks 10, 14, 15, 16

- [ ] **Step 1: Append notes + lab + refill hooks**

```ts
import type {
  NoteRow,
  LabResultRow,
  RefillDueRow,
} from "@/patient/types/patient";

// ─── Notes ─────────────────────────────────────────────────
export function useNotes() {
  return useQuery<{ notes: NoteRow[] }>({
    queryKey: patientKeys.notes(),
    queryFn: () => api<{ notes: NoteRow[] }>("/notes/me"),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<NoteRow, "id" | "createdAt" | "updatedAt">) =>
      api<NoteRow>("/notes", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

export function useEditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Omit<NoteRow, "id" | "createdAt" | "updatedAt">> & { id: string }) =>
      api<NoteRow>(`/notes/${id}`, { method: "PUT", body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.notes() }),
  });
}

// ─── Lab Results ───────────────────────────────────────────
export function useLabResults(params: { months?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.months) qs.set("months", String(params.months));
  return useQuery<{ results: LabResultRow[] }>({
    queryKey: patientKeys.labResults(params),
    queryFn: () =>
      api<{ results: LabResultRow[] }>(
        `/me/lab-results${qs.size ? "?" + qs.toString() : ""}`
      ),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

// ─── Refill-due ────────────────────────────────────────────
export function useRefillDue(days = 14) {
  return useQuery<{ medicines: RefillDueRow[] }>({
    queryKey: [...patientKeys.medicineRefills(), days] as const,
    queryFn: () =>
      api<{ medicines: RefillDueRow[] }>(`/medicines/refill-due?days=${days}`),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/patient/hooks/index.ts
git commit -m "feat(patient): notes + lab-results + refill-due hooks"
```

---

## Task 6: Allergies Components

**Files:**
- Create: `apps/marketing/src/patient/components/allergies/SeverityPill.tsx`
- Create: `apps/marketing/src/patient/components/allergies/AllergyRow.tsx`
- Create: `apps/marketing/src/patient/components/allergies/AllergyFormSheet.tsx`
- Create: `apps/marketing/src/patient/components/allergies/AllergyList.tsx`

**Interfaces:**
- Consumes: `AllergyRow` (Task 1), `Pill`, `Card`, `EmptyState`, `Skeleton`, `Sheet` from primitives; `useAllergies`, `useAddAllergy`, `useEditAllergy`, `useDeleteAllergy` (Task 2)
- Produces: `<AllergyList>` consumed by Task 11

- [ ] **Step 1: Read `Pill`, `Card`, `EmptyState`, `Skeleton`, `Sheet` interfaces**

Read:
- `apps/marketing/src/patient/components/primitives/Pill.tsx`
- `apps/marketing/src/patient/components/primitives/Card.tsx`
- `apps/marketing/src/patient/components/primitives/EmptyState.tsx`
- `apps/marketing/src/patient/components/primitives/Skeleton.tsx`
- `apps/marketing/src/patient/components/primitives/Sheet.tsx`

Note their exact prop signatures.

- [ ] **Step 2: Write `SeverityPill.tsx`**

```tsx
"use client";
import { Pill } from "@/patient/components/primitives/Pill";
import type { AllergyRow } from "@/patient/types/patient";

const TONE: Record<NonNullable<AllergyRow["severity"]>, "neutral" | "info" | "warning" | "danger"> = {
  mild: "neutral",
  moderate: "info",
  severe: "warning",
  life_threatening: "danger",
};

export function SeverityPill({ severity }: { severity: AllergyRow["severity"] }) {
  if (!severity) return null;
  const label = severity.replace("_", " ");
  return <Pill tone={TONE[severity]}>{label}</Pill>;
}
```

- [ ] **Step 3: Write `AllergyRow.tsx`**

```tsx
"use client";
import { Trash2 } from "lucide-react";
import { Card } from "@/patient/components/primitives/Card";
import { SeverityPill } from "./SeverityPill";
import type { AllergyRow as Row } from "@/patient/types/patient";

export function AllergyRowItem({
  row,
  onDelete,
}: {
  row: Row;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{row.substance}</p>
            <SeverityPill severity={row.severity} />
          </div>
          {row.reaction && <p className="text-sm text-[var(--ink-muted)]">Reaction: {row.reaction}</p>}
          {row.notes && <p className="text-sm text-[var(--ink-muted)]">{row.notes}</p>}
        </div>
        <button
          aria-label="Delete allergy"
          onClick={() => onDelete(row.id)}
          className="text-[var(--ink-muted)] hover:text-[var(--danger)]"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Write `AllergyFormSheet.tsx`**

Read the existing `Sheet` primitive first; the signature below assumes `open`, `onOpenChange`, `title`, and a `children` slot. Match exactly.

```tsx
"use client";
import { useState } from "react";
import { Sheet } from "@/patient/components/primitives/Sheet";
import type { AllergyRow } from "@/patient/types/patient";

export function AllergyFormSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { substance: string; severity: AllergyRow["severity"]; reaction: string | null; notes: string | null }) => Promise<void>;
}) {
  const [substance, setSubstance] = useState("");
  const [severity, setSeverity] = useState<AllergyRow["severity"]>("mild");
  const [reaction, setReaction] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!substance.trim()) {
      setErr("Substance is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        substance: substance.trim(),
        severity,
        reaction: reaction.trim() || null,
        notes: notes.trim() || null,
      });
      setSubstance("");
      setReaction("");
      setNotes("");
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add allergy">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Substance</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={substance}
            onChange={(e) => setSubstance(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Severity</span>
          <select
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={severity ?? "mild"}
            onChange={(e) => setSeverity(e.target.value as AllergyRow["severity"])}
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="life_threatening">Life-threatening</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Reaction (optional)</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={reaction}
            onChange={(e) => setReaction(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-[var(--brand)] py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 5: Write `AllergyList.tsx`**

```tsx
"use client";
import { useState } from "react";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { useAddAllergy, useAllergies, useDeleteAllergy } from "@/patient/hooks";
import { AllergyRowItem } from "./AllergyRow";
import { AllergyFormSheet } from "./AllergyFormSheet";

export function AllergyList() {
  const allergies = useAllergies();
  const add = useAddAllergy();
  const del = useDeleteAllergy();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Allergies"
        rightAction={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Add
          </button>
        }
      />
      <QueryBoundary
        query={allergies}
        renderLoading={<Skeleton rows={3} />}
        renderEmpty={<EmptyState title="No allergies recorded" />}
        renderData={(data) => (
          <div className="space-y-2">
            {data.allergies.map((row) => (
              <AllergyRowItem key={row.id} row={row} onDelete={(id) => del.mutate(id)} />
            ))}
          </div>
        )}
      />
      <AllergyFormSheet
        open={open}
        onOpenChange={setOpen}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/patient/components/allergies
git commit -m "feat(patient): allergies components"
```

---

## Task 7: Vaccinations Components

**Files:**
- Create: `apps/marketing/src/patient/components/vaccinations/StatusPill.tsx`
- Create: `apps/marketing/src/patient/components/vaccinations/VaccinationList.tsx`
- Create: `apps/marketing/src/patient/components/vaccinations/DueList.tsx`
- Create: `apps/marketing/src/patient/components/vaccinations/VaccinationFormSheet.tsx`

**Interfaces:**
- Consumes: `VaccinationRow`, primitives, `useVaccinations`, `useVaccinationsDue`, `useAddVaccination` (Task 3)
- Produces: `<VaccinationList>`, `<DueList>` consumed by Task 12

- [ ] **Step 1: Read primitives (`Pill`, `Card`, `Sheet`, `EmptyState`, `Skeleton`, `SectionHeader`)**

Already known from Task 6. Skip if recently read; otherwise re-read.

- [ ] **Step 2: Write `StatusPill.tsx`**

```tsx
"use client";
import { Pill } from "@/patient/components/primitives/Pill";
import type { VaccinationRow } from "@/patient/types/patient";

const TONE: Record<VaccinationRow["status"], "neutral" | "success" | "warning" | "danger"> = {
  administered: "success",
  due: "warning",
  overdue: "danger",
  upcoming: "neutral",
};

export function StatusPill({ status }: { status: VaccinationRow["status"] }) {
  return <Pill tone={TONE[status]}>{status}</Pill>;
}
```

- [ ] **Step 3: Write `VaccinationList.tsx`**

```tsx
"use client";
import { Card } from "@/patient/components/primitives/Card";
import { StatusPill } from "./StatusPill";
import type { VaccinationRow } from "@/patient/types/patient";

export function VaccinationList({ rows }: { rows: VaccinationRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--ink-muted)]">No vaccinations recorded.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Card key={row.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-medium">{row.vaccine}</p>
              {row.doseNumber != null && (
                <p className="text-sm text-[var(--ink-muted)]">Dose {row.doseNumber}</p>
              )}
              <p className="text-xs text-[var(--ink-muted)]">
                {row.administeredAt.slice(0, 10)}
              </p>
            </div>
            <StatusPill status={row.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `DueList.tsx`**

```tsx
"use client";
import { VaccinationList } from "./VaccinationList";
import type { VaccinationRow } from "@/patient/types/patient";

export function DueList({ rows }: { rows: VaccinationRow[] }) {
  return <VaccinationList rows={rows} />;
}
```

(`VaccinationList` handles empty state; `DueList` exists for semantic naming.)

- [ ] **Step 5: Write `VaccinationFormSheet.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Sheet } from "@/patient/components/primitives/Sheet";
import type { VaccinationRow } from "@/patient/types/patient";

export function VaccinationFormSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { vaccine: string; doseNumber: number | null; administeredAt: string; lotNumber: string | null; notes: string | null }) => Promise<void>;
}) {
  const [vaccine, setVaccine] = useState("");
  const [dose, setDose] = useState("");
  const [administeredAt, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lot, setLot] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!vaccine.trim()) {
      setErr("Vaccine name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        vaccine: vaccine.trim(),
        doseNumber: dose ? Number(dose) : null,
        administeredAt,
        lotNumber: lot.trim() || null,
        notes: notes.trim() || null,
      });
      setVaccine("");
      setDose("");
      setLot("");
      setNotes("");
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Record vaccination">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Vaccine</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={vaccine}
            onChange={(e) => setVaccine(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Dose number (optional)</span>
          <input
            type="number"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Date administered</span>
          <input
            type="date"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={administeredAt}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Lot number (optional)</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-[var(--brand)] py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/patient/components/vaccinations
git commit -m "feat(patient): vaccinations components"
```

---

## Task 8: Vitals Components

**Files:**
- Create: `apps/marketing/src/patient/components/vitals/VitalsSparkCard.tsx`
- Create: `apps/marketing/src/patient/components/vitals/AddVitalSheet.tsx`
- Create: `apps/marketing/src/patient/components/vitals/AddSymptomSheet.tsx`
- Create: `apps/marketing/src/patient/components/vitals/SymptomRow.tsx`
- Create: `apps/marketing/src/patient/components/vitals/SymptomDiary.tsx`
- Create: `apps/marketing/src/patient/components/vitals/AlertsList.tsx`

**Interfaces:**
- Consumes: `VitalType`, `VitalSeriesResponse`, `VitalAlert`, `SymptomRow` (Task 1), primitives + charts, hooks from Task 4
- Produces: consumed by Task 13

- [ ] **Step 1: Read `Sparkline` chart component**

Read `apps/marketing/src/patient/components/charts/Sparkline.tsx`. Note its prop signature.

- [ ] **Step 2: Write `VitalsSparkCard.tsx`**

```tsx
"use client";
import { Card } from "@/patient/components/primitives/Card";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { Sparkline } from "@/patient/components/charts/Sparkline";
import type { VitalSeriesResponse, VitalType } from "@/patient/types/patient";

export function VitalsSparkCard({
  type,
  label,
  query,
}: {
  type: VitalType;
  label: string;
  query: { data: VitalSeriesResponse | undefined; isLoading: boolean };
}) {
  if (query.isLoading) return <Skeleton rounded="card" />;
  const points = query.data?.points ?? [];
  const values = points.map((p) => p.value);
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--ink-muted)]">{label}</p>
          <p className="text-2xl font-semibold">{values[values.length - 1] ?? "—"}</p>
        </div>
        <Sparkline values={values} type={type} />
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Write `AddVitalSheet.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Sheet } from "@/patient/components/primitives/Sheet";
import type { VitalType } from "@/patient/types/patient";

const TYPES: VitalType[] = [
  "heart_rate",
  "blood_pressure",
  "spo2",
  "temperature",
  "blood_sugar",
  "weight",
  "respiratory_rate",
];

export function AddVitalSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { type: VitalType; value: number; secondary?: number | null; context?: string | null }) => Promise<void>;
}) {
  const [type, setType] = useState<VitalType>("heart_rate");
  const [value, setValue] = useState("");
  const [secondary, setSecondary] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!Number.isFinite(num)) {
      setErr("Value must be a number");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        type,
        value: num,
        secondary: secondary ? Number(secondary) : null,
        context: context.trim() || null,
      });
      setValue("");
      setSecondary("");
      setContext("");
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add vital reading">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Type</span>
          <select
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={type}
            onChange={(e) => setType(e.target.value as VitalType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Value</span>
          <input
            type="number"
            step="any"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </label>
        {type === "blood_pressure" && (
          <label className="block">
            <span className="text-sm font-medium">Diastolic</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium">Context (optional)</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </label>
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-[var(--brand)] py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 4: Write `AddSymptomSheet.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Sheet } from "@/patient/components/primitives/Sheet";
import type { SymptomRow } from "@/patient/types/patient";

export function AddSymptomSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { symptom: string; severity: SymptomRow["severity"]; startedAt: string; notes: string | null }) => Promise<void>;
}) {
  const [symptom, setSymptom] = useState("");
  const [severity, setSeverity] = useState<SymptomRow["severity"]>("mild");
  const [startedAt, setStartedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!symptom.trim()) {
      setErr("Symptom name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({
        symptom: symptom.trim(),
        severity,
        startedAt,
        notes: notes.trim() || null,
      });
      setSymptom("");
      setNotes("");
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Log symptom">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Symptom</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Severity</span>
          <select
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={severity ?? "mild"}
            onChange={(e) => setSeverity(e.target.value as SymptomRow["severity"])}
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Started</span>
          <input
            type="date"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-[var(--brand)] py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 5: Write `SymptomRow.tsx`**

```tsx
"use client";
import { Trash2 } from "lucide-react";
import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import type { SymptomRow as Row } from "@/patient/types/patient";

const TONE: Record<NonNullable<Row["severity"]>, "neutral" | "info" | "warning"> = {
  mild: "neutral",
  moderate: "info",
  severe: "warning",
};

export function SymptomRowItem({
  row,
  onDelete,
}: {
  row: Row;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{row.symptom}</p>
            {row.severity && <Pill tone={TONE[row.severity]}>{row.severity}</Pill>}
          </div>
          <p className="text-xs text-[var(--ink-muted)]">Started {row.startedAt.slice(0, 10)}</p>
          {row.notes && <p className="text-sm text-[var(--ink-muted)]">{row.notes}</p>}
        </div>
        <button
          aria-label="Delete symptom"
          onClick={() => onDelete(row.id)}
          className="text-[var(--ink-muted)] hover:text-[var(--danger)]"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 6: Write `SymptomDiary.tsx`**

```tsx
"use client";
import { useState } from "react";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { useAddSymptom, useDeleteSymptom, useSymptoms } from "@/patient/hooks";
import { AddSymptomSheet } from "./AddSymptomSheet";
import { SymptomRowItem } from "./SymptomRow";

export function SymptomDiary() {
  const symptoms = useSymptoms();
  const add = useAddSymptom();
  const del = useDeleteSymptom();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Symptom diary"
        rightAction={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Log symptom
          </button>
        }
      />
      <QueryBoundary
        query={symptoms}
        renderLoading={<Skeleton rows={3} />}
        renderEmpty={<EmptyState title="No symptoms logged" />}
        renderData={(data) => (
          <div className="space-y-2">
            {data.symptoms.map((row) => (
              <SymptomRowItem key={row.id} row={row} onDelete={(id) => del.mutate(id)} />
            ))}
          </div>
        )}
      />
      <AddSymptomSheet
        open={open}
        onOpenChange={setOpen}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 7: Write `AlertsList.tsx`**

```tsx
"use client";
import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import type { VitalAlert } from "@/patient/types/patient";

function toneFor(classification: string): "warning" | "danger" | "info" {
  if (classification === "critical" || classification === "high") return "danger";
  if (classification === "warning") return "warning";
  return "info";
}

export function AlertsList({
  alerts,
  isLoading,
}: {
  alerts: VitalAlert[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton rows={2} />;
  if (!alerts?.length) return <EmptyState title="No alerts in the last 30 days" />;
  return (
    <div className="space-y-2">
      {alerts.map((a, idx) => (
        <Card key={idx}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{a.type.replace("_", " ")}</p>
              {a.message && <p className="text-sm text-[var(--ink-muted)]">{a.message}</p>}
            </div>
            <Pill tone={toneFor(a.classification)}>{a.classification}</Pill>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/marketing/src/patient/components/vitals
git commit -m "feat(patient): vitals + symptom components"
```

---

## Task 9: Trends Components

**Files:**
- Create: `apps/marketing/src/patient/components/trends/MetricTabs.tsx`
- Create: `apps/marketing/src/patient/components/trends/RangeTabs.tsx`
- Create: `apps/marketing/src/patient/components/trends/MetricChart.tsx`
- Create: `apps/marketing/src/patient/components/trends/TrendsDashboard.tsx`

**Interfaces:**
- Consumes: `VitalType`, `LabResultRow`, charts, `useVitalsSeriesRaw`, `useLabResults` (Task 5)
- Produces: `<TrendsDashboard>` consumed by Task 14

- [ ] **Step 1: Read `TrendArea` chart component**

Read `apps/marketing/src/patient/components/charts/TrendArea.tsx`. Note prop signature.

- [ ] **Step 2: Write `MetricTabs.tsx`**

```tsx
"use client";

export type MetricKey =
  | "blood_pressure"
  | "blood_sugar"
  | "heart_rate"
  | "spo2"
  | "weight"
  | "temperature"
  | "hba1c";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "blood_pressure", label: "Blood pressure" },
  { key: "blood_sugar", label: "Glucose" },
  { key: "heart_rate", label: "Heart rate" },
  { key: "spo2", label: "SpO₂" },
  { key: "weight", label: "Weight" },
  { key: "temperature", label: "Temperature" },
  { key: "hba1c", label: "HbA1c" },
];

export function MetricTabs({
  active,
  onChange,
}: {
  active: MetricKey;
  onChange: (m: MetricKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {METRICS.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`rounded-full px-3 py-1 text-sm ${
            active === m.key
              ? "bg-[var(--brand)] text-white"
              : "bg-[var(--surface-2)] text-[var(--ink)]"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `RangeTabs.tsx`**

```tsx
"use client";

export type RangeDays = 7 | 30 | 90 | 365;

const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
  { days: 365, label: "1y" },
];

export function RangeTabs({
  active,
  onChange,
}: {
  active: RangeDays;
  onChange: (r: RangeDays) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-[var(--surface-2)] p-1">
      {RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => onChange(r.days)}
          className={`rounded-full px-3 py-1 text-sm ${
            active === r.days ? "bg-[var(--surface-1)] font-medium" : "text-[var(--ink-muted)]"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `MetricChart.tsx`**

```tsx
"use client";
import { Card } from "@/patient/components/primitives/Card";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { TrendArea } from "@/patient/components/charts/TrendArea";
import type { VitalSeriesResponse } from "@/patient/types/patient";

export function MetricChart({
  query,
}: {
  query: { data: VitalSeriesResponse | undefined; isLoading: boolean };
}) {
  if (query.isLoading) return <Skeleton rounded="card" />;
  const points = (query.data?.points ?? []).map((p) => ({
    t: p.t,
    value: p.value,
    secondary: p.secondary ?? null,
  }));
  return (
    <Card>
      <TrendArea points={points} showSecondary />
    </Card>
  );
}
```

- [ ] **Step 5: Write `TrendsDashboard.tsx`**

```tsx
"use client";
import { useState } from "react";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { MetricTabs, type MetricKey } from "./MetricTabs";
import { RangeTabs, type RangeDays } from "./RangeTabs";
import { MetricChart } from "./MetricChart";
import { useLabResults, useVitalsSeriesRaw } from "@/patient/hooks";
import type { VitalType } from "@/patient/types/patient";

const VITAL_METRICS: VitalType[] = [
  "heart_rate",
  "blood_pressure",
  "spo2",
  "temperature",
  "blood_sugar",
  "weight",
];

function isVital(m: MetricKey): m is VitalType {
  return (VITAL_METRICS as readonly string[]).includes(m as string);
}

export function TrendsDashboard() {
  const [metric, setMetric] = useState<MetricKey>("blood_pressure");
  const [range, setRange] = useState<RangeDays>(30);

  const vitalsQuery = useVitalsSeriesRaw(
    (isVital(metric) ? metric : "heart_rate") as VitalType,
    range
  );
  const labsQuery = useLabResults({ months: Math.max(1, Math.ceil(range / 30)) });

  return (
    <div className="space-y-6">
      <SectionHeader title="Trends" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricTabs active={metric} onChange={setMetric} />
        <RangeTabs active={range} onChange={setRange} />
      </div>
      {metric === "hba1c" ? (
        <LabResultsTable labs={labsQuery.data?.results ?? []} isLoading={labsQuery.isLoading} />
      ) : (
        <MetricChart query={vitalsQuery} />
      )}
    </div>
  );
}

function LabResultsTable({
  labs,
  isLoading,
}: {
  labs: Array<{ id: string; test: string; value: string; unit: string | null; collectedAt: string }>;
  isLoading: boolean;
}) {
  if (isLoading) return <Skeleton rows={3} />;
  const filtered = labs.filter((l) => /hba1c/i.test(l.test));
  if (!filtered.length)
    return <p className="text-sm text-[var(--ink-muted)]">No HbA1c results in this range.</p>;
  return (
    <div className="space-y-2">
      {filtered.map((l) => (
        <div key={l.id} className="rounded border border-[var(--border)] bg-[var(--surface-1)] p-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{l.test}</span>
            <span>{l.collectedAt.slice(0, 10)}</span>
          </div>
          <p className="text-lg font-semibold">
            {l.value}
            {l.unit && <span className="text-sm font-normal text-[var(--ink-muted)]"> {l.unit}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/patient/components/trends
git commit -m "feat(patient): trends dashboard components"
```

---

## Task 10: Notes Components

**Files:**
- Create: `apps/marketing/src/patient/components/notes/PinnedHeader.tsx`
- Create: `apps/marketing/src/patient/components/notes/NoteRow.tsx`
- Create: `apps/marketing/src/patient/components/notes/NoteFormSheet.tsx`
- Create: `apps/marketing/src/patient/components/notes/NotesList.tsx`

**Interfaces:**
- Consumes: `NoteRow`, primitives, `useNotes`, `useAddNote`, `useEditNote`, `useDeleteNote` (Task 5)
- Produces: `<NotesList>` consumed by Task 15

- [ ] **Step 1: Write `PinnedHeader.tsx`**

Read `SectionHeader` to confirm shape; then write:

```tsx
"use client";
import { Pin } from "lucide-react";

export function PinnedHeader({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink-muted)]">
      <Pin size={14} />
      <span>Pinned ({count})</span>
    </div>
  );
}
```

- [ ] **Step 2: Write `NoteRow.tsx`**

```tsx
"use client";
import { Pin, Trash2 } from "lucide-react";
import { Card } from "@/patient/components/primitives/Card";
import type { NoteRow as Row } from "@/patient/types/patient";

export function NoteRowItem({
  row,
  onTogglePin,
  onDelete,
}: {
  row: Row;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{row.title}</p>
            {row.pinned && <Pin size={14} className="text-[var(--brand)]" />}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink-muted)]">{row.body}</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">{row.updatedAt.slice(0, 10)}</p>
        </div>
        <div className="flex gap-2">
          <button
            aria-label="Toggle pin"
            onClick={() => onTogglePin(row.id)}
            className="text-[var(--ink-muted)] hover:text-[var(--brand)]"
          >
            <Pin size={18} />
          </button>
          <button
            aria-label="Delete note"
            onClick={() => onDelete(row.id)}
            className="text-[var(--ink-muted)] hover:text-[var(--danger)]"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Write `NoteFormSheet.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Sheet } from "@/patient/components/primitives/Sheet";
import type { NoteRow } from "@/patient/types/patient";

export function NoteFormSheet({
  open,
  onOpenChange,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { title: string; body: string; pinned: boolean }) => Promise<void>;
  initial?: NoteRow;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setErr("Title is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ title: title.trim(), body: body.trim(), pinned });
      setTitle("");
      setBody("");
      setPinned(false);
      onOpenChange(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={initial ? "Edit note" : "New note"}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Body</span>
          <textarea
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface-1)] p-2"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
          <span className="text-sm">Pin this note</span>
        </label>
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-[var(--brand)] py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 4: Write `NotesList.tsx`**

```tsx
"use client";
import { useState } from "react";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { useAddNote, useDeleteNote, useEditNote, useNotes } from "@/patient/hooks";
import { NoteRowItem } from "./NoteRow";
import { NoteFormSheet } from "./NoteFormSheet";
import { PinnedHeader } from "./PinnedHeader";

export function NotesList() {
  const notes = useNotes();
  const add = useAddNote();
  const edit = useEditNote();
  const del = useDeleteNote();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Notes"
        rightAction={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white"
          >
            New note
          </button>
        }
      />
      <QueryBoundary
        query={notes}
        renderLoading={<Skeleton rows={3} />}
        renderEmpty={<EmptyState title="No notes yet" />}
        renderData={(data) => {
          const pinned = data.notes.filter((n) => n.pinned);
          const unpinned = data.notes.filter((n) => !n.pinned);
          return (
            <div className="space-y-6">
              {pinned.length > 0 && (
                <div className="space-y-2">
                  <PinnedHeader count={pinned.length} />
                  {pinned.map((row) => (
                    <NoteRowItem
                      key={row.id}
                      row={row}
                      onTogglePin={() => edit.mutate({ id: row.id, pinned: !row.pinned })}
                      onDelete={(id) => del.mutate(id)}
                    />
                  ))}
                </div>
              )}
              {unpinned.length > 0 && (
                <div className="space-y-2">
                  {unpinned.map((row) => (
                    <NoteRowItem
                      key={row.id}
                      row={row}
                      onTogglePin={() => edit.mutate({ id: row.id, pinned: !row.pinned })}
                      onDelete={(id) => del.mutate(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }}
      />
      <NoteFormSheet
        open={open}
        onOpenChange={setOpen}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `bun --filter marketing typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/notes
git commit -m "feat(patient): notes components"
```

---

## Task 11: Allergies Page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/allergies/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/allergies/page.test.tsx`

**Interfaces:**
- Consumes: `<AllergyList>` (Task 6), `PatientShell` wrapper from `(app)/layout.tsx`

- [ ] **Step 1: Read existing `medications/page.tsx` for the canonical patient-page shape**

Read fully. Confirm: imports, default export signature, `"use client"` directive, layout-of-widgets pattern.

- [ ] **Step 2: Write `page.tsx`**

```tsx
"use client";
import { AllergyList } from "@/patient/components/allergies/AllergyList";

export default function AllergiesPage() {
  return (
    <div className="space-y-6">
      <AllergyList />
    </div>
  );
}
```

- [ ] **Step 3: Write `page.test.tsx`**

Read an existing patient-page test for pattern (e.g. `apps/marketing/src/app/patient/(app)/medications/page.test.tsx`). Then write:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useAllergies: () => ({
    data: { allergies: [{ id: "1", substance: "Peanuts", severity: "severe", reaction: "Hives", notes: null, recordedAt: "2026-01-01" }] },
    isLoading: false,
  }),
  useAddAllergy: () => ({ mutateAsync: vi.fn() }),
  useEditAllergy: () => ({ mutateAsync: vi.fn() }),
  useDeleteAllergy: () => ({ mutate: vi.fn() }),
}));

import AllergiesPage from "./page";

describe("AllergiesPage", () => {
  it("renders list of allergies", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AllergiesPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("Peanuts")).toBeInTheDocument());
    expect(screen.getByText("severe")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test**

Run: `bun --filter marketing test apps/marketing/src/app/patient/\(app\)/allergies`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/allergies
git commit -m "feat(patient): allergies page + test"
```

---

## Task 12: Vaccinations Page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/vaccinations/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/vaccinations/page.test.tsx`

**Interfaces:**
- Consumes: `<VaccinationList>`, `<DueList>` (Task 7)

- [ ] **Step 1: Write `page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { Skeleton } from "@/patient/components/primitives/Skeleton";
import { EmptyState } from "@/patient/components/primitives/EmptyState";
import { VaccinationList } from "@/patient/components/vaccinations/VaccinationList";
import { DueList } from "@/patient/components/vaccinations/DueList";
import { VaccinationFormSheet } from "@/patient/components/vaccinations/VaccinationFormSheet";
import { useAddVaccination, useVaccinations, useVaccinationsDue } from "@/patient/hooks";

export default function VaccinationsPage() {
  const administered = useVaccinations();
  const due = useVaccinationsDue();
  const add = useAddVaccination();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Vaccinations"
        rightAction={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Record
          </button>
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--ink-muted)]">Administered</h2>
        <QueryBoundary
          query={administered}
          renderLoading={<Skeleton rows={2} />}
          renderEmpty={<EmptyState title="No administered vaccinations" />}
          renderData={(d) => <VaccinationList rows={d.vaccinations} />}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--ink-muted)]">Due / overdue</h2>
        <QueryBoundary
          query={due}
          renderLoading={<Skeleton rows={2} />}
          renderEmpty={<EmptyState title="Nothing due right now" />}
          renderData={(d) => <DueList rows={d.vaccinations} />}
        />
      </section>

      <VaccinationFormSheet
        open={open}
        onOpenChange={setOpen}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write `page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVaccinations: () => ({
    data: { vaccinations: [{ id: "1", vaccine: "MMR", doseNumber: 1, administeredAt: "2026-02-01", dueAt: null, status: "administered", lotNumber: null, notes: null }] },
    isLoading: false,
  }),
  useVaccinationsDue: () => ({ data: { vaccinations: [] }, isLoading: false }),
  useAddVaccination: () => ({ mutateAsync: vi.fn() }),
}));

import VaccinationsPage from "./page";

describe("VaccinationsPage", () => {
  it("renders administered vaccines", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <VaccinationsPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("MMR")).toBeInTheDocument());
    expect(screen.getByText("Nothing due right now")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun --filter marketing test apps/marketing/src/app/patient/\(app\)/vaccinations`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/vaccinations
git commit -m "feat(patient): vaccinations page + test"
```

---

## Task 13: Vitals Page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/vitals/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/vitals/page.test.tsx`

**Interfaces:**
- Consumes: `<VitalsSparkCard>`, `<AddVitalSheet>`, `<SymptomDiary>`, `<AlertsList>` (Task 8)

- [ ] **Step 1: Write `page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { VitalsSparkCard } from "@/patient/components/vitals/VitalsSparkCard";
import { AddVitalSheet } from "@/patient/components/vitals/AddVitalSheet";
import { SymptomDiary } from "@/patient/components/vitals/SymptomDiary";
import { AlertsList } from "@/patient/components/vitals/AlertsList";
import { useAddVital, useVitalsAlerts, useVitalsSeries } from "@/patient/hooks";

export default function VitalsPage() {
  const series = useVitalsSeries("heart_rate", "week");
  const bpSeries = useVitalsSeries("blood_pressure", "week");
  const spo2Series = useVitalsSeries("spo2", "week");
  const alerts = useVitalsAlerts(30);
  const add = useAddVital();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Vitals"
        rightAction={
          <button
            onClick={() => setOpen(true)}
            className="rounded bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white"
          >
            Add reading
          </button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <VitalsSparkCard type="heart_rate" label="Heart rate" query={series} />
        <VitalsSparkCard type="blood_pressure" label="Blood pressure" query={bpSeries} />
        <VitalsSparkCard type="spo2" label="SpO₂" query={spo2Series} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--ink-muted)]">Alerts (last 30 days)</h2>
        <AlertsList alerts={alerts.data?.items} isLoading={alerts.isLoading} />
      </section>

      <SymptomDiary />

      <AddVitalSheet
        open={open}
        onOpenChange={setOpen}
        onSubmit={async (input) => {
          await add.mutateAsync(input);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write `page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVitalsSeries: () => ({ data: { points: [{ t: "2026-01-01", value: 72, secondary: null, id: "1", unit: "bpm", context: null }], range: { from: null, to: null }, type: "heart_rate", stats: null, latestClassification: null }, isLoading: false }),
  useVitalsAlerts: () => ({ data: { items: [], count: 0 }, isLoading: false }),
  useSymptoms: () => ({ data: { symptoms: [] }, isLoading: false }),
  useAddSymptom: () => ({ mutateAsync: vi.fn() }),
  useDeleteSymptom: () => ({ mutate: vi.fn() }),
  useAddVital: () => ({ mutateAsync: vi.fn() }),
}));

import VitalsPage from "./page";

describe("VitalsPage", () => {
  it("renders vitals cards and diary", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <VitalsPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("Heart rate")).toBeInTheDocument());
    expect(screen.getByText("Blood pressure")).toBeInTheDocument();
    expect(screen.getByText("Symptom diary")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun --filter marketing test apps/marketing/src/app/patient/\(app\)/vitals`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/vitals
git commit -m "feat(patient): vitals page + test"
```

---

## Task 14: Trends Page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/trends/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/trends/page.test.tsx`

**Interfaces:**
- Consumes: `<TrendsDashboard>` (Task 9)

- [ ] **Step 1: Write `page.tsx`**

```tsx
"use client";
import { TrendsDashboard } from "@/patient/components/trends/TrendsDashboard";

export default function TrendsPage() {
  return (
    <div className="space-y-6">
      <TrendsDashboard />
    </div>
  );
}
```

- [ ] **Step 2: Write `page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useVitalsSeriesRaw: () => ({ data: { points: [], range: { from: null, to: null }, type: "heart_rate", stats: null, latestClassification: null }, isLoading: false }),
  useLabResults: () => ({ data: { results: [] }, isLoading: false }),
}));

import TrendsPage from "./page";

describe("TrendsPage", () => {
  it("renders metric tabs and ranges", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <TrendsPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("Blood pressure")).toBeInTheDocument());
    expect(screen.getByText("90d")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun --filter marketing test apps/marketing/src/app/patient/\(app\)/trends`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/trends
git commit -m "feat(patient): trends page + test"
```

---

## Task 15: Notes Page

**Files:**
- Create: `apps/marketing/src/app/patient/(app)/notes/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/notes/page.test.tsx`

**Interfaces:**
- Consumes: `<NotesList>` (Task 10)

- [ ] **Step 1: Write `page.tsx`**

```tsx
"use client";
import { NotesList } from "@/patient/components/notes/NotesList";

export default function NotesPage() {
  return (
    <div className="space-y-6">
      <NotesList />
    </div>
  );
}
```

- [ ] **Step 2: Write `page.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/patient/hooks", () => ({
  useNotes: () => ({
    data: { notes: [{ id: "1", title: "Follow-up", body: "Call Dr.", pinned: true, createdAt: "2026-01-01", updatedAt: "2026-01-02" }] },
    isLoading: false,
  }),
  useAddNote: () => ({ mutateAsync: vi.fn() }),
  useEditNote: () => ({ mutate: vi.fn() }),
  useDeleteNote: () => ({ mutate: vi.fn() }),
}));

import NotesPage from "./page";

describe("NotesPage", () => {
  it("renders pinned note", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <NotesPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByText("Follow-up")).toBeInTheDocument());
    expect(screen.getByText("Pinned (1)")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test**

Run: `bun --filter marketing test apps/marketing/src/app/patient/\(app\)/notes`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/notes
git commit -m "feat(patient): notes page + test"
```

---

## Task 16: Medications — Refill CTA + Sheet

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/medications/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/medications/page.test.tsx`

**Interfaces:**
- Consumes: `useRefillDue` (Task 5), `<Sheet>`, `<StatTile>`, primitives

- [ ] **Step 1: Read existing `medications/page.tsx`**

Read fully. Note the existing 3 `<StatTile>` row + list layout.

- [ ] **Step 2: Add refill CTA + sheet to `medications/page.tsx`**

Wrap the existing import block, then add new imports near the top of the file:

```tsx
import { useRefillDue } from "@/patient/hooks";
import { Sheet } from "@/patient/components/primitives/Sheet";
```

Inside the component, add:

```tsx
const refills = useRefillDue(14);
const [refillOpen, setRefillOpen] = useState(false);
```

Above the existing list (after the StatTile row), insert:

```tsx
<div className="space-y-2">
  <h2 className="text-sm font-medium text-[var(--ink-muted)]">Refills due in next 14 days</h2>
  <button
    onClick={() => setRefillOpen(true)}
    disabled={!refills.data?.medicines?.length}
    className="rounded border border-[var(--border)] bg-[var(--surface-1)] p-3 text-left disabled:opacity-60"
  >
    {refills.isLoading
      ? "Loading…"
      : refills.data?.medicines?.length
        ? `${refills.data.medicines.length} medicine${refills.data.medicines.length === 1 ? "" : "s"} need refill`
        : "Nothing due for refill"}
  </button>
</div>
```

At the end of the component (just before closing tag), add:

```tsx
<Sheet open={refillOpen} onOpenChange={setRefillOpen} title="Refills due">
  <div className="space-y-3">
    {(refills.data?.medicines ?? []).map((m) => (
      <div key={m.id} className="rounded border border-[var(--border)] bg-[var(--surface-1)] p-3">
        <p className="font-medium">{m.name}</p>
        <p className="text-sm text-[var(--ink-muted)]">{m.dosage}</p>
        <p className="text-xs text-[var(--ink-muted)]">
          {m.daysUntilEmpty <= 0 ? "Past due" : `Empty in ${m.daysUntilEmpty} day${m.daysUntilEmpty === 1 ? "" : "s"}`}
        </p>
      </div>
    ))}
    {!refills.data?.medicines?.length && (
      <p className="text-sm text-[var(--ink-muted)]">Nothing due.</p>
    )}
  </div>
</Sheet>
```

- [ ] **Step 3: Extend `medications/page.test.tsx`**

Read the existing test. Append to the existing `vi.mock("@/patient/hooks", ...)`:

```ts
useRefillDue: () => ({ data: { medicines: [{ id: "m1", name: "Aspirin", dosage: "81mg", lastFillDate: "2026-07-01", daysUntilEmpty: 5 }] }, isLoading: false }),
```

In a new `it` block within the same describe:

```ts
it("shows refill CTA", () => {
  // existing render setup
  expect(screen.getByText(/1 medicine.*need refill/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run test**

Run: `bun --filter marketing test apps/marketing/src/app/patient/\(app\)/medications`
Expected: PASS

- [ ] **Step 5: Typecheck + lint**

Run:
```bash
bun --filter marketing typecheck
bun --filter marketing lint
```
Expected: both PASS

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/medications
git commit -m "feat(patient): medications refill-due CTA + sheet"
```

---

## Task 17: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + lint + test**

Run:
```bash
bun --filter marketing typecheck
bun --filter marketing lint
bun --filter marketing test
```
Expected: all clean.

- [ ] **Step 2: Build**

Run: `bun --filter marketing build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke (optional, if dev server reachable)**

Log in as patient → visit `/patient/{allergies,vaccinations,vitals,trends,notes}` → confirm each renders without console errors.

- [ ] **Step 4: Tag the release**

```bash
git tag feat/patient-records-extensions
```

Expected: tag created.
