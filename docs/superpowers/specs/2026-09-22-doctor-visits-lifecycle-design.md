# Doctor Visits Lifecycle — Design

**Date:** 2026-09-22
**Surfaces:** Mobile patient app (`apps/mobile`), web patient portal (`apps/marketing`), API (`apps/api`), shared (`packages/shared`)

## Problem

Doctor visits (appointments) misreport their state:

1. **Old sessions show as "Coming up".** Every patient surface compares `a.date >= today` (date-only) and ignores `a.time`. A 09:00 visit stays "upcoming" all day. The server's `autoExpireAppointments` (15-min grace → `no_show`) is lazy — it only runs when someone reads `/appointments/me` or the doctor list — so stale `scheduled`/`confirmed` rows persist indefinitely.
2. **Timezone incoherence.** Server hardcodes `+05:30`, web list uses UTC (`toISOString`), web widgets use browser-local, mobile uses device-local. Near midnight, surfaces disagree on "today".
3. **"Patient didn't attend" is not first-class.** `no_show` exists but is conflated with `cancelled` in one "Past & Missed" bucket; auto-expiry writes no status-history row; there is no distinct Missed presentation or recovery CTA.
4. **Video consulting has dead ends.** Join CTAs link to `/patient/teleconsult/__pending__` / `roomId: "__pending__"` (fake URLs). DO hydration is fragile. Mobile join deep-links can open an empty WebView. Ghost `"pending"` status used in mobile CTAs (not a valid enum value).

## Decisions (confirmed with user)

- Surfaces: **mobile app + web patient portal** (patient-facing).
- No-show depth: **correct status + distinct Missed UI** (no new schema fields, no acknowledgement flow).
- Video: **lifecycle + Join CTA correctness AND repair of broken video plumbing** per `docs/superpowers/plans/2026-09-15-video-consulting.md` (fail closed — no fake URLs).
- Timezone: **Asia/Colombo (UTC+5:30) everywhere** for upcoming/past decisions.

## Approach

Shared lifecycle module + server-derived fields + reliable expiry + bucket-driven UI + fail-closed video CTAs.

---

## 1. Core lifecycle model

### 1.1 New shared module — `packages/shared/src/visit-lifecycle.ts`

Single source of truth. Pure functions, no I/O. All times computed in **Asia/Colombo (UTC+5:30)**, matching the existing server convention (`apps/api/src/lib/booking.ts` parses `` `${date}T${time}:00+05:30` ``).

Inputs: `date` (`YYYY-MM-DD`), `time` (`HH:MM`), `status` (appointment status), `now` (epoch ms, injectable for tests).

Outputs (exported type `VisitLifecycle`):

| Field | Meaning |
|---|---|
| `startsAt` | epoch ms of visit start |
| `isPast` | `now > startsAt + 15min` (same grace as `autoExpireAppointments`) |
| `isLive` | `startsAt − 10min ≤ now ≤ startsAt + 30min` AND status ∈ `scheduled \| confirmed \| in_progress` (video join window) |
| `bucket` | `upcoming \| today \| completed \| missed \| cancelled` |

Bucket rules (mutually exclusive, in order):

1. `status === "completed"` → `completed`
2. `status === "cancelled"` → `cancelled`
3. `status === "no_show"` → `missed`
4. `status ∈ {scheduled, confirmed}` AND `isPast` → `missed` (stale rows awaiting expiry — the "old sessions" case)
5. SL calendar day of `startsAt` is today → `today` (includes `in_progress` visits happening today)
6. `startsAt` is in the future → `upcoming`
7. otherwise → `missed` (elapsed `in_progress` anomaly; surfaced in Missed, status itself left to the doctor's flip)

Also export small helpers for UI grouping/labels: `slTodayIso()`, `slDayDiff(date)` (for "Today" / "in N days" headers), `countdownDays(startsAt)`.

### 1.2 Server — derived fields on `GET /appointments/me`

`AppointmentRow` (`packages/shared/src/contracts/types.ts`) gains: `startsAt: number`, `isPast: boolean`, `isLive: boolean`, `bucket: "upcoming" | "today" | "completed" | "missed" | "cancelled"`. Computed with the shared module at serialization time. Clients must render from these fields and stop comparing date strings.

### 1.3 Server — auto-expire hardened

`autoExpireAppointments` (`apps/api/src/lib/booking.ts`):

- Keep the 15-minute grace and `+05:30` parsing (re-pointed at the shared module).
- On transition `scheduled|confirmed → no_show`, insert an `appointmentStatusHistory` row (`fromStatus` → `toStatus: "no_show"`, actor `system`, note `auto_expired`) — same pattern as the manual flip in `doctor-portal.ts`.
- `in_progress` visits are NOT auto-expired (a started visit is owned by the doctor's status flip).

### 1.4 Server — no-show cron sweep

New `apps/api/src/cron/no-show-sweep.ts` + `no-show-sweep-router.ts` exposing `POST /__cron/no-show-sweep` (same `x-cron-secret` gate as `post-visit-summary-router.ts`). Runs `autoExpireAppointments(db)` unscoped. Wired into the existing single `*/5 * * * *` scheduled dispatcher in `apps/api/src/index.ts` on the **hourly** bucket (free plan allows 1 cron trigger only). This makes expiry reliable even if nobody opens the app.

---

## 2. Patient UI

### 2.1 Web — `apps/marketing`

- **`patient/(app)/appointments/page.tsx`** — replace the UTC date-string split and `isUpcoming` badge with `row.bucket` / `row.isLive`. Tabs: **Upcoming | Completed | Missed | Cancelled** (Missed separated from Cancelled). Tab↔bucket mapping: Upcoming = `upcoming` + `today`; Completed = `completed`; Missed = `missed`; Cancelled = `cancelled`. "All" view lists everything. Missed rows get a **"Book again"** link to `/patient/appointments/book?doctorId=…`. Rows show mode pill (Video / In-person).
- **`dashboard/UpcomingAppointment.tsx`** — pick the next visit with `bucket ∈ {upcoming, today}` ordered by `startsAt`. **Join Call** renders only when `mode === "video"` AND `row.isLive` AND the active teleconsult session's `appointmentId` matches; otherwise "Starts soon" chip (future/today) or nothing. Delete the `__pending__` URL. `CountdownChip` uses `startsAt`.
- **`HealthSummaryStrip.tsx` / `QuickActions.tsx`** — same bucket filter (remove duplicated date-only compares).

### 2.2 Mobile — `apps/mobile`

- **`app/(app)/appointments.tsx`** — `localTodayIso` date-only filters → `row.bucket`. Filter chips: All / Upcoming / Missed / Past. Chip↔bucket mapping: Upcoming = `upcoming` + `today`; Missed = `missed`; Past = `completed` + `cancelled`. Remove ghost `"pending"` from status lists. Pinned "Upcoming video consultations" only lists video rows that are `isLive` or `bucket === "today"` with an active session (quick-join), plain rows otherwise. Group headers ("Today", "in N days") via shared helpers.
- **`app/(app)/index.tsx`** — Home "Coming up" filters `bucket ∈ {upcoming, today}`; elapsed-today rows drop out.
- **`app/(app)/appointment-detail.tsx`** — remove the `__pending__` navigation. Join button only when the active session's `appointmentId` matches; when `mode === "video"` and `bucket === "today"` but no session → disabled "Waiting for doctor to start". Missed detail: distinct "Missed" pill + "Book again" CTA.
- **Status pills** — `no_show` renders as "Missed", visually distinct from Cancelled.

### 2.3 i18n (en / si / ta)

Add: `status_missed`, `filters.missed`, `bookAgain`, `waitingForDoctor`, `startsSoon`. Reuse existing `status_no_show` keys where the raw status must still be shown (e.g. history).

---

## 3. Video consulting plumbing

Source of truth for gaps: `docs/superpowers/plans/2026-09-15-video-consulting.md`. Global rules kept: one source of truth (`teleconsult_sessions`; `roomId` = DO instance name; `teleconsult_sessions.doctorId` = `users.id`); **never emit fake/dead meeting URLs; never silently swallow session-lifecycle errors.**

1. **Doctor identity (plan Task 1)** — already correct in `resolveParticipant` (`teleconsult.ts` compares `userId === session.doctorId`, both `users.id`). Add a **regression test** (`apps/api/tests/teleconsult-participant.test.ts`) locking 200-for-doctor (not 403) via `GET /teleconsult/sessions/:id`; do not rewrite the function.
2. **Dead `__pending__` URLs** — removed from web `UpcomingAppointment.tsx` and mobile `appointment-detail.tsx`. Join renders only against a real `roomId` from `GET /teleconsult/sessions/me/active`.
3. **DO hydration (plan Task 2)** — route stamps `X-Teleconsult-User-Id/Role/Session-Id/Appointment-Id/Doctor-Id/Patient-Id` headers on the WS upgrade and the `/close` poke; `teleconsult-room.ts` prefers headers, falls back to D1; room-full rejects **pre-upgrade** with `409` (never a fake `101`).
4. **Web patient join path** — `/patient/teleconsult/[roomId]` resolves via `GET /sessions/by-room/:roomId` + participant gate; failures render an explicit error state.
5. **Mobile deep-links** — `/(app)/teleconsult/[roomId]` resolves `roomId → session` via `/me/active` before opening the Whereby WebView (mirrors the doctor-mobile wrapper). Invalid/expired roomId → error screen with retry.
6. **Lifecycle integration** — `POST /teleconsult/sessions` rejects (409) when the appointment is not `scheduled|confirmed|in_progress` (a `no_show`/missed visit can never start a call). Ending a session does not auto-complete the appointment.

---

## 4. Error handling

- Fail closed on session lifecycle: no fake URLs, no empty catch blocks on create/start/end/join paths.
- Client-side: API errors surface as inline error/toast states (existing patterns in both apps).
- Cron errors: log and continue (existing cron style); one failing appointment must not abort the sweep.

## 5. Testing

**API (vitest + MockD1 harness in `apps/api/tests/`):**

- `visit-lifecycle` unit tests: grace-window boundary, SL-midnight boundary, stale `scheduled` → `missed`, `no_show` → `missed`, `isLive` window edges, missing/empty `time` fallback.
- `no-show-sweep`: marks elapsed `scheduled|confirmed` as `no_show` AND writes `appointment_status_history`; leaves `in_progress`/`completed`/`cancelled` alone.
- `teleconsult-participant` regression (doctor caller `doctors.id !== users.id` → 200).
- `POST /teleconsult/sessions` rejects non-active appointments (409).
- `GET /appointments/me` returns the new derived fields consistent with the shared module.

**Client:** bucket/tab/filter logic kept pure where practical; manual checklist for Join CTA states (live / waiting / hidden) on web + mobile, and Missed vs Cancelled presentation in en/si/ta.

## 6. Out of scope

- Doctor-portal queue UX (beyond the shared `autoExpireAppointments` improvement it already calls).
- No-show reason field / patient acknowledgement flow (explicitly descoped).
- SMS/push reminders (MVP-REVIEW backlog).
- One-click re-book flow beyond a plain "Book again" deep link.
- Payment/refund policy (MVP-FOR-PITCH C12).
