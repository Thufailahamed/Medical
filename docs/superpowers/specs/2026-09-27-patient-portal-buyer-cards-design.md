# Patient Web Portal — Buyer-Portal Card UI Redesign (Full Treatment)

Date: 2026-09-27
Status: Approved (brainstorming sections 1-5 confirmed by user)
Companion to: `2026-09-27-patient-vyro-redesign-design.md` (foundation spec — still valid)

## Decisions locked in brainstorming

- **Scope:** All patient pages (~30 routes under `apps/marketing/src/app/patient/(app)` + auth pages). No page left on old cards.
- **Shell:** Full shell + pages. Rebuild `PatientShell` interior (sidebar rail, topbar, canvas, page container) in buyer `Layout` language; keep auth gating + `useRealtime` untouched.
- **Colors:** Strict patient blue tokens unchanged (`--color-brand #3b6ff5`, `--color-ink-card #0c1a3a`, `--color-bg #e8effc`, white cards, existing success/warn/danger softs). Dark ink sections explicitly allowed (`pt-hero` on `ink-card` with brand-blue glow orbs, not volt/copper).
- **Imagery/motion:** Full buyer treatment. Photos (doctors, clinics, hero mosaics), `pt-flow` FlowCanvas decor on heroes/empties, hover lifts + image `scale-105`, metric stacks everywhere.
- **Approach:** System port (recommended, approved). Mirror buyer `ui.tsx` / `Surface` / `PageHero` into patient primitives on blue tokens, then migrate shell + all pages. No per-page forks, no CSS-only shortcut.

## 1. Visual language mapping

Keep every `--color-*` token in `apps/marketing/src/app/patient/globals.css`. Port buyer geometry verbatim:

- 12px card radius, 8px controls, never fully round (already enforced lines 89-106).
- Page rhythm: `max-w-7xl`, `gap-4`, `p-4 md:p-5` cards, `p-6 sm:p-8` feature surfaces, `border-b hairline pb-3` section dividers.
- Type roles (keep `Plus Jakarta Sans + IBM Plex Mono`, don't switch to Syne): `pt-kicker` eyebrow on every card/section, `pt-metric` mono tabular for vitals/scores/counts, 22-28px white ink-hero titles, `t-micro` sublabels.
- Ink heroes: `pt-hero` on `#0c1a3a` + brand-blue radial glows + grain + `inset 0 0 0 1px rgba(255,255,255,0.08)` + dashed `rgba(255,255,255,0.15)` footer strip. Primary action white plate/ink text; secondary translucent plate.

## 2. Shell (`src/patient/components/shell/`)

- `PatientShell.tsx`: unchanged mechanics (canvas `#e8effc`, rounded plate, gating). Content wrapper standardizes to `mx-auto w-full max-w-7xl flex flex-col gap-4 px-1 pb-6 pt-1`.
- `Sidebar.tsx`: light paper rail, `bg-surface` + right hairline `rgba(19,32,68,0.10)`; brand-blue logo tile + ink wordmark + `PATIENT` brand-soft pill; `pt-input` compact search (h-9); group labels `pt-kicker pt-kicker-muted`; links ink-on-transparent, hover `bg-ink/5`, active `bg-brand-soft` + left 2px brand bar + brand icon + `pt-dot` diamond; unread badge `bg-brand text-white`; footer ink avatar square (mono initials) + `SECURED · HEALTHHUB` mono meta. Preserve all `data-testid` (`nav-*`, `sidebar-logout`) + `aria-current`.
- `Topbar.tsx`: hairline bottom rule, title row + mono date, wellness chip (success-soft), dark-ink avatar square, profile menu on `pt-floating`. Keep `data-testid="patient-topbar"`.
- Every page top stack: ink `pt-hero` (kicker + title + desc + status/actions + dashed footer) → metric/action row → `PageSection` cards. Mirrors buyer `DashboardPage`.

## 3. Shared primitives (`src/patient/components/primitives/` + `src/portal/components/ui/` where shared)

- `Surface` kinds `flat/elevated/floating/ink` → `pt-surface/pt-elevated/pt-floating/pt-hero`.
- `Card + CardHeader`: white, 14px, inset hairline, hover lift + 2px brand bottom sweep (`scaleX .14 → 1`) + corner diamond (`patient-card-blob`, opacity .45 → .9, scale 1.15). Standardize all cards to this; retire pastel blob gradients.
- `PageSection`: kicker + 22px title + right action, `border-b hairline pb-3`, `space-y-5` body (buyer `PageSection` parity).
- `MetricStack`: `divide-y hairline` rows, 10px uppercase label + mono value; accents mint=stable, amber=attention, rose=critical, brand=primary.
- `StatusDots/Pill/Badge`: rotated-square diamond + uppercase micro label; map clinical statuses (scheduled/confirmed/in-progress/completed/cancelled/disputed) with buyer palette logic.
- `EmptyState`: `pt-flow` canvas top, ink icon tile + brand-blue glyph, display title, muted desc, primary action.
- `Table`: `pt-table` everywhere (sticky blurred head, hairline rows, `.num` right mono). Applies to appointments, prescriptions, records, invoices, audit.
- `Button/Input/Select/Textarea`: `pt-btn-primary` (ink → brand-strong hover + sweep), `pt-btn-secondary` (hairline → ink fill), `pt-input` inset ring + brand halo; arrow slides 4px on hover.
- Data flow: props-only. Hooks (`useProfile`, `useHealthSummary`, `useVitalsAlerts`, etc.) unchanged.

## 4. Page patterns (all routes, three compositions)

A. **Command dashboard** (`(app)/page.tsx` + `src/patient/components/dashboard/`): ink greeting hero (date kicker, wellness tip, vitals-steady/alert pill, white `Log vitals`, blood/BMI/insurance footer) → 4-up metric cards → `VitalsTrend` Trajectory card (title + trailing total + TimeSeries) → depot-style photo rows (care team/clinics with status pills) → spotlight photo grid (records/doctors/marketplace with category badge + meta + Book action).
B. **List + detail** (appointments, prescriptions, medications, records, imaging, diagnostic-tests, vaccinations, allergies, messages, notifications, activity, audit, marketplace, doctors, teleconsult, insurance subpages, care-team/add, appointments/book): buyer `OrdersPage/RfqsPage` pattern — ink hero with count + primary CTA, pill tabs (`All/Upcoming/Completed`), `pt-table` or photo-card grid, detail with `MetricStack` + timeline + actions. Doctors/care-team/marketplace get photo cards (image top, verified badge, location meta, CTA footer).
C. **Profile/settings forms** (profile, health-id, family, caretakers, insurance, consents, share, export, dsar, emergency, settings, more, ai, trends, notes, health, support, verify-otp, mfa, login/register/forgot-password): buyer `ProfilePage` pattern — flat surfaces with `PageSection` headers, `pt-input` forms, `SuccessBanner/ErrorBanner`, `QueryBoundary` shimmer skeletons. Auth pages use VYRO auth-card pattern inside existing `auth-harbor.css` shell (scoped overrides only, never edit shared file).
- Photos: care-only subjects (doctors, clinics, hero), clinical alt text, lazy loading, initials fallback (no hardcoding in primitives). Hover `scale-105` on images, `-translate-y-0.5` on cards.

## 5. Motion, a11y, testing, rollout

- Motion: `ease-vyro`, 140-280ms, `anim-rise` stagger, `patient-shimmer` skeletons, buyer-style pulse blocks for loading grids. `prefers-reduced-motion` kill-switch stays.
- A11y: brand focus ring, semantic landmarks, dots always paired with text, photo `alt` required, contrast untouched.
- Testing: existing `src/patient` + `src/app/patient` vitest suite stays green (`npx vitest run src/patient src/app/patient` from `apps/marketing`); update only classname assertions (`patient-card`, `pt-*` kept); add primitive snapshot/class tests for `PageHero/MetricStack/EmptyState`. Manual per-page: hero renders, table sorts, empty shows, 360px no overflow. Diff-check `--color-*` unchanged.
- Rollout: primitives → shell → dashboard → batches (A: appointments/prescriptions/records/vitals, B: doctors/care-team/marketplace/messages, C: settings/profile/forms). Presentational diffs only.

## Self-review

- No placeholders; scope is explicit (all patient routes, full shell).
- Consistent with companion spec; deltas are additive (ink heroes allowed, photo/flow treatment, metric stacks, three page compositions).
- No contradictions with color freeze or hook/API freeze.
- Single-plan scope: system port + migration batches fit one implementation plan.
