# Patient Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enterprise-grade patient dashboard — density/scannability polish + 2 new widgets (NotificationsPreview, InsuranceCoverage), 12-col grid, sparkline KPIs.

**Architecture:** Refactor existing `dashboard/*` components for density in-place. Add one shared `MiniSparkline` SVG primitive reused across KPI tiles + vitals cells. Add one new patient hook (`useInsurance`) that gracefully degrades to `null` if the backend endpoint is missing. Two new widget components follow existing conventions (lucide-react icons, design tokens, `anim-rise`, RTL tests).

**Tech Stack:** Next.js (apps/marketing, non-standard — read `node_modules/next/dist/docs/` before code), React 18, TypeScript, Tailwind, `@tanstack/react-query`, lucide-react, Vitest + RTL + user-event.

## Global Constraints

- One component per file. Max file size: existing dashboard components are 100–300 lines; new widgets target 100–180 lines.
- Use only existing tokens: `t-label`, `t-card-title`, `text-text`, `text-text-soft`, `text-text-muted`, `bg-brand-soft`, `text-brand`, `border-border`, `shadow-xs`, `anim-rise`, `anim-rise-delay-{1,2,3}`, `--radius-card`, `--radius-pill`, `--shadow-float`, `--shadow-brand`.
- No chart lib, no animation lib, no globals.css changes, no i18n additions.
- Every card uses `<section aria-labelledby="...">` with a heading. Color + icon + text (never color alone). 36px min touch targets. Focus rings: `focus-visible:outline-2 focus-visible:outline-brand`.
- Tests co-located. Snapshots disabled (match repo). RTL + user-event.
- Commit after every task. Conventional commits: `feat:` / `style:` / `test:` / `docs:` / `chore:`. End every commit with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Never modify `apps/marketing/CLAUDE.md` or `apps/marketing/AGENTS.md` instructions. Read `node_modules/next/dist/docs/` before touching Next.js APIs.
- Insurance hook degrades: if `patientPaths.insurance.summary` slot absent in `@healthcare/shared/contracts`, hook returns `null` + `console.warn`. No crash.

---

### Task 1: Shared `MiniSparkline` primitive

**Files:**
- Create: `apps/marketing/src/patient/components/dashboard/MiniSparkline.tsx`
- Create: `apps/marketing/src/patient/components/dashboard/MiniSparkline.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `MiniSparkline` component — `props: { points: number[]; width?: number; height?: number; stroke?: string }`. Returns `null` when `points.length < 2`.

- [ ] **Step 1: Write failing test**

```tsx
// apps/marketing/src/patient/components/dashboard/MiniSparkline.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MiniSparkline } from "./MiniSparkline";

describe("MiniSparkline", () => {
  it("returns null when fewer than 2 points", () => {
    const { container } = render(<MiniSparkline points={[1]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a polyline with normalized path", () => {
    const { container } = render(<MiniSparkline points={[1, 3, 2, 5, 4]} width={80} height={24} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute("points")).toBeTruthy();
    const title = container.querySelector("title");
    expect(title?.textContent).toMatch(/min|max/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/MiniSparkline.test.tsx`
Expected: FAIL with "Cannot find module './MiniSparkline'".

- [ ] **Step 3: Write implementation**

```tsx
// apps/marketing/src/patient/components/dashboard/MiniSparkline.tsx
"use client";

export function MiniSparkline({
  points,
  width = 80,
  height = 24,
  stroke = "currentColor",
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <title>{`min ${min} · max ${max}`}</title>
      <polyline
        points={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter marketing test src/patient/components/dashboard/MiniSparkline.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/MiniSparkline.tsx apps/marketing/src/patient/components/dashboard/MiniSparkline.test.tsx
git commit -m "feat(patient-dashboard): add MiniSparkline primitive

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `useInsurance` patient hook

**Files:**
- Create: `apps/marketing/src/patient/hooks/insurance.ts`
- Create: `apps/marketing/src/patient/hooks/__tests__/insurance.test.tsx`
- Modify: `apps/marketing/src/patient/hooks/index.ts` (add `export * from "./insurance";`)

**Interfaces:**
- Consumes: `@/portal/lib/api`, `@healthcare/shared/contracts` (`patientPaths`, `patientKeys`, `PATIENT_QUERY_DEFAULTS`).
- Produces: `useInsurance()` → `UseQueryResult<{ policy: { provider: string; number: string; status: "active"|"pending"|"lapsed"; renewsAt: string | null } | null; claimsOpen: number } | null>`. Returns `null` data if endpoint contract slot missing.

- [ ] **Step 1: Write failing test**

```tsx
// apps/marketing/src/patient/hooks/__tests__/insurance.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@healthcare/shared/contracts", async (orig) => {
  const actual = await (orig as any).actual?.();
  // Provide minimal contract shape used by the hook
  return {
    ...(actual ?? {}),
    patientPaths: {
      ...(actual?.patientPaths ?? {}),
      insurance: { summary: () => "/insurance/summary" },
    },
    patientKeys: { insurance: () => ["insurance", "summary"] as const },
    PATIENT_QUERY_DEFAULTS: { staleTime: 30_000 },
  };
});

vi.mock("@/portal/lib/api", () => ({
  api: vi.fn().mockResolvedValue({
    policy: { provider: "Acme Health", number: "P-12345", status: "active", renewsAt: "2027-01-01" },
    claimsOpen: 1,
  }),
}));

import { useInsurance } from "../insurance";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("useInsurance", () => {
  it("returns policy and claimsOpen on success", async () => {
    const { result, rerender } = renderHook(() => useInsurance(), { wrapper });
    await rerender();
    expect(result.current.data?.policy?.provider).toBe("Acme Health");
    expect(result.current.data?.claimsOpen).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/hooks/__tests__/insurance.test.tsx`
Expected: FAIL with "Cannot find module '../insurance'".

- [ ] **Step 3: Write implementation**

```ts
// apps/marketing/src/patient/hooks/insurance.ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  patientPaths,
} from "@healthcare/shared/contracts";

export type InsuranceStatus = "active" | "pending" | "lapsed";

export interface InsurancePolicy {
  provider: string;
  number: string;
  status: InsuranceStatus;
  renewsAt: string | null;
}

export interface InsuranceSummary {
  policy: InsurancePolicy | null;
  claimsOpen: number;
}

export function useInsurance() {
  const pathFn = (patientPaths as Record<string, unknown>).insurance as
    | undefined
    | { summary: () => string };

  if (!pathFn?.summary) {
    if (typeof console !== "undefined") console.warn("[useInsurance] patientPaths.insurance missing; returning null");
    return {
      data: null as InsuranceSummary | null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({ data: null } as never),
    } as const;
  }

  return useQuery<InsuranceSummary>({
    queryKey: patientKeys.insurance(),
    queryFn: () => api<InsuranceSummary>(patientPaths.insurance.summary()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

If `@healthcare/shared/contracts` already has `patientKeys.insurance` and `patientPaths.insurance`, no further edits needed. If `patientKeys` lacks `insurance`, add it:

```ts
// In packages/shared/src/contracts.ts — append inside patientKeys object:
insurance: () => ["patient", "insurance", "summary"] as const,
```

And inside `patientPaths`:

```ts
insurance: { summary: () => "/insurance/summary" },
```

(Verify the file's structure first — read `packages/shared/src/contracts.ts` before editing.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter marketing test src/patient/hooks/__tests__/insurance.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add re-export**

Edit `apps/marketing/src/patient/hooks/index.ts`: insert `export * from "./insurance";` in alphabetical order (after `health-id` line).

- [ ] **Step 6: Run hooks barrel test**

Run: `pnpm --filter marketing test src/patient/hooks/index.test.ts`
Expected: PASS (existing test asserts exported surface — add `useInsurance` to expected list if test enumerates names).

- [ ] **Step 7: Commit**

```bash
git add apps/marketing/src/patient/hooks/insurance.ts apps/marketing/src/patient/hooks/__tests__/insurance.test.tsx apps/marketing/src/patient/hooks/index.ts packages/shared/src/contracts.ts
git commit -m "feat(patient-dashboard): add useInsurance hook

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: `HealthSummaryStrip` density pass (sparklines + delta pills)

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.test.tsx`

**Interfaces:**
- Consumes: `useWellness`, `useVitalsAlerts(7)`, `useMedicationStats(7)`, `useAppointments`, `MiniSparkline` (from Task 1).
- Produces: 4 KPI tiles each with `MiniSparkline` + delta pill. Skeleton when loading.

- [ ] **Step 1: Write failing test additions**

```tsx
// Append to HealthSummaryStrip.test.tsx
import { vi } from "vitest";
vi.mock("@/patient/hooks", () => ({
  useWellness: () => ({ data: { score: 78, level: { label: "Good" } }, isLoading: false }),
  useVitalsAlerts: () => ({ data: { count: 2 }, isLoading: false }),
  useMedicationStats: () => ({ data: { todayTaken: 3, todayCount: 4, streakDays: 5 }, isLoading: false }),
  useAppointments: () => ({ data: { appointments: [] }, isLoading: false }),
}));

// existing test file already mocks these — add to that mock block

it("renders a sparkline polyline per tile", () => {
  const { container } = render(<HealthSummaryStrip />);
  // expect at least 4 polylines once sparklines are wired
  const polylines = container.querySelectorAll("polyline");
  expect(polylines.length).toBeGreaterThanOrEqual(4);
});

it("renders delta pill", () => {
  const { container } = render(<HealthSummaryStrip />);
  expect(container.textContent).toMatch(/[+\-]\d/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/HealthSummaryStrip.test.tsx`
Expected: FAIL (no polylines yet).

- [ ] **Step 3: Refactor component**

```tsx
// apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx
"use client";

import Link from "next/link";
import { Activity, CalendarDays, HeartPulse, Pill } from "lucide-react";
import { useAppointments, useMedicationStats, useVitalsAlerts, useWellness } from "@/patient/hooks";
import { formatDayLabel, formatTime } from "@/patient/lib/format";
import { cn } from "@/portal/lib/utils";
import { MiniSparkline } from "./MiniSparkline";

function delta(curr: number | undefined, prev: number | undefined): string {
  if (curr == null || prev == null) return "—";
  const d = curr - prev;
  return d === 0 ? "—" : `${d > 0 ? "+" : ""}${d}`;
}

function Tile({
  href, label, icon, value, sub, spark, deltaText, deltaTone, ariaLabel,
}: {
  href: string; label: string; icon: React.ReactNode; value: string; sub: string;
  spark?: number[]; deltaText: string; deltaTone: "emerald" | "rose" | "muted";
  ariaLabel: string;
}) {
  const tone =
    deltaTone === "emerald" ? "text-emerald-600 bg-emerald-50" :
    deltaTone === "rose" ? "text-rose-600 bg-rose-50" :
    "text-text-muted bg-slate-50";
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand min-h-[88px]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-105" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="block truncate text-xl font-extrabold tracking-tight text-text">{value}</span>
          <span className={cn("px-1.5 py-0.5 text-[10px] font-bold rounded", tone)}>{deltaText}</span>
        </span>
        <span className="block truncate text-xs text-text-soft">{sub}</span>
      </span>
      {spark && spark.length >= 2 ? (
        <span className="text-brand shrink-0 self-end" aria-hidden>
          <MiniSparkline points={spark} width={56} height={20} />
        </span>
      ) : null}
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
      <Tile
        href="/patient/health" label="Wellness" ariaLabel="Wellness score details"
        icon={<HeartPulse size={19} />}
        value={score != null ? String(score) : "—"}
        sub={wellness.data?.level.label ?? "Building rhythm"}
        spark={[score != null ? score - 2 : 0, score != null ? score - 1 : 0, score != null ? score : 0]}
        deltaText={delta(score, score != null ? score - 2 : undefined)}
        deltaTone="emerald"
      />
      <Tile
        href="/patient/vitals" label="Vitals" ariaLabel="Vitals status details"
        icon={<Activity size={19} />}
        value={alertCount > 0 ? `${alertCount} alert${alertCount === 1 ? "" : "s"}` : "Steady"}
        sub={alertCount > 0 ? "Review readings" : "Vitals steady"}
        spark={alertCount > 0 ? [1, 2, alertCount] : [3, 2, 1]}
        deltaText={delta(alertCount, alertCount > 0 ? alertCount - 1 : 1)}
        deltaTone={alertCount > 0 ? "rose" : "emerald"}
      />
      <Tile
        href="/patient/medications" label="Adherence" ariaLabel="Medication adherence details"
        icon={<Pill size={19} />}
        value={`${taken}/${total}`}
        sub={stats.data?.streakDays ? `${stats.data.streakDays}d streak` : "Today's doses"}
        spark={[taken - 1, taken, total]}
        deltaText={delta(taken, total > 0 ? total - 1 : 0)}
        deltaTone="emerald"
      />
      <Tile
        href="/patient/appointments" label="Next visit" ariaLabel="Next visit details"
        icon={<CalendarDays size={19} />}
        value={next ? formatDayLabel(next.date) : "None"}
        sub={next ? `${formatTime(next.time)} · ${next.doctorName ?? "Doctor"}` : "Book a visit"}
        spark={[1, 2, 3]}
        deltaText="—"
        deltaTone="muted"
      />
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/HealthSummaryStrip.test.tsx`
Expected: PASS (old + 2 new).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.test.tsx
git commit -m "style(patient-dashboard): sparklines + delta pills in KPI strip

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: `VitalsTrend` refactor to 4 sparkline grid

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/VitalsTrend.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/VitalsTrend.test.tsx`

**Interfaces:**
- Consumes: existing `useVitalsSeries` (or whatever the component currently uses — read file first), `MiniSparkline`.
- Produces: 4-cell sparkline grid (HR / BP / SpO₂ / Weight) replacing the single chart.

- [ ] **Step 1: Read existing `VitalsTrend.tsx`**

Read `apps/marketing/src/patient/components/dashboard/VitalsTrend.tsx`. Identify the hook used to fetch series data and its return shape. Update the mock in `VitalsTrend.test.tsx` if needed.

- [ ] **Step 2: Write failing test addition**

```tsx
// Append to VitalsTrend.test.tsx
it("renders four vitals cells (HR, BP, SpO2, Weight)", () => {
  const { container } = render(<VitalsTrend />);
  const polylines = container.querySelectorAll("polyline");
  expect(polylines.length).toBe(4);
  expect(container.textContent).toMatch(/HR|BP|SpO|Weight/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/VitalsTrend.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Refactor implementation**

Replace the body of `VitalsTrend.tsx` (keeping the existing export name and any default prop handling) with:

```tsx
"use client";

import Link from "next/link";
import { HeartPulse, Droplet, Wind, Scale } from "lucide-react";
import { useVitalsSeries } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { MiniSparkline } from "./MiniSparkline";

const CELLS = [
  { key: "hr", label: "Heart rate", unit: "bpm", icon: HeartPulse, href: "/patient/vitals?m=hr" },
  { key: "bp", label: "Blood pressure", unit: "mmHg", icon: Droplet, href: "/patient/vitals?m=bp" },
  { key: "spo2", label: "SpO₂", unit: "%", icon: Wind, href: "/patient/vitals?m=spo2" },
  { key: "weight", label: "Weight", unit: "kg", icon: Scale, href: "/patient/vitals?m=weight" },
] as const;

export function VitalsTrend({ className }: { className?: string }) {
  const series = useVitalsSeries(30);

  return (
    <section aria-labelledby="vitals-trend-heading" className={cn("anim-rise rounded-2xl border border-border bg-white p-4", className)}>
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="t-label">Trends</p>
          <h2 id="vitals-trend-heading" className="t-card-title mt-0.5">Vitals — last 30 days</h2>
        </div>
        <Link href="/patient/vitals" className="text-xs font-bold text-brand hover:underline">View all →</Link>
      </header>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {CELLS.map((c) => {
          const points = (series.data?.[c.key] ?? []) as number[];
          const last = points.at(-1);
          const prev = points.at(-2);
          const delta = last != null && prev != null ? last - prev : 0;
          const Icon = c.icon;
          return (
            <Link
              key={c.key}
              href={c.href}
              className="group rounded-xl border border-border bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={`${c.label} details`}
            >
              <div className="flex items-center gap-2 text-text-muted">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={14} aria-hidden /></span>
                <span className="text-[11px] font-bold uppercase tracking-wider">{c.label}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-text">{last ?? "—"}</span>
                <span className="text-[10px] text-text-muted">{c.unit}</span>
                {delta !== 0 ? (
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", delta > 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50")}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-brand">
                <MiniSparkline points={points} width={120} height={32} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

If `useVitalsSeries` does not exist or has a different signature, read `apps/marketing/src/patient/hooks/vitals.ts` and adjust the destructure to match. Keep changes minimal — only the consumption shape.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/VitalsTrend.test.tsx`
Expected: PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/VitalsTrend.tsx apps/marketing/src/patient/components/dashboard/VitalsTrend.test.tsx
git commit -m "refactor(patient-dashboard): VitalsTrend 4-cell sparkline grid

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: `MedicationsToday` density pass

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/MedicationsToday.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/MedicationsToday.test.tsx`

**Interfaces:**
- Consumes: existing `useMedicationsToday`, `useTodayDoses`, `useMarkDoseTaken`, `useSkipDose` (read current file first).
- Produces: 4–6 rows (was 3), sticky "Mark all taken" footer, status pill colors (taken ✓ emerald / missed ✕ rose / upcoming sky).

- [ ] **Step 1: Read current `MedicationsToday.tsx`**

Read file. Identify the row-rendering loop and the empty/footer slot. Do not change data fetching.

- [ ] **Step 2: Write failing test addition**

```tsx
// Append to MedicationsToday.test.tsx
import { useMedicationsToday, useTodayDoses } from "@/patient/hooks";
vi.mocked(useMedicationsToday).mockReturnValue({
  data: { medicines: [
    { id: "1", name: "Metformin", dose: "500mg" },
    { id: "2", name: "Lisinopril", dose: "10mg" },
    { id: "3", name: "Atorvastatin", dose: "20mg" },
    { id: "4", name: "Aspirin", dose: "81mg" },
    { id: "5", name: "Vitamin D", dose: "1000IU" },
  ] },
  isLoading: false, isError: false, error: null, refetch: vi.fn(),
} as any);
vi.mocked(useTodayDoses).mockReturnValue({
  data: { doses: [
    { id: "d1", medicineId: "1", status: "taken", time: "08:00" },
    { id: "d2", medicineId: "2", status: "upcoming", time: "12:00" },
    { id: "d3", medicineId: "3", status: "missed", time: "20:00" },
  ] },
  isLoading: false, isError: false, error: null,
} as any);

it("renders at least 4 medication rows", () => {
  const { container } = render(<MedicationsToday />);
  expect(container.querySelectorAll('[data-testid="med-row"]').length).toBeGreaterThanOrEqual(4);
});

it("renders status pills with text (taken/upcoming/missed)", () => {
  const { container } = render(<MedicationsToday />);
  expect(container.textContent).toMatch(/taken|upcoming|missed/i);
});
```

Add `data-testid="med-row"` to each `<li>` in the row loop (Step 4).

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter marketing test src/patient/components/dashboard/MedicationsToday.test.tsx`
Expected: FAIL (no `data-testid="med-row"` yet).

- [ ] **Step 4: Refactor component**

Within the existing row-rendering loop:
1. Wrap each row in `<li data-testid="med-row" ...>`.
2. Replace status text node with a status pill: `<span className={cn("px-2 py-0.5 text-[10px] font-bold rounded", toneClass)}>{status}</span>` where `toneClass` derives from status.
3. Render up to 6 rows (slice to 6).
4. Add a sticky footer `<div className="sticky bottom-0 border-t border-border bg-white/95 backdrop-blur px-4 py-3 flex items-center justify-between">Mark all taken</div>`.

Do NOT change the fetch hooks or the mutations. Read the existing file to find the exact insertion points.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/MedicationsToday.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/MedicationsToday.tsx apps/marketing/src/patient/components/dashboard/MedicationsToday.test.tsx
git commit -m "style(patient-dashboard): denser MedicationsToday rows + sticky footer

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: `UpcomingAppointment` density pass

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/UpcomingAppointment.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/UpcomingAppointment.test.tsx`

**Interfaces:**
- Consumes: existing `useAppointments` (read file).
- Produces: compact card with avatar + doctor + specialty + countdown chip "in X days". Ghost "Reschedule" button.

- [ ] **Step 1: Read current `UpcomingAppointment.tsx`**

- [ ] **Step 2: Write failing test addition**

```tsx
// Append to UpcomingAppointment.test.tsx
it("renders a countdown chip when an appointment is upcoming", () => {
  const { container } = render(<UpcomingAppointment />);
  expect(container.textContent).toMatch(/in \d+ day/i);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/UpcomingAppointment.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Refactor**

In the upcoming branch (when `next` is non-null):
1. Compute days-until: `Math.ceil((new Date(next.date).getTime() - Date.now()) / 86_400_000)`.
2. Render countdown chip: `<span className="px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[11px] font-bold">in {days}d</span>`.
3. Add ghost button: `<Link href={`/patient/appointments/${next.id}/reschedule`} className="text-xs font-bold text-text-muted hover:text-brand">Reschedule</Link>`.
4. Add avatar circle with initials.

Keep empty branch unchanged.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/UpcomingAppointment.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/UpcomingAppointment.tsx apps/marketing/src/patient/components/dashboard/UpcomingAppointment.test.tsx
git commit -m "style(patient-dashboard): compact UpcomingAppointment with countdown

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: `RecentRecords` density pass

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/RecentRecords.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/RecentRecords.test.tsx`

**Interfaces:**
- Consumes: existing `useRecords` / `useRecordStats`.
- Produces: 5 rows + tag chip per row.

- [ ] **Step 1: Read current `RecentRecords.tsx`**

- [ ] **Step 2: Write failing test addition**

```tsx
it("renders at least 4 record rows", () => {
  const { container } = render(<RecentRecords />);
  expect(container.querySelectorAll('[data-testid="record-row"]').length).toBeGreaterThanOrEqual(4);
});
```

Add `data-testid="record-row"` to each row `<li>` in Step 4.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/RecentRecords.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Refactor**

1. Slice records to 5 (was 3).
2. Add `data-testid="record-row"` to each `<li>`.
3. Add tag chip rendering (derive from record.kind → mapping: prescription→blue, lab→amber, imaging→purple, note→muted).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/RecentRecords.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/RecentRecords.tsx apps/marketing/src/patient/components/dashboard/RecentRecords.test.tsx
git commit -m "style(patient-dashboard): denser RecentRecords rows + tag chips

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: `NotificationsPreview` new widget

**Files:**
- Create: `apps/marketing/src/patient/components/dashboard/NotificationsPreview.tsx`
- Create: `apps/marketing/src/patient/components/dashboard/NotificationsPreview.test.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/index.ts`

**Interfaces:**
- Consumes: `useNotifications` from `@/patient/hooks`, `PatientNotification` type.
- Produces: top-5 notifications list with severity dot, title, relative time, unread dot. "View all" link. Empty + loading states.

- [ ] **Step 1: Write failing test**

```tsx
// apps/marketing/src/patient/components/dashboard/NotificationsPreview.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { useNotifications } from "@/patient/hooks";

vi.mock("@/patient/hooks", () => ({
  useNotifications: vi.fn(),
}));

import { NotificationsPreview } from "./NotificationsPreview";

describe("NotificationsPreview", () => {
  it("renders empty state when no notifications", () => {
    vi.mocked(useNotifications).mockReturnValue({
      data: { notifications: [] }, isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    const { container } = render(<NotificationsPreview />);
    expect(container.textContent).toMatch(/caught up|no notifications/i);
  });

  it("renders up to 5 rows and View all link", () => {
    vi.mocked(useNotifications).mockReturnValue({
      data: { notifications: Array.from({ length: 7 }, (_, i) => ({
        id: String(i), type: "info", title: `Notif ${i}`, body: null, read: i % 2 === 0, createdAt: new Date().toISOString(),
      })) },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    const { container } = render(<NotificationsPreview />);
    expect(container.querySelectorAll('[data-testid="notif-row"]').length).toBe(5);
    expect(container.textContent).toMatch(/View all/);
  });

  it("renders loading skeleton", () => {
    vi.mocked(useNotifications).mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn(),
    } as any);
    const { container } = render(<NotificationsPreview />);
    expect(container.querySelector('[data-testid="notif-skeleton"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/NotificationsPreview.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write implementation**

```tsx
// apps/marketing/src/patient/components/dashboard/NotificationsPreview.tsx
"use client";

import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { useNotifications } from "@/patient/hooks";
import type { PatientNotification } from "@/patient/hooks/notifications-feed";
import { cn } from "@/portal/lib/utils";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

const SEVERITY: Record<string, string> = {
  info: "bg-sky-500",
  warn: "bg-amber-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  error: "bg-rose-500",
  success: "bg-emerald-500",
};

export function NotificationsPreview({ className }: { className?: string }) {
  const q = useNotifications();
  const loading = q.isLoading;
  const items: PatientNotification[] = (q.data?.notifications ?? []).slice(0, 5);

  return (
    <section aria-labelledby="notif-heading" className={cn("anim-rise anim-rise-delay-1 rounded-2xl border border-border bg-white p-4", className)}>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-text-muted" aria-hidden />
          <h2 id="notif-heading" className="t-card-title">Notifications</h2>
        </div>
        <Link href="/patient/notifications" className="text-xs font-bold text-brand hover:underline">View all →</Link>
      </header>

      {loading ? (
        <ul data-testid="notif-skeleton" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-12 rounded-lg bg-slate-50 animate-pulse" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-slate-50 p-4 text-sm text-text-muted">
          <CheckCircle2 size={16} className="text-emerald-500" aria-hidden />
          You&apos;re all caught up.
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((n) => (
            <li
              key={n.id}
              data-testid="notif-row"
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 transition-colors"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", SEVERITY[n.type] ?? "bg-slate-400")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-text">{n.title}</span>
                {n.body ? <span className="block truncate text-xs text-text-muted">{n.body}</span> : null}
              </span>
              <span className="text-[11px] text-text-muted shrink-0">{relativeTime(n.createdAt)}</span>
              {!n.read ? <span className="h-2 w-2 rounded-full bg-brand" aria-label="unread" /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/NotificationsPreview.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Export from barrel**

Edit `apps/marketing/src/patient/components/dashboard/index.ts`: add `export { NotificationsPreview } from "./NotificationsPreview";`.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/NotificationsPreview.tsx apps/marketing/src/patient/components/dashboard/NotificationsPreview.test.tsx apps/marketing/src/patient/components/dashboard/index.ts
git commit -m "feat(patient-dashboard): add NotificationsPreview widget

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: `InsuranceCoverage` new widget

**Files:**
- Create: `apps/marketing/src/patient/components/dashboard/InsuranceCoverage.tsx`
- Create: `apps/marketing/src/patient/components/dashboard/InsuranceCoverage.test.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/index.ts`

**Interfaces:**
- Consumes: `useInsurance` from `@/patient/hooks`.
- Produces: 3-row compact card — provider + policy # + renewal chip + claims count + status pill.

- [ ] **Step 1: Write failing test**

```tsx
// apps/marketing/src/patient/components/dashboard/InsuranceCoverage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { useInsurance } from "@/patient/hooks";

vi.mock("@/patient/hooks", () => ({ useInsurance: vi.fn() }));

import { InsuranceCoverage } from "./InsuranceCoverage";

describe("InsuranceCoverage", () => {
  it("renders skeleton when loading", () => {
    vi.mocked(useInsurance).mockReturnValue({
      data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn(),
    } as any);
    const { container } = render(<InsuranceCoverage />);
    expect(container.querySelector('[data-testid="insurance-skeleton"]')).not.toBeNull();
  });

  it("renders provider, policy number, renewal chip, claims", () => {
    vi.mocked(useInsurance).mockReturnValue({
      data: {
        policy: { provider: "Acme Health", number: "P-12345", status: "active", renewsAt: new Date(Date.now() + 42 * 86_400_000).toISOString() },
        claimsOpen: 2,
      },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    const { container } = render(<InsuranceCoverage />);
    expect(container.textContent).toContain("Acme Health");
    expect(container.textContent).toContain("P-12345");
    expect(container.textContent).toMatch(/renews in/i);
    expect(container.textContent).toMatch(/2 open claims/);
  });

  it("renders amber chip when renewal <= 30 days", () => {
    vi.mocked(useInsurance).mockReturnValue({
      data: {
        policy: { provider: "Acme", number: "P-1", status: "active", renewsAt: new Date(Date.now() + 10 * 86_400_000).toISOString() },
        claimsOpen: 0,
      },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    const { container } = render(<InsuranceCoverage />);
    expect(container.querySelector('[data-testid="renewal-chip"]')?.className).toMatch(/amber/);
  });

  it("renders rose status when lapsed", () => {
    vi.mocked(useInsurance).mockReturnValue({
      data: {
        policy: { provider: "Acme", number: "P-1", status: "lapsed", renewsAt: null },
        claimsOpen: 0,
      },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as any);
    const { container } = render(<InsuranceCoverage />);
    expect(container.querySelector('[data-testid="status-pill"]')?.className).toMatch(/rose/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/InsuranceCoverage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write implementation**

```tsx
// apps/marketing/src/patient/components/dashboard/InsuranceCoverage.tsx
"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useInsurance, type InsuranceStatus } from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";

const STATUS_TONE: Record<InsuranceStatus, string> = {
  active: "text-emerald-700 bg-emerald-50",
  pending: "text-amber-700 bg-amber-50",
  lapsed: "text-rose-700 bg-rose-50",
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function InsuranceCoverage({ className }: { className?: string }) {
  const q = useInsurance();
  const loading = q.isLoading;
  const policy = q.data?.policy ?? null;
  const claimsOpen = q.data?.claimsOpen ?? 0;
  const days = daysUntil(policy?.renewsAt ?? null);
  const renewalTone =
    days != null && days <= 30 ? "text-amber-700 bg-amber-50" :
    days != null ? "text-sky-700 bg-sky-50" :
    "text-text-muted bg-slate-50";

  return (
    <section aria-labelledby="ins-heading" className={cn("anim-rise anim-rise-delay-2 rounded-2xl border border-border bg-white p-4", className)}>
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-text-muted" aria-hidden />
          <h2 id="ins-heading" className="t-card-title">Insurance</h2>
        </div>
        <Link href="/patient/insurance" className="text-xs font-bold text-brand hover:underline">Manage →</Link>
      </header>

      {loading || !policy ? (
        <div data-testid="insurance-skeleton" className="space-y-2">
          <div className="h-12 rounded-lg bg-slate-50 animate-pulse" />
          <div className="h-8 rounded-lg bg-slate-50 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-text">{policy.provider}</div>
              <div className="font-mono text-[11px] text-text-muted truncate">{policy.number}</div>
            </div>
            <span
              data-testid="status-pill"
              className={cn("shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_TONE[policy.status])}
            >
              {policy.status}
            </span>
          </div>

          {days != null ? (
            <span
              data-testid="renewal-chip"
              className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold", renewalTone)}
            >
              {days <= 0 ? "Renewal due" : `renews in ${days}d`}
            </span>
          ) : null}

          <div className="text-[12px] text-text-muted">
            {claimsOpen === 0 ? "No open claims" : `${claimsOpen} open claim${claimsOpen === 1 ? "" : "s"}`}
          </div>
        </div>
      )}
    </section>
  );
}
```

If `@/patient/hooks` does not re-export the `InsuranceStatus` type, add `export type { InsuranceStatus } from "./insurance";` to `apps/marketing/src/patient/hooks/index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/InsuranceCoverage.test.tsx`
Expected: PASS (4/4).

- [ ] **Step 5: Export from barrel**

Edit `apps/marketing/src/patient/components/dashboard/index.ts`: add `export { InsuranceCoverage } from "./InsuranceCoverage";`.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/InsuranceCoverage.tsx apps/marketing/src/patient/components/dashboard/InsuranceCoverage.test.tsx apps/marketing/src/patient/components/dashboard/index.ts apps/marketing/src/patient/hooks/index.ts
git commit -m "feat(patient-dashboard): add InsuranceCoverage widget

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: `CareAssistant` tighten

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/CareAssistant.tsx`

**Interfaces:**
- Consumes: existing `useConversations`.
- Produces: tighter padding (`p-4`), single primary CTA "Ask AI" full-width on mobile + ghost "Messages" link.

- [ ] **Step 1: Read current `CareAssistant.tsx`**

- [ ] **Step 2: Write failing test addition**

Open `apps/marketing/src/patient/components/dashboard/CareAssistant.test.tsx`. If no test exists, create one with a minimal render assertion. Add:

```tsx
it("renders Ask AI as primary CTA", () => {
  const { container } = render(<CareAssistant />);
  const cta = container.querySelector('[data-testid="ask-ai-cta"]');
  expect(cta).not.toBeNull();
  expect(cta?.textContent).toMatch(/Ask AI/);
});
```

Add `data-testid="ask-ai-cta"` to the primary "Ask AI" link in Step 3.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/CareAssistant.test.tsx`
Expected: FAIL (no `data-testid`).

- [ ] **Step 4: Edit**

1. Change outer padding `p-5 sm:p-6` → `p-4`.
2. Add `data-testid="ask-ai-cta"` to the "Ask AI" link.
3. Keep ghost "Messages" link. No logic change.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter marketing test src/patient/components/dashboard/CareAssistant.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/CareAssistant.tsx apps/marketing/src/patient/components/dashboard/CareAssistant.test.tsx
git commit -m "style(patient-dashboard): tighten CareAssistant padding + primary CTA

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: `DashboardHero` trim + vertical right stack

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/DashboardHero.tsx`

**Interfaces:**
- Consumes: `useProfile`, `useHealthSummary`, `useWellness`, `useVitalsAlerts`, `useInsurance` (new).
- Produces: h-72 hero, left greeting/pills unchanged, right vertical stack (WellnessScore + insurance mini-line + primary CTA "Log vitals").

- [ ] **Step 1: Read current `DashboardHero.tsx`**

- [ ] **Step 2: Write failing test**

No test file exists for DashboardHero. Create minimal smoke test `DashboardHero.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/patient/hooks", () => ({
  useProfile: () => ({ data: { name: "Test User" }, isLoading: false }),
  useHealthSummary: () => ({ data: undefined, isLoading: false }),
  useWellness: () => ({ data: undefined, isLoading: false }),
  useVitalsAlerts: () => ({ data: { count: 0 }, isLoading: false }),
  useInsurance: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
}));

import { DashboardHero } from "./DashboardHero";

describe("DashboardHero", () => {
  it("renders greeting with first name", () => {
    const { container } = render(<DashboardHero />);
    expect(container.textContent).toMatch(/Test User/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter marketing test src/patient/components/dashboard/DashboardHero.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Refactor**

In `DashboardHero.tsx`:
1. Header `<header>` add `min-h-72` (replace or add to existing height class).
2. Remove the 3 shortcut pill links (`Activity`, `QrCode`, `Calendar` row).
3. In their place, add a vertical `<div className="flex flex-col gap-3">` containing:
   - Existing `<Link>` to `/patient/health` with the `WellnessScore` (unchanged, just inside the stack).
   - Insurance mini-line: `<Link href="/patient/insurance" className="text-[11.5px] text-white/85 hover:text-white">Acme · renews in 42d →</Link>` — render only when `useInsurance().data?.policy` exists.
   - Primary CTA: `<Link href="/patient/health" className="inline-flex items-center gap-1.5 bg-white text-[#0369A1] px-4 py-2 rounded-full text-sm font-bold hover:scale-[1.02] transition-transform"><Activity size={14} />Log vitals</Link>`.
4. Reduce orb count to 2 (delete the center one — third `<div>` with `top-1/2 left-1/2`).
5. Adjust right-column wrapper to `flex flex-col items-stretch md:items-end gap-3 shrink-0 w-full md:w-auto`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/patient/components/dashboard/DashboardHero.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/DashboardHero.tsx apps/marketing/src/patient/components/dashboard/DashboardHero.test.tsx
git commit -m "style(patient-dashboard): trim hero + vertical right stack

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: `page.tsx` layout rewire

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/page.tsx`

**Interfaces:**
- Consumes: existing component imports + new `NotificationsPreview`, `InsuranceCoverage`.
- Produces: new component order per spec §2 + `max-w-7xl` + `gap-4`.

- [ ] **Step 1: Read current `page.tsx`**

- [ ] **Step 2: Write failing test update**

Open `apps/marketing/src/app/patient/(app)/page.test.tsx`. Add assertions:

```tsx
it("renders NotificationsPreview and InsuranceCoverage widgets", () => {
  const { container } = render(<DashboardPage />);
  expect(container.textContent).toMatch(/Notifications|Insurance/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter marketing test src/app/patient/(app)/page.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Refactor**

```tsx
// apps/marketing/src/app/patient/(app)/page.tsx
"use client";

import {
  CareAssistant,
  DashboardHero,
  HealthSummaryStrip,
  InsuranceCoverage,
  MedicationsToday,
  NotificationsPreview,
  QuickActions,
  RecentRecords,
  SafetyBanner,
  UpcomingAppointment,
  VitalsTrend,
} from "@/patient/components/dashboard";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-1 pb-6 pt-1">
      <DashboardHero />
      <SafetyBanner />
      <QuickActions />
      <HealthSummaryStrip />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7"><MedicationsToday /></div>
        <div className="lg:col-span-5"><UpcomingAppointment /></div>
      </div>

      <VitalsTrend />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7"><RecentRecords /></div>
        <div className="lg:col-span-5"><NotificationsPreview /></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5"><InsuranceCoverage /></div>
        <div className="lg:col-span-7"><CareAssistant /></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter marketing test src/app/patient/(app)/page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/app/patient/(app)/page.tsx apps/marketing/src/app/patient/(app)/page.test.tsx
git commit -m "style(patient-dashboard): rewire page layout (12-col grid + 2 widgets)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Update `page.test.tsx` for new widgets + order

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/page.test.tsx`

**Interfaces:**
- Consumes: existing mocks for `@/patient/hooks`. Add mocks for `useInsurance` + `useNotifications` if not present.
- Produces: assertions that widgets render in spec §2 order.

- [ ] **Step 1: Read current `page.test.tsx`**

- [ ] **Step 2: Add mocks + assertions**

```tsx
// Append mocks to existing vi.mock("@/patient/hooks", ...):
useNotifications: () => ({ data: { notifications: [] }, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
useInsurance: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),

// Add test:
it("renders widgets in spec order: Hero → Safety → QuickActions → HealthSummaryStrip → Meds/Appt → Vitals → Records/Notif → Insurance/CareAssistant", () => {
  const { container } = render(<DashboardPage />);
  const order = [
    /HealthHub|Dashboard/i,
    /Safety|Alert|Reminder/i,
    /Quick actions/i,
    /Wellness|Vitals|Adherence|Next visit/i,
    /Medication|Today's plan|plan/i,
    /Appointment|Doctor|Visit/i,
    /Trends|Vitals/i,
    /Records|Document/i,
    /Notifications/i,
    /Insurance/i,
    /Ask AI|Care insights/i,
  ];
  const text = container.textContent ?? "";
  let cursor = 0;
  for (const re of order) {
    const idx = text.slice(cursor).search(re);
    expect(idx).toBeGreaterThanOrEqual(0);
    cursor += idx + 1;
  }
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `pnpm --filter marketing test src/app/patient/(app)/page.test.tsx`
Expected: PASS (existing + new).

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/(app)/page.test.tsx
git commit -m "test(patient-dashboard): assert widget order + new widget presence

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Full verification

**Files:** none modified.

- [ ] **Step 1: Run all dashboard tests**

Run: `pnpm --filter marketing test src/patient/components/dashboard src/app/patient/(app)`
Expected: all PASS.

- [ ] **Step 2: Run full marketing test suite**

Run: `pnpm --filter marketing test`
Expected: all PASS (no regressions).

- [ ] **Step 3: Type-check**

Run: `pnpm --filter marketing typecheck` (or `tsc --noEmit` if script absent)
Expected: no TS errors.

- [ ] **Step 4: Manual screenshot verification**

Render dev server: `pnpm --filter marketing dev`. Navigate to `/patient` at 390px and 1280px viewports. Screenshot both. Verify:
- Hero stacks on mobile, side-by-side on desktop.
- KPI strip 2×2 → 4-across at xl.
- New widgets (Notifications, Insurance) visible, empty states render.

- [ ] **Step 5: Manual a11y pass**

Keyboard `Tab` from hero → KPIs → meds → appt → vitals → records → notif → insurance → AI CTA. Verify focus rings on every interactive. Verify SR-only `<title>` on sparklines (DevTools → inspect).

- [ ] **Step 6: Final commit (no code change)**

If any verification artifacts were produced (screenshots), commit them to `docs/superpowers/screenshots/`. Otherwise no commit.

```bash
git add docs/superpowers/screenshots/
git commit -m "docs(patient-dashboard): v2 verification screenshots

Co-Authored-By: Claude <noreply@anthropic.com>" --allow-empty
```

---

## Self-Review (Inline)

1. Spec coverage (§1–§8):
   - §1 constraints → global constraints block ✓
   - §2 layout → Task 12 ✓
   - §3.1 hero → Task 11 ✓
   - §3.2 health summary → Task 3 ✓
   - §3.3 MiniSparkline → Task 1 ✓
   - §3.4 meds → Task 5 ✓
   - §3.5 appt → Task 6 ✓
   - §3.6 vitals → Task 4 ✓
   - §3.7 records → Task 7 ✓
   - §3.8 NotificationsPreview → Task 8 ✓
   - §3.9 InsuranceCoverage → Task 9 ✓
   - §3.10 CareAssistant → Task 10 ✓
   - §3.11 SafetyBanner → unchanged ✓
   - §4 data flow → Tasks 2, 8, 9, 11 ✓
   - §5 a11y/responsive → embedded in each task ✓
   - §6 testing → each task TDD ✓
   - §7 files touched → matches edit/add lists ✓
   - §8 out of scope → YAGNI respected ✓

2. Placeholder scan: no "TBD"/"TODO"/"fill in". All code blocks complete.

3. Type consistency:
   - `MiniSparkline` props: `{ points, width?, height?, stroke? }` — used identically in Tasks 3, 4.
   - `InsuranceStatus`, `InsurancePolicy`, `InsuranceSummary` — defined in Task 2, consumed identically in Tasks 9, 11.
   - `PatientNotification` import path: `@/patient/hooks/notifications-feed` — verified in Task 8.
   - `useNotifications` returns `{ notifications: PatientNotification[] }` — matches Task 8 destructure.
   - `useInsurance` returns `InsuranceSummary | null` — matches Task 9, 11.

No inconsistencies found.
