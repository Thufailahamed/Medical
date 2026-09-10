# Patient Dashboard Polish — Design Spec
Date: 2026-09-10
Status: Approved (sections 1-3 approved via brainstorming)
Scope: `apps/marketing/src/app/patient/(app)/page.tsx` + `src/patient/components/dashboard/*`

## 1. Goal & Constraints
- Goal: Visual polish first (user choice), clean clinical light style, balanced mobile/desktop.
- Add only needed new content: Health Summary Strip (wellness, vitals status, adherence, next visit).
- Constraints: No new APIs/routes/auth changes. Reuse existing hooks only. Follow existing `Card`, `CardHeader`, `QueryBoundary`, `Skeleton`, `EmptyState` patterns. No global token overhaul.

## 2. Layout & Hierarchy (Approved)
Order in `page.tsx`:
1. `DashboardHero` (refined)
2. `SafetyBanner` (unchanged logic, spacing only)
3. `QuickActions` (polished)
4. NEW `HealthSummaryStrip` (4 tiles)
5. Grid 2-col lg: `MedicationsToday` + `UpcomingAppointment`
6. `VitalsTrend` (full width)
7. Grid 2-col lg: `RecentRecords` + `CareAssistant`

Container: `max-w-6xl mx-auto flex flex-col gap-5 sm:gap-6 px-1 sm:px-2 pb-6 pt-1`.
Breakpoints: 1-col base, `lg:grid-cols-2` for paired cards. QuickActions: `grid-cols-2 lg:grid-cols-4`.
No route or sidebar changes.

## 3. Components & Visual Polish (Approved)
Design language: clean clinical light — white cards (#FFF), border `border-border`, radius 16px cards / 12px inner / 999px pills, soft shadow `0 1px 2px rgba(16,24,40,0.05), 0 4px 16px rgba(2,132,199,0.06)`, hover lift `-2px` + border-brand/30. Accent: sky-600/teal-600, success emerald, warning amber, danger rose. Text: `text-text / text-text-soft / text-text-muted`.

- DashboardHero.tsx: keep oceanic gradient but soften orbs, increase text contrast (white/90), unify glass pills (12% white, 18% border, blur 6px). Keep greeting, date, tip, blood/BMI/alert pills, wellness badge, 3 shortcuts. Improve focus-visible rings, touch targets 36px min.
- QuickActions.tsx: keep 4 actions (Medications, Add record, Book visit, Log vitals). Larger icon tile 44px, `rounded-xl`, hover `scale-105`, label 14px bold + hint 12px. Add `aria-label` per link.
- Shared Cards (MedicationsToday, UpcomingAppointment, VitalsTrend, RecentRecords, CareAssistant): unify via existing `Card` + `CardHeader` — no prop API change. Consistent `mt-4` content offset, consistent empty/loading slots. No logic change except styling.
- NEW HealthSummaryStrip.tsx (`src/patient/components/dashboard/HealthSummaryStrip.tsx`):
  - 4 tiles: Wellness (useWellness score+label), Vitals (useVitalsAlerts count → steady/alert), Adherence (useMedicationStats 7d taken/count + streak), Next visit (useAppointments next date/time/doctor).
  - Each tile: icon in tinted square, value 20px bold, label 11px uppercase, sub 12px muted, link to /patient/health, /patient/vitals, /patient/medications, /patient/appointments.
  - Grid: `grid-cols-2 xl:grid-cols-4 gap-3`. Skeleton while any loading, individual tile empty fallback (e.g. “—” + CTA).
  - Export from `dashboard/index.ts`, render in `page.tsx` after QuickActions.

Out of scope: WellnessScore, WeekStrip, BodyOverview, RecentActivity remain unused on home. No family/care-team/messages/vaccinations sections on home (accessible via sidebar).

## 4. Data Flow
Reuse only: `useProfile, useHealthSummary, useWellness, useVitalsAlerts, useMedicationsToday, useMedicationStats, useTodayDoses, useAppointments, useVitalsSeries, useRecords/useRecordStats`. No new fetchers, no store changes. HealthSummaryStrip composes the four hooks already used elsewhere on the page — no additional network cost beyond existing caches.

## 5. States, A11y, Responsive
- Loading: `Skeleton` shimmer per card/tile, preserve layout height to avoid CLS.
- Empty: `EmptyState` with title + CTA (e.g. meds empty → “View medications”; appointments empty → “Book visit”).
- Error: `QueryBoundary` retry button, `role=alert` for action errors.
- A11y: 44px min targets for QuickActions/tiles on mobile, visible focus rings, color + icon + text (never color alone), `aria-hidden` on decorative orbs.
- Responsive: hero stacks (greeting full width, wellness badge full width on mobile), tiles 2x2 mobile → 4-across xl, paired grids stack on mobile.

## 6. Testing & Verification
- Update `src/app/patient/(app)/page.test.tsx`: keep existing assertions, add HealthSummaryStrip assertions (Wellness/Adherence/Next visit present), keep negative assertions (no Life quality / Recent activity duplicates).
- Run: `pnpm --filter marketing test src/app/patient/(app)/page.test.tsx` + dashboard component tests (`MedicationsToday.test.tsx`, `VitalsTrend.test.tsx`, `WellnessScore.test.tsx` unaffected).
- Manual: 390px + 1280px screenshots, keyboard tab through hero → tiles → cards, light mode only (appearance page untouched).

## 7. Files Touched
- Edit: `page.tsx`, `DashboardHero.tsx`, `QuickActions.tsx`, `dashboard/index.ts`, shared card classNames (no API change).
- Add: `HealthSummaryStrip.tsx` + `HealthSummaryStrip.test.tsx`.
- No backend, no i18n, no migration.
