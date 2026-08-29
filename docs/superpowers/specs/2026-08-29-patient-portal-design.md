# Patient Portal — Design Spec

**Date:** 2026-08-29
**Status:** Approved for planning
**Area:** `apps/marketing` (Next.js 16), with one additive change in `apps/api`

---

## 1. Goal

Build a premium patient-facing web portal as a distinct role interface alongside the
existing doctor (`/portal`), hospital (`/hospital`), admin (`/admin`), lab (`/lab-portal`)
and insurance-operator surfaces.

Visual direction: soft light-gray application canvas, a large rounded content plate,
white rounded cards, generous spacing, near-black typography, indigo/purple accent,
a floating icon-only sidebar with a circular active state, pill controls, circular
progress indicators, elegant charts, and an interactive anatomical centerpiece.

Non-goals: changing the doctor, hospital, admin, lab or insurance-operator portals;
altering authentication; inventing medical data or capabilities the backend does not have.

## 2. Context — what already exists

A patient web surface already ships at `apps/marketing/src/app/portal/(patient)/me/*`.
It is role-gated (`PATIENT_ROLES = ["patient"]`, `layout.tsx:32`) and uses a minimal
top-strip shell with no sidebar. Twenty page files exist across `me`, `me/records`,
`me/imaging` (incl. a DICOM viewer), `me/share`, `me/audit`, `me/notifications`, and
`me/insurance` plus eleven insurance sub-routes.

The backend already serves essentially every widget this spec calls for. The endpoint
inventory is in §7. Only one additive backend change is required (§8).

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | New route tree at `/patient/*`; existing `/portal/me/*` pages migrate in and old URLs become redirect stubs | Matches how `/hospital` and `/admin` are already separated. No link rot. Doctor-portal styling stays untouched. |
| D2 | All seven nav destinations built to production depth in this effort | Avoids dead nav links; ships a coherent product. |
| D3 | Anatomical centerpiece is a hand-built SVG with data-backed hotspots | No licensing risk; matches the purple design system; animates well. |
| D4 | Real APIs from the first commit; no mock data ships | Honors the constraint that nothing on screen may be fabricated. |
| D5 | New `src/patient/*` module with its own `@/patient/*` alias, but reusing the existing portal auth store and API wrapper | Session continuity from `/portal/login`; no duplicated auth state; still a clean code boundary. |

## 4. Architecture

### 4.1 Route tree

```
apps/marketing/src/app/patient/
  layout.tsx              imports ./globals.css; <div data-app="patient">;
                          Providers (TanStack Query) + AuthBoot; no role gate
  globals.css             purple token set, scoped [data-app="patient"]
  login/page.tsx          patient sign-in, writes to the shared portal auth store
  403/page.tsx
  (app)/
    layout.tsx            role gate PATIENT_ROLES = ["patient"] + PatientShell
    page.tsx              Dashboard
    health/page.tsx       My Health
    appointments/page.tsx
    records/page.tsx      + records/[id]/page.tsx
    medications/page.tsx
    messages/page.tsx     + messages/[conversationId]/page.tsx
    profile/page.tsx
    imaging/, share/, audit/, insurance/    migrated from (patient), reskinned
```

The split between `patient/layout.tsx` (CSS + providers, ungated) and
`patient/(app)/layout.tsx` (role gate + shell) mirrors the existing
`portal/layout.tsx` / `portal/(portal)/layout.tsx` split, so `login` and `403`
render without a gate.

### 4.2 Redirects

Every page under `src/app/portal/(patient)/**` is replaced by a server
`redirect()` stub to its `/patient/*` equivalent:

| Old | New |
|---|---|
| `/portal/me` | `/patient` |
| `/portal/me/records` | `/patient/records` |
| `/portal/me/imaging` and `/portal/me/imaging/[studyUid]` | `/patient/imaging`, `/patient/imaging/[studyUid]` |
| `/portal/me/share` | `/patient/share` |
| `/portal/me/audit` | `/patient/audit` |
| `/portal/me/notifications` | `/patient/notifications` |
| `/portal/me/insurance/**` (12 routes) | `/patient/insurance/**` |

`src/app/portal/login/page.tsx:72-76` currently sends patients to `/portal/me`;
its destination becomes `/patient`.

### 4.3 Module layout

```
apps/marketing/src/patient/
  components/
    shell/      Sidebar.tsx, Topbar.tsx, PatientShell.tsx
    ui/         Card, StatTile, Pill, SectionHeader, EmptyState, Skeleton, Sheet
    charts/     TrendArea, BarSeries, RadialGauge, Sparkline   (recharts wrappers)
    body/       BodyFigure, BodyHotspot, OrganDetailPanel
    widgets/    one file per dashboard card
  hooks/        usePatientVitals, useUpcomingAppointment, useTodayMeds, ...
  lib/          format.ts, vitals.ts, cn.ts
  types/        patient.ts
```

Add `"@/patient/*": ["./src/patient/*"]` to `apps/marketing/tsconfig.json` paths,
alongside the existing `@/portal/*` and `@/hospital/*`.

### 4.4 Reused, not duplicated

- `@/portal/stores/auth` — persisted Zustand store, key `healthcare-portal-auth`
- `@/portal/lib/api` — sets `Authorization: Bearer`, `Accept-Language`, handles the
  401 refresh-and-retry and the login bounce
- `@/portal/hooks/useRealtime` — SSE

Doctor-portal files are otherwise read-only to this work; the only edits are the
redirect stubs and the login destination string.

### 4.5 Known CSS constraint

`src/app/portal/globals.css:10` declares `--color-*` on bare `:root` rather than
scoping them. Tailwind v4 needs the custom properties at `:root` to generate
utilities, so the patient stylesheet follows the same pattern. Separate route trees
produce separate CSS chunks, so the two sets do not collide at runtime — this is
already true of `/hospital` and `/admin`. We follow the precedent rather than
refactor it.

## 5. Visual system

Tokens live in `apps/marketing/src/app/patient/globals.css`, declared under
`[data-app="patient"]` and mirrored on `:root` for Tailwind v4 utility generation.

```css
/* Surfaces */
--color-canvas:      #E9ECF1;   /* page background behind the plate */
--color-bg:          #F4F5F8;   /* rounded dashboard plate */
--color-surface:     #FFFFFF;   /* cards */
--color-surface-2:   #F5F6F8;   /* inset wells, inactive pills */
--color-surface-3:   #ECEEF2;   /* chart gutters, unfilled tracks */

/* Ink */
--color-text:        #0B0B0F;
--color-text-soft:   #56585F;
--color-text-muted:  #9A9DA6;

/* Accent */
--color-brand:       #5B4EE9;
--color-brand-soft:  #EEEBFE;
--color-brand-strong:#4338CA;
--color-ink:         #101014;   /* black pill, FAB, active nav circle */

/* Semantic */
--color-success: #16A06A;  --color-success-soft: #E7F7EF;
--color-warn:    #E08A00;  --color-warn-soft:    #FDF3E0;
--color-danger:  #E0464B;  --color-danger-soft:  #FDECEC;

/* Geometry */
--radius-plate: 32px;
--radius-card:  24px;
--radius-inner: 16px;
--radius-pill:  999px;

/* Depth — wide, low-opacity, no dark edges */
--shadow-card:  0 1px 2px rgba(11,11,15,.04), 0 8px 24px rgba(11,11,15,.05);
--shadow-float: 0 4px 12px rgba(11,11,15,.06), 0 18px 40px rgba(11,11,15,.08);
--shadow-brand: 0 8px 24px rgba(91,78,233,.28);
```

### 5.1 Type scale

Family: `Plus Jakarta Sans`, falling back to `Outfit`, then system sans.

| Role | Spec |
|---|---|
| Page display | 56px / 700 / -0.03em |
| Card title | 18px / 600 |
| Metric value | 40px / 700 / -0.02em, unit trails at 18px / 500 muted |
| Label | 13px / 500, muted |
| Micro | 11px / 500, muted |

### 5.2 Shell composition

- Page canvas at `--color-canvas` with 20px padding; inside it a single
  `--radius-plate` plate on `--color-bg`. The marketing root layout owns `<html>`
  and `<body>`, so the canvas background is applied to the `[data-app="patient"]`
  wrapper with `min-height: 100dvh` rather than to `body`.
- Sidebar: floating white rail **inside** the plate — 84px wide, `--radius-pill`,
  `--shadow-card`, icon-only. Active item is a solid `--color-ink` 48px circle with
  a white icon. Inactive items are muted icons with no chrome. Labels appear as
  hover tooltips and are always present as `aria-label`.
- Topbar: inline with the plate rather than a full-width bar — greeting on the left,
  a centered floating nav pill, and a right cluster of name + date, avatar, and a
  circular notification bell carrying the unread badge.
- Content: 12-column grid, 20px gutters.

### 5.3 Motion

Framer Motion is not a dependency and is not being added; motion is CSS plus the
animation options recharts already provides.

- Card mount: 180ms opacity and 8px rise, staggered 40ms by grid index
- Metric counters: 600ms ease-out, first paint only
- Radial gauges and chart series: 700ms ease-out via recharts
- Hover: card raises to `--shadow-float` over 160ms; nav circle scales to 1.06
- All of the above is disabled under `@media (prefers-reduced-motion: reduce)`

### 5.4 Rules that keep it from reading as a generic admin template

No card borders — separation comes from shadow and spacing alone. No chart gridlines
except a single dashed baseline. One accent-colored bar or segment per chart with the
remainder in `--color-surface-3`. No colored card headers. No icon-in-a-colored-square
pattern.

## 6. Screens

### 6.1 Dashboard — `/patient`

Heading strip: the display heading "Health Monitoring", with a right cluster holding a
range pill (`Week`), a refresh circle, and an ink `+` FAB opening a quick-action sheet
(log a vital, book an appointment, upload a record).

The range pill offers Week, Month and Quarter. It is the single source of the `from`
and `to` parameters for the VitalsTrend, WeekStrip and Activity widgets; the remaining
cards show current state and ignore it. The refresh circle invalidates the
`["patient"]` query-key prefix.

| Grid | Widget | Data | Empty state |
|---|---|---|---|
| L 5col | **VitalsTrend** — tabs for Heart rate, Saturation, Blood pressure, Temperature; bar series with one accent bar and a floating value pill; footer Average and Max tiles | `GET /vitals/me/series?type=&from=&to=` | "No heart-rate readings yet" + Log reading |
| L 5col | **Assistant** — ink card showing the top health alert with an Ask call to action | `GET /health-summary/me` (alerts), `GET /chat/sessions` | "Nothing needs attention right now" |
| C 4col, spans 2 rows | **BodyFigure** — the centerpiece (§6.2) | per hotspot | per hotspot |
| R 3col | **WeekStrip** — seven day pills, a dot marking days with activity | `GET /timeline/me?from=&to=` | dots simply absent |
| R 3col | **Medications** — today's doses as pills, an adherence radial reading `todayTaken / todayCount`, and the streak | `GET /medicines/today`, `GET /medicines/me/stats` | "No medications yet" + Add |
| R 3col | **Wellness** — score donut, `components` rendered as segmented arcs, seven-day sparkline | `GET /wellness/me`, `last7Days` from medicine stats | API already returns `score: 0` with level "Set up profile" |
| D 5col | **RecentRecords** | `GET /medical-records/me?limit=4`, `GET /medical-records/me/stats` | "No records yet" + Upload |
| D 4col | **UpcomingAppointment** — doctor, specialization, hospital, date, time, mode | `GET /appointments/me` (see §8) | "No upcoming visits" + Book |
| D 3col | **Activity** | `GET /timeline/me?limit=6` | "Your activity will appear here" |

### 6.2 BodyFigure centerpiece

A hand-built SVG figure — translucent indigo silhouette with distinct organ shapes and
soft depth — carrying clickable hotspots. Each hotspot is bound to real data:

| Hotspot | Source | Status derivation |
|---|---|---|
| Heart | `GET /vitals/me/series` for `heart_rate` and `blood_pressure` | classification from `GET /vitals/me/alerts` |
| Lungs | `spo2`, `respiratory_rate` | same |
| Metabolic | `GET /medical-records/me/lab-results?test=HbA1c` and glucose | the `flag` column (`normal`/`low`/`high`/`critical`) |
| Kidney | lab results for creatinine and eGFR | the `flag` column |
| Body composition | `patients.height`/`weight` via `GET /vitals/me/derived` | `bmi` and `bmiCategory` |

A hotspot with no underlying data renders muted grey with "No data yet — log a
reading". It never displays a fabricated status such as "Excellent".

Selecting a hotspot opens an `OrganDetailPanel` showing the latest reading, its trend
sparkline, the reference range, and a link to the matching section of My Health.

Accessibility: hotspots are `<button>` elements in the tab order with descriptive
`aria-label`s ("Heart — resting rate 72 bpm, normal"), and the panel is reachable
without a pointer.

### 6.3 My Health — `/patient/health`

Four metric tiles across the top (latest value plus delta) drawn from
`GET /vitals/me/derived` (`latestByType`) and the series `stats.delta`. Below them a
large trend chart with type and range switchers, the alerts list from
`GET /vitals/me/alerts`, a lab-trend chart with a test picker backed by
`GET /medical-records/me/lab-results?test=&months=`, and the symptom log from
`GET /vitals/symptoms/me`. A log sheet posts to `POST /vitals`.

### 6.4 Appointments — `/patient/appointments`

Upcoming and Past tabs over `GET /appointments/me`. A detail sheet shows linked
records via `GET /appointments/:id/records`. Booking posts to `POST /appointments`;
rescheduling uses `PATCH /appointments/:id`; cancelling uses
`DELETE /appointments/:id`. A completed visit surfaces its rating through
`GET /appointments/:id/rating`.

### 6.5 Medical Records — `/patient/records`

Record-type filter chips over the paginated `GET /medical-records/me`, with a stats
header from `GET /medical-records/me/stats`. The detail route `/patient/records/[id]`
renders the structured-extraction children — `GET /medical-records/:id/lab-results`,
`/imaging-findings`, `/prescription-items`, `/vaccination-doses` — alongside attached
files from `GET /files/record/:recordId` and a share call to action.

### 6.6 Medications — `/patient/medications`

The active list from `GET /medicines/me`, today's schedule from
`GET /medicines/today`, a seven-day adherence bar chart from the `last7Days` array on
`GET /medicines/me/stats`, refills from `GET /medicines/refill-due`, and interaction
warnings from `GET /medicines/me/interactions`. Adding uses `POST /medicines`;
stopping uses `POST /medicines/:id/stop`.

### 6.7 Messages — `/patient/messages`

Two tabs. **Care team** lists `GET /patient-messages/conversations`, opens a thread at
`GET /patient-messages/conversations/:id/messages`, and replies through
`POST /patient-messages/conversations/:id/messages`. Because only a doctor can open a
thread, the empty state reads "Your care team will start a conversation here" with no
compose affordance, and a thread the doctor has closed renders read-only with an
explanatory line rather than a disabled input.

**Assistant** covers the AI health chat: `GET /chat/sessions`,
`POST /chat/sessions`, and the SSE stream at
`POST /chat/sessions/:id/messages/stream`.

### 6.8 Profile — `/patient/profile`

Identity and demographics from `GET /patients/me` with `PUT /patients/me`; allergies
through `GET/POST/PATCH/DELETE /allergies`; vaccinations from `GET /vaccinations/me`
and `GET /vaccinations/me/due`; family members via `GET/POST/DELETE
/patients/me/family`; the health ID card at `GET /me/health-id`; language through
`PATCH /patients/me/locale`; and sign out.

### 6.9 Secondary routes and where they are reached

The sidebar carries exactly the seven primary destinations: Dashboard, My Health,
Appointments, Medical Records, Medications, Messages, Profile. The migrated routes are
reachable but deliberately kept out of the rail so it stays compact:

| Route | Entry point |
|---|---|
| `/patient/notifications` | the bell in the topbar right cluster, carrying the unread badge |
| `/patient/imaging` | a "Imaging studies" card on Medical Records, and imaging-type record detail |
| `/patient/share` | the share call to action on Medical Records and on record detail |
| `/patient/audit` | a "Who accessed my records" link in Profile |
| `/patient/insurance` | an "Insurance" section link in Profile |

Each of these keeps its existing behaviour and data wiring; the work on them is
reskinning to the patient design system, not rebuilding.

## 7. Endpoint inventory
Every endpoint below already exists and requires no change.

```
GET  /auth/me
GET  /patients/me                          PUT /patients/me
PATCH /patients/me/locale
GET  /patients/me/family                   POST, DELETE
GET  /vitals/me                            POST /vitals
GET  /vitals/me/series?type=&from=&to=
GET  /vitals/me/derived
GET  /vitals/me/alerts?days=
GET  /vitals/symptoms/me                   POST /vitals/symptoms
GET  /health-summary/me
GET  /wellness/me
GET  /timeline/me?type=&from=&to=&limit=
GET  /appointments/me                      POST /appointments
PATCH /appointments/:id                    DELETE /appointments/:id
GET  /appointments/:id/records             GET /appointments/:id/rating
GET  /medical-records/me                   GET /medical-records/me/stats
GET  /medical-records/me/lab-results?test=&months=
GET  /medical-records/:id
GET  /medical-records/:id/lab-results
GET  /medical-records/:id/imaging-findings
GET  /medical-records/:id/prescription-items
GET  /medical-records/:id/vaccination-doses
GET  /medicines/me                         GET /medicines/me/stats?days=
GET  /medicines/today                      GET /medicines/refill-due
GET  /medicines/me/interactions
POST /medicines                            POST /medicines/:id/stop
GET  /patient-messages/conversations
GET  /patient-messages/conversations/:id/messages
POST /patient-messages/conversations/:id/messages
GET  /chat/sessions                        POST /chat/sessions
POST /chat/sessions/:id/messages/stream
GET  /notifications/me                     GET /notifications/unread-count
PUT  /notifications/:id/read               PUT /notifications/read-all
GET  /allergies/me                         POST, PATCH, DELETE
GET  /vaccinations/me                      GET /vaccinations/me/due
GET  /files/record/:recordId               GET /files/download/:key
GET  /imaging/studies                      GET /imaging/studies/:studyUid
GET  /share/links                          POST /share/links
GET  /me/health-id
```

## 8. Backend change

`GET /appointments/me` (`apps/api/src/routes/appointments.ts:442`) returns raw
`appointments` rows, which carry `doctorId` and `hospitalId` but no names. The
upcoming-appointment card cannot render "doctor and hospital" from that.

Change: left-join `doctors` to `users` and left-join `hospitals`, then append
`doctorName`, `doctorSpecialization`, and `hospitalName` to each row. This is purely
additive — every existing key keeps its name and type, so the mobile app and any
other consumer are unaffected. Roughly fifteen lines plus a test asserting both the
new fields and the preservation of the existing shape.

No other backend or schema change is in scope.

## 9. Data-integrity rules

1. No mock, seed, or placeholder values ship in application code. Fixtures exist only
   inside test files.
2. A widget with no data renders a designed empty state with a call to action, never a
   zero, a dash, or an invented value.
3. Status language ("Excellent", "Normal", "High") is only ever rendered from a real
   classification returned by `GET /vitals/me/alerts` or from a `flag` column on a lab
   result. It is never inferred in the UI.
4. Development data comes from a seed script under `apps/api/scripts/` that populates
   a test patient against a local D1 instance. It is not imported by application code.

## 10. Errors and loading

Each widget owns its own query, so a single failing endpoint degrades one card rather
than the page. Every widget implements three states: a shape-matched skeleton (not a
grey rectangle), the populated state, and the empty state. A failed query renders an
inline retry inside the card.

Query keys are namespaced `["patient", domain, ...params]` with `staleTime` of 60
seconds and `retry: 1`. Token refresh, the 401 retry, and the bounce to login are
already handled inside `@/portal/lib/api` and are not reimplemented.

## 11. Testing

Vitest with Testing Library is already configured (`bun run test` in
`apps/marketing`). Tests to write:

- The `(app)` layout redirects an unauthenticated visitor to `/patient/login?next=`
  and a non-patient role to `/patient/403`.
- `/vitals/me/series` responses map correctly onto chart series, including the
  blood-pressure case where `secondary` carries the diastolic value.
- Empty states render their call to action and emit no numeric content.
- A `BodyFigure` hotspot with no data renders the muted no-data state and never a
  status word.
- Adherence arithmetic from `todayTaken` and `todayCount`, including the divide-by-zero
  case when nothing is scheduled.
- Each old `/portal/me/*` route redirects to its `/patient/*` counterpart.
- The `appointments.ts` join returns the new name fields while preserving every
  pre-existing key.

## 12. Out of scope

- Any change to the doctor, hospital, admin, lab-portal or insurance-operator surfaces
  beyond the redirect stubs and the one login destination string.
- Authentication, session, or RBAC changes.
- The pre-existing defect at `apps/api/src/routes/timeline.ts:190-197`, where
  appointment events read `a.scheduledAt`, `a.type`, `a.location` and `a.providerName`
  — none of which exist on the `appointments` schema — so those events fall back to
  `createdAt` with a null subtitle. Documented here, deliberately not fixed.
- New AI capabilities. The Assistant card and Messages tab surface the existing
  `/chat` endpoints only.
- Mobile app changes.
