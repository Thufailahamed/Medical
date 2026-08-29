# Patient Portal — Records Extensions Design Spec

**Date:** 2026-08-29
**Status:** Approved for planning
**Area:** `apps/marketing` (Next.js)
**Source of truth:** `apps/mobile` Expo patient app — these web pages are parity surfaces for mobile-only features.

---

## 1. Goal

Add five patient-facing web pages under `/patient/(app)/*` that mirror the mobile
patient app's records-extension surfaces:

1. `/patient/allergies` — structured allergy list (substance, severity, reaction)
2. `/patient/vaccinations` — administered doses + due/overdue list
3. `/patient/vitals` — manual vital entry, symptom diary, 30-day alerts, sparklines
4. `/patient/trends` — multi-metric trends dashboard (7d / 30d / 90d / 1y)
5. `/patient/notes` — pinned + recent patient notes

Also enhance `/patient/medications` with a refill-due CTA + sheet.

These pages close the largest functional gap between the web patient portal and the
mobile app. They reuse every primitive and hook pattern established by the existing
twelve `/patient/(app)/*` pages (no backend changes required).

Non-goals: AI OCR flows (deferred to AI Suite spec), bulk vaccination upload, edit of
vital entries (delete only), caretaker / family surfaces (separate specs).

## 2. Context

The patient web portal shipped in twelve stacked `feat(patient):` commits between
`0b9b5a4` and `761eae3`. It currently exposes 12 patient-facing pages under
`/patient/(app)/*` plus 21 under `/portal/(patient)/me/*`. The mobile app (Expo,
`apps/mobile`) is the canonical patient surface and ships ~40 screens across AI,
booking, telehealth, family, caretaker marketplace, DSAR, identity, devices, and
records extensions.

This spec is the **first of multiple subsystem specs** identified during the gap
analysis. Records-Extensions was prioritised because its data shapes are reused by
later specs (AI explanations need symptom + vital history, bookings consume allergy
data, etc.).

### Mobile parity targets

| Mobile route | Web target | Status before | Status after |
|---|---|---|---|
| `(app)/allergies.tsx` | `/patient/allergies` | absent | new |
| `(app)/vaccinations.tsx` | `/patient/vaccinations` | absent | new |
| `(app)/vitals.tsx` | `/patient/vitals` | absent | new |
| `(app)/records/trends.tsx` | `/patient/trends` | absent | new |
| `(app)/notes.tsx` | `/patient/notes` | absent | new |
| refills (inline) | `/patient/medications` CTA | absent | additive |

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | New routes live directly under `/patient/(app)/*`, not nested under `/patient/health` or `/patient/records` | Mobile parity — top-level destinations. Easier sidebar/shell integration later. |
| D2 | Mirror the existing 12-page pattern: `page.tsx` + `page.test.tsx` per route; per-domain component folder under `src/patient/components/{allergies,vitals,vaccinations,notes,trends}/` | Zero new conventions. Existing primitives (`Card`, `StatTile`, `Pill`, `Sheet`, `QueryBoundary`, `TrendArea`, `Sparkline`) cover all UI needs. |
| D3 | Hooks in `src/patient/hooks/index.ts` following the existing `useFoo` pattern | Barrel already re-exports the patient surface; same imports work from any page. |
| D4 | Refill-due lives as a CTA sheet on `/patient/medications`, not a new route | Mobile parity — refill is a hint surfaced inside the medications page, not a destination. Avoids nav bloat. |
| D5 | No backend changes | All endpoints already exposed. Verified in `apps/api` handlers. |
| D6 | Optimistic updates are NOT used | Matches existing patient portal (which has none). Mutations invalidate query keys via TanStack. |
| D7 | Test per page mirrors existing `*.test.tsx` shape | Render + empty + loading + key mutation coverage. |

## 4. Architecture

### 4.1 Route tree (additions only)

```
apps/marketing/src/app/patient/(app)/
  allergies/page.tsx
  allergies/page.test.tsx
  vaccinations/page.tsx
  vaccinations/page.test.tsx
  vitals/page.tsx
  vitals/page.test.tsx
  trends/page.tsx
  trends/page.test.tsx
  notes/page.tsx
  notes/page.test.tsx
  medications/page.tsx            (modify — add refill CTA + sheet)
  medications/page.test.tsx       (extend — refill interaction)
```

### 4.2 Component tree (new)

```
apps/marketing/src/patient/components/
  allergies/
    AllergyList.tsx
    AllergyRow.tsx
    AllergyFormSheet.tsx          (add/edit)
    SeverityPill.tsx
  vaccinations/
    VaccinationList.tsx
    DueList.tsx
    VaccinationFormSheet.tsx
    StatusPill.tsx
  vitals/
    VitalsSparkCard.tsx           (mini sparkline per type)
    AddVitalSheet.tsx
    SymptomDiary.tsx
    SymptomRow.tsx
    AddSymptomSheet.tsx
    AlertsList.tsx
  trends/
    TrendsDashboard.tsx
    MetricTabs.tsx                (BP / glucose / HR / HbA1c / weight / SpO2 / temp)
    RangeTabs.tsx                 (7d / 30d / 90d / 1y)
    MetricChart.tsx               (reuses TrendArea + Sparkline from primitives; uses `useVitalsSeriesRaw` so 1y range works without extending `RangeKey`)
  notes/
    NotesList.tsx
    NoteRow.tsx
    NoteFormSheet.tsx
    PinnedHeader.tsx
```

All new components consume primitives from `src/patient/components/primitives/`
(`Card`, `StatTile`, `Pill`, `EmptyState`, `Skeleton`, `Sheet`, `QueryBoundary`,
`SectionHeader`) and charts from `src/patient/components/charts/`
(`Sparkline`, `TrendArea`).

### 4.3 Hooks (additions to `src/patient/hooks/index.ts`)

| Hook | Endpoint | Notes |
|---|---|---|
| `useAllergies()` | `GET /allergies/me` | existing key factory slot exists (`patientKeys.allergies`) |
| `useAddAllergy()` | `POST /allergies` | mutation; invalidates `patientKeys.allergies()` |
| `useEditAllergy(id)` | `PATCH /allergies/:id` | mutation; invalidates same |
| `useDeleteAllergy()` | `DELETE /allergies/:id` | mutation; invalidates same |
| `useVaccinations()` | `GET /vaccinations/me` | existing key factory slot |
| `useVaccinationsDue()` | `GET /vaccinations/me/due` | existing key factory slot — needs new key variant `vaccinationsDue` |
| `useAddVaccination()` | `POST /vaccinations/me` | mutation |
| `useVitals(type, range)` | `GET /vitals/me/series?type&from` | reuses existing `useVitalsSeries` for the vitals page |
| `useVitalsSeriesRaw(type, days)` | same endpoint, raw `days` param | trends page only — bypasses `RangeKey` (which is week/month/quarter) |
| `useVitalsDerived()` | `GET /vitals/me/derived` | reuses key slot |
| `useVitalsAlerts(30)` | `GET /vitals/me/alerts?days=30` | existing hook accepts days param |
| `useSymptoms()` | `GET /vitals/symptoms/me` | needs new key `symptoms()` — already declared |
| `useAddVital()` | `POST /vitals` | mutation; invalidates `vitalsSeries` + `vitalsDerived` + `vitalsAlerts` |
| `useDeleteVital()` | `DELETE /vitals/:id` | mutation |
| `useAddSymptom()` | `POST /vitals/symptoms` | mutation; invalidates `symptoms()` |
| `useDeleteSymptom()` | `DELETE /vitals/symptoms/:id` | mutation |
| `useLabResults()` | `GET /me/lab-results` | needed by trends page for HbA1c; raw days/months param so 1y range works |
| `useNotes()` | `GET /notes/me` | new key slot `notes()` |
| `useAddNote()` | `POST /notes` | mutation |
| `useEditNote(id)` | `PUT /notes/:id` | mutation |
| `useDeleteNote()` | `DELETE /notes/:id` | mutation |
| `useRefillDue(days=14)` | `GET /medicines/refill-due?days=14` | uses existing `medicineRefills()` key |

### 4.4 Query-key additions to `src/patient/lib/query.ts`

```ts
notes: () => ["patient", "notes"] as const,
vaccinationsDue: () => ["patient", "vaccinations", "due"] as const,
labResults: (params?: { months?: number }) =>
  ["patient", "records", "lab-results", params ?? {}] as const,
```

`allergies`, `vaccinations`, `refills`, `symptoms` keys already exist in the
factory (lines 60–62, 46, 27). No conflicts.

### 4.5 Data flow per page

Each page follows the existing patient pattern:

```
<SectionHeader title="…" rightAction={<SheetTrigger/>} />
<QueryBoundary
  query={useFoo()}
  renderLoading={<Skeleton/>}
  renderEmpty={<EmptyState/>}
  renderData={(data) => <List rows={data}/>}
/>
```

Mutations are triggered from form sheets; on success they `invalidateQueries` for
the relevant key prefix and the sheet closes.

### 4.6 Error handling

- Network: `QueryBoundary` already handles skeleton → empty → error (existing
  component). Render `EmptyState` with retry CTA on error.
- Mutations: form sheets inline zod errors at the field level. Toast on success
  via the existing `useToast` (or portal toast system if not present in patient
  module — fall back to no-op with sheet close).
- 401/403: existing `useAuthStore.onAuthError` triggers re-auth.
- 410 `family_member_gone` / `principal_access_gone`: no impact for these pages.

### 4.7 Refill CTA on `/patient/medications`

Add a third `<StatTile>` row above the medication list showing
"Refills due in next 14d: N". Tapping the tile opens a `<Sheet>` listing
medicines from `useRefillDue({ days: 14 })` with name, dosage, last-fill date,
days-until-empty estimate. Pure display — no mutation.

### 4.8 Testing

Each page gets a `page.test.tsx`:

- **Render empty state**: mock hook → empty array → empty placeholder shows.
- **Render loading state**: mock hook pending → skeleton shows.
- **Render data state**: mock hook with fixtures → list rows render.
- **Open add sheet**: trigger button → sheet opens with form.
- **Submit form (success)**: fill form → submit → mutation called → sheet closes.
- **Submit form (error)**: fill form → submit fails → error message stays visible.
- **Delete flow**: tap delete → confirm → mutation called → row removed.

Mocks reuse the existing `vi.mock("@/patient/hooks", ...)` pattern from the
twelve sibling pages. No new mocking infrastructure required.

### 4.9 Out of scope

- AI OCR prescription/vaccination card → AI Suite spec.
- Bulk vaccination upload → manual single-add only for v1.
- Edit of vital entries → delete only (matches mobile's current limitation).
- Caretaker / family surfaces, DSAR, marketplace, identity → separate specs.

## 5. Files changed

| Path | Change |
|---|---|
| `apps/marketing/src/app/patient/(app)/allergies/page.tsx` | new |
| `apps/marketing/src/app/patient/(app)/allergies/page.test.tsx` | new |
| `apps/marketing/src/app/patient/(app)/vaccinations/page.tsx` | new |
| `apps/marketing/src/app/patient/(app)/vaccinations/page.test.tsx` | new |
| `apps/marketing/src/app/patient/(app)/vitals/page.tsx` | new |
| `apps/marketing/src/app/patient/(app)/vitals/page.test.tsx` | new |
| `apps/marketing/src/app/patient/(app)/trends/page.tsx` | new |
| `apps/marketing/src/app/patient/(app)/trends/page.test.tsx` | new |
| `apps/marketing/src/app/patient/(app)/notes/page.tsx` | new |
| `apps/marketing/src/app/patient/(app)/notes/page.test.tsx` | new |
| `apps/marketing/src/app/patient/(app)/medications/page.tsx` | modify (refill CTA + sheet) |
| `apps/marketing/src/app/patient/(app)/medications/page.test.tsx` | extend (refill interaction) |
| `apps/marketing/src/patient/components/allergies/*` | new (4 files) |
| `apps/marketing/src/patient/components/vaccinations/*` | new (4 files) |
| `apps/marketing/src/patient/components/vitals/*` | new (6 files) |
| `apps/marketing/src/patient/components/trends/*` | new (4 files) |
| `apps/marketing/src/patient/components/notes/*` | new (4 files) |
| `apps/marketing/src/patient/hooks/index.ts` | extend (~120 lines, ~21 hooks) |
| `apps/marketing/src/patient/lib/query.ts` | extend (3 keys) |
| `apps/marketing/src/patient/types/patient.ts` | extend (AllergyRow, VaccinationRow, SymptomRow, NoteRow, LabResultRow, RefillDueRow) |

Total: 5 new pages + 5 test files + 22 new components + 21 hooks + 6 types +
2 modified files. No backend changes.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Endpoint shape drift (e.g. `/allergies/me` response wrapping) | Read handler in `apps/api` before writing hook. Add shape assertion in test. |
| Sheet z-index conflict with patient shell sidebar | Use the existing `<Sheet>` primitive which already handles stacking. |
| Sparkline 30-point chart perf | Cap points to 30; use existing `TrendArea` + `Sparkline` (already optimised). |
| Refill-due endpoint does not exist for all patients | Empty state handles zero results; CTA hides when zero. |
| Next.js 16 breaking changes | Read `apps/marketing/AGENTS.md` warning — verify every new file with current docs from `node_modules/next/dist/docs/` before writing. |

## 7. Verification

- [ ] `bun --filter marketing lint` clean
- [ ] `bun --filter marketing typecheck` clean
- [ ] `bun --filter marketing test` — all 5 new page tests + extended medications test pass
- [ ] `bun --filter marketing build` clean
- [ ] Each new route reachable via `/patient/{allergies,vaccinations,vitals,trends,notes}` after patient login
- [ ] Refill CTA visible on `/patient/medications` when refills exist
- [ ] No new lint warnings in touched files
