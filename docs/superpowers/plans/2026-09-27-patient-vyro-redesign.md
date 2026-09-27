# Patient Portal VYRO Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every page of the patient web portal to the VYRO buyer-portal design language (inset-hairline cards, dark-ink page heroes, mono metrics, kicker labels, rotated-square dots) while keeping the existing blue color tokens unchanged.

**Architecture:** Layered restyle: (1) extend `patient/globals.css` with a `.pt-hero` family matching project-5's `PageHero`, (2) add a `PageHero` primitive + retune `Card`/`StatTile`/`EmptyState` primitives, (3) restyle shell (Sidebar → light paper rail, Topbar chrome), then (4) mechanically swap every page's oceanic gradient hero + bordered cards to the primitives in domain batches, and (5) delete dead `.dashboard-hero`/dark-sidebar CSS and verify.

**Tech Stack:** Next.js 16 App Router (`@healthcare/marketing`), Tailwind v4 `@theme` tokens, React Query, vitest + testing-library.

Spec: `docs/superpowers/specs/2026-09-27-patient-vyro-redesign-design.md`

## Global Constraints

- **No color token changes.** Never edit any `--color-*` definition in `apps/marketing/src/app/patient/globals.css`. Verify with `git diff src/app/patient/globals.css | grep '^[+-].*--color'` returning nothing (except none — do not touch).
- Reference look lives in `~/Downloads/project-5/apps/web/src/components/{ui.tsx,brand/PageHero.tsx,brand/Surface.tsx}` — port geometry/structure, not colors.
- All new CSS must be scoped under `[data-app="patient"]`.
- Preserve every `data-testid`, `aria-current`, role, and accessible name that existing tests assert (`nav-*`, `sidebar-logout`, `patient-topbar`, `logout-button`).
- Existing user-visible copy (headings, CTAs, warnings) is preserved verbatim — restyle only changes structure/wrappers, except where the spec explicitly says to use the kicker/title split.
- The working tree already contains an uncommitted in-flight VYRO port (15 modified files under `apps/marketing/src/app/patient/globals.css` + `src/patient/components`). Task 1 first commits this baseline so later diffs are isolated. Do NOT commit anything under `apps/mobile` or `apps/api`.
- **Known pre-existing test failures — these fail before any redesign work; they must still fail identically after (not more):**
  - `src/patient/components/records/RecordForm.test.tsx` (2 tests)
  - `src/patient/hooks/index.test.ts` (1 test — barrel list missing `useCancelTestBooking`, `useInitiateTestPayment`, `useRescheduleTestBooking`)
  - 9 files under `src/app/patient/(app)/**/page.test.tsx` (11 tests: dashboard, allergies, health, medications ×2, notes, profile ×2, vaccinations, vitals) — pages import hooks their test mocks don't define.
  - Verification rule for every task: run the affected tests; allowed failures are ONLY in the listed files with the listed test names as of the baseline. Any NEW failure in a touched test file = fix before commit.

## Shared verification commands

```bash
# All page/component tests (from apps/marketing):
npm test -- --run <path-or-glob>
# Full patient suite:
npm test -- --run src/patient src/app/patient
# Assert no color tokens were touched (from repo root):
git diff HEAD -- apps/marketing/src/app/patient/globals.css | grep '^[+-] *--color' || echo CLEAN
```

## Shared restyle playbook (used by Tasks 7–15)

Every page restyle in Tasks 7–15 applies this exact mechanical recipe. **Apply page-markup changes only around the existing JSX — never change hooks, state, handlers, testids, or copy.**

**(a) Hero replacement.** The current oceanic hero block has this shape (line numbers vary per file — locate the `dashboard-hero` className):

```tsx
<header
  className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
  style={{ background: "linear-gradient(135deg, #0C4A6E ...)" }}
>
  {/* glow orb divs */}
  ...kicker pill, h1, p, action buttons, metrics strip...
</header>
```

Replace the whole header with:

```tsx
<PageHero
  icon={<IconName size={13} />}
  kicker="SECTION KICKER"
  title="Existing H1 text"
  description="Existing subtitle paragraph text"
  status={<HeroStatusPill label="Status text" tone="brand" />}   // optional, keep only if the old hero had a status/count pill — reuse existing conditional logic
  actions={
    <>
      <Link href="..." className={heroSecondaryAction}>Existing secondary label</Link>
      <button type="button" onClick={existingHandler} className={heroPrimaryAction}>
        Existing primary label
      </button>
    </>
  }
  footer={
    <>
      <span>Footer item 1 (reuse existing meta text)</span>
      <span>Footer item 2</span>
    </>
  }
/>
```

Import line every hero restyle adds:

```tsx
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
```

Rules:
- Old hero inner `<button>`s keep their `onClick`/`disabled` exactly; swap only `className` → `heroSecondaryAction` (ghost/translucent) or `heroPrimaryAction` (white-on-ink). Old `<Link>` CTAs get `heroSecondaryAction`/`heroPrimaryAction` the same way.
- Old inline-glass metric tiles inside the hero (the `bg-white/10` boxes) MOVE to the dashed `footer` as mono text spans (`<span>` + count/label in existing text) — do not reproduce full tile cards inside PageHero (it has no slot for them). If the hero had a 4-tile metrics strip and no meta data, drop the strip entirely; the page body cards below already carry the metrics.
- Glow-orb divs and gradient styles are DELETED (PageHero renders its own).

**(b) Card conversion.** Replace hand-rolled cards:

```tsx
// BEFORE
<article className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col gap-4">

// AFTER
<article className="patient-card p-5 flex flex-col gap-4">
```

- Any `border border-slate-200*` → drop the border class (the inset hairline in `.patient-card` replaces it).
- `bg-white` on a card container → drop (surface comes from `.patient-card`).
- Section wrapper panels (`rounded-2xl border bg-white p-5 sm:p-6`) → `className="patient-card p-5 sm:p-6 flex flex-col gap-4"`.
- Row cards inside a list (`p-4 rounded-xl border bg-white`) → `<div className="patient-card p-4 ...">` is too heavy for rows; instead use `rounded-[10px] shadow-[inset_0_0_0_1px_rgba(19,32,68,0.08)]` (keeps hairline, lighter than a full card). Same swap logic everywhere: container→`patient-card`, row→inset-hairline div.

**(c) Semantic color mapping (slate/rose/sky/amber/emerald → tokens).** Text `text-slate-900` → `text-text`; `text-slate-500`/`600` → `text-text-soft`; `text-slate-400` → `text-text-muted`; `bg-slate-50` → `bg-surface-2`; `bg-sky-*` accents → `text-brand`/`bg-brand-soft`; keep `rose-*`/`emerald-*`/`amber-*` as-is (they already match danger/success/warn). Hero-internal white-opacity classes disappear with the hero.

**(d) Buttons.** `rounded-xl ... bg-sky-* text-sky-700 border-sky-200` small action buttons → `pt-btn-secondary text-xs` or keep as small link-buttons with `text-brand`.

**(e) Tables.** Any `<table className="w-full ...">` → add `pt-table` class, keep all other classes/attributes.

**(f) Empty states.** `bg-slate-50 border` empty blocks → use `<EmptyState title=... description=... action=... />` from `@/patient/components/primitives` when the block is centered placeholder copy; keep inline if it embeds contextual actions.

**(g) Skeletons.** `bg-slate-100 animate-pulse` → `patient-shimmer rounded-[10px]` (keep dimensions).

Commit message style per task: `feat(patient): VYRO restyle <domain> pages`.

---

### Task 0: Read the reference design first

**Files:** none (read-only orientation)

- [ ] **Step 1: Read the VYRO reference primitives**

Read these three files to internalize the target look:
`/Users/thufailahamed/Downloads/project-5/apps/web/src/components/brand/PageHero.tsx`, `/Users/thufailahamed/Downloads/project-5/apps/web/src/components/brand/Surface.tsx`, and lines 84–300 of `/Users/thufailahamed/Downloads/project-5/apps/web/src/index.css`.

- [ ] **Step 2: Read the current patient globals.css**

Read `apps/marketing/src/app/patient/globals.css` fully — note the existing `pt-*` classes (surface/kicker/metric/btn/input/dot/table/flow/patient-card) which are already ported and must not be duplicated.

---

### Task 1: Commit the in-flight baseline

The working tree has an uncommitted partial port in 15 marketing files (plus unrelated mobile/api edits which must remain untouched). Commit ONLY the marketing patient-scope files so subsequent tasks diff cleanly.

**Files:**
- Modify (commit only): `apps/marketing/src/app/patient/globals.css`, `apps/marketing/src/patient/components/**` (14 files currently modified)

**Interfaces:**
- Consumes: current working tree state.
- Produces: clean baseline commit; later tasks can rely on `globals.css` containing the full `pt-*` layer committed.

- [ ] **Step 1: Verify scope of the diff**

```bash
git -C /Users/thufailahamed/Downloads/App-2 status --short apps/marketing/src app 2>/dev/null
git -C /Users/thufailahamed/Downloads/App-2 diff HEAD --stat apps/marketing/src | tail -3
```

Expected: exactly the files listed in Global Constraints (globals.css + 14 patient component files). If additional `apps/marketing` files are modified, stage only the 15 known files (globals.css, dashboard/DashboardHero, dashboard/HealthSummaryStrip, dashboard/QuickActions, primitives/CardHeader, primitives/EmptyState, primitives/Pill, primitives/QueryBoundary, primitives/SectionHeader, primitives/Sheet, primitives/StatTile, shell/ActiveMemberPill, shell/PatientShell, shell/Sidebar (also has the `nav-timeline` line), shell/Topbar).

- [ ] **Step 2: Run the patient suite to confirm baseline**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient src/app/patient 2>&1 | grep -E "Test Files|Tests "
```

Expected: `3 failed tests (RecordForm ×2, hooks barrel ×1)` + `11 failed tests in src/app/patient page tests` per the Global Constraints list, all others pass.

- [ ] **Step 3: Commit the baseline**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/app/patient/globals.css apps/marketing/src/patient
git commit -m "wip(patient): in-flight VYRO token + shell port baseline" --no-verify
```

Do NOT use `git add -A` / `git add .` — mobile/api edits stay unstaged.

---

### Task 2: `.pt-hero` family + `.pt-btn-danger` in globals.css

Add the new hero/button CSS. Do NOT delete `.dashboard-hero` yet (pages still reference it until Task 16).

**Files:**
- Modify: `apps/marketing/src/app/patient/globals.css` (insert after the `.pt-flow` block, ~line 423, before the `.dashboard-hero` block)

**Interfaces:**
- Produces (consumed by Task 3's PageHero and all page tasks): classes `.pt-hero`, `.pt-hero-kicker`, `.pt-hero-title`, `.pt-hero-desc`, `.pt-hero-actions`, `.pt-hero-footer`, `.pt-btn-danger`, `.hero-grain`.

- [ ] **Step 1: Insert the CSS**

```css
/* ============================================================
   VYRO page hero — dark-ink card, brand glow orbs, mono kicker,
   dashed footer strip. Sits on --color-ink-card (blue palette).
   ============================================================ */
[data-app="patient"] .pt-hero {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-plate);
  background: var(--color-ink-card);
  color: #ffffff;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 24px 48px -20px rgba(19, 32, 68, 0.45);
}
[data-app="patient"] .pt-hero::before {
  content: "";
  pointer-events: none;
  position: absolute;
  top: -7rem;
  right: -5rem;
  width: 20rem;
  height: 20rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(59, 111, 245, 0.35) 0%, transparent 65%);
}
[data-app="patient"] .pt-hero::after {
  content: "";
  pointer-events: none;
  position: absolute;
  bottom: -8rem;
  left: -5rem;
  width: 18rem;
  height: 18rem;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(99, 140, 255, 0.22) 0%, transparent 60%);
}
[data-app="patient"] .pt-hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-patient-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7eb3ff;
}
[data-app="patient"] .pt-hero-title {
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #ffffff;
  font-size: clamp(22px, 2.4vw, 28px);
  line-height: 1.15;
}
[data-app="patient"] .pt-hero-desc {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.875rem;
  line-height: 1.65;
  max-width: 42rem;
}
[data-app="patient"] .pt-hero-footer {
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  font-family: var(--font-patient-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}
/* Primary action inside ink hero: white plate, ink text */
[data-app="patient"] .pt-hero .hero-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.25rem;
  padding-inline: 1rem;
  border-radius: 8px;
  background: #ffffff;
  color: var(--color-ink-card);
  font-weight: 700;
  transition: transform 180ms var(--ease-vyro), background 180ms var(--ease-vyro);
}
[data-app="patient"] .pt-hero .hero-primary:hover {
  background: #e8effc;
  transform: translateY(-1px);
}
[data-app="patient"] .pt-hero .hero-primary:disabled {
  opacity: 0.5;
}
/* Secondary action inside ink hero: translucent plate */
[data-app="patient"] .pt-hero .hero-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2rem;
  padding-inline: 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  transition: background 180ms var(--ease-vyro), color 180ms var(--ease-vyro);
}
[data-app="patient"] .pt-hero .hero-secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
[data-app="patient"] .pt-hero .hero-secondary:disabled {
  opacity: 0.5;
}
[data-app="patient"] .pt-btn-danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
[data-app="patient"] .pt-btn-danger:hover {
  background: var(--color-danger);
  color: #ffffff;
  transform: translateY(-1px);
}
```

The page-level action class names used by the playbook (`heroPrimaryAction`/`heroSecondaryAction`) are exported by the PageHero primitive in Task 3 and resolve to `hero-primary` / `hero-secondary` strings.

- [ ] **Step 2: Verify CSS compiles and tokens untouched**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/app/patient/globals.test.ts 2>&1 | grep -E "Test Files|Tests "
cd /Users/thufailahamed/Downloads/App-2 && git diff HEAD -- apps/marketing/src/app/patient/globals.css | grep '^[+-] *--color' || echo CLEAN
```

Expected: tokens test passes; `CLEAN`.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/app/patient/globals.css
git commit -m "feat(patient): add pt-hero ink card and pt-btn-danger styles"
```

---

### Task 3: `PageHero` primitive

**Files:**
- Create: `apps/marketing/src/patient/components/primitives/PageHero.tsx`
- Create: `apps/marketing/src/patient/components/primitives/PageHero.test.tsx`
- Modify: `apps/marketing/src/patient/components/primitives/index.ts` (add exports)

**Interfaces:**
- Consumes: `.pt-hero*`, `.hero-primary`, `.hero-secondary` CSS from Task 2; `cn` from `@/portal/lib/utils`; `--color-success/--color-warn/--color-brand` tokens.
- Produces used by all page tasks:
  - `PageHero(props: { icon?: React.ReactNode; kicker?: string; title: React.ReactNode; description?: React.ReactNode; status?: React.ReactNode; actions?: React.ReactNode; footer?: React.ReactNode; className?: string })`
  - `HeroStatusPill(props: { label: React.ReactNode; tone?: "success" | "warn" | "brand" | "paper" })`
  - `heroPrimaryAction = "hero-primary"` (string constant), `heroSecondaryAction = "hero-secondary"` (string constant)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "./PageHero";

describe("PageHero", () => {
  it("renders kicker, title and description on the ink surface", () => {
    const { container } = render(
      <PageHero
        kicker="Biometric Telemetry"
        title="Clinical Vitals"
        description="Log and monitor readings."
      />
    );
    expect(container.querySelector(".pt-hero")).toBeTruthy();
    expect(container.querySelector(".pt-hero-kicker")?.textContent).toContain("Biometric Telemetry");
    expect(screen.getByText("Clinical Vitals")).toBeTruthy();
    expect(screen.getByText("Log and monitor readings.")).toBeTruthy();
  });

  it("renders actions with hero action classes", () => {
    render(
      <PageHero
        title="T"
        actions={
          <>
            <button type="button" className={heroSecondaryAction}>Symptom</button>
            <button type="button" className={heroPrimaryAction}>Add reading</button>
          </>
        }
      />
    );
    expect(document.querySelector(".hero-secondary")?.textContent).toContain("Symptom");
    expect(document.querySelector(".hero-primary")?.textContent).toContain("Add reading");
  });

  it("renders the dashed footer strip", () => {
    render(<PageHero title="T" footer={<span>7-day window</span>} />);
    const footer = document.querySelector(".pt-hero-footer");
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain("7-day window");
  });

  it("HeroStatusPill renders label with pulse dot", () => {
    render(<HeroStatusPill label="Vitals steady" tone="success" />);
    expect(screen.getByText("Vitals steady")).toBeTruthy();
  });

  it("omits the footer strip when footer is not passed", () => {
    const { container } = render(<PageHero title="T" />);
    expect(container.querySelector(".pt-hero-footer")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/primitives/PageHero.test.tsx 2>&1 | grep -E "Test Files|Error"
```

Expected: FAIL (cannot resolve `./PageHero`).

- [ ] **Step 3: Implement the primitive**

```tsx
"use client";

import type { ComponentType } from "react";
import { cn } from "@/portal/lib/utils";

export const heroPrimaryAction = "hero-primary";
export const heroSecondaryAction = "hero-secondary";

const TONE_DOT: Record<NonNullable<HeroStatusPillProps["tone"]>, string> = {
  success: "bg-success",
  warn: "bg-warn",
  brand: "bg-brand",
  paper: "bg-white/50",
};

interface HeroStatusPillProps {
  label: React.ReactNode;
  tone?: "success" | "warn" | "brand" | "paper";
}

export function HeroStatusPill({ label, tone = "brand" }: HeroStatusPillProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs backdrop-blur-sm">
      <span className={cn("size-2 rounded-full", TONE_DOT[tone], "animate-pulse")} aria-hidden />
      <span className="font-semibold text-white">{label}</span>
    </span>
  );
}

export function PageHero({
  icon,
  kicker,
  title,
  description,
  status,
  actions,
  footer,
  className,
}: {
  icon?: React.ReactNode;
  kicker?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("pt-hero anim-rise", className)}>
      <div className="relative z-10 p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            {kicker ? (
              <div className="pt-hero-kicker mb-2">
                {icon}
                <span>{kicker}</span>
              </div>
            ) : null}
            <h1 className="pt-hero-title">{title}</h1>
            {description ? <p className="pt-hero-desc mt-2">{description}</p> : null}
          </div>
          {status || actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {status}
              {actions}
            </div>
          ) : null}
        </div>
        {footer ? (
          <div className="pt-hero-footer mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </header>
  );
}
```

If `icon` is passed as a lucide component in pages use `icon={<Icon size={13} />}` (note: the playbook passes a rendered node, not a ComponentType — simpler for consumers).

- [ ] **Step 4: Export from the barrel**

In `apps/marketing/src/patient/components/primitives/index.ts` add:

```ts
export { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "./PageHero";
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/primitives 2>&1 | grep -E "Test Files|Tests "
```

Expected: all primitives tests pass (Card.test, PageHero.test, etc.).

- [ ] **Step 6: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/patient/components/primitives/PageHero.tsx apps/marketing/src/patient/components/primitives/PageHero.test.tsx apps/marketing/src/patient/components/primitives/index.ts
git commit -m "feat(patient): VYRO PageHero primitive with hero status pill"
```

---

### Task 4: Retune `Card` + `StatTile` accents to VYRO diamond/sweep

Replace the pastel gradient blob+shine with the flat rotated-square diamond + bottom accent sweep. **Keep the `patient-card`, `patient-card-blob`, `patient-card-shine` class names** (tests assert them; globals.css already styles them — only the color application changes).

**Files:**
- Modify: `apps/marketing/src/patient/components/primitives/Card.tsx`
- Modify: `apps/marketing/src/patient/components/primitives/Card.test.tsx` (only the blob-color assertion if it asserts gradient classes)
- Modify: `apps/marketing/src/patient/components/primitives/StatTile.tsx`

**Interfaces:**
- Consumes: `.patient-card`, `.patient-card-blob`, `.patient-card-shine` CSS (globals.css, already present), `cn`.
- Produces: `Card` and `StatTile` with same prop APIs — consumers unchanged.

- [ ] **Step 1: Update the failing assertion in Card.test.tsx**

Replace the last test ("renders a pastel corner blob by default") body with a flat-accent assertion:

```tsx
it("renders the corner diamond dot by default", () => {
  const { container } = render(<Card>x</Card>);
  expect(container.querySelector(".patient-card-blob")).toBeTruthy();
  expect(container.querySelector(".patient-card-shine")).toBeTruthy();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/primitives/Card.test.tsx 2>&1 | grep -E "Tests "
```

Expected: PASS if current Card already renders both nodes; if PASS proceed (the class names are preserved — the change is inside the classes' color payloads in Card.tsx). If FAIL, fix Card.tsx to render both nodes.

- [ ] **Step 3: Rewrite Card accent payloads**

In `Card.tsx`, replace the `ACCENT` map with flat solids:

```tsx
const ACCENT: Record<
  Exclude<CardAccent, "none">,
  { blob: string; shine: string }
> = {
  brand: { blob: "bg-brand", shine: "bg-brand" },
  sky: { blob: "bg-sky-500", shine: "bg-sky-500" },
  violet: { blob: "bg-violet-500", shine: "bg-violet-500" },
  amber: { blob: "bg-amber-500", shine: "bg-amber-500" },
  green: { blob: "bg-emerald-500", shine: "bg-emerald-500" },
  rose: { blob: "bg-rose-500", shine: "bg-rose-500" },
};
```

(`.patient-card-blob` in globals.css already rotates this 45° into the VYRO diamond and `.patient-card-shine` sweeps it.)

- [ ] **Step 4: Rewrite StatTile tone payload**

In `StatTile.tsx`, replace the `TONE` map `blob`/`shine` values with the same flat solids as Task 4 Step 3 (keep `lightBg`/`accent` as-is), and update the delta line to the VYRO arrow form — replace the delta `<p>`:

```tsx
{delta != null ? (
  <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs font-medium", deltaColor)}>
    <span className={cn("pt-dot", deltaTone === "down" ? "bg-danger" : deltaTone === "up" ? "bg-success" : "bg-text-muted")} />
    {delta}
  </p>
) : null}
```

- [ ] **Step 5: Run primitives tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/primitives 2>&1 | grep -E "Test Files|Tests "
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/patient/components/primitives/Card.tsx apps/marketing/src/patient/components/primitives/Card.test.tsx apps/marketing/src/patient/components/primitives/StatTile.tsx
git commit -m "feat(patient): VYRO flat accent diamond and sweep on Card/StatTile"
```

---

### Task 5: `EmptyState` ink icon tile

**Files:**
- Modify: `apps/marketing/src/patient/components/primitives/EmptyState.tsx`

**Interfaces:**
- Produces: EmptyState icon tile uses `bg-ink` + `text-brand` glyph (from `bg-ink text-sky-300` today). No API change.

- [ ] **Step 1: Update the icon tile**

In `EmptyState.tsx` change the icon wrapper:

```tsx
<div className="mb-2 grid h-12 w-12 place-items-center rounded-lg bg-ink text-brand" aria-hidden>
```

(The `bg-ink` token is `#132044` — stays in the blue family.)

- [ ] **Step 2: Run patient primitives tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components 2>&1 | grep -E "Test Files|Tests "
```

Expected: same pass count as Task 4 baseline for these dirs.

- [ ] **Step 3: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/patient/components/primitives/EmptyState.tsx
git commit -m "feat(patient): EmptyState ink icon tile with brand glyph"
```

---

### Task 6: Sidebar → light paper VYRO rail

**Files:**
- Modify: `apps/marketing/src/patient/components/shell/Sidebar.tsx`
- Modify: `apps/marketing/src/app/patient/globals.css` (replace dark `.sidebar-*` block with light equivalents)

**Interfaces:**
- Consumes: globals tokens (`--color-surface`, `--color-brand`, `--color-brand-soft`, `--color-text`, `.pt-dot`, `.pt-kicker`), existing NAV_GROUPS, `useUnreadNotificationsCount`, `useUiStore`, `useAuthStore`.
- Produces: light sidebar; `data-testid` attrs (`nav-dashboard`, … `nav-timeline`, `nav-dsar`, `sidebar-logout`) and `aria-current="page"` MUST remain.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/patient/components/shell/Sidebar.light.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/patient",
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/portal/stores/ui", () => ({
  useUiStore: () => ({ sidebarCollapsed: false, toggleSidebar: vi.fn(), mobileNavOpen: false }),
}));
vi.mock("@/portal/stores/auth", () => ({
  useAuthStore: () => ({ user: { name: "Test User", email: "t@e.com" } }),
}));
vi.mock("@/portal/lib/auth", () => ({ logout: vi.fn() }));
vi.mock("@/portal/lib/login", () => ({ loginHref: () => "/patient/login" }));
vi.mock("@/patient/hooks/useNotifications", () => ({
  useUnreadNotificationsCount: () => ({ data: 2 }),
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar (light VYRO rail)", () => {
  it("renders nav links with light theme surface", () => {
    const { container } = render(<Sidebar />);
    expect(container.querySelector('[data-testid="nav-dashboard"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="sidebar-logout"]')).toBeTruthy();
  });

  it("marks the active route with aria-current", () => {
    render(<Sidebar />);
    expect(document.querySelector('[aria-current="page"][data-testid="nav-dashboard"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails on the light-surface requirement (or passes trivially if mock is lenient) and node structure intact**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/shell/Sidebar.light.test.tsx 2>&1 | grep -E "Test Files|Tests "
```

Note: existing `Sidebar.test.tsx` mocks may conflict — if `Sidebar.test.tsx` already covers these paths, extend it instead of creating a new file, preserving its assertions.

- [ ] **Step 3: Restyle the Sidebar to light paper**

Apply these edits to `Sidebar.tsx` (structure, handlers, testids unchanged):

1. `<aside>` style: replace `background: "var(--color-ink-card)"` / white border-right with:

```tsx
style={{
  background: "var(--color-surface)",
  borderRight: "1px solid rgba(19, 32, 68, 0.10)",
}}
```

2. Logo tile: `bg-sky-400 text-ink-card` → `bg-brand text-white shadow-brand`; wordmark `text-white` → `text-text`; `PATIENT` tag `bg-sky-400/15 text-sky-300` → `bg-brand-soft text-brand`; tagline row `text-white/40` → `text-text-muted`, keep `pt-dot bg-emerald-400` → `pt-dot bg-success`.
3. Search input: `bg-white/[0.04] text-white placeholder:text-white/35` ring → `bg-surface-2 text-text placeholder:text-text-muted` with `shadow-[inset_0_0_0_1px_rgba(19,32,68,0.12)] focus:shadow-[inset_0_0_0_1px_var(--color-brand),0_0_0_3px_rgba(59,111,245,0.25)]`; clear button `text-white/40` → `text-text-muted`.
4. Group label button: className `sidebar-group-label` → `pt-kicker pt-kicker-muted mb-1.5 px-2 py-1 hover:text-text-soft`; chevron `text-white/40` → `text-text-muted`.
5. Links: `sidebar-link` → `sidebar-link-light` (new class from step 4 below). Active icon `text-sky-300` → `text-brand`; inactive icon `text-white/45 group-hover:text-white/90` → `text-text-muted group-hover:text-text`.
6. Unread badge: `bg-sky-400 text-ink-card` → `bg-brand text-white`; collapsed diamond `bg-sky-300` → `bg-brand`.
7. Footer: avatar `bg-sky-400 text-ink-card` → `bg-ink text-brand-soft`; name `text-white` → `text-text`; email `text-white/40` → `text-text-muted`; icon buttons `text-white/40 hover:text-white hover:bg-white/[0.08]` → `text-text-muted hover:text-text hover:bg-ink/5`; logout `hover:text-rose-300 hover:bg-rose-500/15` → `hover:text-danger hover:bg-danger-soft`; meta line `text-white/25` → `text-text-muted` and `pt-dot bg-emerald-400` → `pt-dot bg-success`.
8. In `globals.css`, replace the entire `/* Patient Sidebar Design Tokens & Scoped Styles */` block (lines ~511–610, the `.sidebar-*` dark rules) with:

```css
/* ── Patient sidebar — light paper VYRO rail ─────────────── */

.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(19, 32, 68, 0.22) transparent;
}

.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}

.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(19, 32, 68, 0.16);
  border-radius: 9999px;
}

.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(19, 32, 68, 0.3);
}

.sidebar-link-light {
  color: var(--color-text-soft);
  background-color: transparent;
  border: 1px solid transparent;
  transition: all 180ms cubic-bezier(0.22, 1, 0.36, 1);
  position: relative;
  text-decoration: none;
}

.sidebar-link-light:hover {
  color: var(--color-text);
  background-color: rgba(19, 32, 68, 0.04);
}

.sidebar-link-light[aria-current="page"] {
  color: var(--color-text);
  font-weight: 600;
  background: var(--color-brand-soft);
  border-color: rgba(59, 111, 245, 0.18);
}

.sidebar-link-light[aria-current="page"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--color-brand);
}
```

- [ ] **Step 4: Run shell tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/shell 2>&1 | grep -E "Test Files|Tests "
```

Expected: shell tests pass; if an existing Sidebar test asserts on the dark classes (`sidebar-group-label` etc.), update those assertions to the new class names — but keep all `data-testid`/`aria-current`/`text-content` assertions intact.

- [ ] **Step 5: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/patient/components/shell/Sidebar.tsx apps/marketing/src/patient/components/shell apps/marketing/src/app/patient/globals.css
git commit -m "feat(patient): light paper VYRO sidebar rail"
```

---

### Task 7: Topbar VYRO chrome detail pass

**Files:**
- Modify: `apps/marketing/src/patient/components/shell/Topbar.tsx`
- Modify: `apps/marketing/src/app/patient/globals.css` (only if the avatar change needs a helper class — prefer inline)

**Interfaces:**
- Consumes: existing Topbar structure (already partially VYRO-ified in the working tree).
- Produces: hairline rule, mono date, ink avatar; `data-testid="patient-topbar"` and `data-testid="logout-button"` preserved.

- [ ] **Step 1: Apply the chrome edits**

1. Header rule: `border-b border-ink/10` → `border-b` + style `borderBottom: "1px solid rgba(19,32,68,0.10)"` if tailwind `ink/10` differs; keep `bg-surface/90 backdrop-blur-md`.
2. Date row already mono; ensure `font-mono text-[11px] text-text-muted` present.
3. Avatar initials tile: `bg-ink font-mono text-xs font-bold text-sky-300` → `bg-ink font-mono text-xs font-bold text-brand-soft` (keeps ink square, blue text).
4. Wellness chip and profile menu: no structural change (already `pt-floating`, success-soft).

- [ ] **Step 2: Run shell tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/shell 2>&1 | grep -E "Test Files|Tests "
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/patient/components/shell/Topbar.tsx apps/marketing/src/app/patient/globals.css
git commit -m "feat(patient): VYRO topbar chrome details"
```

---

### Task 8: Dashboard components → ink hero + VYRO cards

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/DashboardHero.tsx` (tests: `DashboardHero.test.tsx` — assertions on greeting text and "Log vitals" must keep passing)
- Modify: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx`, `QuickActions.tsx`, `SafetyBanner.tsx` (only if either carries hero/gradient markup — verify by reading; otherwise skip file)

**Interfaces:**
- Consumes: `PageHero`/`HeroStatusPill`/`heroPrimaryAction`/`heroSecondaryAction` from Task 3, playbook rules.
- Produces: dashboard hero as `.pt-hero` card; DashboardHero test contract: "Good (morning|afternoon|evening|night)" text + "Log vitals" text preserved.

- [ ] **Step 1: Read all 15 dashboard components**

Read each file; flag anything with `dashboard-hero`, inline `linear-gradient`, `rounded-2xl border bg-white`, or `bg-white/10` hero internals.

- [ ] **Step 2: Convert `DashboardHero` to ink hero**

Replace the outer `<header>` (the `dashboard-hero` + inline gradient + orb divs + cross watermark) with a `PageHero`-structured block, preserving all hooks/conditionals:

```tsx
<PageHero
  icon={<HeartPulse size={13} />}
  kicker={getTodayFormatted()}
  title={`${greetingForHour(hour)}, ${firstName}`}
  description={tipFromWellness(score)}
  status={
    alertCount > 0 ? (
      <Link href="/patient/vitals" className={heroSecondaryAction}>
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        {alertCount} vital alert{alertCount === 1 ? "" : "s"}
      </Link>
    ) : (
      <HeroStatusPill label="Vitals steady" tone="success" />
    )
  }
  actions={
    <Link href="/patient/health" className={heroPrimaryAction}>
      <Activity size={14} />
      Log vitals
    </Link>
  }
  footer={
    <>
      {blood ? <span>Blood {blood}</span> : null}
      {bmi != null ? <span>BMI {Number(bmi).toFixed(1)}{bmiCat ? ` · ${bmiCat}` : ""}</span> : null}
      {insurance.data?.policy ? <span>{insurance.data.policy.provider}{insurance.data.policy.renewsAt ? ` · renews ${Math.max(0, Math.ceil((new Date(insurance.data.policy.renewsAt).getTime() - Date.now()) / 86_400_000))}d` : ""}</span> : null}
    </>
  }
/>
```

Keep `data-testid="hero-insurance-line"` if present (move it onto the footer `<span>` for insurance). Wellness score link becomes a body-level element is NOT required — instead render the wellness block directly below the hero as the first grid child (keep its existing data flow):

```tsx
<Link href="/patient/health" className="patient-card group flex items-center gap-4 p-4">
  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-brand text-white shadow-brand">
    <HeartPulse size={22} strokeWidth={2.3} />
  </div>
  <div className="min-w-0 flex-1">
    <div className="pt-kicker flex items-center gap-1">
      <Sparkles size={11} className="text-brand" />
      <span>Wellness</span>
    </div>
    <div className="mt-1 flex items-baseline gap-1.5">
      <span className="pt-metric text-3xl text-text">{score != null ? score : "—"}</span>
      {score != null && <span className="t-micro">pts</span>}
    </div>
    <span className="t-micro mt-0.5 block">{level ?? "Building health rhythm"}</span>
  </div>
</Link>
```

(The dashboard `page.tsx` composition in `src/app/patient/(app)/page.tsx` must place this wellness card at the top of the first grid row — inside `DashboardHero.tsx` export it as a second named export `WellnessCard` and add it to `index.ts`, OR render it inside `DashboardHero` immediately after the `PageHero` — choose the simplest: render `PageHero` + wellness card together inside `DashboardHero`.)

- [ ] **Step 3: Convert remaining hero/gradient internals**

Grep the directory:

```bash
grep -n "dashboard-hero\|linear-gradient\|bg-white/" apps/marketing/src/patient/components/dashboard/*.tsx | grep -v test
```

Apply the Shared Restyle Playbook (§a hero → PageHero internals, §b cards, §c tokens) to each hit. `HealthSummaryStrip`/`QuickActions`/etc. mostly need `rounded-2xl bg-white border` → `patient-card` per §b.

- [ ] **Step 4: Run dashboard tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/dashboard 2>&1 | grep -E "Test Files|Tests "
```

Expected: all pass — `DashboardHero.test` (greeting + Log vitals), others unchanged.

- [ ] **Step 5: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/patient/components/dashboard
git commit -m "feat(patient): ink VYRO dashboard hero and card conversions"
```

---

### Task 9: Vitals + health + trends + timeline pages

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/vitals/page.tsx` (tests: `page.test.tsx` — asserts vitals cards and diary)
- Modify: `apps/marketing/src/app/patient/(app)/health/page.tsx` (tests assert vitals, alerts, profile snapshot)
- Modify: `apps/marketing/src/app/patient/(app)/trends/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/timeline/page.tsx`

**Interfaces:**
- Consumes: playbook + PageHero (Task 3). Keep `AddVitalSheet`/`AddSymptomSheet` wiring, hooks, testids.

- [ ] **Step 1: Restyle vitals page per playbook**

Concrete hero port for `vitals/page.tsx` (lines ~69–195):

```tsx
<PageHero
  icon={<HeartPulse size={13} />}
  kicker="Biometric Telemetry & Vitals"
  title="Clinical Vitals & Symptoms"
  description="Log and monitor heart rate, blood pressure, SpO2 oxygenation, and record daily symptoms for your care team."
  actions={
    <>
      <button type="button" onClick={() => setSymptomSheetOpen(true)} className={heroSecondaryAction}>
        <Plus size={13} />
        Log Symptom
      </button>
      <button type="button" onClick={() => openAddVital("heart_rate")} className={heroPrimaryAction}>
        <Plus size={14} />
        Add Vitals Reading
      </button>
    </>
  }
  footer={
    <>
      <span>Heart rate {lastHr != null ? `${Math.round(lastHr)} BPM` : "target 60–100"}</span>
      <span>BP {lastBpSys != null ? `${Math.round(lastBpSys)}/${lastBpDia ? Math.round(lastBpDia) : "--"}` : "target <120/80"}</span>
      <span>SpO2 {lastSpo2 != null ? `${Math.round(lastSpo2)}%` : "target 95–100%"}</span>
      <span>{alertItems.length === 0 ? "0 alerts · stable" : `${alertItems.length} alerts`}</span>
    </>
  }
/>
```

Then the three vital metric cards (`article` blocks) per §b/§c: `article className="patient-card p-5 flex flex-col justify-between gap-4"`; icon tiles keep pastel bg (`bg-rose-50` etc. — these are legitimate semantic containers); big numbers `text-3xl font-black tracking-tight text-slate-900` → `pt-metric text-3xl text-text`; slate text → tokens per §c; record buttons → small `rounded-[8px] border` link-buttons with semantic color. Alerts/symptoms section panels per §b; alert/symptom row cards per §b row rule.

- [ ] **Step 2: Restyle health / trends / timeline the same way**

Same playbook: each page's `dashboard-hero` block → `PageHero` (derive kicker/title/description/copy verbatim from each file's current hero), gradient or bordered card bodies → §b, big numeric readouts → `pt-metric`.

- [ ] **Step 3: Run tests for these routes**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run "src/app/patient/(app)/vitals" "src/app/patient/(app)/health" 2>&1 | grep -E "Test Files|Tests "
```

Expected: vitals failures (if any) match baseline list only ("renders vitals cards and diary" is NOT in baseline failures — it must pass after restyle; "renders vitals, alerts, profile snapshot without a duplicate page title" is a BASELINE FAIL in health — must remain exactly that, not become a different error).

- [ ] **Step 4: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add "apps/marketing/src/app/patient/(app)/vitals" "apps/marketing/src/app/patient/(app)/health" "apps/marketing/src/app/patient/(app)/trends" "apps/marketing/src/app/patient/(app)/timeline"
git commit -m "feat(patient): VYRO restyle vitals/health/trends/timeline"
```

---

### Task 10: Medications + prescriptions pages

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/medications/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`, `history/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/prescriptions/page.tsx`, `[id]/page.tsx`

**Interfaces:**
- Consumes: playbook + PageHero. The medications tests (`renders the section header`, `shows refill CTA when refills are due`) are BASELINE FAILURES (mock lacks `usePatientProfile`) — after restyle they must still fail with the SAME mock error, so do not remove the `usePatientProfile` import or page hook usage.

- [ ] **Step 1: Restyle medications pages per playbook**

For `medications/page.tsx` hero (line ~84): kicker "Medications", keep title/desc lines verbatim, footer from stale/refill counts currently shown in hero glass tiles. Body cards §b; dose rows §b row rule; refills CTA `pt-btn pt-btn-primary text-xs`.

- [ ] **Step 2: Restyle prescriptions pages per playbook**

For `prescriptions/page.tsx` (hero line ~105): kicker "Prescriptions", footer from prescription meta (refill day, clinic). `[id]/page.tsx` detail: convert bordered detail panels → `patient-card`; prescription metadata mono rows; lists → `pt-table` if tabular.

- [ ] **Step 3: Run tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run "src/app/patient/(app)/medications" "src/app/patient/(app)/prescriptions" 2>&1 | grep -E "Test Files|Tests |Error:"
```

Expected: medications page tests fail with unchanged "No \"usePatientProfile\" export is defined on the \"@/patient/hooks\" mock" error; prescriptions tests unchanged from baseline.

- [ ] **Step 4: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add "apps/marketing/src/app/patient/(app)/medications" "apps/marketing/src/app/patient/(app)/prescriptions"
git commit -m "feat(patient): VYRO restyle medications and prescriptions"
```

---

### Task 11: Appointments + care-team + doctors + teleconsult pages

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/appointments/page.tsx`, `book/page.tsx`, `[id]/page.tsx`, `[id]/rate/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/care-team/page.tsx`, `care-team/add/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/doctors/[id]/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/teleconsult/[roomId]/page.tsx`

**Interfaces:**
- Consumes: playbook + PageHero; booking flows (doctors search, slots) unchanged functionally.

- [ ] **Step 1: Restyle all four clusters per playbook**

Each hero (appointments line ~152, book line ~111, care-team ~122/103) → PageHero with verbatim copy; icon in kicker = the hero's existing leading icon (CalendarDays / Users / UserPlus respectively); glass metrics → mono footer spans; booking/slot picker cards, doctor cards, calendar grid cells → §b conversions with §c token mapping; rate form / review submit buttons → `pt-btn pt-btn-primary`.

- [ ] **Step 2: Run tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run "src/app/patient/(app)/appointments" "src/app/patient/(app)/care-team" 2>&1 | grep -E "Test Files|Tests "
```

Expected: unchanged baselines (no known failing files in this cluster).

- [ ] **Step 3: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add "apps/marketing/src/app/patient/(app)/appointments" "apps/marketing/src/app/patient/(app)/care-team" "apps/marketing/src/app/patient/(app)/doctors" "apps/marketing/src/app/patient/(app)/teleconsult"
git commit -m "feat(patient): VYRO restyle appointments care-team doctors teleconsult"
```

---

### Task 12: Records + imaging + diagnostics cluster

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/records/page.tsx`, `records/new/page.tsx`, `records/scan/page.tsx`, `records/[id]/page.tsx`, `records/[id]/edit/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/imaging/page.tsx`, `imaging/[studyUid]/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/diagnostic-tests/page.tsx`, `diagnostic-tests/bookings/page.tsx`, `bookings/[id]/page.tsx`, `bookings/[id]/rate/page.tsx`, `bookings/[id]/result/page.tsx`, `packages/page.tsx`, `packages/[slug]/page.tsx`, `[slug]/page.tsx`

**Interfaces:**
- Consumes: playbook + PageHero. Do not touch the RecordSearch/filter logic or `focus=search` param behavior (Topbar links there).

- [ ] **Step 1: Restyle records pages per playbook**

Heroes (records/new line ~24, scan line ~111) → PageHero; records list cards → `patient-card` with row-level inset hairlines; DICOM/imaging viewers MUST keep their own dark viewport containers (only the surrounding chrome converts).

- [ ] **Step 2: Restyle diagnostic tests cluster**

Test catalog cards, package cards, booking slots, result panels → §b; price numbers / booking IDs → `pt-metric`/mono; statuses → §b-Badge pattern (`pt-dot` + pill).

- [ ] **Step 3: Run tests (all 9 baseline failures live near here — compare exactly)**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run "src/app/patient/(app)/allergies" "src/app/patient/(app)/vaccinations" 2>&1 | grep -E "Test Files|Tests "
```

(Allergies/vaccinations are in the sidebar "Records & Labs" family though pages live at top level — if their restyle happens in Task 15 instead skip here.)

Expected: allergies "renders list of allergies" + vaccinations "renders administered vaccines" are BASELINE FAILURES — must fail with the same mock-export errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add "apps/marketing/src/app/patient/(app)/records" "apps/marketing/src/app/patient/(app)/imaging" "apps/marketing/src/app/patient/(app)/diagnostic-tests"
git commit -m "feat(patient): VYRO restyle records imaging diagnostics"
```

---

### Task 13: Insurance + marketplace pages

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/insurance/page.tsx`, `marketplace/page.tsx`, `marketplace/[providerId]/page.tsx`, `claims/page.tsx`, `claims/new/page.tsx`, `claims/[id]/page.tsx`, `coverage-check/page.tsx`, `ecard/[id]/page.tsx`, `enroll/[planId]/page.tsx`, `payment/[enrollmentId]/page.tsx`, `payment/cancel/page.tsx`, `payment/return/page.tsx`, `plans/[planId]/page.tsx`, `policy/[id]/page.tsx`, `quote/page.tsx`
- Modify: `apps/marketing/src/app/patient/(app)/marketplace/page.tsx`, `marketplace/[caretakerId]/page.tsx`, `marketplace/inquiries/page.tsx` (the two distinct `marketplace` trees: `insurance/marketplace` and top-level `marketplace` — both)

**Interfaces:**
- Consumes: playbook + PageHero; pricing figures in `pt-metric`; coverage-check/enroll/quote multi-step forms unchanged in logic.

- [ ] **Step 1: Restyle insurance pages per playbook**

Hero at `insurance/page.tsx` line ~137 → PageHero; plan cards, quote cards, claim rows, ecard, payment status panels → §b; premium/sum assured numbers → `pt-metric`; policy/claim status badges → `pt-dot` pills; `hero-action-btn` at `plans/[planId]/page.tsx:190` → header moved to PageHero actions with `heroPrimaryAction`.

- [ ] **Step 2: Restyle marketplace pages per playbook**

Caretaker marketplace listing cards, inquiries table → §b + §e (`pt-table`).

- [ ] **Step 3: Run tests if any exist for these routes**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run "src/app/patient/(app)/insurance" 2>&1 | grep -E "Test Files|Tests "
```

Expected: no regressions (these routes are largely un-tested; suite count unchanged).

- [ ] **Step 4: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add "apps/marketing/src/app/patient/(app)/insurance" "apps/marketing/src/app/patient/(app)/marketplace"
git commit -m "feat(patient): VYRO restyle insurance and marketplace"
```

---

### Task 14: Family/safety/tools/pages remaining under the 35-hero list

**Files:** (each `page.tsx`; the (~line) marks the `dashboard-hero` header)
- `family/page.tsx` (~153), `caretakers/page.tsx` (~133), `emergency/page.tsx` (~220), `health-id/page.tsx` (~162)
- `messages/page.tsx` (~88), `messages/[id]/page.tsx`, `notifications/page.tsx` (~150), `notifications/preferences/page.tsx`
- `notes/page.tsx` (~122), `share/page.tsx` (~166), `consents/page.tsx` (~113), `export/page.tsx` (~112), `dsar/page.tsx` (~93), `audit/page.tsx` (~159)
- `tenants/page.tsx`, `activity/page.tsx`, `allergies/page.tsx` (~136), `vaccinations/page.tsx` (~79), `more/page.tsx`, `support/page.tsx` (top-level, non-(app) but patient-scoped)
- `profile/page.tsx` (~78), `profile/edit/page.tsx`, `settings/appearance/page.tsx`, `settings/email-import/page.tsx`, `settings/password/page.tsx`, `403/page.tsx`

**Interfaces:**
- Consumes: playbook + PageHero.
- `notes/page.test.tsx` "renders pinned note" and `profile/page.test.tsx` "renders the section header"/"shows a log out action" and `allergies` "renders list of allergies" are BASELINE FAILURES — keep same failure modes (do not fix page logic).

- [ ] **Step 1: Restyle each page per playbook**

Every `dashboard-hero` header → `PageHero` with the page's own verbatim kicker/copy. Special cases:
- `emergency/page.tsx`: the emergency info card is safety-critical copy — rewrap only classes; keep `danger`-tone mappings (`bg-rose-*` → keep, it's the danger token).
- `health-id/page.tsx`: QR canvas/viewport container keeps its own background; chrome only.
- `export/page.tsx`, `dsar/page.tsx`, `audit/page.tsx`: data tables → `pt-table` per §e.
- `messages/page.tsx` + `[id]`: thread composer chrome → §b; the thread scroll area keeps structure.
- `more/page.tsx`: menu tiles grid → `MenuTile`-style: each item `patient-card group relative p-4` with corner diamond.
- `403/page.tsx`, `support/page.tsx`: simple ink-surface empty/centered states via `EmptyState`.

- [ ] **Step 2: Run tests for this batch**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run "src/app/patient/(app)/notes" "src/app/patient/(app)/profile" "src/app/patient/(app)/allergies" 2>&1 | grep -E "Test Files|Tests "
```

Expected: baseline failures only (3 tests), same errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add "apps/marketing/src/app/patient/(app)/family" "apps/marketing/src/app/patient/(app)/caretakers" "apps/marketing/src/app/patient/(app)/emergency" "apps/marketing/src/app/patient/(app)/health-id" "apps/marketing/src/app/patient/(app)/messages" "apps/marketing/src/app/patient/(app)/notifications" "apps/marketing/src/app/patient/(app)/notes" "apps/marketing/src/app/patient/(app)/share" "apps/marketing/src/app/patient/(app)/consents" "apps/marketing/src/app/patient/(app)/export" "apps/marketing/src/app/patient/(app)/dsar" "apps/marketing/src/app/patient/(app)/audit" "apps/marketing/src/app/patient/(app)/tenants" "apps/marketing/src/app/patient/(app)/activity" "apps/marketing/src/app/patient/(app)/allergies" "apps/marketing/src/app/patient/(app)/vaccinations" "apps/marketing/src/app/patient/(app)/more" "apps/marketing/src/app/patient/support" "apps/marketing/src/app/patient/(app)/profile" "apps/marketing/src/app/patient/(app)/settings" "apps/marketing/src/app/patient/403"
git commit -m "feat(patient): VYRO restyle family tools records-chrome and settings pages"
```

---

### Task 15: AI pages + auth pages

**Files:**
- Modify: `apps/marketing/src/patient/components/ai/AiToolHero.tsx` (line 32 uses `dashboard-hero`)
- Modify: `apps/marketing/src/app/patient/(app)/ai/page.tsx` (~161), `ai/chat/page.tsx`, `ai/clinical-note/page.tsx`, `ai/lab-explain/page.tsx` (~122), `ai/lab-trend/page.tsx` (~114), `ai/ocr/page.tsx`, `ai/vaccination-card/page.tsx` (~178)
- Modify: `apps/marketing/src/app/patient/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, `verify-otp/page.tsx`, `mfa/challenge/page.tsx`, `mfa/setup/page.tsx`

**Interfaces:**
- Consumes: playbook + PageHero. `AiToolHero` test (`AiToolHero.test.tsx`) — keep any title/copy assertions passing; update classname assertions if it asserts `dashboard-hero`.
- Auth pages share `src/app/_shared/auth-harbor.css` — DO NOT edit that file; style auth pages only with local/tailwind classes already scoped to patient (their layout is patient-scoped via data-app attribute).

- [ ] **Step 1: Convert `AiToolHero`**

Its `dashboard-hero` container → `.pt-hero` wrapper with the same internal structure (kicker mono light blue, white title, translucent action row). Keep its props API. Based on its test, update only what the test requires.

- [ ] **Step 2: Restyle AI pages per playbook**

Hero `ai/page.tsx` (~161): the gradient `<section>` → PageHero; AI tool cards → §b; chat page keeps its own composer layout — only swap surrounding panel classes; output cards (clinical note, vaccination card) → `patient-card`.

- [ ] **Step 3: Restyle auth pages**

Keep the auth-harbor layout; swap primary buttons to `pt-btn pt-btn-primary`, inputs to `pt-input`, brand marks to blue tokens where the current page uses dark navy — colors are already blue-family tokens.

- [ ] **Step 4: Run tests**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient/components/ai "src/app/patient/(app)/ai" 2>&1 | grep -E "Test Files|Tests "
```

Expected: same baseline as Tasks 3–8 (AI component tests all passed at baseline; page tests within `(app)/ai` have no baseline failures — keep it that way).

- [ ] **Step 5: Commit**

```bash
cd /Users/thufailahamed/Downloads/App-2
git add apps/marketing/src/patient/components/ai "apps/marketing/src/app/patient/(app)/ai" apps/marketing/src/app/patient/login apps/marketing/src/app/patient/register apps/marketing/src/app/patient/forgot-password apps/marketing/src/app/patient/verify-otp apps/marketing/src/app/patient/mfa
git commit -m "feat(patient): VYRO restyle AI pages and auth screens"
```

---

### Task 16: Delete dead CSS + final sweep

**Files:**
- Modify: `apps/marketing/src/app/patient/globals.css` (delete `.dashboard-hero` block and the dark `.sidebar-*` rules block lines ~511–610 — already replaced in Task 6, verify gone)

**Interfaces:**
- Consumes: all pages migrated off `dashboard-hero` by Tasks 8–15.

- [ ] **Step 1: Confirm no page references `dashboard-hero` / `hero-action-btn` remain in patient scope**

```bash
grep -rl "dashboard-hero\|hero-action-btn" apps/marketing/src/app/patient apps/marketing/src/patient | wc -l
```

Expected: `0`. If any file remains, restyle it with the playbook before deleting CSS.

- [ ] **Step 2: Delete the dead CSS in globals.css**

Remove the `/* Ensure all white action buttons ... */` block containing `.dashboard-hero { ... }` and all `.dashboard-hero .bg-white` / `.hero-action-btn` rules (lines ~474–509 in the baseline file; after Tasks 6's rewrite line numbers shift — locate by searching `dashboard-hero`).

Also confirm the dark `.sidebar-link`/`.sidebar-group-label`/`.sidebar-btn`/`.sidebar-footer-btn` rules are gone (replaced in Task 6).

- [ ] **Step 3: Verify tokens untouched + tokens test passes**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/app/patient/globals.test.ts 2>&1 | grep -E "Test Files|Tests "
cd /Users/thufailahamed/Downloads/App-2 && git diff HEAD -- apps/marketing/src/app/patient/globals.css | grep '^[+-] *--color' || echo CLEAN
```

Expected: pass; `CLEAN`.

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/globals.css
git commit -m "chore(patient): remove oceanic hero and dark sidebar CSS"
```

---

### Task 17: Full verification sweep

**Files:** none expected; fix regressions in whichever file caused them.

- [ ] **Step 1: Full patient suite**

```bash
cd /Users/thufailahamed/Downloads/App-2/apps/marketing && npm test -- --run src/patient src/app/patient 2>&1 | grep -E "Test Files|Tests "
```

Expected: exactly the baseline set of failures — `RecordForm.test.tsx` ×2, `hooks/index.test.ts` ×1 (`useCancelTestBooking` etc. missing from barrel test), plus the 9 page-test files ×11 tests (dashboard, allergies, health, medications ×2, notes, profile ×2, vaccinations, vitals-variant) with the SAME error modes as documented in Global Constraints. **Any other failing test = regression to fix now.**

- [ ] **Step 2: Global structure sanity**

```bash
grep -rl "dashboard-hero" apps/marketing/src/app/patient apps/marketing/src/patient | wc -l   # 0
grep -rl "hero-action-btn" apps/marketing/src/app/patient apps/marketing/src/patient | wc -l  # 0
git -C /Users/thufailahamed/Downloads/App-2 diff HEAD -- apps/marketing/src/app/patient/globals.css | grep '^[+-] *--color' || echo CLEAN  # CLEAN
```

- [ ] **Step 3: Primitives/API sanity grep**

```bash
grep -c "export { PageHero" apps/marketing/src/patient/components/primitives/index.ts  # ≥ 1
```

- [ ] **Step 4: Final report**

List per-task commits and confirm the test comparison table (baseline vs final).
