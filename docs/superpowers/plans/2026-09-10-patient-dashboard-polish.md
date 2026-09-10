# Patient Dashboard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the patient dashboard visually and add a glanceable Health Summary Strip without new APIs.

**Architecture:** Keep `page.tsx` order, refine `DashboardHero` + `QuickActions` classNames only, add one new `HealthSummaryStrip` component composing existing TanStack Query hooks, unify container spacing responsively.

**Tech Stack:** Next.js 16.2.10 (App Router, `use client`), React 19, Tailwind CSS v4, lucide-react icons, TanStack Query v5, Vitest + Testing Library.

## Global Constraints

- No new APIs, routes, auth, backend, migration, or i18n changes.
- Reuse existing hooks only: `useWellness`, `useVitalsAlerts`, `useMedicationStats`, `useAppointments`.
- Follow existing patterns: `Card`, `CardHeader`, `QueryBoundary`, `Skeleton`, `EmptyState`, `cn` from `@/portal/lib/utils`.
- Clean clinical light style: white cards, `border-border`, 16px card radius, soft shadow, sky/teal accents.
- Never use the strings `Life quality` or `Recent activity` in new home UI (existing `page.test.tsx` asserts their absence).
- Mobile 390px stacks, desktop 1280px uses 2-col grids; 44px min touch targets, visible focus rings.

---

### Task 1: HealthSummaryStrip component (TDD)

**Files:**
- Create: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx`
- Create: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.test.tsx`

**Interfaces:**
- Consumes: `useWellness() -> { data?: { score: number, level: { label: string } } }`, `useVitalsAlerts(7) -> { data?: { count: number } }`, `useMedicationStats(7) -> { data?: { todayTaken: number, todayCount: number, streakDays: number } }`, `useAppointments() -> { data?: { appointments: AppointmentRow[] } }`, `formatDayLabel(date: string)`, `formatTime(time: string)` from `@/patient/lib/format`.
- Produces: `export function HealthSummaryStrip({ className }: { className?: string })` — grid of 4 linked tiles.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useWellness: () => ({ data: { score: 82, level: { label: "Good" } }, isLoading: false, isError: false }),
  useVitalsAlerts: () => ({ data: { count: 0, items: [] }, isLoading: false, isError: false }),
  useMedicationStats: () => ({ data: { todayTaken: 2, todayCount: 3, streakDays: 4 }, isLoading: false, isError: false }),
  useAppointments: () => ({ data: { appointments: [{ date: "2099-01-02", time: "10:00", doctorName: "Dr. Silva", doctorSpecialization: "GP", hospitalName: "General", mode: "video" }] }, isLoading: false, isError: false }),
}));

import { HealthSummaryStrip } from "./HealthSummaryStrip";

describe("HealthSummaryStrip", () => {
  it("renders four glanceable tiles with links", () => {
    render(<HealthSummaryStrip />);
    expect(screen.getByText("Wellness")).toBeTruthy();
    expect(screen.getByText("82")).toBeTruthy();
    expect(screen.getByText("Vitals steady")).toBeTruthy();
    expect(screen.getByText("Adherence")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.getByText("Next visit")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Wellness/i })).toHaveProperty("href");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/HealthSummaryStrip.test.tsx`
Expected: FAIL with "HealthSummaryStrip not defined / no such file"

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx
"use client";

import Link from "next/link";
import { Activity, CalendarDays, HeartPulse, Pill } from "lucide-react";
import { useAppointments, useMedicationStats, useVitalsAlerts, useWellness } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";

function Tile({ href, label, icon, value, sub, ariaLabel }: { href: string; label: string; icon: React.ReactNode; value: string; sub: string; ariaLabel: string }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand min-h-[76px]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
        <span className="block truncate text-xl font-extrabold tracking-tight text-text">{value}</span>
        <span className="block truncate text-xs text-text-soft">{sub}</span>
      </span>
    </Link>
  );
}

export function HealthSummaryStrip({ className }: { className?: string }) {
  const wellness = useWellness();
  const alerts = useVitalsAlerts(7);
  const stats = useMedicationStats(7);
  const appts = useAppointments();

  const score = wellness.data?.score;
  const alertCount = alerts.data?.count ?? 0;
  const taken = stats.data?.todayTaken ?? 0;
  const total = stats.data?.todayCount ?? 0;
  const next = (appts.data?.appointments ?? [])
    .filter((a) => new Date(a.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] ?? null;

  return (
    <section aria-label="Health summary" className={cn("anim-rise grid grid-cols-2 gap-3 xl:grid-cols-4", className)}>
      <Tile href="/patient/health" label="Wellness" ariaLabel="Wellness score details" icon={<HeartPulse size={19} />} value={score != null ? String(score) : "—"} sub={wellness.data?.level.label ?? "Building rhythm"} />
      <Tile href="/patient/vitals" label="Vitals" ariaLabel="Vitals status details" icon={<Activity size={19} />} value={alertCount > 0 ? `${alertCount} alert${alertCount === 1 ? "" : "s"}` : "Steady"} sub={alertCount > 0 ? "Review readings" : "Vitals steady"} />
      <Tile href="/patient/medications" label="Adherence" ariaLabel="Medication adherence details" icon={<Pill size={19} />} value={`${taken}/${total}`} sub={stats.data?.streakDays ? `${stats.data.streakDays}d streak` : "Today's doses"} />
      <Tile href="/patient/appointments" label="Next visit" ariaLabel="Next visit details" icon={<CalendarDays size={19} />} value={next ? formatDayLabel(next.date) : "None"} sub={next ? `${formatTime(next.time)} · ${next.doctorName ?? "Doctor"}` : "Book a visit"} />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter marketing test src/patient/components/dashboard/HealthSummaryStrip.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.test.tsx
git commit -m "feat: add patient health summary strip"
```

---

### Task 2: Wire strip into dashboard home

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/index.ts`
- Modify: `apps/marketing/src/app/patient/(app)/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/page.test.tsx`

**Interfaces:**
- Consumes: `HealthSummaryStrip` from Task 1.
- Produces: Dashboard home order Hero > Safety > QuickActions > HealthSummaryStrip > Meds/Visit > Vitals > Records/Assistant.

- [ ] **Step 1: Export strip from barrel**

```ts
// append to apps/marketing/src/patient/components/dashboard/index.ts
export { HealthSummaryStrip } from "./HealthSummaryStrip";
```

Current file already exports 12 items ending with `SafetyBanner` and `QuickActions`; add the line above as the last line.

- [ ] **Step 2: Update page.tsx imports and JSX**

```tsx
// apps/marketing/src/app/patient/(app)/page.tsx
import {
  CareAssistant,
  DashboardHero,
  HealthSummaryStrip,
  MedicationsToday,
  QuickActions,
  RecentRecords,
  SafetyBanner,
  UpcomingAppointment,
  VitalsTrend,
} from "@/patient/components/dashboard";
```

Insert after `<QuickActions />`:

```tsx
<HealthSummaryStrip />
```

Full JSX becomes:

```tsx
<div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-1 pb-6 pt-1 sm:gap-6 sm:px-2">
  <DashboardHero />
  <SafetyBanner />
  <QuickActions />
  <HealthSummaryStrip />
  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <MedicationsToday />
    <UpcomingAppointment />
  </div>
  <VitalsTrend />
  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <RecentRecords />
    <CareAssistant className="min-h-full" />
  </div>
</div>
```

- [ ] **Step 3: Update page.test.tsx mock-safe assertions**

Add to the existing `DashboardPage` test (keep all existing expects, do not add `Life quality` or `Recent activity` strings):

```tsx
expect(screen.getByText("Wellness")).toBeTruthy();
expect(screen.getByText("Adherence")).toBeTruthy();
expect(screen.getByText("Next visit")).toBeTruthy();
```

- [ ] **Step 4: Run home test**

Run: `pnpm --filter marketing test src/app/patient/\(app\)/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/index.ts "apps/marketing/src/app/patient/(app)/page.tsx" "apps/marketing/src/app/patient/(app)/page.test.tsx"
git commit -m "feat: show health summary on patient dashboard"
```

---

### Task 3: Polish DashboardHero (classNames only, no logic)

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/DashboardHero.tsx:74-302`

**Interfaces:**
- Consumes: `useProfile`, `useHealthSummary`, `useWellness`, `useVitalsAlerts(7)` (unchanged).
- Produces: Same JSX structure and links (`/patient/vitals`, `/patient/health`, `/patient/health-id`, `/patient/appointments`), refined visuals only.

- [ ] **Step 1: Soften gradient + unify pills**

Replace the `header` style background with:

```tsx
background:
  "linear-gradient(135deg, #0B4A6F 0%, #0369A1 45%, #0E7490 75%, #14919B 100%)",
```

Keep boxShadow as-is. Add `focus-visible:outline-2 focus-visible:outline-white` to the three inner `Link` shortcuts (Log vitals, Health ID, Book visit) and the wellness badge link.

- [ ] **Step 2: Improve mobile stacking**

Change the main flex row class from:

```tsx
"flex items-start justify-between gap-6 flex-wrap"
```

to:

```tsx
"flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-6"
```

Change the right column from `flex flex-col items-end gap-3 shrink-0` to `flex flex-col items-stretch md:items-end gap-3 shrink-0 w-full md:w-auto`.

- [ ] **Step 3: Run hero-related tests**

Run: `pnpm --filter marketing test src/app/patient/\(app\)/page.test.tsx`
Expected: PASS (hero text `Good morning/afternoon/evening` + name still renders)

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/DashboardHero.tsx
git commit -m "style: polish patient dashboard hero"
```

---

### Task 4: Polish QuickActions (classNames + a11y only)

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/QuickActions.tsx:1-88`

**Interfaces:**
- Consumes: Same 4-entry `ACTIONS` array (hrefs `/patient/medications`, `/patient/records/new`, `/patient/appointments/book`, `/patient/vitals`).
- Produces: Same `QuickActions` export, larger touch targets and hover polish.

- [ ] **Step 1: Enlarge tiles and add a11y labels**

Replace the `Link` className:

```tsx
"group flex items-center gap-3.5 rounded-2xl border border-border bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand min-h-[76px]"
```

Replace icon span size from `h-11 w-11` to `h-12 w-12` and icon `size={19}` to `size={20}`. Add `aria-label={action.label}` to each `Link`.

- [ ] **Step 2: Run tests**

Run: `pnpm --filter marketing test src/app/patient/\(app\)/page.test.tsx`
Expected: PASS (`Quick actions` heading still found)

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/QuickActions.tsx
git commit -m "style: polish patient quick actions"
```

---

### Task 5: Final verification (tests + lint)

**Files:**
- Test: `apps/marketing/src/app/patient/(app)/page.test.tsx`
- Test: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.test.tsx`

**Interfaces:**
- Consumes: All tasks above.
- Produces: Green test run, no new lint errors in touched files.

- [ ] **Step 1: Run dashboard test suite**

Run: `pnpm --filter marketing test src/patient/components/dashboard src/app/patient/\(app\)/page.test.tsx`
Expected: PASS (all suites, including `MedicationsToday.test.tsx`, `VitalsTrend.test.tsx`, `RecentRecords.test.tsx`)

- [ ] **Step 2: Lint touched files**

Run: `pnpm --filter marketing lint -- apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx "apps/marketing/src/app/patient/(app)/page.tsx" apps/marketing/src/patient/components/dashboard/DashboardHero.tsx apps/marketing/src/patient/components/dashboard/QuickActions.tsx`
Expected: No new warnings/errors (pre-existing warnings allowed if untouched lines)

- [ ] **Step 3: Manual responsive check**

Open `/patient` at 390px and 1280px. Confirm: hero stacks cleanly, QuickActions is 2x2 on mobile and 4-across on desktop, strip is 2x2 mobile and 4-across xl, paired cards stack on mobile. Tab through with keyboard — every tile shows a focus ring.
