# Patient Buyer-Cards Full Treatment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the buyer-portal card behaviors missing from the VYRO base port — MetricStack, StatusDots, photo cards with flow decor — and apply them across the patient dashboard + list pages, then delete dead hero CSS.

**Architecture:** Delta on top of `docs/superpowers/plans/2026-09-27-patient-vyro-redesign.md` (do that plan first if not done). Three new presentational primitives (props-only, no hooks), one CSS append block (no token edits), then two page-migration batches and a cleanup task.

**Tech Stack:** Next.js 16 App Router (`@healthcare/marketing`), Tailwind v4 `@theme`, vitest + @testing-library/react, lucide-react icons.

Spec: `docs/superpowers/specs/2026-09-27-patient-portal-buyer-cards-design.md` (companion to `2026-09-27-patient-vyro-redesign-design.md`). Buyer reference: `~/Downloads/project-5/apps/web/src/components/ui.tsx` (MetricStack, StatusDots), `brand/PageHero.tsx`, `brand/Surface.tsx`.

## Global Constraints

- Never edit any `--color-*` definition in `apps/marketing/src/app/patient/globals.css` — append-only under `[data-app="patient"]`.
- All new CSS scoped under `[data-app="patient"]`; never touch shared `auth-harbor.css` or `src/app/portal/**`.
- Preserve every `data-testid`, `aria-current`, role, accessible name asserted by existing tests.
- Preserve user-visible copy verbatim; restyle changes wrappers only.
- Presentational diffs only — no hook, route, or API changes.
- Known pre-existing failures (from base plan) must fail identically after, never more: `src/patient/components/records/RecordForm.test.tsx` (2), `src/patient/hooks/index.test.ts` (1), 9 files under `src/app/patient/(app)/**/page.test.tsx` (11 tests).
- Verify with: `npm test -- --run <path>` from `apps/marketing`; color freeze with `git diff HEAD -- apps/marketing/src/app/patient/globals.css | grep '^[+-] *--color' || echo CLEAN` from repo root.

---

### Task 1: MetricStack primitive

**Files:**
- Create: `apps/marketing/src/patient/components/primitives/MetricStack.tsx`
- Create: `apps/marketing/src/patient/components/primitives/MetricStack.test.tsx`
- Modify: `apps/marketing/src/patient/components/primitives/index.ts`

**Interfaces:**
- Consumes: `cn` from `@/portal/lib/utils`.
- Produces: `export type MetricAccent = "mint" | "amber" | "rose" | "brand" | "ink"`, `export interface MetricStackItem { label: string; value: string; accent?: MetricAccent }`, `export function MetricStack({ items, compact, className }: { items: MetricStackItem[]; compact?: boolean; className?: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MetricStack } from "./MetricStack";

describe("MetricStack", () => {
  it("renders label/value rows with divide styling", () => {
    const { getByText } = render(
      <MetricStack items={[{ label: "Awaiting confirmation", value: "3", accent: "amber" }]} />
    );
    expect(getByText("Awaiting confirmation")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });

  it("applies compact density when compact=true", () => {
    const { container } = render(
      <MetricStack compact items={[{ label: "A", value: "1" }]} />
    );
    expect(container.querySelector("dl")?.className).toMatch(/divide-y/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/patient/components/primitives/MetricStack.test.tsx`
Expected: FAIL with "Failed to resolve import ./MetricStack" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { cn } from "@/portal/lib/utils";

export type MetricAccent = "mint" | "amber" | "rose" | "brand" | "ink";

export interface MetricStackItem {
  label: string;
  value: string;
  accent?: MetricAccent;
}

const ACCENT: Record<MetricAccent, string> = {
  mint: "text-success",
  amber: "text-warn",
  rose: "text-danger",
  brand: "text-brand",
  ink: "text-text",
};

export function MetricStack({
  items,
  compact = false,
  className,
}: {
  items: MetricStackItem[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-ink/10", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex items-baseline justify-between gap-4",
            compact ? "py-2" : "py-3"
          )}
        >
          <dt className="t-label">{item.label}</dt>
          <dd className={cn("pt-metric text-2xl", ACCENT[item.accent ?? "ink"])}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

Plus index.ts append (exact two lines):

```ts
export { MetricStack } from "./MetricStack";
export type { MetricStackItem, MetricAccent } from "./MetricStack";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/patient/components/primitives/MetricStack.test.tsx src/patient/components/primitives/Card.test.tsx`
Expected: PASS (all green; no other file touched).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/primitives/MetricStack.tsx apps/marketing/src/patient/components/primitives/MetricStack.test.tsx apps/marketing/src/patient/components/primitives/index.ts
git commit -m "feat(patient): add MetricStack primitive (buyer divide-row metrics)"
```

### Task 2: StatusDots primitive (clinical status → diamond dot + label)

**Files:**
- Create: `apps/marketing/src/patient/components/primitives/StatusDots.tsx`
- Create: `apps/marketing/src/patient/components/primitives/StatusDots.test.tsx`
- Modify: `apps/marketing/src/patient/components/primitives/index.ts`

**Interfaces:**
- Consumes: `cn` from `@/portal/lib/utils`.
- Produces: `export type ClinicalStatus = "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled" | "missed" | "pending" | "disputed"`, `export function StatusDots({ status, label }: { status: ClinicalStatus; label?: string })` — always renders a text label next to the diamond (a11y: dot is `aria-hidden`).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusDots } from "./StatusDots";

describe("StatusDots", () => {
  it("renders a diamond dot plus text label", () => {
    const { getByText, container } = render(<StatusDots status="confirmed" />);
    expect(getByText("Confirmed")).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("maps cancelled to muted tone and in_progress to amber", () => {
    const { container, rerender } = render(<StatusDots status="cancelled" />);
    expect(container.innerHTML).toMatch(/text-text-muted/);
    rerender(<StatusDots status="in_progress" />);
    expect(container.innerHTML).toMatch(/bg-warn/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/patient/components/primitives/StatusDots.test.tsx`
Expected: FAIL with "Failed to resolve import ./StatusDots".

- [ ] **Step 3: Write minimal implementation**

```tsx
"use client";

import { cn } from "@/portal/lib/utils";

export type ClinicalStatus =
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "missed"
  | "pending"
  | "disputed";

const PALETTE: Record<ClinicalStatus, { dot: string; label: string; text: string }> = {
  scheduled: { dot: "bg-text-muted", label: "Scheduled", text: "text-text-soft" },
  confirmed: { dot: "bg-brand", label: "Confirmed", text: "text-text" },
  in_progress: { dot: "bg-warn", label: "In progress", text: "text-text" },
  completed: { dot: "bg-success", label: "Completed", text: "text-text" },
  cancelled: { dot: "bg-text-muted", label: "Cancelled", text: "text-text-muted" },
  missed: { dot: "bg-danger", label: "Missed", text: "text-text" },
  pending: { dot: "bg-warn", label: "Pending", text: "text-text" },
  disputed: { dot: "bg-danger", label: "Needs review", text: "text-text" },
};

export function StatusDots({ status, label }: { status: ClinicalStatus; label?: string }) {
  const s = PALETTE[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", s.text)}>
      <span aria-hidden="true" className={cn("pt-dot", s.dot)} />
      {label ?? s.label}
    </span>
  );
}
```

Plus index.ts append:

```ts
export { StatusDots } from "./StatusDots";
export type { ClinicalStatus } from "./StatusDots";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/patient/components/primitives/StatusDots.test.tsx src/patient/components/primitives/MetricStack.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/components/primitives/StatusDots.tsx apps/marketing/src/patient/components/primitives/StatusDots.test.tsx apps/marketing/src/patient/components/primitives/index.ts
git commit -m "feat(patient): add StatusDots clinical status primitive"
```

### Task 3: Photo treatment — CSS append + PhotoCard primitive

**Files:**
- Modify: `apps/marketing/src/app/patient/globals.css` (append only, after line 696 — never edit `--color-*` lines 10-63)
- Create: `apps/marketing/src/patient/components/primitives/PhotoCard.tsx`
- Create: `apps/marketing/src/patient/components/primitives/PhotoCard.test.tsx`
- Modify: `apps/marketing/src/patient/components/primitives/index.ts`

**Interfaces:**
- Consumes: `Card` from `./Card`, `cn` from `@/portal/lib/utils`; CSS classes `.pt-photo-zoom`, `.pt-photo-overlay`, `.pt-photo-fallback` defined in the appended block.
- Produces: `export function PhotoCard({ imageSrc, fallbackInitials, alt, badge, title, meta, footer, href }: { imageSrc?: string | null; fallbackInitials: string; alt: string; badge?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; footer?: React.ReactNode; href?: string })` — image top (h-36, zoom on card hover), gradient overlay, verified-style badge slot, title + meta + footer slots; when `imageSrc` is falsy or the image errors, renders initials fallback tile (no external placeholder service).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PhotoCard } from "./PhotoCard";

describe("PhotoCard", () => {
  it("renders image with alt and title", () => {
    const { getByAltText, getByText } = render(
      <PhotoCard imageSrc="https://example.com/doc.jpg" fallbackInitials="DR" alt="Dr Rao portrait" title="Dr Rao" />
    );
    expect(getByAltText("Dr Rao portrait")).toBeTruthy();
    expect(getByText("Dr Rao")).toBeTruthy();
  });

  it("falls back to initials when image errors", () => {
    const { getByAltText, getByText } = render(
      <PhotoCard imageSrc="https://example.com/broken.jpg" fallbackInitials="DR" alt="Dr Rao portrait" title="Dr Rao" />
    );
    fireEvent.error(getByAltText("Dr Rao portrait"));
    expect(getByText("DR")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/patient/components/primitives/PhotoCard.test.tsx`
Expected: FAIL with "Failed to resolve import ./PhotoCard".

- [ ] **Step 3: Write minimal implementation**

CSS append to `apps/marketing/src/app/patient/globals.css` (exact block, nothing else):

```css
/* ── Buyer photo treatment (append-only; no token edits) ─── */
[data-app="patient"] .pt-photo-zoom img {
  transition: transform 500ms var(--ease-vyro);
}
[data-app="patient"] .pt-photo-zoom:hover img {
  transform: scale(1.05);
}
[data-app="patient"] .pt-photo-overlay {
  background: linear-gradient(to top, rgba(12, 26, 58, 0.72), transparent 60%);
}
[data-app="patient"] .pt-photo-fallback {
  background: var(--color-ink-card);
  color: var(--color-surface);
  font-family: var(--font-patient-mono);
}
```

Component `PhotoCard.tsx` (exact):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/portal/lib/utils";
import { Card } from "./Card";

export function PhotoCard({
  imageSrc,
  fallbackInitials,
  alt,
  badge,
  title,
  meta,
  footer,
  href,
  className,
}: {
  imageSrc?: string | null;
  fallbackInitials: string;
  alt: string;
  badge?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(imageSrc) && !errored;

  const body = (
    <Card padded={false} className={cn("pt-photo-zoom overflow-hidden", className)}>
      <div className="relative h-36 overflow-hidden bg-surface-2">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc as string}
            alt={alt}
            loading="lazy"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden className="pt-photo-fallback grid h-full w-full place-items-center text-xl font-bold">
            {fallbackInitials}
          </div>
        )}
        <div aria-hidden className="pt-photo-overlay pointer-events-none absolute inset-0" />
        {badge ? <div className="absolute left-2.5 top-2.5">{badge}</div> : null}
      </div>
      <div className="space-y-2 p-4">
        <div className="t-card-title text-text">{title}</div>
        {meta ? <div className="t-micro">{meta}</div> : null}
        {footer ? <div className="border-t border-ink/10 pt-3">{footer}</div> : null}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} aria-label={typeof title === "string" ? title : alt} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
```

Index append:

```ts
export { PhotoCard } from "./PhotoCard";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/patient/components/primitives/PhotoCard.test.tsx src/patient/components/primitives/StatusDots.test.tsx`
Expected: PASS. Then: `git diff HEAD -- apps/marketing/src/app/patient/globals.css | grep '^[+-] *--color' || echo CLEAN` Expected: CLEAN.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/patient/globals.css apps/marketing/src/patient/components/primitives/PhotoCard.tsx apps/marketing/src/patient/components/primitives/PhotoCard.test.tsx apps/marketing/src/patient/components/primitives/index.ts
git commit -m "feat(patient): add PhotoCard + buyer photo treatment CSS"
```

### Task 4: Dashboard command-center upgrade

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/page.tsx`
- Modify: `apps/marketing/src/patient/components/dashboard/DashboardHero.tsx` (keep hooks/greeting logic; swap wellness stat strip to MetricStack row, keep `data-testid="hero-insurance-line"`)
- Modify: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx` (metrics → `pt-metric`; keep testids)
- Test: `apps/marketing/src/patient/components/dashboard/DashboardHero.test.tsx`, `apps/marketing/src/app/patient/(app)/page.test.tsx` (assert-only additions, no behavior change)

**Interfaces:**
- Consumes: `MetricStack` from `@/patient/components/primitives`, `StatusDots` from `@/patient/components/primitives`, `PhotoCard` from `@/patient/components/primitives`, `PageHero/HeroStatusPill/heroPrimaryAction` from `@/patient/components/primitives/PageHero` (all already exist except the three new ones from Tasks 1-3).
- Produces: dashboard page rendering ink hero → 4-up `StatTile` metric row → `VitalsTrend` trajectory card with trailing total → depot-style care-team photo rows with `StatusDots` → spotlight `PhotoCard` grid.

- [ ] **Step 1: Write the failing test (extend DashboardHero test)**

Add to `DashboardHero.test.tsx` (exact new test, existing file untouched otherwise):

```tsx
it("shows vitals status as a pill with text, not dot-only", () => {
  const { container } = render(<DashboardHero />);
  const pill = container.querySelector(".pt-hero");
  expect(pill).toBeTruthy();
  expect(pill?.textContent).toMatch(/Vitals steady|vital alert/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/patient/components/dashboard/DashboardHero.test.tsx`
Expected: FAIL — selector `.pt-hero` may already exist (DashboardHero already uses PageHero), so the meaningful failure is the text assertion if status pill regresses to dot-only. If it passes already, keep the test (locks behavior) and proceed — note PASS-LOCKED in commit message.

- [ ] **Step 3: Minimal page changes (mechanical, no hook changes)**

1. `page.tsx`: keep grid structure; wrap `WellnessScore/BodyOverview/RecentActivity` row cards with `MetricStack compact` inside `RecentActivity` footer only (no layout class changes beyond adding `pt-flow` to one empty state if present).
2. `DashboardHero.tsx`: keep all hooks (`useProfile/useHealthSummary/useWellness/useVitalsAlerts/useInsurance`), greeting, footer blood/BMI/insurance line with `data-testid="hero-insurance-line"`; ensure status slot uses `HeroStatusPill` (already) and actions use `heroPrimaryAction` (already); add `MetricStack` row under hero only if `score/bmi/blood` exist — reuse existing values, no new data.
3. `HealthSummaryStrip.tsx`: swap big numbers to `pt-metric`, sublabels to `t-micro` — classnames only.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run "src/patient/components/dashboard" "src/app/patient/(app)/page.test.tsx"`
Expected: PASS except the 9 known pre-existing page-test files (dashboard page test is one of them — allowed failures only with the listed test names from Global Constraints; any NEW failure = fix before commit).

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/page.tsx" apps/marketing/src/patient/components/dashboard/DashboardHero.tsx apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx apps/marketing/src/patient/components/dashboard/DashboardHero.test.tsx
git commit -m "feat(patient): dashboard command-center buyer treatment"
```

### Task 5: List-detail batch — doctors, care-team, marketplace, appointments

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/doctors/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/care-team/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/marketplace/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/appointments/page.tsx` (status badges → `StatusDots`; tabs → buyer pill-tab row classes; keep `VisitBucket` logic + teleconsult polling effect untouched)
- Test: existing `page.test.tsx` files in those four routes (assert-only additions)

**Interfaces:**
- Consumes: `PhotoCard`, `StatusDots`, `MetricStack`, `Pill` from primitives; existing hooks (`useAppointments`, doctor/care-team hooks) unchanged.
- Produces: four routes rendering ink `PageHero` (already done by base plan for most) + pill-tab filter row (`overflow-x-auto`, active = `bg-surface text-text shadow-sm`) + `PhotoCard` grids for doctors/care-team/marketplace + `pt-table` + `StatusDots` rows for appointments.

- [ ] **Step 1: Write the failing test (appointments status text)**

Add to the appointments page test (exact):

```tsx
it("renders appointment statuses as text, not color-only", () => {
  const { container } = render(<AppointmentsPage />);
  expect(container.textContent).toMatch(/Confirmed|Scheduled|Completed|Cancelled|In progress|Missed|Pending/);
});
```

Note: if the page test renders with mocked empty data, assert on the empty-state text instead (`EmptyState` title) — keep whichever matches existing mock shape; do not change mocks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run "src/app/patient/(app)/appointments"`
Expected: FAIL (status badges currently `bg-*-50` pills without `StatusDots` text mapping) or PASS-LOCKED if base plan already migrated — either way proceed to Step 3 to finish the remaining three pages.

- [ ] **Step 3: Minimal implementation (mechanical)**

1. Appointments `getStatusBadge()` (lines 29-74): keep function + labels, replace `className` pill with `<StatusDots status={mapToClinical(status)} label={label} />` where map is `confirmed→confirmed, completed→completed, in_progress→in_progress, scheduled→scheduled, no_show→missed, cancelled→cancelled, default→pending`. Keep icons where tests assert them; do not rename labels.
2. Doctors/care-team/marketplace cards: swap bordered `div` cards for `PhotoCard` with `imageSrc={existing photo field ?? null}`, `fallbackInitials={initials helper already in file}`, `alt={name + " portrait"}` (or clinic name), `badge={<Pill tone="success">Verified</Pill>}` only where a verified flag already exists, `title={name}`, `meta={specialty/location line}`, `footer={existing CTA link}`.
3. Tab rows: add buyer classes `overflow-x-auto pb-1` on wrapper + `rounded-full` active pill — classnames only, keep `activeTab` state + counts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run "src/app/patient/(app)/appointments" "src/app/patient/(app)/doctors" "src/app/patient/(app)/care-team" "src/app/patient/(app)/marketplace"`
Expected: PASS except known pre-existing failures listed in Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add "apps/marketing/src/app/patient/(app)/doctors/page.tsx" "apps/marketing/src/app/patient/(app)/care-team/page.tsx" "apps/marketing/src/app/patient/(app)/marketplace/page.tsx" "apps/marketing/src/app/patient/(app)/appointments/page.tsx"
git commit -m "feat(patient): buyer photo + status treatment for care pages"
```

### Task 6: Dead CSS removal + freeze verification + full suite

**Files:**
- Modify: `apps/marketing/src/app/patient/globals.css` (delete `.dashboard-hero` block lines 593-629 + `.hero-action-btn` overrides; keep every `--color-*` line)
- Test: none new — full suite run.

**Interfaces:**
- Consumes: grep results proving zero `dashboard-hero` usages remain under `src/app/patient/**` and `src/patient/**`.
- Produces: `echo CLEAN` color-freeze proof + green suite (minus known failures).

- [ ] **Step 1: Prove no usages remain (failing check first)**

Run: `rg -l 'dashboard-hero' "apps/marketing/src/app/patient" "apps/marketing/src/patient" || echo NONE`
Expected: list of files (FAIL = still in use) — if NONE already, proceed (base plan finished migration).

- [ ] **Step 2: Delete dead CSS only after NONE**

Delete lines 593-629 (`.dashboard-hero` + `.bg-white` overrides + span/svg overrides) exactly; do not touch lines 10-63 (`--color-*`).

- [ ] **Step 3: Run freeze + full suite**

Run: `git diff HEAD -- apps/marketing/src/app/patient/globals.css | grep '^[+-] *--color' || echo CLEAN`
Expected: CLEAN.

Run: `npm test -- --run src/patient src/app/patient`
Expected: PASS except the exact known failures in Global Constraints (RecordForm 2, hooks index 1, 9 page-test files 11 tests). Any new failure = fix before commit.

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/globals.css
git commit -m "chore(patient): remove dead dashboard-hero CSS (buyer port complete)"
```
