# Patient Dashboard v2 — Enterprise Polish + New Widgets — Design Spec
Date: 2026-09-10
Status: Approved (sections 1–3 approved via brainstorming)
Supersedes: prior v1 spec dated 2026-09-10 (already-shipped hero / quick actions / health summary strip baseline). v1 components stay; this doc adds density pass + 2 new widgets.

Scope:
- `apps/marketing/src/app/patient/(app)/page.tsx`
- `apps/marketing/src/patient/components/dashboard/*` (refactor + 2 new files)
- `apps/marketing/src/patient/components/dashboard/MiniSparkline.tsx` (new shared primitive)
- `apps/marketing/src/patient/hooks/insurance.ts` (new thin hook)
- `apps/marketing/src/patient/hooks/index.ts` (re-export)

## 1. Goal & Constraints
Goal: enterprise-grade density + scannability, modern dark-clinical polish, two new widgets (Notifications Preview, Insurance Coverage). No new backend routes. Reuse existing hooks. Add one tiny hook for insurance (no UI logic — just data wiring).

Constraints:
- One component per file in `dashboard/`. No `features/` restructure.
- Use existing tokens: `t-label`, `t-card-title`, `text-text-muted`, `bg-brand-soft`, `text-brand`, `border-border`, `shadow-xs`, `anim-rise`.
- No chart lib. No animation lib. No globals.css additions.
- Snapshots disabled (match repo style). Tests use RTL + user-event.

## 2. Layout — 12-col grid (Approved)
Container: `max-w-7xl mx-auto flex flex-col gap-4 px-1 sm:px-2 pb-6 pt-1`. Was `max-w-6xl` + `gap-5/6`. Card padding standardised to `p-4`.

Order in `page.tsx`:
1. `DashboardHero` (h-72, denser left+right cols)
2. `SafetyBanner` (unchanged)
3. `HealthSummaryStrip` (4 KPI tiles with sparklines + delta pills)
4. Grid: `MedicationsToday` (col-span-7) | `UpcomingAppointment` (col-span-5)
5. `VitalsTrend` (full width, 4 mini sparklines instead of single chart)
6. Grid: `RecentRecords` (col-span-7) | NEW `NotificationsPreview` (col-span-5)
7. Grid: NEW `InsuranceCoverage` (col-span-5) | `CareAssistant` (col-span-7)

Breakpoints: stacked base, `lg:grid-cols-12` for paired rows. Sparkline grid: `grid-cols-2 xl:grid-cols-4`.

## 3. Component Specs

### 3.1 `DashboardHero.tsx` (refactor)
Keep oceanic gradient `135deg, #0B4A6F → #0369A1 → #0E7490 → #14919B`. Trim height h-72. Drop 3 floating shortcut pills on right; replace with vertical stack:
- `WellnessScore` card (existing component, unchanged) with circular progress ring 0–100.
- Insurance status mini-line: provider + renewal chip (e.g. "renews in 42d").
- Primary CTA "Log vitals" → `/patient/health` (Activity icon, brand pill).

Add grid texture overlay at 3% opacity. Reduce orb count 3→2 (top-right + bottom-left). Touch targets ≥36px.

### 3.2 `HealthSummaryStrip.tsx` (density pass)
Same 4 tiles. Each tile gains:
- 24px-tall `MiniSparkline` of last-7d values (where data exists).
- Delta pill under value (`+2` emerald / `-1` rose / `—` muted).
- Loading: shimmer skeleton matching final height.
- Empty fallback per tile (e.g. "—" + CTA).

### 3.3 `MiniSparkline.tsx` (new primitive, ≤40 lines)
Pure SVG. Props: `points: number[]`, `width?: number`, `height?: number`, `stroke?: string` (defaults `currentColor`).
- Render `<svg viewBox preserveAspectRatio="none">` with `<polyline>`.
- Wrap in `<span><title>{min}–{max}</title></span>` for SR.
- `aria-hidden="true"` on the polyline.
- No data: return `null` (caller handles empty state).

### 3.4 `MedicationsToday.tsx` (density pass)
List 4–6 rows (was 3). Each row: status pill (taken ✓ emerald / missed ✕ rose / upcoming sky), med name 13px bold, dose 12px muted, time 12px mono. Sticky footer "Mark all taken". Empty: friendly CTA.

### 3.5 `UpcomingAppointment.tsx` (density pass)
Compact: avatar 40px + doctor name + specialty + countdown chip "in 2 days" (brand-soft). Secondary row: Teleconsult link if virtual, else location. Ghost "Reschedule" button.

### 3.6 `VitalsTrend.tsx` (refactor)
Replace single chart with 4-col sparkline grid: HR / BP / SpO₂ / Weight. Each cell: label 11px uppercase + value 20px bold + 60px `MiniSparkline` + delta pill. Tap cell → `/patient/vitals`. Loading skeleton per cell.

### 3.7 `RecentRecords.tsx` (density pass)
5 rows (was 3). Each row: icon 16px tinted + title 13px bold + date 12px muted + tag chip. Empty: upload CTA.

### 3.8 `NotificationsPreview.tsx` (NEW)
Top 5 unread/read-mix from `useNotifications()`. Each row: severity dot (info sky / warn amber / critical rose), title 13px, relative time 12px muted, unread 8px dot. Header: "Notifications" + "View all →" link to `/patient/notifications`. Empty: "You're all caught up". Loading: 3 skeleton rows.

### 3.9 `InsuranceCoverage.tsx` (NEW)
Reads `useInsurance()` (new hook). 3-row compact card:
- Provider + policy # (truncated, mono font for #)
- Renewal chip: "renews in Xd" (amber if ≤30d) or "lapsed" (rose)
- Claims count: "N open claims" or "no open claims"
Status pill: `active` emerald / `lapsed` rose / `pending` amber. Footer link → `/patient/insurance`.

If `useInsurance` returns no data → render skeleton only (no fake data).

### 3.10 `CareAssistant.tsx` (refactor)
Tighten padding `p-5 → p-4`. Replace 2-link row with primary "Ask AI" (brand pill, full width on mobile) + ghost "Messages" link (icon-only on mobile).

### 3.11 `SafetyBanner.tsx` (unchanged)

## 4. Data Flow

Reuse existing:
- `useProfile`, `useHealthSummary`, `useWellness`, `useVitalsAlerts`, `useMedicationsToday`, `useMedicationStats`, `useAppointments`, `useVitalsSeries`, `useRecords`/`useRecordStats`, `useNotifications` (full feed, not just unread count), `useConversations`.

New hook: `apps/marketing/src/patient/hooks/insurance.ts`
- `useInsurance()` → `useQuery` against `patientPaths.insurance.summary()` (assumed contract slot; if absent in `@healthcare/shared/contracts`, add a thin `insurance: { summary: () => "/insurance/summary" }` entry).
- Returns `{ policy: { provider, number, status, renewsAt } | null, claimsOpen: number }`.
- Re-export from `hooks/index.ts`.
- Loading only — no fake data fallback (component renders skeleton).

No new API endpoints authored in this work. If backend lacks `/insurance/summary`, the hook throws "missing endpoint" toast — out of scope to build it. Hook ships with a single `console.warn` and returns `null` so UI never crashes.

## 5. States, A11y, Responsive
- Loading: skeleton shimmer per card, preserved layout height (no CLS).
- Empty: friendly copy + CTA.
- Error: existing `QueryBoundary` retry, `role="alert"` on action errors.
- A11y: every card `<section aria-labelledby>`. Sparkline `<title>` for SR. Color + icon + text (never color alone). Focus rings use `focus-visible:outline-2 focus-visible:outline-brand`. 36px min touch targets.
- Responsive: hero stacks on mobile; paired grids stack; KPI strip 2×2 → 4-across xl; Vitals grid 2×2 → 4-across xl.

## 6. Testing & Verification

Co-located `*.test.tsx` for each touched/new component. RTL + user-event. Cover: render, loading skeleton, empty state, error retry.

Existing tests to update:
- `src/app/patient/(app)/page.test.tsx`: assert new widgets present, assert layout order matches §2.
- `HealthSummaryStrip.test.tsx`: assert sparkline + delta pill render.
- `MedicationsToday.test.tsx`, `VitalsTrend.test.tsx`, `RecentRecords.test.tsx`: density assertions.

New tests:
- `MiniSparkline.test.tsx`: empty/null data → null; renders polyline; SR title.
- `NotificationsPreview.test.tsx`: renders top 5; empty state; "View all" link.
- `InsuranceCoverage.test.tsx`: loading skeleton; renewal ≤30d amber; lapsed rose.

Run: `pnpm --filter marketing test src/app/patient/(app)/` + dashboard tests.
Manual: 390px + 1280px screenshots, keyboard tab through hero → KPIs → cards, light mode.

## 7. Files Touched

Edit:
- `src/app/patient/(app)/page.tsx` — new order, `max-w-7xl`, `gap-4`.
- `src/patient/components/dashboard/DashboardHero.tsx` — trim height, vertical right stack.
- `src/patient/components/dashboard/HealthSummaryStrip.tsx` — sparklines + delta.
- `src/patient/components/dashboard/MedicationsToday.tsx` — denser rows + sticky footer.
- `src/patient/components/dashboard/UpcomingAppointment.tsx` — compact + countdown chip.
- `src/patient/components/dashboard/VitalsTrend.tsx` — 4 sparkline grid.
- `src/patient/components/dashboard/RecentRecords.tsx` — 5 rows + tag chips.
- `src/patient/components/dashboard/CareAssistant.tsx` — tighten + single primary.
- `src/patient/components/dashboard/index.ts` — export new widgets.
- `src/patient/hooks/index.ts` — re-export `useInsurance`.

Add:
- `src/patient/components/dashboard/MiniSparkline.tsx` + `.test.tsx`.
- `src/patient/components/dashboard/NotificationsPreview.tsx` + `.test.tsx`.
- `src/patient/components/dashboard/InsuranceCoverage.tsx` + `.test.tsx`.
- `src/patient/hooks/insurance.ts`.

No backend, no i18n, no migration, no shared-contract changes (insurance path is best-effort; if contract lacks the slot, hook returns `null` + logs).

## 8. Out of Scope (YAGNI)
- Drag-reorder / saved layouts / theme toggle / chart lib / animation lib.
- Wellness sub-score radar / care-team presence on home.
- Family/caretakers/insurance-marketplace sections on home (sidebar covers).
- Any backend work for insurance endpoint (hook degrades gracefully).
