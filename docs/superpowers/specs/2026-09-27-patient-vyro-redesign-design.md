# Patient Web Portal — VYRO (project-5 buyer portal) Redesign

Date: 2026-09-27
Status: Approved

## Goal

Redesign every page of the patient web portal (`apps/marketing/src/app/patient/{login,(app)}` and `apps/marketing/src/patient`) to the VYRO design language used by `~/Downloads/project-5/apps/web` (buyer portal), while **keeping the existing patient blue color token palette unchanged**.

Reference: `project-5/apps/web/src/components/ui.tsx`, `brand/PageHero.tsx`, `brand/Surface.tsx`, `index.css` (VYRO tokens / classes).

## Non-goals

- No color token changes (all `--color-*` patient values in `patient/globals.css` stay).
- No routing / data / hook changes; restyling only.
- Clinician portal (`src/app/portal/**`), admin, marketing pages are out of scope except where shared patient components (`src/patient/**`) are the only home of a style.
- No full `tsc --noEmit` gate (per user choice) — verification is the patient vitest suite.

## 1. Foundation — `apps/marketing/src/app/patient/globals.css`

Keep every color token. Add / modify (all scoped `[data-app="patient"]`):

- **`.pt-hero`** — dark-ink hero card: `background: var(--color-ink-card)` (#0c1a3a), brand-blue glow orbs via `radial-gradient` blur layers (`#3b6ff5`, lighter blue), grain overlay, inner hairline `inset 0 0 0 1px rgba(255,255,255,0.08)`.
  - `.pt-hero-kicker` — `font-family: var(--font-patient-mono)`, 11px, uppercase, `letter-spacing .16em`, light blue (`#7eb3ff`).
  - `.pt-hero-footer` — dashed top rule `rgba(255,255,255,0.15)`, mono 11px uppercase `rgba(255,255,255,0.5)`.
  - `.pt-hero-title` — `t-display`-like white heading.
- **Delete** `.dashboard-hero` block and all `hero-action-btn` / `.dashboard-hero .bg-white` overrides (lines 474–509). All 35+ usages are replaced in §4.
- Keep existing `.pt-surface`, `.pt-elevated`, `.pt-floating`, `.pt-card`, `.pt-kicker`, `.pt-metric`, `.pt-btn*`, `.pt-input`, `.pt-dot`, `.pt-table`, `.pt-flow` (already VYRO-ported).
- Add `.pt-btn-danger` (danger-soft bg / danger text semantics, same sweep geometry).
- Add `.pt-empty` polish: flow bg + ink icon tile with brand-blue glyph.

## 2. Primitives — `apps/marketing/src/patient/components/primitives/`

- **New `PageHero.tsx`** (port of project-5 `brand/PageHero.tsx`):
  - Props: `icon` (ComponentType), `kicker`, `title`, `description?`, `status?` (ReactNode), `actions?`, `footer?` (ReactNode — rendered in dashed mono strip).
  - Renders `.pt-hero` surface: glow orbs, kicker row (icon + mono kicker light-blue), white title, muted description, action cluster, dashed footer.
  - Export `HeroStatusPill({ label, tone: "success" | "warn" | "brand" | "paper" })` — mono pill, translucent white border (VYRO paper/15 style), pulsing dot (brand/success/warn tones mapped to existing success/warn/brand tokens).
  - Export hero action class helpers: `heroActionClass` (translucent outline) + `heroPrimaryActionClass` (white bg, ink text — the hero-context primary).
- **`Card.tsx`** — remove `patient-card-blob` pastel gradient + `patient-card-shine` usage. VYRO treatment:
  - `patient-card` base (inset hairline) + corner rotated-square diamond (single accent color, radius 1px, opacity .45 → .9 on hover, scale 1.15) + 2px bottom accent sweep (scaleX .14 → 1 on hover, brand color per `accent` prop).
  - `accent` prop API unchanged (`brand | sky | violet | amber | green | rose | none`), colors mapped to flat brand-ish accents (`bg-brand`, `bg-sky-500`, `bg-violet-500`, `bg-amber-500`, `bg-emerald-500`, `bg-rose-500`).
- **`StatTile.tsx`** — same base as Card; kicker label, `pt-metric` value, unit; delta row uses `↑/↓` glyph + rotated-square dot in success/danger tone.
- **`SectionHeader.tsx`** — unchanged (already PageSection-shaped).
- **`EmptyState.tsx`** — icon tile: `bg-ink` (`#132044`) + brand-blue glyph; keep flow bg.
- **`Card.test.tsx` / `StatTile`-related tests** — update to new DOM only where classnames are asserted; behavior (links, children) unchanged.

## 3. Shell — `apps/marketing/src/patient/components/shell/`

- **`Sidebar.tsx`** → light paper rail:
  - Background `var(--color-surface)`, right hairline `rgba(19,32,68,0.10)`.
  - Logo: brand-blue tile (white glyph), ink wordmark, `PATIENT` tag in brand-soft pill.
  - Search input: `.pt-input`-styled compact (h-9).
  - Group labels: `.pt-kicker pt-kicker-muted` (mono? no — keep UI font, uppercase 10px, muted). Collapse chevrons keep behavior.
  - Links: ink text on transparent, hover `bg-ink/5`; active: `bg-brand-soft` + left 2px `--color-brand` bar + brand-blue icon + `pt-dot` diamond; text stays ink (not white).
  - Unread badge: `bg-brand text-white` worn on active too.
  - Footer: ink avatar square (mono initials, brand-soft text), profile/logout icon buttons ink-muted hover states, mono "SECURED · HEALTHHUB" meta line (`text-text-muted`).
  - Replace `.sidebar-*` CSS-class styling (dark-scoped rules in globals.css) with light-theme classes; delete the now-dead `.sidebar-link`/`sidebar-group-label`/`sidebar-footer-btn` dark rules and `sidebar-scroll` dark scrollbar styling from `patient/globals.css` (replace with light-theme equivalents where still needed).
  - All `data-testid`s (`nav-*`, `sidebar-logout`) and `aria-current` behavior preserved.
- **`Topbar.tsx`** — keep structure/behaviour; retune chrome to VYRO: hairline `rgba(19,32,68,0.10)` bottom rule, page-title row + mono date, wellness chip stays success-soft; avatar dark-ink square mono initials; profile menu on `pt-floating` already. `data-testid="patient-topbar"` kept.
- **`PatientShell.tsx`** — unchanged layout mechanics (canvas bg, rounded plate). Canvas/backdrop colors unchanged.

## 4. Pages — all pages under `apps/marketing/src/app/patient/{(app),login}` + hero-bearing `src/patient/components`

Mechanical restyle per page (no data/hook changes):

1. Replace `dashboard-hero` gradient `<header>` blocks (35 pages) and `AiToolHero`/`DashboardHero` gradient banners with new `PageHero` primitive: mono kicker, title, description, status pill(s), actions via hero action classes, dashed mono footer for meta (dates, IDs, counts).
2. Replace inline `rounded-2xl border border-slate-200 bg-white` / `bg-white border` cards with `Card` primitive (or `pt-surface` divs where a primitive is inappropriate, e.g. grids of list rows inside cards).
3. Big metric numbers → `pt-metric` mono class; lower-case sublabels → `t-micro`/kicker.
4. Status badges → dot (`pt-dot` rotated square) + Badge-style pill.
5. Buttons → `pt-btn pt-btn-primary|secondary|ghost`; hero-context CTAs use hero primary (white on ink).
6. Tables → `.pt-table` classes.
7. Empty/loading blocks → `EmptyState` / `patient-shimmer`.

Dashboard components in `src/patient/components/dashboard/` (DashboardHero, HealthSummaryStrip, QuickActions, MedicationsToday, UpcomingAppointment, WeekStrip, VitalsTrend, WellnessScore, BodyOverview, RecentActivity, RecentRecords, NotificationsPreview, InsuranceCoverage, CareAssistant, SafetyBanner) get the same card/hero treatment; `DashboardHero` becomes an ink `PageHero`-style greeting card with wellness stat block (mono metric), status pills, and `Log vitals` white-on-ink action.

Page inventory (restyle each): dashboard page + the 35 `dashboard-hero` files found by grep under `src/app/patient/**`, plus `ai/**` subpages, `records/**` subpages, `insurance/**` subpages, `appointments/book`, `care-team/add`, `more`, `settings`, `timeline`, `trends`, `messages`, `profile`, `marketplace`, `teleconsult`, `doctors`, `tenants`, `activity`, `health`, `support`, `verify-otp`, `mfa` — i.e. every page under `(app)` + auth pages (`login`, `register`, `forgot-password`, `verify-otp`, `mfa`) restyled to VYRO auth-card pattern while keeping the `auth-harbor.css` shared shell.

## 5. Verification

- Run the marketing app patient tests: `cd apps/marketing && npx vitest run src/patient src/app/patient` (filters: component + page + parity tests).
- Lint the touched files: `npx eslint <files>` or the app's `npm run lint` if fast enough.
- No token/canvas/brand color values are modified; a diff check of `--color-*` definitions confirms this.

## Risks / mitigations

- **Test contrast breakage:** tests assert `data-testid`s and some classnames (`patient-card`, `pt-*`). Keep those class names in the new primitives; only swap decorative internals.
- **75 `dashboard-hero` matches across 3 apps:** only `src/app/patient/**` (35 files) + `src/patient/**` (2) are in scope. `src/app/portal/**` (clinician) keeps its own CSS in `portal/globals.css` — untouched.
- **Auth pages** share `auth-harbor.css` with other apps — style only via `[data-app="patient"]` scoping / local classes, never the shared file.
