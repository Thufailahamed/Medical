# Doctor Visits Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make doctor visits report correct state everywhere — old sessions stop showing as "Coming up", missed (no-show) visits are first-class, and video consulting has no dead-end links.

**Architecture:** A pure shared module (`visit-lifecycle`) computes visit state in Asia/Colombo time; the API stamps derived fields (`startsAt`, `isPast`, `isLive`, `bucket`) onto `GET /appointments/me` rows and expires stale visits to `no_show` reliably (read-time + hourly cron, with status-history audit rows). Web and mobile render from those fields with bucket-driven tabs/filters, a distinct Missed presentation, and fail-closed video Join CTAs. Teleconsult backend gets header-stamped DO hydration and a real 409 on room-full.

**Tech Stack:** TypeScript, Hono/Cloudflare Workers + D1 + Durable Objects (API), Next.js + TanStack Query (web), Expo/React Native + React Query (mobile), Drizzle (schema), Vitest + MockD1 (tests), Bun workspaces.

## Global Constraints

- All upcoming/past/live decisions use **Asia/Colombo (UTC+5:30)** — parse `date`+`time` as `` `${date}T${time || "00:00"}:00+05:30` ``.
- Grace window: `isPast` ⇔ `now > startsAt + 15min` (matches existing `autoExpireAppointments`).
- Join window: `isLive` ⇔ `startsAt − 10min ≤ now ≤ startsAt + 30min` AND status ∈ `scheduled | confirmed | in_progress`.
- `bucket` values are exactly `upcoming | today | completed | missed | cancelled` (type `VisitBucket`).
- Bucket rules in order: `completed`→completed; `cancelled`→cancelled; `no_show`→missed; `scheduled|confirmed` AND isPast→missed; SL calendar day of `startsAt` is today→today; `now < startsAt`→upcoming; else→missed (elapsed `in_progress` anomaly).
- No new DB schema fields. `no_show` is the "patient didn't attend" state; UI copy calls it **"Missed"**.
- Fail closed on video: never emit `__pending__` or other fake meeting URLs; Join renders only against a real `roomId` from `GET /teleconsult/sessions/me/active`; no silent catches on session-lifecycle errors.
- `teleconsult_sessions.doctorId` stores `users.id`; `appointments.doctorId` stores `doctors.id`. Never compare across the two.
- No ghost `"pending"` status anywhere — valid statuses are `scheduled | confirmed | in_progress | completed | cancelled | no_show`.
- Test commands: API `bun run test <file>` (from `apps/api`); shared `bunx vitest run <file>` (from `packages/shared`); web `bun run test <file>` (from `apps/marketing`).
- Commit after every task with a `feat:`/`fix:` message (repo style).

---

### Task 1: Shared `visit-lifecycle` module

**Files:**
- Create: `packages/shared/src/visit-lifecycle.ts`
- Create: `packages/shared/src/visit-lifecycle.test.ts`
- Modify: `packages/shared/src/index.ts` (add export)
- Modify: `packages/shared/package.json` (add export path)

**Interfaces:**
- Consumes: nothing (pure module)
- Produces (used by Tasks 2–10):
  - `type VisitBucket = "upcoming" | "today" | "completed" | "missed" | "cancelled"`
  - `interface VisitLifecycle { startsAt: number; isPast: boolean; isLive: boolean; bucket: VisitBucket }`
  - `computeVisitLifecycle(input: { date: string; time?: string | null; status: string; now?: number }): VisitLifecycle`
  - `visitStartsAt(date: string, time?: string | null): number`
  - `slTodayIso(now?: number): string`
  - `slDayDiff(date: string, now?: number): number`
  - `countdownDays(startsAt: number, now?: number): number`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/visit-lifecycle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeVisitLifecycle,
  visitStartsAt,
  slTodayIso,
  slDayDiff,
  countdownDays,
} from "./visit-lifecycle";

// Reference "now": 2026-09-22 15:00 SL time = 09:30 UTC.
const NOW = new Date("2026-09-22T09:30:00Z").getTime();

describe("visitStartsAt", () => {
  it("parses date+time as Asia/Colombo", () => {
    expect(visitStartsAt("2026-09-22", "15:00")).toBe(NOW);
  });
  it("falls back to 00:00 when time is missing", () => {
    const midday = new Date("2026-09-22T06:30:00Z").getTime(); // 12:00 SL
    expect(visitStartsAt("2026-09-22", null)).toBe(
      new Date("2026-09-21T18:30:00Z").getTime() // 2026-09-22T00:00+05:30
    );
    expect(midday).toBeGreaterThan(visitStartsAt("2026-09-22", null));
  });
});

describe("computeVisitLifecycle — buckets", () => {
  it("status completed wins", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "completed", now: NOW }).bucket
    ).toBe("completed");
  });
  it("status cancelled wins", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "cancelled", now: NOW }).bucket
    ).toBe("cancelled");
  });
  it("no_show maps to missed", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "no_show", now: NOW }).bucket
    ).toBe("missed");
  });
  it("stale scheduled (past grace) is missed — the old-sessions bug", () => {
    const lc = computeVisitLifecycle({
      date: "2026-09-22", time: "09:00", status: "scheduled", now: NOW,
    });
    expect(lc.isPast).toBe(true);
    expect(lc.bucket).toBe("missed");
  });
  it("confirmed within grace window is still today (not missed)", () => {
    const lc = computeVisitLifecycle({
      date: "2026-09-22", time: "14:50", status: "confirmed", now: NOW,
    });
    expect(lc.isPast).toBe(false);
    expect(lc.bucket).toBe("today");
  });
  it("later today is today", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "18:00", status: "scheduled", now: NOW }).bucket
    ).toBe("today");
  });
  it("future day is upcoming", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-25", time: "10:00", status: "confirmed", now: NOW }).bucket
    ).toBe("upcoming");
  });
  it("elapsed in_progress anomaly surfaces as missed", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-21", time: "10:00", status: "in_progress", now: NOW }).bucket
    ).toBe("missed");
  });
});

describe("computeVisitLifecycle — isLive", () => {
  it("true 5 min before start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:05", status: "confirmed", now: NOW }).isLive
    ).toBe(true);
  });
  it("true 20 min after start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "14:40", status: "in_progress", now: NOW }).isLive
    ).toBe(true);
  });
  it("false 2h before start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "17:00", status: "confirmed", now: NOW }).isLive
    ).toBe(false);
  });
  it("false 45 min after start", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "14:15", status: "confirmed", now: NOW }).isLive
    ).toBe(false);
  });
  it("false for completed even inside window", () => {
    expect(
      computeVisitLifecycle({ date: "2026-09-22", time: "15:00", status: "completed", now: NOW }).isLive
    ).toBe(false);
  });
});

describe("SL calendar helpers", () => {
  it("slTodayIso uses Asia/Colombo even near UTC midnight", () => {
    // 2026-09-22T19:00Z = 2026-09-23 00:30 SL
    expect(slTodayIso(new Date("2026-09-22T19:00:00Z").getTime())).toBe("2026-09-23");
  });
  it("slDayDiff: yesterday −1, today 0, tomorrow +1", () => {
    expect(slDayDiff("2026-09-21", NOW)).toBe(-1);
    expect(slDayDiff("2026-09-22", NOW)).toBe(0);
    expect(slDayDiff("2026-09-23", NOW)).toBe(1);
  });
  it("countdownDays rounds up and never goes negative", () => {
    expect(countdownDays(NOW + 86_400_000, NOW)).toBe(1);
    expect(countdownDays(NOW - 86_400_000, NOW)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/visit-lifecycle.test.ts` (from `packages/shared`)
Expected: FAIL — `Failed to resolve import "./visit-lifecycle"`

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/visit-lifecycle.ts`:

```ts
/**
 * Visit lifecycle — single source of truth for "is this doctor visit
 * upcoming / today / missed / …". Pure functions, no I/O.
 *
 * All calendar math is Asia/Colombo (UTC+5:30) to match how the API
 * parses appointment date+time (`${date}T${time}:00+05:30`).
 */

export type VisitBucket =
  | "upcoming"
  | "today"
  | "completed"
  | "missed"
  | "cancelled";

export interface VisitLifecycle {
  /** Epoch ms of the visit start. */
  startsAt: number;
  /** Past the 15-minute post-start grace window. */
  isPast: boolean;
  /** Inside the video join window (start−10min … start+30min). */
  isLive: boolean;
  bucket: VisitBucket;
}

export interface VisitLifecycleInput {
  /** YYYY-MM-DD (Sri Lanka calendar day). */
  date: string;
  /** HH:MM (optional; falls back to 00:00). */
  time?: string | null;
  /** Appointment status enum value. */
  status: string;
  /** Epoch ms override for tests. */
  now?: number;
}

const GRACE_MS = 15 * 60 * 1000;
const JOIN_OPEN_MS = 10 * 60 * 1000;
const JOIN_CLOSE_MS = 30 * 60 * 1000;

/** Parse an appointment's date+time as Asia/Colombo epoch ms. */
export function visitStartsAt(date: string, time?: string | null): number {
  const iso = `${date}T${time || "00:00"}:00+05:30`;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function computeVisitLifecycle(
  input: VisitLifecycleInput
): VisitLifecycle {
  const now = input.now ?? Date.now();
  const startsAt = visitStartsAt(input.date, input.time);
  const isPast = now > startsAt + GRACE_MS;
  const status = input.status;
  const isActiveStatus =
    status === "scheduled" || status === "confirmed" || status === "in_progress";
  const isLive =
    isActiveStatus &&
    now >= startsAt - JOIN_OPEN_MS &&
    now <= startsAt + JOIN_CLOSE_MS;

  let bucket: VisitBucket;
  if (status === "completed") {
    bucket = "completed";
  } else if (status === "cancelled") {
    bucket = "cancelled";
  } else if (status === "no_show") {
    bucket = "missed";
  } else if ((status === "scheduled" || status === "confirmed") && isPast) {
    bucket = "missed";
  } else if (slDayDiff(input.date, now) === 0) {
    bucket = "today";
  } else if (now < startsAt) {
    bucket = "upcoming";
  } else {
    bucket = "missed";
  }

  return { startsAt, isPast, isLive, bucket };
}

const slDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Asia/Colombo, as YYYY-MM-DD. */
export function slTodayIso(now: number = Date.now()): string {
  return slDateFormatter.format(new Date(now));
}

/** Whole SL calendar days from today to `date` (negative = past). */
export function slDayDiff(date: string, now: number = Date.now()): number {
  const a = Date.parse(`${slTodayIso(now)}T00:00:00Z`);
  const b = Date.parse(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Days until the visit starts (for countdown chips); 0 when past. */
export function countdownDays(startsAt: number, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((startsAt - now) / 86_400_000));
}
```

- [ ] **Step 4: Wire exports**

In `packages/shared/src/index.ts` add:

```ts
export * from "./visit-lifecycle";
```

In `packages/shared/package.json` `"exports"`, add:

```json
"./visit-lifecycle": "./src/visit-lifecycle.ts"
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bunx vitest run src/visit-lifecycle.test.ts` (from `packages/shared`)
Expected: PASS (all cases)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/visit-lifecycle.ts packages/shared/src/visit-lifecycle.test.ts packages/shared/src/index.ts packages/shared/package.json
git commit -m "feat(shared): add visit-lifecycle module for SL-time visit buckets"
```

---

### Task 2: Derived lifecycle fields on `GET /appointments/me`

**Files:**
- Modify: `packages/shared/src/contracts/types.ts:201-225` (`AppointmentRow`)
- Modify: `apps/api/src/routes/appointments.ts:456-469` (`GET /me` handler)
- Create: `apps/api/tests/appointments-lifecycle-fields.test.ts`

**Interfaces:**
- Consumes: `computeVisitLifecycle` from `@healthcare/shared/visit-lifecycle` (Task 1)
- Produces: `AppointmentRow` gains required fields `startsAt: number`, `isPast: boolean`, `isLive: boolean`, `bucket: VisitBucket` — Tasks 6–9 render from these.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/appointments-lifecycle-fields.test.ts`:

```ts
// tests/appointments-lifecycle-fields.test.ts
//
// GET /appointments/me must stamp derived lifecycle fields (startsAt,
// isPast, isLive, bucket) so clients stop doing their own date-string
// math (the "old sessions show as Coming up" bug).

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, getJson } from "./_testApp";
import appointmentsRouter from "../src/routes/appointments";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-lc";
const PATIENT_ID = "patient-lc";

let db: MockD1;
let app: Hono<AppEnvironment>;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Lex", email: "l@test.local" },
    { id: "user-doc-lc", role: "doctor", name: "Dr. L", email: "dl@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [{ id: "doctor-lc", userId: "user-doc-lc" }]);
  db.seed("hospitals", [{ id: "hosp-lc", name: "Test Hospital" }]);

  // Far-future rows so autoExpireAppointments (15-min grace) leaves them alone.
  db.seed("appointments", [
    {
      id: "apt-future",
      patientId: PATIENT_ID,
      doctorId: "doctor-lc",
      hospitalId: "hosp-lc",
      date: "2027-01-10",
      time: "10:00",
      status: "confirmed",
      mode: "in_person",
    },
    {
      id: "apt-done",
      patientId: PATIENT_ID,
      doctorId: "doctor-lc",
      hospitalId: "hosp-lc",
      date: "2027-01-05",
      time: "09:00",
      status: "completed",
      mode: "video",
    },
  ]);

  app = await buildTestApp(db, { id: PATIENT_USER, role: "patient" });
  app.route("/appointments", appointmentsRouter);
});

describe("GET /appointments/me — lifecycle fields", () => {
  it("stamps startsAt/isPast/isLive/bucket on every row", async () => {
    db.setWhere("patients", (r: any) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r: any) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    const future = body.appointments.find((a: any) => a.id === "apt-future");
    expect(typeof future.startsAt).toBe("number");
    expect(future.startsAt).toBe(
      new Date("2027-01-10T10:00:00+05:30").getTime()
    );
    expect(future.isPast).toBe(false);
    expect(future.isLive).toBe(false);
    expect(future.bucket).toBe("upcoming");

    const done = body.appointments.find((a: any) => a.id === "apt-done");
    expect(done.bucket).toBe("completed");
    expect(done.isLive).toBe(false);
  });

  it("keeps every pre-existing key intact", async () => {
    db.setWhere("patients", (r: any) => r.userId === PATIENT_USER);
    db.setWhere("appointments", (r: any) => r.patientId === PATIENT_ID);

    const res = await getJson(app, "/appointments/me");
    const row = ((await res.json()) as any).appointments[0];
    expect(row.id).toBeTruthy();
    expect(row.date).toBeTruthy();
    expect(row.status).toBeTruthy();
    expect(typeof row.recordCount).toBe("number");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/appointments-lifecycle-fields.test.ts` (from `apps/api`)
Expected: FAIL — `future.startsAt` is `undefined`

- [ ] **Step 3: Extend the contract type**

In `packages/shared/src/contracts/types.ts`, update `AppointmentRow` (import first):

```ts
import type { VisitBucket } from "../visit-lifecycle";
```

then add these fields to the interface (after `hospitalName`):

```ts
  /** Derived (server) — Asia/Colombo epoch ms of visit start. */
  startsAt: number;
  /** Derived (server) — past the 15-minute grace window. */
  isPast: boolean;
  /** Derived (server) — inside the video join window. */
  isLive: boolean;
  /** Derived (server) — upcoming | today | completed | missed | cancelled. */
  bucket: VisitBucket;
```

- [ ] **Step 4: Stamp fields in the API**

In `apps/api/src/routes/appointments.ts` add import:

```ts
import { computeVisitLifecycle } from "@healthcare/shared/visit-lifecycle";
```

In the `GET /me` handler, replace the return with:

```ts
  const enriched = await enrichAppointmentsWithNames(db, upcoming);
  const now = Date.now();
  const appointmentsOut = enriched.map((r: any) => {
    const lc = computeVisitLifecycle({
      date: r.date,
      time: r.time,
      status: r.status,
      now,
    });
    return {
      ...r,
      startsAt: lc.startsAt,
      isPast: lc.isPast,
      isLive: lc.isLive,
      bucket: lc.bucket,
    };
  });

  return c.json({ appointments: appointmentsOut });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test tests/appointments-lifecycle-fields.test.ts tests/appointments-me-join.test.ts` (from `apps/api`)
Expected: PASS (new + existing join test still green)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/contracts/types.ts apps/api/src/routes/appointments.ts apps/api/tests/appointments-lifecycle-fields.test.ts
git commit -m "feat(api): stamp visit lifecycle fields on GET /appointments/me"
```

---

### Task 3: Harden `autoExpireAppointments` (history + race safety)

**Files:**
- Modify: `apps/api/src/lib/booking.ts:74-115` (`autoExpireAppointments`)
- Create: `apps/api/tests/auto-expire-history.test.ts`

**Interfaces:**
- Consumes: `visitStartsAt` from `@healthcare/shared/visit-lifecycle`; `withStatusGuard` from `../lib/status-guard`; `appointmentStatusHistory` from `@healthcare/db`
- Produces: `autoExpireAppointments(db: any, patientId?: string, doctorId?: string): Promise<number>` — now returns the number of visits expired (Task 4 reports it). Existing callers may ignore the return value.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/auto-expire-history.test.ts`:

```ts
// tests/auto-expire-history.test.ts
//
// auto-expire to no_show must (a) write an appointment_status_history
// audit row (was: silent status flip), (b) return the expired count,
// (c) leave in_progress/completed/cancelled rows alone.

import { describe, it, expect, beforeEach } from "vitest";
import { MockD1 } from "./_mockDb";
import { autoExpireAppointments } from "../src/lib/booking";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  // 2 days ago — well past the 15-minute grace window.
  db.seed("appointments", [
    { id: "apt-old-sched", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "10:00", status: "scheduled" },
    { id: "apt-old-conf", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "11:00", status: "confirmed" },
    { id: "apt-old-prog", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "12:00", status: "in_progress" },
    { id: "apt-old-done", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "13:00", status: "completed" },
    { id: "apt-old-canc", patientId: "p1", doctorId: "d1", date: "2026-09-20", time: "14:00", status: "cancelled" },
  ]);
  db.seed("appointmentStatusHistory", []);
});

describe("autoExpireAppointments", () => {
  it("expires stale scheduled/confirmed rows and writes history", async () => {
    const expired = await autoExpireAppointments(db, "p1");
    expect(expired).toBe(2);

    const rows = db.tables["appointments"].rows;
    expect(rows.find((r) => r.id === "apt-old-sched").status).toBe("no_show");
    expect(rows.find((r) => r.id === "apt-old-conf").status).toBe("no_show");

    const hist = db.tables["appointmentStatusHistory"].rows;
    expect(hist.length).toBe(2);
    for (const h of hist) {
      expect(h.toStatus).toBe("no_show");
      expect(h.fromStatus === "scheduled" || h.fromStatus === "confirmed").toBe(true);
      expect(h.reason).toBe("auto_expired");
    }
  });

  it("leaves in_progress, completed and cancelled rows alone", async () => {
    await autoExpireAppointments(db, "p1");
    const rows = db.tables["appointments"].rows;
    expect(rows.find((r) => r.id === "apt-old-prog").status).toBe("in_progress");
    expect(rows.find((r) => r.id === "apt-old-done").status).toBe("completed");
    expect(rows.find((r) => r.id === "apt-old-canc").status).toBe("cancelled");
    const hist = db.tables["appointmentStatusHistory"].rows;
    expect(hist.find((h) => h.appointmentId === "apt-old-prog")).toBeUndefined();
  });

  it("returns 0 and writes nothing when everything is fresh", async () => {
    db.seed("appointments", [
      { id: "apt-fresh", patientId: "p1", doctorId: "d1", date: "2099-01-01", time: "10:00", status: "confirmed" },
    ]);
    const expired = await autoExpireAppointments(db, "p1");
    expect(expired).toBe(0);
    expect(db.tables["appointmentStatusHistory"].rows.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/auto-expire-history.test.ts` (from `apps/api`)
Expected: FAIL — `expired` is `undefined` (function returns void today)

- [ ] **Step 3: Rewrite `autoExpireAppointments`**

In `apps/api/src/lib/booking.ts`, update imports and the function body:

```ts
import { and, asc, eq, inArray } from "drizzle-orm";
import { appointments, appointmentStatusHistory } from "@healthcare/db";
import { visitStartsAt } from "@healthcare/shared/visit-lifecycle";
import { withStatusGuard } from "./status-guard";
```

```ts
/**
 * Auto-expire (mark as no_show) any scheduled/confirmed appointments
 * that have passed their start time by more than 15 minutes.
 * Writes an appointment_status_history audit row per transition.
 * Returns the number of appointments expired.
 */
export async function autoExpireAppointments(
  db: any,
  patientId?: string,
  doctorId?: string
): Promise<number> {
  let expired = 0;
  try {
    const now = Date.now();
    const conditions = [];
    if (patientId) {
      conditions.push(eq(appointments.patientId, patientId));
    }
    if (doctorId) {
      conditions.push(eq(appointments.doctorId, doctorId));
    }

    const pendingAppts = await db
      .select()
      .from(appointments)
      .where(
        and(
          ...conditions,
          inArray(appointments.status, ["scheduled", "confirmed"])
        )
      );

    for (const appt of pendingAppts) {
      const apptTime = visitStartsAt(appt.date, appt.time);

      // If 15 mins buffer time has passed
      if (now - apptTime > 15 * 60 * 1000) {
        const { changed } = await withStatusGuard(
          db,
          appointments,
          appt.id,
          ["scheduled", "confirmed"],
          { status: "no_show" }
        );
        if (changed) {
          expired += 1;
          await db.insert(appointmentStatusHistory).values({
            appointmentId: appt.id,
            fromStatus: appt.status,
            toStatus: "no_show",
            changedByUserId: null,
            reason: "auto_expired",
          } as any);
        }
      }
    }
  } catch (err) {
    console.error("autoExpireAppointments failed:", err);
  }
  return expired;
}
```

(Keep `compactQueue` and `slotCount` unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test tests/auto-expire-history.test.ts tests/appointments-lifecycle-fields.test.ts tests/appointments-me-join.test.ts` (from `apps/api`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/booking.ts apps/api/tests/auto-expire-history.test.ts
git commit -m "feat(api): audit no-show auto-expiry and return expired count"
```

---

### Task 4: No-show cron sweep

**Files:**
- Create: `apps/api/src/cron/no-show-sweep.ts`
- Create: `apps/api/src/cron/no-show-sweep-router.ts`
- Modify: `apps/api/src/index.ts` (import, mount, scheduled wiring — imports near lines 69–81, mount near lines 417–418, scheduled hourly bucket near lines 463–466)
- Create: `apps/api/tests/no-show-sweep.test.ts`

**Interfaces:**
- Consumes: `autoExpireAppointments(db): Promise<number>` (Task 3); cron-router secret-gate pattern from `apps/api/src/cron/post-visit-summary-router.ts`
- Produces: `runNoShowSweep(db: any): Promise<{ expired: number }>`; `POST /__cron/no-show-sweep` route.

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/no-show-sweep.test.ts`:

```ts
// tests/no-show-sweep.test.ts
//
// The sweep must expire stale visits even when nobody opens
// /appointments/me — the reliability half of the "old sessions show
// as Coming up" fix.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson } from "./_testApp";
import { noShowSweepRouter } from "../src/cron/no-show-sweep-router";
import { runNoShowSweep } from "../src/cron/no-show-sweep";
import type { AppEnvironment } from "../src/types";

let db: MockD1;

beforeEach(() => {
  db = new MockD1();
  db.seed("appointments", [
    { id: "apt-stale", patientId: "p1", doctorId: "d1", date: "2026-09-01", time: "10:00", status: "confirmed" },
    { id: "apt-future", patientId: "p2", doctorId: "d1", date: "2099-01-01", time: "10:00", status: "scheduled" },
  ]);
  db.seed("appointmentStatusHistory", []);
});

describe("runNoShowSweep", () => {
  it("expires stale rows across all patients and reports the count", async () => {
    const result = await runNoShowSweep(db);
    expect(result).toEqual({ expired: 1 });
    const rows = db.tables["appointments"].rows;
    expect(rows.find((r) => r.id === "apt-stale").status).toBe("no_show");
    expect(rows.find((r) => r.id === "apt-future").status).toBe("scheduled");
    expect(db.tables["appointmentStatusHistory"].rows.length).toBe(1);
  });
});

describe("POST /__cron/no-show-sweep", () => {
  it("runs the sweep and returns { ok, expired }", async () => {
    const app = await buildTestApp(db);
    app.route("/", noShowSweepRouter);
    const res = await postJson(app, "/__cron/no-show-sweep", {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.expired).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test tests/no-show-sweep.test.ts` (from `apps/api`)
Expected: FAIL — cannot resolve `../src/cron/no-show-sweep`

- [ ] **Step 3: Implement sweep + router**

Create `apps/api/src/cron/no-show-sweep.ts`:

```ts
// ─── No-show sweep (doctor-visits lifecycle) ─────────────
//
// Expires stale scheduled/confirmed appointments to no_show across
// ALL patients/doctors. Runs hourly via the shared */5 cron trigger
// (see index.ts scheduled()) so old sessions stop appearing as
// "Coming up" even when nobody opens the app.

import { autoExpireAppointments } from "../lib/booking";

export async function runNoShowSweep(
  db: any
): Promise<{ expired: number }> {
  const expired = await autoExpireAppointments(db);
  return { expired };
}
```

Create `apps/api/src/cron/no-show-sweep-router.ts` (copy the secret-gate pattern verbatim from `post-visit-summary-router.ts`):

```ts
// ─── No-show sweep cron handler ──────────────────────────
//
// Wraps `runNoShowSweep` so Wrangler can call it via the scheduled
// trigger AND it can be invoked manually via HTTP for integration
// tests. Manual invocation requires `x-cron-secret` to match
// `env.CRON_SECRET` (skipped in dev).

import { Hono } from "hono";
import { runNoShowSweep } from "./no-show-sweep";
import type { AppEnvironment } from "../types";

export const noShowSweepRouter = new Hono<AppEnvironment>();

noShowSweepRouter.post("/__cron/no-show-sweep", async (c) => {
  const cronSecret = c.env.CRON_SECRET || "";
  const isDev = c.env.ENVIRONMENT !== "production" || c.env.DEV_MODE === "true";
  if (!isDev) {
    const provided = c.req.header("x-cron-secret") || "";
    if (!cronSecret || provided !== cronSecret) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const db = c.get("db");
  const result = await runNoShowSweep(db);
  return c.json({ ok: true, ...result });
});
```

- [ ] **Step 4: Wire into `apps/api/src/index.ts`**

Next to the other cron imports (near `postVisitSummaryRouter`):

```ts
import { noShowSweepRouter } from "./cron/no-show-sweep-router";
```

Next to the other cron mounts (`app.route("/", postVisitSummaryRouter);`):

```ts
app.route("/", noShowSweepRouter);
```

In `scheduled()`, inside the hourly bucket (`if (utcMin >= 5 && utcMin < 10)`), add:

```ts
      paths.push("/__cron/no-show-sweep");
```

Also add to the comment block listing manual cron endpoints:

```ts
//   POST /__cron/no-show-sweep           with x-cron-secret header.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test tests/no-show-sweep.test.ts tests/auto-expire-history.test.ts` (from `apps/api`)
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/cron/no-show-sweep.ts apps/api/src/cron/no-show-sweep-router.ts apps/api/src/index.ts apps/api/tests/no-show-sweep.test.ts
git commit -m "feat(api): add hourly no-show sweep cron for stale appointments"
```

---

### Task 5: Teleconsult fail-closed plumbing (DO hydration + room-full 409 + create guard)

**Files:**
- Modify: `apps/api/src/routes/teleconsult.ts:225-242` (WS upgrade headers), `:667-673` (the `/close` poke)
- Modify: `apps/api/src/durable-objects/teleconsult-room.ts:93-150` (fetch hydration + room-full)
- Modify: `apps/api/tests/teleconsult-room.test.ts` (3rd-peer rejection expectation)
- Create: `apps/api/tests/teleconsult-create-guard.test.ts`

**Interfaces:**
- Consumes: session row shape `{ id, appointmentId, doctorId (= users.id), patientUserId, roomId }`; `resolveParticipant` (unchanged — already correct, regression-tested in `teleconsult-participant.test.ts`)
- Produces: DO instances hydrated from `X-Teleconsult-Session-Id` / `X-Teleconsult-Appointment-Id` / `X-Teleconsult-Doctor-Id` / `X-Teleconsult-Patient-Id` headers (D1 lookup remains fallback); room-full rejects pre-upgrade with HTTP `409`; `POST /teleconsult/sessions` returns `409` for appointments not in `scheduled|confirmed|in_progress` (already implemented — locked by test).

- [ ] **Step 1: Write the failing create-guard test**

Create `apps/api/tests/teleconsult-create-guard.test.ts`:

```ts
// tests/teleconsult-create-guard.test.ts
//
// A no_show / completed / cancelled appointment must never start a
// teleconsult session — the patient didn't attend or the visit is over.

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { MockD1 } from "./_mockDb";
import { buildTestApp, postJson } from "./_testApp";
import teleconsultRouter from "../src/routes/teleconsult";
import type { AppEnvironment } from "../src/types";

const PATIENT_USER = "user-patient-cg";
const PATIENT_ID = "patient-cg";
const DOCTOR_USER = "user-doctor-cg";
const DOCTOR_ID = "doctor-cg";

let db: MockD1;

beforeEach(async () => {
  db = new MockD1();
  db.seed("users", [
    { id: PATIENT_USER, role: "patient", name: "Pat", email: "p@test.local" },
    { id: DOCTOR_USER, role: "doctor", name: "Doc", email: "d@test.local" },
  ]);
  db.seed("patients", [{ id: PATIENT_ID, userId: PATIENT_USER }]);
  db.seed("doctors", [{ id: DOCTOR_ID, userId: DOCTOR_USER }]);
});

function doctorApp() {
  return buildTestApp(db, { id: DOCTOR_USER, role: "doctor" }).then((app) => {
    app.route("/teleconsult", teleconsultRouter);
    db.setWhere("doctors", (r) => r.userId === DOCTOR_USER);
    db.setWhere("appointments", () => true);
    return app;
  });
}

describe("POST /teleconsult/sessions — appointment status guard", () => {
  for (const status of ["no_show", "completed", "cancelled"]) {
    it(`rejects ${status} appointments with 409`, async () => {
      db.seed("appointments", [
        { id: `apt-${status}`, doctorId: DOCTOR_ID, patientId: PATIENT_ID, status, mode: "video", date: "2026-12-01", time: "10:00" },
      ]);
      const app = await doctorApp();
      const res = await postJson(app, "/teleconsult/sessions", {
        appointmentId: `apt-${status}`,
      });
      expect(res.status).toBe(409);
    });
  }

  it("rejects in_person appointments with 409 (not a video visit)", async () => {
    db.seed("appointments", [
      { id: "apt-ipp", doctorId: DOCTOR_ID, patientId: PATIENT_ID, status: "confirmed", mode: "in_person", date: "2026-12-01", time: "10:00" },
    ]);
    const app = await doctorApp();
    const res = await postJson(app, "/teleconsult/sessions", { appointmentId: "apt-ipp" });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run test — expect PASS (guard already implemented)**

Run: `bun run test tests/teleconsult-create-guard.test.ts` (from `apps/api`)
Expected: PASS (regression lock; if it fails, fix `POST /sessions` in `teleconsult.ts:277-285` to keep the `409` status guard and `409 appointment_not_video` mode guard)

- [ ] **Step 3: Write the failing room-full test**

In `apps/api/tests/teleconsult-room.test.ts`, find the test "3rd peer rejected (101 status, no accepted WS)" and change its expectation from `101` to `409`:

```ts
    expect(res.status).toBe(409);
```

Also add a header-hydration test (same file, new `describe`):

```ts
describe("TeleconsultRoom — header hydration", () => {
  it("hydrates session context from X-Teleconsult-* headers without D1", async () => {
    const state = new FakeState();
    const env: any = { DB: undefined }; // no D1 — headers must be enough
    const room = new TeleconsultRoom(state, env);

    const req = new Request("https://do/upgrade", {
      headers: {
        Upgrade: "websocket",
        "X-Teleconsult-User-Id": "user-a",
        "X-Teleconsult-Role": "doctor",
        "X-Teleconsult-Session-Id": "sess-h",
        "X-Teleconsult-Appointment-Id": "appt-h",
        "X-Teleconsult-Doctor-Id": "doc-user-h",
        "X-Teleconsult-Patient-Id": "pat-user-h",
      },
    });
    const res = await room.fetch(req);
    expect(res.status).toBe(101);
    expect((room as any).sessionId).toBe("sess-h");
    expect((room as any).appointmentId).toBe("appt-h");
    expect((room as any).doctorUserId).toBe("doc-user-h");
    expect((room as any).patientUserId).toBe("pat-user-h");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun run test tests/teleconsult-room.test.ts` (from `apps/api`)
Expected: FAIL — room-full still returns `101`; header hydration leaves `sessionId` null.

- [ ] **Step 5: Fix the DO**

In `apps/api/src/durable-objects/teleconsult-room.ts`:

(a) Replace the room-full `101` block with a real pre-upgrade rejection:

```ts
      return new Response("Room full", { status: 409 });
```

(b) In `fetch`, right after `await this.hydrated;`, prefer stamped headers over D1:

```ts
    // Header-stamped session context (set by the /teleconsult route
    // after participant verification) wins over cold-start D1 lookup.
    const h = (n: string) => request.headers.get(n);
    if (h("X-Teleconsult-Session-Id")) {
      this.sessionId = h("X-Teleconsult-Session-Id");
      this.appointmentId = h("X-Teleconsult-Appointment-Id");
      this.doctorUserId = h("X-Teleconsult-Doctor-Id");
      this.patientUserId = h("X-Teleconsult-Patient-Id");
    }
```

- [ ] **Step 6: Stamp headers at the route edges**

In `apps/api/src/routes/teleconsult.ts`:

(a) WS upgrade (`doReq` near line 234) — extend headers:

```ts
  const doReq = new Request(doUrl, {
    headers: {
      Upgrade: "websocket",
      "X-Teleconsult-User-Id": resolvedUserId,
      "X-Teleconsult-Role": participant.role,
      "X-Teleconsult-Session-Id": row.id,
      "X-Teleconsult-Appointment-Id": row.appointmentId,
      "X-Teleconsult-Doctor-Id": row.doctorId,
      "X-Teleconsult-Patient-Id": row.patientUserId,
    },
  });
```

(b) The `/close` poke in `POST /sessions/:id/end` — same context:

```ts
      await stub.fetch("https://do/close", {
        method: "POST",
        headers: {
          "X-Teleconsult-Session-Id": row.id,
          "X-Teleconsult-Appointment-Id": row.appointmentId,
          "X-Teleconsult-Doctor-Id": row.doctorId,
          "X-Teleconsult-Patient-Id": row.patientUserId,
        },
      });
```

- [ ] **Step 7: Run all teleconsult tests**

Run: `bun run test tests/teleconsult-room.test.ts tests/teleconsult.test.ts tests/teleconsult-participant.test.ts tests/teleconsult-create-guard.test.ts tests/teleconsult-push.test.ts` (from `apps/api`)
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/teleconsult.ts apps/api/src/durable-objects/teleconsult-room.ts apps/api/tests/teleconsult-room.test.ts apps/api/tests/teleconsult-create-guard.test.ts
git commit -m "fix(teleconsult): header-stamp DO hydration, 409 on room full, guard session create"
```

---

### Task 6: Web appointments page — buckets, Missed tab, fail-closed Join

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/appointments/page.tsx` (TabFilter ~line 26, filter useMemo ~lines 108–127, tab buttons ~lines 247–345, row rendering ~lines 435–560)
- Modify: `apps/marketing/src/app/patient/(app)/appointments/page.test.tsx`

**Interfaces:**
- Consumes: `AppointmentRow.bucket / .isPast / .isLive / .startsAt` (Task 2); `activeSession` polling already in the page (`teleconsultApi.getActiveForMe`)
- Produces: nothing downstream (leaf page).

- [ ] **Step 1: Write the failing tests**

Replace `apps/marketing/src/app/patient/(app)/appointments/page.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockRows: any[] = [
  {
    id: "a1", date: "2027-01-10", time: "10:00", status: "confirmed", mode: "in_person",
    doctorName: "Dr. Upcoming", doctorSpecialization: "Cardio", hospitalName: "Asiri",
    reason: null, notes: null, queueNumber: null, paymentStatus: null, recordCount: 0,
    startsAt: new Date("2027-01-10T10:00:00+05:30").getTime(),
    isPast: false, isLive: false, bucket: "upcoming",
  },
  {
    id: "a2", date: "2026-09-20", time: "09:00", status: "no_show", mode: "video",
    doctorName: "Dr. Missed", doctorSpecialization: "Derma", hospitalName: "Asiri",
    reason: null, notes: null, queueNumber: null, paymentStatus: null, recordCount: 0,
    startsAt: new Date("2026-09-20T09:00:00+05:30").getTime(),
    isPast: true, isLive: false, bucket: "missed",
  },
];

vi.mock("@/patient/hooks", () => ({
  useAppointments: () => ({
    data: { appointments: mockRows },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/portal/lib/api", () => ({
  teleconsultApi: { getActiveForMe: async () => ({ session: null }) },
}));

import AppointmentsPage from "./page";

describe("AppointmentsPage", () => {
  it("renders the page header", () => {
    render(<AppointmentsPage />);
    expect(screen.getByText(/Appointments/)).toBeTruthy();
  });

  it("shows a Missed tab separate from Cancelled", () => {
    render(<AppointmentsPage />);
    expect(screen.getByText(/Missed/)).toBeTruthy();
    expect(screen.getByText(/Cancelled/)).toBeTruthy();
  });

  it("puts no_show rows under Missed, not Upcoming", () => {
    render(<AppointmentsPage />);
    // Upcoming tab (default all) shows the upcoming doctor.
    expect(screen.getByText("Dr. Upcoming")).toBeTruthy();
    // The missed row is reachable and labelled Missed — never "upcoming".
    expect(screen.getAllByText("Dr. Missed").length).toBeGreaterThan(0);
  });

  it("never renders a __pending__ join link", () => {
    const { container } = render(<AppointmentsPage />);
    expect(container.innerHTML).not.toContain("__pending__");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/app/patient/\(app\)/appointments/page.test.tsx` (from `apps/marketing`)
Expected: FAIL — no "Missed"/"Cancelled" tabs; `__pending__` may be present.

- [ ] **Step 3: Implement bucket-driven page**

In `apps/marketing/src/app/patient/(app)/appointments/page.tsx`:

(a) Import the bucket type and change `TabFilter`:

```ts
import type { VisitBucket } from "@healthcare/shared/visit-lifecycle";

type TabFilter = "all" | VisitBucket;
```

(b) Replace the `today` + `useMemo` list-split block with bucket lists:

```ts
  const { upcomingList, completedList, missedList, cancelledList } = useMemo(() => {
    const sorted = [...rawAppointments].sort((a, b) =>
      (b.date + b.time).localeCompare(a.date + a.time)
    );
    const byBucket = (b: VisitBucket) => sorted.filter((a) => a.bucket === b);
    return {
      upcomingList: [...byBucket("today"), ...byBucket("upcoming")],
      completedList: byBucket("completed"),
      missedList: byBucket("missed"),
      cancelledList: byBucket("cancelled"),
    };
  }, [rawAppointments]);
```

(c) In `filteredAppointments`, map tabs to lists (`activeTab === "missed"` → `missedList`, `"cancelled"` → `cancelledList`, `"past"` branch removed). Update `useMemo` deps accordingly (`upcomingList, completedList, missedList, cancelledList`).

(d) Update `getStatusBadge`: change the `no_show` label from `"No Show"` to `"Missed"` (keep the rose styling).

(e) Tab buttons (both desktop + mobile variants): replace the `"past"` tab with `"missed"` and `"cancelled"` tabs, labeled `Missed ({missedList.length})` and `Cancelled ({cancelledList.length})`. Keep `All`, `Upcoming`, `Completed`.

(f) Row rendering: replace

```ts
              const isUpcoming = a.date >= today && a.status !== "cancelled" && a.status !== "no_show";
```

with

```ts
              const isUpcoming = a.bucket === "upcoming" || a.bucket === "today";
```

(g) Join Call link (currently interpolating `__pending__`): replace with fail-closed rendering:

```tsx
                      {isVideo && a.isLive && activeSession?.appointmentId === a.id ? (
                        <Link
                          href={`/patient/teleconsult/${activeSession.roomId}`}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1"
                          style={{
                            background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",
                          }}
                        >
                          <Video size={13} />
                          <span>Join Call</span>
                        </Link>
                      ) : isVideo && (a.bucket === "today" || a.isLive) ? (
                        <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200">
                          {a.isLive ? "Waiting for doctor" : "Starts soon"}
                        </span>
                      ) : null}
```

(h) "Book Again" CTA: show when `a.bucket === "missed" || a.bucket === "cancelled" || a.bucket === "completed"` (replace the `a.status === "no_show" || …` condition).

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/app/patient/\(app\)/appointments/page.test.tsx` (from `apps/marketing`)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/patient/\(app\)/appointments/page.tsx apps/marketing/src/app/patient/\(app\)/appointments/page.test.tsx
git commit -m "fix(web): bucket-driven appointments tabs with distinct Missed state"
```

---

### Task 7: Web dashboard widgets — next-up correctness + fail-closed Join

**Files:**
- Modify: `apps/marketing/src/patient/components/dashboard/UpcomingAppointment.tsx` (filter ~line 77, Join link ~lines 111–127, CountdownChip ~lines 16–33)
- Modify: `apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx` (~line 73)
- Modify: `apps/marketing/src/patient/components/dashboard/QuickActions.tsx` (~line 67)
- Create: `apps/marketing/src/patient/components/dashboard/UpcomingAppointment.test.tsx`

**Interfaces:**
- Consumes: `AppointmentRow` lifecycle fields (Task 2); `countdownDays` from `@healthcare/shared/visit-lifecycle` (Task 1)
- Produces: nothing downstream (leaf widgets).

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/patient/components/dashboard/UpcomingAppointment.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const rows = [
  {
    id: "past-today", date: "2026-09-22", time: "09:00", status: "scheduled", mode: "in_person",
    doctorName: "Dr. Elapsed", doctorSpecialization: null, hospitalName: null,
    startsAt: 0, isPast: true, isLive: false, bucket: "missed",
  },
  {
    id: "next", date: "2026-09-22", time: "18:00", status: "confirmed", mode: "video",
    doctorName: "Dr. Next", doctorSpecialization: null, hospitalName: null,
    startsAt: Date.now() + 3 * 3600_000, isPast: false, isLive: false, bucket: "today",
  },
];

vi.mock("@/patient/hooks", () => ({
  useAppointments: () => ({ data: { appointments: rows }, isLoading: false, isError: false }),
}));
vi.mock("@/portal/lib/api", () => ({
  teleconsultApi: { getActiveForMe: async () => ({ session: null }) },
}));

import { UpcomingAppointment } from "./UpcomingAppointment";

describe("UpcomingAppointment", () => {
  it("picks the bucket-based next visit, not the elapsed one", () => {
    render(<UpcomingAppointment />);
    expect(screen.getByText(/Dr. Next/)).toBeTruthy();
    expect(screen.queryByText(/Dr. Elapsed/)).toBeNull();
  });

  it("never links to __pending__ and hides Join without a live session", () => {
    const { container } = render(<UpcomingAppointment />);
    expect(container.innerHTML).not.toContain("__pending__");
    expect(screen.queryByTestId("join-call-link")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/patient/components/dashboard/UpcomingAppointment.test.tsx` (from `apps/marketing`)
Expected: FAIL — "Dr. Elapsed" may show as next; `__pending__` link present.

- [ ] **Step 3: Fix UpcomingAppointment.tsx**

(a) Imports:

```ts
import { countdownDays } from "@healthcare/shared/visit-lifecycle";
```

(b) `CountdownChip` — accept `startsAt: number` and compute:

```ts
function CountdownChip({ startsAt }: { startsAt: number }) {
  const days = countdownDays(startsAt);
  const label = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`;
  // ...keep existing markup/styles, use `label`
```

(c) Next-visit selection — replace the `new Date(a.date) >= …` filter:

```ts
          const next = (data.appointments ?? [])
            .filter((a) => a.bucket === "upcoming" || a.bucket === "today")
            .sort((a, b) => a.startsAt - b.startsAt)[0];
```

(d) Join link — replace the `__pending__` interpolation with fail-closed block:

```tsx
                {next.mode === "video" &&
                next.isLive &&
                activeSession?.appointmentId === next.id ? (
                  <Link
                    href={`/patient/teleconsult/${activeSession.roomId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-md transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-violet-600"
                    data-testid="join-call-link"
                  >
                    <Video size={13} />
                    Join Call
                  </Link>
                ) : next.mode === "video" && (next.bucket === "today" || next.isLive) ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-500"
                    data-testid="join-waiting-chip"
                  >
                    <Video size={13} />
                    {next.isLive ? "Waiting for doctor" : "Starts soon"}
                  </span>
                ) : null}
```

(e) Pass `startsAt={next.startsAt}` to `CountdownChip`.

- [ ] **Step 4: Fix HealthSummaryStrip.tsx and QuickActions.tsx**

In both files replace:

```ts
    .filter((a) => new Date(a.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]
```

with:

```ts
    .filter((a) => a.bucket === "upcoming" || a.bucket === "today")
    .sort((a, b) => a.startsAt - b.startsAt)[0]
```

In `HealthSummaryStrip.tsx`, replace the `visitDays` computation (`Math.ceil((new Date(next.date)…)`) with:

```ts
  const visitDays = next ? countdownDays(next.startsAt) : null;
```

(add `import { countdownDays } from "@healthcare/shared/visit-lifecycle";`).

In `QuickActions.tsx` the `formatDayLabel(next.date)` hint stays as-is (display only).

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test src/patient/components/dashboard/UpcomingAppointment.test.tsx src/app/patient/\(app\)/appointments/page.test.tsx` (from `apps/marketing`)
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/patient/components/dashboard/UpcomingAppointment.tsx apps/marketing/src/patient/components/dashboard/UpcomingAppointment.test.tsx apps/marketing/src/patient/components/dashboard/HealthSummaryStrip.tsx apps/marketing/src/patient/components/dashboard/QuickActions.tsx
git commit -m "fix(web): dashboard widgets pick next visit by bucket, fail-closed Join CTA"
```

---

### Task 8: Mobile appointments screen — buckets, filters, pinned video, i18n

**Files:**
- Modify: `apps/mobile/src/app/(app)/appointments.tsx` (STATUS_TONE ~lines 28–36, FILTER_VALUES ~line 38, groupKey ~lines 56–80, filters ~lines 136–184, filter chips ~lines 232–244, pinned video ~lines 296–330, card CTAs ~lines 501–575)
- Modify: `apps/mobile/src/i18n/locales/en.json`, `si.json`, `ta.json` (inside the `appointments` object, ~line 1944 in en)

**Interfaces:**
- Consumes: `AppointmentRow` lifecycle fields (Task 2); `slDayDiff` from `@healthcare/shared/visit-lifecycle` (Task 1)
- Produces: nothing downstream (leaf screen).

- [ ] **Step 1: Add i18n keys (all three locales)**

In `apps/mobile/src/i18n/locales/en.json`, inside `"appointments"` (next to `"filter"`), add/replace:

```json
    "filter": {
      "all": "All",
      "upcoming": "Upcoming",
      "missed": "Missed",
      "past": "Past"
    },
    "statusLabel": {
      "scheduled": "Scheduled",
      "confirmed": "Confirmed",
      "in_progress": "In progress",
      "completed": "Completed",
      "cancelled": "Cancelled",
      "no_show": "Missed"
    },
    "bookAgain": "Book again",
    "waitingForDoctor": "Waiting for doctor to start",
    "startsSoon": "Starts soon",
    "missedEmpty": {
      "title": "No missed visits",
      "body": "Visits you didn't attend will show here"
    },
```

In `si.json` (inside `"appointments"`):

```json
    "filter": {
      "all": "සියල්ල",
      "upcoming": "ඉදිරි",
      "missed": "මඟ හැරිණි",
      "past": "අතීත"
    },
    "statusLabel": {
      "scheduled": "ඇපවී ඇත",
      "confirmed": "තහවුරු කර ඇත",
      "in_progress": "සිදුවෙමින්",
      "completed": "සම්පූර්ණයි",
      "cancelled": "අවලංගුයි",
      "no_show": "මඟ හැරිණි"
    },
    "bookAgain": "නැවත වෙන් කරගන්න",
    "waitingForDoctor": "වෛද්‍යවරයා ආරම්භ කිරීමට රැඳී සිටී",
    "startsSoon": "ඉක්මනින් ආරම්භ වේ",
    "missedEmpty": {
      "title": "මඟ හැරුණු සංචාර නැත",
      "body": "ඔබ සහභාගී නොවූ සංචාර මෙහි දිස්වේ"
    },
```

In `ta.json` (inside `"appointments"`):

```json
    "filter": {
      "all": "அனைத்தும்",
      "upcoming": "வரவிருக்கும்",
      "missed": "தவறவிட்டவை",
      "past": "கடந்தவை"
    },
    "statusLabel": {
      "scheduled": "திட்டமிடப்பட்டது",
      "confirmed": "உறுதிப்படுத்தப்பட்டது",
      "in_progress": "நடைபெறுகிறது",
      "completed": "முடிந்தது",
      "cancelled": "ரத்து செய்யப்பட்டது",
      "no_show": "தவறவிட்டது"
    },
    "bookAgain": "மீண்டும் பதிவு செய்",
    "waitingForDoctor": "மருத்துவர் தொடங்கக் காத்திருக்கிறது",
    "startsSoon": "விரைவில் தொடங்கும்",
    "missedEmpty": {
      "title": "தவறவிட்ட வருகைகள் இல்லை",
      "body": "நீங்கள் கலந்துகொள்ளாத வருகைகள் இங்கே தோன்றும்"
    },
```

- [ ] **Step 2: Rework the screen logic**

In `apps/mobile/src/app/(app)/appointments.tsx`:

(a) Imports:

```ts
import { slDayDiff } from "@healthcare/shared/visit-lifecycle";
```

(b) `STATUS_TONE` — drop the ghost `pending` entry and give `no_show` its own tone (keep `danger` or use `"warning"`; label change is what matters):

```ts
const STATUS_TONE: Record<string, PillTone> = {
  confirmed: "success",
  scheduled: "primary",
  in_progress: "primary",
  completed: "info",
  cancelled: "neutral",
  no_show: "danger",
};
```

(c) `FILTER_VALUES`:

```ts
const FILTER_VALUES = ["all", "upcoming", "missed", "past"] as const;
```

(d) Replace `groupKey`'s `localTodayIso` math with `slDayDiff`:

```ts
function groupKey(t: (k: string) => string, a: any) {
  if (!a?.date) return t("appointments.groups.later");
  const diff = slDayDiff(a.date);
  if (diff === 0) return t("appointments.groups.today");
  if (diff < 0) {
    const d = new Date(a.date);
    return t("appointments.groups.pastMonth", {
      month: d.toLocaleString("en", { month: "short" }),
      year: d.getFullYear(),
      defaultValue: `${d.toLocaleString("en", { month: "long" })} ${d.getFullYear()}`,
    });
  }
  if (diff <= 7) return t("appointments.groups.week");
  return t("appointments.groups.later");
}
```

(e) Replace `localTodayIso` + `matchesDateFilter` + `upcomingVideo` + `upcomingCount` with bucket logic:

```ts
  const matchesDateFilter = (a: any) => {
    if (filter === "all") return true;
    if (filter === "missed") return a.bucket === "missed";
    if (filter === "upcoming") return a.bucket === "upcoming" || a.bucket === "today";
    return a.bucket === "completed" || a.bucket === "cancelled"; // "past"
  };
  const matchesModeFilter = (a: any) => {
    if (modeFilter === "all") return true;
    return a.mode === modeFilter;
  };

  const filtered = useMemo(
    () => all.filter((a) => matchesDateFilter(a) && matchesModeFilter(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, filter, modeFilter]
  );

  // Pinned video rows: only visits that are live or later today.
  const upcomingVideo = useMemo(() => {
    return all
      .filter(
        (a) =>
          a.mode === "video" &&
          (a.isLive || a.bucket === "today") &&
          (a.status === "scheduled" ||
            a.status === "confirmed" ||
            a.status === "in_progress")
      )
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);

  const showPinnedVideo =
    upcomingVideo.length > 0 &&
    (modeFilter === "all" || modeFilter === "video") &&
    (filter === "all" || filter === "upcoming");

  const upcomingCount = all.filter(
    (a) => a.bucket === "upcoming" || a.bucket === "today"
  ).length;
```

(f) Status pill: replace `label={item.status.replace("_", " ")}` with:

```tsx
                                label={
                                  t(`appointments.statusLabel.${item.status}`, {
                                    defaultValue: item.status.replace("_", " "),
                                  }) as string
                                }
```

(g) Everywhere the code branches on `["scheduled","confirmed","pending"]` (cancel button, join buttons): drop `"pending"`. Cancel button condition becomes `["scheduled", "confirmed"].includes(item.status)`. The video-join Pressables (both the pinned quick-join and the row CTA) become fail-closed:

```tsx
                    {item.mode === "video" &&
                    item.isLive &&
                    activeSession?.session?.appointmentId === item.id ? (
                      <Button
                        title={t("appointments.joinVideo")}
                        icon={Video}
                        variant="primary"
                        size="sm"
                        onPress={() =>
                          router.push({
                            pathname: "/(app)/teleconsult/[roomId]" as any,
                            params: { roomId: activeSession.session!.roomId },
                          })
                        }
                      />
                    ) : item.mode === "video" &&
                      (item.bucket === "today" || item.isLive) ? (
                      <Button
                        title={
                          item.isLive
                            ? t("appointments.waitingForDoctor")
                            : t("appointments.startsSoon")
                        }
                        icon={Video}
                        variant="secondary"
                        size="sm"
                        disabled
                      />
                    ) : null}
```

(h) Missed rows get a "Book again" action next to Details:

```tsx
                      {item.bucket === "missed" ? (
                        <Button
                          title={t("appointments.bookAgain")}
                          icon={CalendarPlus}
                          variant="secondary"
                          size="sm"
                          onPress={() =>
                            router.push({
                              pathname: "/(app)/book-appointment" as any,
                              params: { prefillDoctorId: item.doctorId ?? "" },
                            })
                          }
                        />
                      ) : null}
```

- [ ] **Step 3: Verify**

Run: `grep -n "pending" apps/mobile/src/app/\(app\)/appointments.tsx` (from repo root) — Expected: NO appointment-status matches (only unrelated words if any).
Run: `bun run typecheck` (from `packages/shared`) — Expected: PASS.
Run: `bun run test` (from `apps/marketing`) — Expected: PASS (shared contracts untouched by this task; suite stays green).
(The mobile screen is `@ts-nocheck`, so correctness is by review of the diff against this plan.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(app\)/appointments.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
git commit -m "fix(mobile): bucket-driven appointments list with Missed filter and fail-closed join"
```

---

### Task 9: Mobile Home "Coming up" + appointment detail

**Files:**
- Modify: `apps/mobile/src/app/(app)/index.tsx` (~lines 154–155 filter, "Coming up" section ~lines 1568–1595)
- Modify: `apps/mobile/src/app/(app)/appointment-detail.tsx` (status pill ~lines 205–215, join buttons ~lines 279–330)

**Interfaces:**
- Consumes: `AppointmentRow` lifecycle fields (Task 2); i18n keys from Task 8
- Produces: nothing downstream (leaf screens).

- [ ] **Step 1: Fix Home "Coming up"**

In `apps/mobile/src/app/(app)/index.tsx` replace:

```ts
  const upcomingAppointments = appointments.filter((a: any) =>
    ["scheduled", "confirmed", "in_progress"].includes(a.status)
  );
```

with:

```ts
  const upcomingAppointments = appointments.filter(
    (a: any) => a.bucket === "upcoming" || a.bucket === "today"
  );
  upcomingAppointments.sort(
    (a: any, b: any) => a.startsAt - b.startsAt
  );
```

(Elapsed-today and stale rows now drop out of "Coming up" — the reported bug.)

- [ ] **Step 2: Fix appointment detail**

In `apps/mobile/src/app/(app)/appointment-detail.tsx`:

(a) Status pill (near line 210): replace `label={appt.status.replace("_", " ")}` with:

```tsx
                      label={
                        t(`appointments.statusLabel.${appt.status}`, {
                          defaultValue: appt.status.replace("_", " "),
                        }) as string
                      }
```

(b) Replace the two join Buttons (the `activeSession` match block AND the `__pending__` fallback) with one fail-closed block:

```tsx
                  {appt.mode === "video" &&
                  activeSession?.session?.appointmentId === id &&
                  activeSession.session ? (
                    <Button
                      title={t("consult.joinVideoVisit")}
                      icon={Video}
                      variant="primary"
                      size="md"
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/teleconsult/[roomId]" as any,
                          params: { roomId: activeSession.session!.roomId },
                        })
                      }
                    />
                  ) : appt.mode === "video" &&
                    (appt.bucket === "today" || appt.isLive) ? (
                    <Button
                      title={
                        appt.isLive
                          ? t("appointments.waitingForDoctor")
                          : t("appointments.startsSoon")
                      }
                      icon={Video}
                      variant="secondary"
                      size="md"
                      disabled
                    />
                  ) : null}
```

(c) Missed visits: after the status pill row, when `appt.bucket === "missed"`, render a "Book again" button:

```tsx
                  {appt.bucket === "missed" ? (
                    <Button
                      title={t("appointments.bookAgain")}
                      icon={CalendarPlus}
                      variant="primary"
                      size="md"
                      onPress={() =>
                        router.push({
                          pathname: "/(app)/book-appointment" as any,
                          params: { prefillDoctorId: appt.doctorId ?? "" },
                        })
                      }
                    />
                  ) : null}
```

(Import `CalendarPlus` from `lucide-react-native` if not already imported.)

- [ ] **Step 3: Verify**

Run: `bun run test` (from `apps/marketing`) and read-check the two mobile files compile-level (both `@ts-nocheck`); grep the mobile app to confirm zero remaining `__pending__` occurrences:

Run: `grep -rn "__pending__" apps/mobile/src apps/marketing/src` 
Expected: only the teleconsult room pages' defensive branches (removed in Task 10) or nothing.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(app\)/index.tsx apps/mobile/src/app/\(app\)/appointment-detail.tsx
git commit -m "fix(mobile): Coming up and detail screens use visit buckets, add Book again"
```

---

### Task 10: Teleconsult join paths — remove `__pending__`, explicit error states

**Files:**
- Modify: `apps/marketing/src/app/patient/teleconsult/[roomId]/page.tsx` (pending branch ~lines 35–75, resolve effect)
- Modify: `apps/mobile/src/app/(app)/teleconsult/[roomId].tsx` (`__pending__` branch ~lines 72–110)

**Interfaces:**
- Consumes: `GET /teleconsult/sessions/by-room/:roomId` (exists) and `GET /teleconsult/sessions/me/active` (exists)
- Produces: room pages accept only real `roomId`s; failures render an error state with retry (never a blank room, never polling on a fake id).

- [ ] **Step 1: Fix the web room page**

In `apps/marketing/src/app/patient/teleconsult/[roomId]/page.tsx`:

(a) Delete the `isPending` constant and the entire pending polling branch of the `useEffect`. The comment block at the top: update "Two entry modes" to state there is one entry mode (real `roomId` only) and that `__pending__` is rejected.

(b) Replace the resolve effect with a single one-shot resolve + explicit errors:

```tsx
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await teleconsultApi.getByRoom(roomId);
        if (cancelled) return;
        if (!res.session) {
          setError("This room is no longer available.");
          setLoading(false);
          return;
        }
        setSessionId(res.session.id);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Couldn't join this room. Check your connection and try again.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);
```

(If `teleconsultApi` has no `getByRoom`, add it next to `getActiveForMe` in `apps/marketing/src/portal/lib/api.ts`:

```ts
  getByRoom: (roomId: string) =>
    api<{ session: { id: string; roomId: string; appointmentId: string } | null }>(
      `/teleconsult/sessions/by-room/${encodeURIComponent(roomId)}`
    ),
```

— match the file's existing `api` helper style.)

(c) Guard the very top of the effect/render: if `roomId === "__pending__"` → `setError("Invalid room link.")` immediately (fail closed even on hand-typed URLs).

(d) The error state UI must offer a "Back to appointments" link (`/patient/appointments`) and a "Try again" button that re-runs the resolve (a `retryToken` state bumped by the button, added to the effect deps).

- [ ] **Step 2: Fix the mobile room page**

In `apps/mobile/src/app/(app)/teleconsult/[roomId].tsx`:

(a) Delete the `__pending__` polling branch entirely.

(b) In the one-shot resolve: when `active.session` is null or `active.session.roomId !== roomId`, set an error state (not the waiting state):

```ts
          if (!active.session || active.session.roomId !== roomId) {
            setError(t("consult.roomUnavailable", {
              defaultValue: "This room is no longer available.",
            }) as string);
            setLoading(false);
            return;
          }
```

(c) Add `consult.roomUnavailable` to en/si/ta (en: `"This room is no longer available."`, si: `"මෙම කාමරය තවදුරටත් නොමැත."`, ta: `"இந்த அறை இனி கிடைக்காது."`) inside a `"consult"` object (create if absent).

(d) The error UI: message + "Try again" (re-run resolve) + "Back" (`router.back()`). No WebView mount on error.

(e) At the top of the resolve effect: if `roomId === "__pending__"` → error immediately, same message.

- [ ] **Step 3: Verify no fake URLs remain and suites pass**

Run: `grep -rn "__pending__" apps/marketing/src apps/mobile/src apps/api/src` (from repo root)
Expected: NO matches in app code (test fixtures may mention it as "must not contain").

Run: `bun run test` (from `apps/marketing`) and `bun run test` (from `apps/api`).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/app/patient/teleconsult/\[roomId\]/page.tsx apps/mobile/src/app/\(app\)/teleconsult/\[roomId\].tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json apps/marketing/src/portal/lib/api.ts
git commit -m "fix(teleconsult): fail-closed join paths, remove __pending__ dead links"
```

---

## Verification (after all tasks)

- [ ] Full API suite: `bun run test` (from `apps/api`) — all green
- [ ] Full web suite: `bun run test` (from `apps/marketing`) — all green
- [ ] Shared suite: `bunx vitest run` (from `packages/shared`) — all green
- [ ] Typecheck: `bun run typecheck` in `apps/api`, `apps/marketing`, `packages/shared`
- [ ] `grep -rn "__pending__" apps packages` returns no app-code matches
- [ ] `grep -rn "\"pending\"" apps/mobile/src/app` returns no appointment-status matches
- [ ] Manual smoke (mobile + web): stale `scheduled` row from yesterday shows under **Missed** (not Coming up) with "Book again"; today's elapsed slot disappears from "Coming up" within 15 min; video visit shows "Starts soon"/"Waiting for doctor" until a real session exists, then "Join Call" with a real roomId.
