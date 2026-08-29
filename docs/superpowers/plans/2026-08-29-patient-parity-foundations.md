# Patient Parity Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared contract layer, hook structure, realtime sync, and parity manifest that the following nine mobile↔web parity sub-projects depend on — without changing any user-visible behaviour.

**Architecture:** Endpoint paths, response types, and React Query key factories move into `@healthcare/shared/contracts` so mobile and web type against one definition. The 661-line web patient hook barrel splits into per-domain modules behind an unchanged `@/patient/hooks` specifier. `useRealtime` — already built and mounted on four other surfaces — gets mounted on the patient shell with patient-key invalidation coverage. A parity manifest with an enforcing test makes the parity claim auditable.

**Tech Stack:** TypeScript, Next.js 16.2.10, React 19.2.4, TanStack Query, Vitest + happy-dom + Testing Library, Bun workspaces, Turbo.

## Global Constraints

- **Next.js 16.2.10 / React 19.2.4.** Per `apps/marketing/AGENTS.md`, this version has breaking changes relative to training data. Read the relevant guide under `apps/marketing/node_modules/next/dist/docs/` before writing app-router code.
- **No user-visible behaviour change.** Foundations ships no feature. Every change is structural.
- **All 17 existing patient page tests plus all component/lib tests must pass unchanged** at every commit. This is the regression gate.
- **No API changes.** Every path in the contracts must be one the API already serves.
- **Import specifier `@/patient/hooks` must keep working** — all existing tests mock that exact string.
- Test command: `cd apps/marketing && bun run test`. Typecheck: `bun run typecheck` from repo root.
- Branch: `feat/mobile-web-parity`.

---

### Task 1: Lock the public hook surface with a characterization test

Refactor safety net. This test passes on first run by design — it is a characterization test that pins the barrel's exports so Tasks 3–6 cannot silently drop one.

**Files:**
- Test: `apps/marketing/src/patient/hooks/index.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `EXPECTED_HOOK_EXPORTS` — the frozen list of names `@/patient/hooks` must export.

- [ ] **Step 1: Write the characterization test**

```ts
import { describe, expect, it } from "vitest";

import * as hooks from "@/patient/hooks";

/**
 * The public surface of `@/patient/hooks`. Every page test in this app
 * mocks the `@/patient/hooks` specifier, so this list is effectively the
 * portal's internal API. The domain-split in the parity Foundations work
 * moves these between files; this test proves none went missing.
 */
const EXPECTED_HOOK_EXPORTS = [
  "usePatientProfile",
  "useProfile",
  "useHealthSummary",
  "useWellness",
  "useVitalsSeries",
  "useVitalsAlerts",
  "useAppointments",
  "useAppointmentRecords",
  "useBookAppointment",
  "useCancelAppointment",
  "useRescheduleAppointment",
  "useRecords",
  "useRecordStats",
  "useRecord",
  "useMedications",
  "useAddMedication",
  "useEditMedication",
  "useStopMedication",
  "useTodayDoses",
  "useMarkDoseTaken",
  "useSkipDose",
  "useUntakeDose",
  "useMedicationsToday",
  "useMedicationStats",
  "useTimeline",
  "useConversations",
  "useConversationMessages",
  "useSendPatientMessage",
  "useMarkConversationRead",
  "useNotifications",
  "useUnreadNotificationsCount",
  "useMarkNotificationRead",
  "useMarkAllNotificationsRead",
  "useAllergies",
  "useAddAllergy",
  "useEditAllergy",
  "useDeleteAllergy",
  "useVaccinations",
  "useVaccinationsDue",
  "useAddVaccination",
  "useVitalsDerived",
  "useVitalsSeriesRaw",
  "useSymptoms",
  "useAddVital",
  "useDeleteVital",
  "useAddSymptom",
  "useDeleteSymptom",
  "useNotes",
  "useAddNote",
  "useEditNote",
  "useDeleteNote",
  "useLabResults",
  "useRefillDue",
] as const;

describe("@/patient/hooks barrel", () => {
  it.each(EXPECTED_HOOK_EXPORTS)("exports %s as a function", (name) => {
    expect(typeof (hooks as Record<string, unknown>)[name]).toBe("function");
  });

  it("exports nothing unexpected without this list being updated", () => {
    const actual = Object.keys(hooks).sort();
    const expected = [...EXPECTED_HOOK_EXPORTS].sort();
    expect(actual).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd apps/marketing && bun run test src/patient/hooks/index.test.ts`
Expected: PASS, 54 assertions. If the second test fails, the barrel has exports this plan did not know about — add them to the list rather than deleting them from the barrel.

- [ ] **Step 3: Commit**

```bash
git add apps/marketing/src/patient/hooks/index.test.ts
git commit -m "test(patient): characterize the @/patient/hooks public surface"
```

---

### Task 2: Contracts package scaffold — shared query keys

Moves `patientKeys` out of the web app into `@healthcare/shared/contracts` so mobile can invalidate on the same keys, and adds the factories the current code is missing (`useTodayDoses` and `useAddVital` build raw key arrays today).

**Files:**
- Create: `packages/shared/src/contracts/keys.ts`
- Create: `packages/shared/src/contracts/keys.test.ts`
- Create: `packages/shared/src/contracts/index.ts`
- Modify: `packages/shared/package.json` (add `./contracts` export)
- Modify: `apps/marketing/src/patient/lib/query.ts` (re-export from shared)

**Interfaces:**
- Consumes: nothing.
- Produces: `patientKeys` (all existing members, plus `vitals()`, `doses()`, `dosesToday()`), `PATIENT_QUERY_DEFAULTS`, `RangeKey`, `rangeToFrom(range, now?)` — all importable from `@healthcare/shared/contracts`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/contracts/keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { PATIENT_QUERY_DEFAULTS, patientKeys, rangeToFrom } from "./keys";

describe("patientKeys", () => {
  it("roots every key under 'patient' so the surface invalidates as one prefix", () => {
    const factories = Object.entries(patientKeys).filter(
      ([, v]) => typeof v === "function"
    ) as [string, (...a: never[]) => readonly string[]][];

    expect(factories.length).toBeGreaterThan(0);
    for (const [name, factory] of factories) {
      // Every factory takes 0-2 args that are strings/numbers/objects.
      const key = (factory as (...a: unknown[]) => readonly unknown[])(
        "x",
        "week"
      );
      expect(key[0], `${name} must be rooted at "patient"`).toBe("patient");
    }
    expect(patientKeys.all).toEqual(["patient"]);
  });

  it("gives doses their own factory so dose mutations invalidate precisely", () => {
    expect(patientKeys.doses()).toEqual(["patient", "doses"]);
    expect(patientKeys.dosesToday()).toEqual(["patient", "doses", "today"]);
  });

  it("gives vitals a root factory covering series, derived and alerts", () => {
    expect(patientKeys.vitals()).toEqual(["patient", "vitals"]);
    expect(patientKeys.vitalsDerived().slice(0, 2)).toEqual([
      "patient",
      "vitals",
    ]);
    expect(patientKeys.vitalsSeries("heart_rate", "week").slice(0, 2)).toEqual([
      "patient",
      "vitals",
    ]);
  });

  it("defaults queries to a 60s staleTime with one retry", () => {
    expect(PATIENT_QUERY_DEFAULTS).toEqual({ staleTime: 60_000, retry: 1 });
  });
});

describe("rangeToFrom", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");

  it("subtracts 7 days for a week", () => {
    expect(rangeToFrom("week", now)).toBe("2026-08-22T12:00:00.000Z");
  });

  it("subtracts a month for a month", () => {
    expect(rangeToFrom("month", now)).toBe("2026-07-29T12:00:00.000Z");
  });

  it("subtracts three months for a quarter", () => {
    expect(rangeToFrom("quarter", now)).toBe("2026-05-29T12:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/marketing && bun run test ../../packages/shared/src/contracts/keys.test.ts`
Expected: FAIL — `Cannot find module './keys'`.

Note: `packages/shared` has no vitest config of its own. Running the shared test through the marketing runner is intentional and keeps one test command. If the marketing vitest `include` does not pick up files outside `src/`, run it with an explicit path as above; the config's `include` only restricts default discovery.

- [ ] **Step 3: Create the keys module**

Create `packages/shared/src/contracts/keys.ts`. Copy the body of `apps/marketing/src/patient/lib/query.ts` verbatim, then add the three new factories:

```ts
/**
 * Query keys and shared options for every patient hook, on both web and
 * mobile.
 *
 * Every key starts with "patient" so a single prefix invalidates the whole
 * surface, and so patient cache entries never collide with the clinician
 * portal's. Lives in @healthcare/shared so the Expo app and the web portal
 * invalidate on identical keys — `useRealtime` on either platform can then
 * map a server event to the same cache entry.
 */

export const PATIENT_QUERY_DEFAULTS = {
  staleTime: 60_000,
  retry: 1,
} as const;

export type RangeKey = "week" | "month" | "quarter";

export const patientKeys = {
  all: ["patient"] as const,

  profile: () => ["patient", "profile"] as const,
  healthSummary: () => ["patient", "health-summary"] as const,
  wellness: () => ["patient", "wellness"] as const,

  vitals: () => ["patient", "vitals"] as const,
  vitalsSeries: (type: string, range: RangeKey) =>
    ["patient", "vitals", "series", type, range] as const,
  vitalsDerived: () => ["patient", "vitals", "derived"] as const,
  vitalsAlerts: (days: number) => ["patient", "vitals", "alerts", days] as const,
  symptoms: () => ["patient", "vitals", "symptoms"] as const,

  appointments: () => ["patient", "appointments"] as const,
  appointmentRecords: (id: string) =>
    ["patient", "appointments", id, "records"] as const,

  records: (params: Record<string, unknown>) =>
    ["patient", "records", params] as const,
  recordStats: () => ["patient", "records", "stats"] as const,
  record: (id: string) => ["patient", "records", id] as const,
  recordChildren: (id: string, kind: string) =>
    ["patient", "records", id, kind] as const,
  labTrend: (test: string, months: number) =>
    ["patient", "records", "lab-trend", test, months] as const,
  labResults: (params: { months?: number } = {}) =>
    ["patient", "records", "lab-results", params] as const,

  medicines: () => ["patient", "medicines"] as const,
  medicinesToday: () => ["patient", "medicines", "today"] as const,
  medicineStats: (days: number) =>
    ["patient", "medicines", "stats", days] as const,
  medicineRefills: () => ["patient", "medicines", "refills"] as const,
  medicineInteractions: () => ["patient", "medicines", "interactions"] as const,

  doses: () => ["patient", "doses"] as const,
  dosesToday: () => ["patient", "doses", "today"] as const,

  timeline: (params: Record<string, unknown>) =>
    ["patient", "timeline", params] as const,

  conversations: () => ["patient", "messages", "conversations"] as const,
  conversation: (id: string) =>
    ["patient", "messages", "conversations", id] as const,
  chatSessions: () => ["patient", "messages", "chat-sessions"] as const,

  notifications: () => ["patient", "notifications"] as const,
  unreadCount: () => ["patient", "notifications", "unread"] as const,

  allergies: () => ["patient", "allergies"] as const,
  vaccinations: () => ["patient", "vaccinations"] as const,
  vaccinationsDue: () => ["patient", "vaccinations", "due"] as const,
  family: () => ["patient", "family"] as const,
  familyActive: () => ["patient", "family", "active"] as const,
  notes: () => ["patient", "notes"] as const,
};

/** Range key → an ISO `from` bound. `to` is always "now" (omitted). */
export function rangeToFrom(range: RangeKey, now = new Date()): string {
  const d = new Date(now);
  if (range === "week") d.setDate(d.getDate() - 7);
  else if (range === "month") d.setMonth(d.getMonth() - 1);
  else d.setMonth(d.getMonth() - 3);
  return d.toISOString();
}
```

- [ ] **Step 4: Create the contracts barrel**

Create `packages/shared/src/contracts/index.ts`:

```ts
/**
 * Cross-platform API contracts for the patient surface.
 *
 * Each domain module exports three things and nothing else:
 *   - path builders    — the endpoint strings, built once
 *   - types            — the shapes the API actually returns
 *   - (keys.ts only)   — the React Query key factories
 *
 * No fetch logic, no React, no platform imports. Web hooks and Expo hooks
 * both import from here so that a drift between the two platforms becomes
 * a typecheck error rather than a runtime bug.
 */

export * from "./keys";
```

- [ ] **Step 5: Add the package export**

In `packages/shared/package.json`, add to `exports`, after the `"."` entry:

```json
    "./contracts": "./src/contracts/index.ts",
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/marketing && bun run test ../../packages/shared/src/contracts/keys.test.ts`
Expected: PASS.

- [ ] **Step 7: Re-point the web query module at shared**

Replace the entire contents of `apps/marketing/src/patient/lib/query.ts` with:

```ts
/**
 * Patient query keys and defaults.
 *
 * The definitions now live in `@healthcare/shared/contracts` so the Expo
 * app and this portal invalidate on identical keys. This module stays as
 * the web-side import site — every patient hook and test already imports
 * `@/patient/lib/query`, and keeping that specifier stable means the move
 * touches no call sites.
 */

export {
  PATIENT_QUERY_DEFAULTS,
  patientKeys,
  rangeToFrom,
  type RangeKey,
} from "@healthcare/shared/contracts";
```

- [ ] **Step 8: Run the whole suite**

Run: `cd apps/marketing && bun run test`
Expected: PASS, including all 17 patient page tests and `src/patient/lib/*.test.ts`.

Run: `cd /Users/thufailahamed/Downloads/App-2 && bun run typecheck`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/contracts packages/shared/package.json apps/marketing/src/patient/lib/query.ts
git commit -m "feat(shared): patient query-key contracts shared across web and mobile"
```

---

### Task 3: Move patient response types into contracts

`apps/marketing/src/patient/types/patient.ts` is 301 lines, 24 exported types, 16 importers. It describes API response shapes that mobile re-declares independently. Moving it to contracts is the anti-drift win; a re-export shim keeps all 16 importers working.

**Files:**
- Create: `packages/shared/src/contracts/types.ts`
- Modify: `packages/shared/src/contracts/index.ts`
- Modify: `apps/marketing/src/patient/types/patient.ts` (becomes a shim)
- Create: `apps/marketing/src/patient/types/patient.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: from `@healthcare/shared/contracts` — `VitalType`, `VitalContext`, `VitalPoint`, `VitalsDerived`, `AllergyRow`, `VaccinationAdministeredRow`, `VaccinationSlot`, `SymptomRow`, `NoteRow`, `LabResultRow`, `RefillCandidate`, `VitalStats`, `VitalSeriesResponse`, `VitalAlert`, `WellnessResponse`, `MedicineStats`, `MedicineRow`, `AppointmentRow`, `RecordRow`, `RecordStats`, `TimelineEvent`, `HealthSummary`, `Conversation`, `Message`.

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/patient/types/patient.test.ts`:

```ts
import { describe, expectTypeOf, it } from "vitest";

import type { AllergyRow, MedicineRow, VitalType } from "@/patient/types/patient";
import type {
  AllergyRow as SharedAllergyRow,
  MedicineRow as SharedMedicineRow,
  VitalType as SharedVitalType,
} from "@healthcare/shared/contracts";

/**
 * The web-side type module is a shim over the shared contract. If these
 * ever diverge, mobile and web are describing the same endpoint two
 * different ways — which is the exact failure this package exists to stop.
 */
describe("@/patient/types/patient", () => {
  it("re-exports the shared contract types unchanged", () => {
    expectTypeOf<AllergyRow>().toEqualTypeOf<SharedAllergyRow>();
    expectTypeOf<MedicineRow>().toEqualTypeOf<SharedMedicineRow>();
    expectTypeOf<VitalType>().toEqualTypeOf<SharedVitalType>();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/marketing && bun run test src/patient/types/patient.test.ts`
Expected: FAIL — `@healthcare/shared/contracts` has no export named `AllergyRow`.

- [ ] **Step 3: Move the types**

Copy the entire current contents of `apps/marketing/src/patient/types/patient.ts` into a new file `packages/shared/src/contracts/types.ts` verbatim, changing only the file's leading doc comment to:

```ts
/**
 * Patient API response shapes, shared by the Expo app and the web portal.
 *
 * These describe what the API actually returns — not what a screen wants.
 * Screen-local view models belong next to the screen.
 */
```

- [ ] **Step 4: Export it from the contracts barrel**

In `packages/shared/src/contracts/index.ts`, add below the keys export:

```ts
export * from "./types";
```

- [ ] **Step 5: Turn the web module into a shim**

Replace the entire contents of `apps/marketing/src/patient/types/patient.ts` with:

```ts
/**
 * Patient API response shapes.
 *
 * Defined in `@healthcare/shared/contracts` so the Expo app and this
 * portal describe every endpoint identically. This module remains the
 * web-side import site: 16 files already import `@/patient/types/patient`,
 * and keeping that specifier stable means the move touches no call sites.
 */

export type {
  AllergyRow,
  AppointmentRow,
  Conversation,
  HealthSummary,
  LabResultRow,
  MedicineRow,
  MedicineStats,
  Message,
  NoteRow,
  RecordRow,
  RecordStats,
  RefillCandidate,
  SymptomRow,
  TimelineEvent,
  VaccinationAdministeredRow,
  VaccinationSlot,
  VitalAlert,
  VitalContext,
  VitalPoint,
  VitalSeriesResponse,
  VitalStats,
  VitalType,
  VitalsDerived,
  WellnessResponse,
} from "@healthcare/shared/contracts";
```

- [ ] **Step 6: Run tests and typecheck**

Run: `cd apps/marketing && bun run test`
Expected: PASS, all suites.

Run: `cd /Users/thufailahamed/Downloads/App-2 && bun run typecheck`
Expected: no new errors. If a consumer imported a type not in the list above, add it to both the shim and this task's Interfaces block.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/contracts apps/marketing/src/patient/types/patient.ts apps/marketing/src/patient/types/patient.test.ts
git commit -m "feat(shared): move patient response types into the contracts package"
```

---

### Task 4: Endpoint path builders in contracts

Removes the last duplicated thing: the endpoint strings themselves. One module per domain, matching the hook modules that Tasks 5–6 create.

**Files:**
- Create: `packages/shared/src/contracts/paths.ts`
- Create: `packages/shared/src/contracts/paths.test.ts`
- Modify: `packages/shared/src/contracts/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `patientPaths` — a nested object of path builders, importable from `@healthcare/shared/contracts`. Members used by later tasks: `patientPaths.profile.me()`, `.profile.auth()`, `.profile.healthSummary()`, `.profile.wellness()`, `.vitals.series(type, from)`, `.vitals.derived()`, `.vitals.alerts(days)`, `.vitals.create()`, `.vitals.detail(id)`, `.vitals.symptoms()`, `.vitals.symptomCreate()`, `.vitals.symptomDetail(id)`, `.appointments.mine()`, `.appointments.create()`, `.appointments.detail(id)`, `.appointments.records(id)`, `.appointments.reschedule(id)`, `.records.mine(q)`, `.records.stats()`, `.records.detail(id)`, `.records.labResults(q)`, `.medicines.mine()`, `.medicines.create()`, `.medicines.detail(id)`, `.medicines.stop(id)`, `.medicines.today()`, `.medicines.stats(days)`, `.medicines.refillDue(days)`, `.doses.mine(from, to)`, `.doses.taken(id)`, `.doses.skip(id)`, `.messages.conversations()`, `.messages.conversationMessages(id)`, `.messages.conversationRead(id)`, `.notifications.mine()`, `.notifications.unreadCount()`, `.notifications.read(id)`, `.notifications.readAll()`, `.allergies.mine()`, `.allergies.detail(id)`, `.vaccinations.mine()`, `.vaccinations.due()`, `.notes.mine()`, `.notes.create()`, `.notes.detail(id)`, `.timeline.mine(q)`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/contracts/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { patientPaths } from "./paths";

describe("patientPaths", () => {
  it("builds the collection endpoints the patient surface reads", () => {
    expect(patientPaths.profile.me()).toBe("/patients/me");
    expect(patientPaths.profile.auth()).toBe("/auth/me");
    expect(patientPaths.appointments.mine()).toBe("/appointments/me");
    expect(patientPaths.medicines.mine()).toBe("/medicines/me");
    expect(patientPaths.notifications.unreadCount()).toBe(
      "/notifications/unread-count"
    );
  });

  it("interpolates ids into detail endpoints", () => {
    expect(patientPaths.records.detail("rec_1")).toBe("/medical-records/rec_1");
    expect(patientPaths.appointments.reschedule("a1")).toBe(
      "/appointments/a1/reschedule"
    );
    expect(patientPaths.medicines.stop("m1")).toBe("/medicines/m1/stop");
    expect(patientPaths.doses.taken("d1")).toBe("/doses/d1/taken");
  });

  it("omits the query string entirely when no filters are set", () => {
    expect(patientPaths.records.mine({})).toBe("/medical-records/me");
    expect(patientPaths.timeline.mine({})).toBe("/timeline/me");
  });

  it("encodes query values so a search term cannot break the URL", () => {
    expect(patientPaths.records.mine({ search: "a&b", limit: 5 })).toBe(
      "/medical-records/me?search=a%26b&limit=5"
    );
    expect(patientPaths.vitals.series("blood_pressure", "2026-01-01T00:00:00.000Z")).toBe(
      "/vitals/me/series?type=blood_pressure&from=2026-01-01T00%3A00%3A00.000Z"
    );
  });

  it("joins timeline kinds with commas", () => {
    expect(patientPaths.timeline.mine({ limit: 10, kinds: ["record", "vital"] })).toBe(
      "/timeline/me?limit=10&kinds=record%2Cvital"
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/marketing && bun run test ../../packages/shared/src/contracts/paths.test.ts`
Expected: FAIL — `Cannot find module './paths'`.

- [ ] **Step 3: Implement the path builders**

Create `packages/shared/src/contracts/paths.ts`:

```ts
/**
 * Endpoint path builders for the patient surface.
 *
 * Every patient endpoint string in the codebase should come from here, so
 * that the Expo app and the web portal cannot drift onto different URLs
 * for the same resource. Builders return the path only — the base URL and
 * auth headers are each platform's fetch layer's business.
 */

/** Build a query string, dropping empty values and omitting `?` entirely when nothing is set. */
function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

export interface RecordsQuery {
  type?: string;
  search?: string;
  limit?: number;
}

export interface LabResultsQuery {
  months?: number;
  test?: string;
}

export interface TimelineQuery {
  limit?: number;
  kinds?: string[];
}

export const patientPaths = {
  profile: {
    me: () => "/patients/me",
    auth: () => "/auth/me",
    healthSummary: () => "/health-summary/me",
    wellness: () => "/wellness/me",
  },

  vitals: {
    series: (type: string, from: string) =>
      `/vitals/me/series${qs({ type, from })}`,
    derived: () => "/vitals/me/derived",
    alerts: (days: number) => `/vitals/me/alerts${qs({ days })}`,
    create: () => "/vitals",
    detail: (id: string) => `/vitals/${id}`,
    symptoms: () => "/vitals/symptoms/me",
    symptomCreate: () => "/vitals/symptoms",
    symptomDetail: (id: string) => `/vitals/symptoms/${id}`,
  },

  appointments: {
    mine: () => "/appointments/me",
    create: () => "/appointments",
    detail: (id: string) => `/appointments/${id}`,
    records: (id: string) => `/appointments/${id}/records`,
    reschedule: (id: string) => `/appointments/${id}/reschedule`,
  },

  records: {
    mine: (q: RecordsQuery = {}) =>
      `/medical-records/me${qs({ type: q.type, search: q.search, limit: q.limit })}`,
    stats: () => "/medical-records/me/stats",
    detail: (id: string) => `/medical-records/${id}`,
    labResults: (q: LabResultsQuery = {}) =>
      `/medical-records/me/lab-results${qs({ months: q.months, test: q.test })}`,
  },

  medicines: {
    mine: () => "/medicines/me",
    create: () => "/medicines",
    detail: (id: string) => `/medicines/${id}`,
    stop: (id: string) => `/medicines/${id}/stop`,
    today: () => "/medicines/today",
    stats: (days: number) => `/medicines/me/stats${qs({ days })}`,
    refillDue: (days: number) => `/medicines/refill-due${qs({ days })}`,
  },

  doses: {
    mine: (from: string, to: string) => `/doses/me${qs({ from, to })}`,
    taken: (id: string) => `/doses/${id}/taken`,
    skip: (id: string) => `/doses/${id}/skip`,
  },

  messages: {
    conversations: () => "/patient-messages/conversations",
    conversationMessages: (id: string) =>
      `/patient-messages/conversations/${id}/messages`,
    conversationRead: (id: string) =>
      `/patient-messages/conversations/${id}/read`,
  },

  notifications: {
    mine: () => "/notifications/me",
    unreadCount: () => "/notifications/unread-count",
    read: (id: string) => `/notifications/${id}/read`,
    readAll: () => "/notifications/read-all",
  },

  allergies: {
    mine: () => "/allergies/me",
    detail: (id: string) => `/allergies/${id}`,
  },

  vaccinations: {
    mine: () => "/vaccinations/me",
    due: () => "/vaccinations/me/due",
  },

  notes: {
    mine: () => "/notes/me",
    create: () => "/notes",
    detail: (id: string) => `/notes/${id}`,
  },

  timeline: {
    mine: (q: TimelineQuery = {}) =>
      `/timeline/me${qs({ limit: q.limit, kinds: q.kinds?.length ? q.kinds.join(",") : undefined })}`,
  },
} as const;
```

- [ ] **Step 4: Export from the barrel**

In `packages/shared/src/contracts/index.ts`, add:

```ts
export * from "./paths";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/marketing && bun run test ../../packages/shared/src/contracts/paths.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/contracts
git commit -m "feat(shared): patient endpoint path builders in contracts"
```

---

### Task 5: Split the hook barrel — read-side domains

Splits `index.ts` into per-domain modules and points them at `patientPaths`. Done in two tasks so a reviewer can reject one half. This task takes profile, vitals, records, timeline, and labs.

**Files:**
- Create: `apps/marketing/src/patient/hooks/profile.ts`
- Create: `apps/marketing/src/patient/hooks/vitals.ts`
- Create: `apps/marketing/src/patient/hooks/records.ts`
- Create: `apps/marketing/src/patient/hooks/timeline.ts`
- Modify: `apps/marketing/src/patient/hooks/index.ts`

**Interfaces:**
- Consumes: `patientPaths`, `patientKeys`, `PATIENT_QUERY_DEFAULTS`, `rangeToFrom`, `RangeKey` from Tasks 2 and 4.
- Produces: `profile.ts` exports `usePatientProfile`, `PatientProfileResponse`, `useProfile`, `useHealthSummary`, `useWellness`. `vitals.ts` exports `useVitalsSeries`, `useVitalsAlerts`, `useVitalsDerived`, `useVitalsSeriesRaw`, `useSymptoms`, `useAddVital`, `useDeleteVital`, `useAddSymptom`, `useDeleteSymptom`. `records.ts` exports `useRecords`, `useRecordStats`, `useRecord`, `useLabResults`. `timeline.ts` exports `useTimeline`.

- [ ] **Step 1: Create `profile.ts`**

Move `usePatientProfile`, `PatientProfileResponse`, `useProfile`, `useHealthSummary`, `useWellness` out of `index.ts` verbatim, with this header and with paths swapped for builders:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/portal/lib/api";
import { PATIENT_QUERY_DEFAULTS, patientKeys, patientPaths } from "@healthcare/shared/contracts";
import type { HealthSummary, WellnessResponse } from "@/patient/types/patient";
import type { AuthUser } from "@/portal/stores/auth";

export interface PatientProfileResponse {
  patient: {
    patients: { id: string; dateOfBirth: string | null; gender: string | null };
    users: { id: string; name: string; email: string | null; phone: string | null };
  };
}

export function usePatientProfile() {
  return useQuery<PatientProfileResponse>({
    queryKey: [...patientKeys.profile(), "record"] as const,
    queryFn: () => api<PatientProfileResponse>(patientPaths.profile.me()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useProfile() {
  return useQuery<AuthUser | null>({
    queryKey: patientKeys.profile(),
    queryFn: () => api<{ user: AuthUser }>(patientPaths.profile.auth()).then((r) => r.user),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useHealthSummary() {
  return useQuery<HealthSummary>({
    queryKey: patientKeys.healthSummary(),
    queryFn: () => api<HealthSummary>(patientPaths.profile.healthSummary()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}

export function useWellness() {
  return useQuery<WellnessResponse>({
    queryKey: patientKeys.wellness(),
    queryFn: () => api<WellnessResponse>(patientPaths.profile.wellness()),
    ...PATIENT_QUERY_DEFAULTS,
  });
}
```

Note the `usePatientProfile` key: it was the literal `["patient","profile","record"]`; building it from the factory keeps the identical array while routing through the contract.

- [ ] **Step 2: Create `vitals.ts`, `records.ts`, `timeline.ts`**

Same treatment — move each hook body verbatim from `index.ts`, replace inline endpoint strings with `patientPaths.*` calls, replace the raw `["patient","vitals"]` invalidations in `useAddVital`/`useDeleteVital` with `patientKeys.vitals()`, and keep every signature, generic, and `enabled` guard exactly as it is. Each file gets `"use client";` at the top and imports only what it uses.

- [ ] **Step 3: Reduce `index.ts` to a barrel for these domains**

Delete the moved hooks from `index.ts` and add at the top:

```ts
export * from "./profile";
export * from "./vitals";
export * from "./records";
export * from "./timeline";
```

- [ ] **Step 4: Run the full suite**

Run: `cd apps/marketing && bun run test`
Expected: PASS. The Task 1 characterization test proves no export was lost; the 17 page tests prove no behaviour changed.

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/patient/hooks
git commit -m "refactor(patient): split profile/vitals/records/timeline hooks onto contracts"
```

---

### Task 6: Split the hook barrel — remaining domains

**Files:**
- Create: `apps/marketing/src/patient/hooks/appointments.ts`
- Create: `apps/marketing/src/patient/hooks/medicines.ts`
- Create: `apps/marketing/src/patient/hooks/messages.ts`
- Create: `apps/marketing/src/patient/hooks/notifications-feed.ts`
- Create: `apps/marketing/src/patient/hooks/allergies.ts`
- Create: `apps/marketing/src/patient/hooks/vaccinations.ts`
- Create: `apps/marketing/src/patient/hooks/notes.ts`
- Modify: `apps/marketing/src/patient/hooks/index.ts`

**Interfaces:**
- Consumes: Tasks 2 and 4 contracts.
- Produces: `appointments.ts` — `useAppointments`, `useAppointmentRecords`, `useBookAppointment`, `useCancelAppointment`, `useRescheduleAppointment`. `medicines.ts` — `useMedications`, `useAddMedication`, `useEditMedication`, `useStopMedication`, `useTodayDoses`, `useMarkDoseTaken`, `useSkipDose`, `useUntakeDose`, `useMedicationsToday`, `useMedicationStats`, `useRefillDue`. `messages.ts` — `useConversations`, `useConversationMessages`, `useSendPatientMessage`, `useMarkConversationRead`. `notifications-feed.ts` — `PatientNotification`, `useNotifications`, `useUnreadNotificationsCount`, `useMarkNotificationRead`, `useMarkAllNotificationsRead`. `allergies.ts` — `useAllergies`, `useAddAllergy`, `useEditAllergy`, `useDeleteAllergy`. `vaccinations.ts` — `useVaccinations`, `useVaccinationsDue`, `useAddVaccination`. `notes.ts` — `useNotes`, `useAddNote`, `useEditNote`, `useDeleteNote`.

The file is named `notifications-feed.ts` rather than `notifications.ts` because `src/patient/hooks/useNotifications.ts` already exists and exports `useUnreadNotificationsCount`; two modules a letter apart invite the wrong import.

- [ ] **Step 1: Create the seven modules**

Move each hook body verbatim from `index.ts`. Replace inline endpoint strings with `patientPaths.*`. In `medicines.ts`, replace the two raw dose keys — `useTodayDoses`'s `["patient","doses","today"]` becomes `patientKeys.dosesToday()`, and `invalidateMedicationQueries`'s `["patient","doses"]` becomes `patientKeys.doses()`. `useTodayDoses` keeps computing its own day bounds and now passes them through `patientPaths.doses.mine(from, to)`. Every signature, generic, and `enabled` guard stays exactly as it is. Each file starts with `"use client";`.

- [ ] **Step 2: Reduce `index.ts` to a pure barrel**

`index.ts` becomes only:

```ts
"use client";

/**
 * The patient hook surface.
 *
 * Hooks live in per-domain modules; this barrel is the single import
 * specifier the app and its tests use. Every page test mocks
 * `@/patient/hooks`, so this file's export list is effectively the
 * portal's internal API — see index.test.ts.
 */

export * from "./profile";
export * from "./vitals";
export * from "./records";
export * from "./timeline";
export * from "./appointments";
export * from "./medicines";
export * from "./messages";
export * from "./notifications-feed";
export * from "./allergies";
export * from "./vaccinations";
export * from "./notes";
```

- [ ] **Step 3: Run the full suite and typecheck**

Run: `cd apps/marketing && bun run test`
Expected: PASS. In particular `src/patient/hooks/index.test.ts` must still report all 54 exports present, and its "nothing unexpected" assertion must hold.

Run: `cd /Users/thufailahamed/Downloads/App-2 && bun run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/marketing/src/patient/hooks
git commit -m "refactor(patient): split remaining hooks into domain modules onto contracts"
```

---

### Task 7: Mount realtime on the patient shell

The `/patient` surface has no realtime sync today. This is the mechanism behind cross-platform "changes reflect immediately".

**Files:**
- Modify: `apps/marketing/src/portal/hooks/useRealtime.ts:48-94` (invalidation maps)
- Modify: `apps/marketing/src/app/patient/(app)/layout.tsx`
- Create: `apps/marketing/src/portal/hooks/useRealtime.test.ts`
- Modify: `apps/marketing/src/app/patient/(app)/layout.test.tsx`

**Interfaces:**
- Consumes: `patientKeys` from Task 2; `useRealtime({ token, userId, silent? })` as it already exists.
- Produces: no new exports. Behavioural change only.

- [ ] **Step 1: Write the failing test for map coverage**

Create `apps/marketing/src/portal/hooks/useRealtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { EVENT_TO_QUERY_KEYS, TYPE_TO_QUERY_KEYS } from "./useRealtime";

/**
 * The patient surface invalidates on `["patient", ...]` keys. These maps
 * were written for the clinician portal, so every patient-relevant event
 * needs an explicit patient entry — otherwise a change made on mobile
 * never refreshes the open web tab, which is the whole point of mounting
 * this hook on /patient.
 */
function patientKeysIn(entries: readonly (readonly string[])[]): string[][] {
  return entries.filter((k) => k[0] === "patient").map((k) => [...k]);
}

describe("TYPE_TO_QUERY_KEYS", () => {
  it.each([
    ["appointment", ["patient", "appointments"]],
    ["medicine", ["patient", "medicines"]],
    ["medicine", ["patient", "doses"]],
    ["lab_ready", ["patient", "records"]],
    ["prescription", ["patient", "prescriptions"]],
    ["insurance", ["patient", "insurance"]],
    ["vaccination", ["patient", "vaccinations"]],
    ["emergency", ["patient", "emergency"]],
  ])("maps notification type %s to %j", (type, key) => {
    expect(patientKeysIn(TYPE_TO_QUERY_KEYS[type] ?? [])).toContainEqual(key);
  });
});

describe("EVENT_TO_QUERY_KEYS", () => {
  it.each([
    ["record", ["patient", "records"]],
    ["record", ["patient", "timeline"]],
    ["message", ["patient", "messages"]],
    ["vital", ["patient", "vitals"]],
    ["note", ["patient", "notes"]],
    ["allergy", ["patient", "allergies"]],
  ])("maps SSE event %s to %j", (event, key) => {
    expect(patientKeysIn(EVENT_TO_QUERY_KEYS[event] ?? [])).toContainEqual(key);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/marketing && bun run test src/portal/hooks/useRealtime.test.ts`
Expected: FAIL — the maps are not exported, and once exported, the `medicine`/`lab_ready`/`insurance`/`vaccination`/`emergency`/`vital`/`note`/`allergy` cases fail.

Before adding the `vital`, `note`, and `allergy` SSE events, confirm `apps/api/src/routes/realtime.ts` actually emits those event names. If it does not, drop those three rows from the test rather than adding dead map entries — the map must describe events that exist.

- [ ] **Step 3: Export and extend the maps**

In `apps/marketing/src/portal/hooks/useRealtime.ts`, add `export` to both map declarations and extend them. `TYPE_TO_QUERY_KEYS` becomes:

```ts
export const TYPE_TO_QUERY_KEYS: Record<string, readonly (readonly string[])[]> = {
  appointment: [["appointments"], ["doctor-portal", "appointments"], ["patient", "appointments"]],
  medicine: [["medicines"], ["doses"], ["patient", "medicines"], ["patient", "doses"]],
  lab_ready: [["lab-orders"], ["doctor-portal", "lab-orders"], ["medical-records"], ["patient", "records"]],
  prescription: [["prescription"], ["doctor", "prescriptions"], ["doctor-portal", "prescriptions"], ["patient", "prescriptions"]],
  insurance: [["insurance"], ["admin", "insurance-claims"], ["patient", "insurance"]],
  hospital: [["hospital-portal"], ["doctor-portal"]],
  emergency: [["emergency"], ["patient", "emergency"]],
  vaccination: [["vaccinations"], ["patient", "vaccinations"]],
  general: [["doctor-messages", "conversations"], ["doctor-portal", "messages"], ["inbox"], ["patient", "messages"]],
  account_pending_review: [["admin", "approvals"], ["admin", "users"]],
  hospital_request: [["hospital-portal"], ["hospital", "collab"]],
};
```

Extend `EVENT_TO_QUERY_KEYS` the same way, adding `["patient","timeline"]` to `record`, and adding `vital`, `note`, and `allergy` entries only for event names `realtime.ts` actually emits.

The `notifications` catch-all in `invalidateFor` uses the bare `["notifications"]` key, which does not match the patient surface's `["patient","notifications"]`. Add the patient key alongside it:

```ts
function invalidateFor(qc: ReturnType<typeof useQueryClient>, n: RealtimeNotification) {
  // Catch-all first — anything matching a notifications tree refreshes.
  qc.invalidateQueries({ queryKey: ["notifications"] });
  qc.invalidateQueries({ queryKey: ["patient", "notifications"] });
  const mapped = TYPE_TO_QUERY_KEYS[n.type];
  // ... unchanged
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/marketing && bun run test src/portal/hooks/useRealtime.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing layout test**

Add to `apps/marketing/src/app/patient/(app)/layout.test.tsx`, inside the existing describe block, keeping the file's existing mock setup:

```tsx
  it("opens a realtime connection for the signed-in patient", () => {
    mockState = {
      hydrated: true,
      token: "tok_1",
      user: { id: "u1", role: "patient", name: "Test" },
    };
    render(<PatientAppLayout>content</PatientAppLayout>);
    expect(realtimeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ token: "tok_1", userId: "u1" })
    );
  });
```

and at the top of the file, alongside the existing mocks:

```tsx
const realtimeSpy = vi.fn();
vi.mock("@/portal/hooks/useRealtime", () => ({
  useRealtime: (args: unknown) => realtimeSpy(args),
}));
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd apps/marketing && bun run test "src/app/patient/(app)/layout.test.tsx"`
Expected: FAIL — `realtimeSpy` never called.

- [ ] **Step 7: Mount the hook**

In `apps/marketing/src/app/patient/(app)/layout.tsx`, add the import and the call. The hook is a no-op until `token` and `userId` are both set, so it is safe to call before the redirect guards:

```tsx
import { useRealtime } from "@/portal/hooks/useRealtime";
```

and inside the component, after the store selectors and before the `useEffect`:

```tsx
  // Server-pushed invalidations. Mounted here so anything the patient does
  // on mobile — a dose marked taken, a record uploaded — refreshes an open
  // web tab within one SSE tick. No-ops until the token hydrates.
  useRealtime({ token: token ?? null, userId: user?.id ?? null });
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd apps/marketing && bun run test`
Expected: PASS, whole suite.

- [ ] **Step 9: Commit**

```bash
git add apps/marketing/src/portal/hooks/useRealtime.ts apps/marketing/src/portal/hooks/useRealtime.test.ts "apps/marketing/src/app/patient/(app)/layout.tsx" "apps/marketing/src/app/patient/(app)/layout.test.tsx"
git commit -m "feat(patient): mount realtime sync on the patient shell"
```

---

### Task 8: Parity manifest and enforcing test

Makes the parity claim auditable. Without this, "100% parity" is an assertion nobody can check.

**Files:**
- Create: `docs/parity-manifest.md`
- Create: `apps/marketing/src/patient/parity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/parity-manifest.md` as the single source of truth for parity status, consumed by every later sub-project.

- [ ] **Step 1: Write the manifest**

Create `docs/parity-manifest.md`. It opens with the format contract, then one table row per patient-facing mobile screen:

```markdown
# Mobile ↔ Web Patient Parity Manifest

Single source of truth for how far the web patient portal has caught up with
the Expo app. Enforced by `apps/marketing/src/patient/parity.test.ts`: every
row marked `done` must resolve to a real page file under
`apps/marketing/src/app/patient/`.

**Status values**

| Status | Meaning |
|---|---|
| `done` | Reachable on web with equivalent capabilities. Must resolve to a page file. |
| `planned` | Not yet built. `sub-project` says which one owns it. |
| `n-a-native` | Will not be built. `notes` must say why. |

**Web route** is the route as served, e.g. `/patient/records`. The test maps
it to `apps/marketing/src/app/patient/(app)/records/page.tsx`, trying both
the `(app)` route group and the bare path.

| mobile | web | status | sub-project | notes |
|---|---|---|---|---|
| `(app)/index` | `/patient` | done | 0 | |
| `(app)/records` | `/patient/records` | done | 0 | list only; write-path in 2 |
| `(app)/record-detail` | `/patient/records/[id]` | done | 0 | read-only; actions in 2 |
| `(app)/add-record` | `/patient/records/new` | planned | 2 | |
| `(app)/edit-record` | `/patient/records/[id]/edit` | planned | 2 | |
| `(app)/records/scan` | `/patient/records/scan` | planned | 6 | OCR via file upload |
| `(app)/records/trends` | `/patient/trends` | done | 0 | |
| `(app)/timeline` | `/patient/timeline` | planned | 9 | |
| `(app)/notes` | `/patient/notes` | done | 0 | |
| `(app)/allergies` | `/patient/allergies` | done | 0 | |
| `(app)/vitals` | `/patient/vitals` | done | 0 | |
| `(app)/vaccinations` | `/patient/vaccinations` | done | 0 | |
| `(app)/health-summary` | `/patient/health-summary` | planned | 9 | |
| `(app)/medicines` | `/patient/medications` | done | 0 | dose actions only; add/edit in 3 |
| `(app)/add-medicine` | `/patient/medications/new` | planned | 3 | |
| `(app)/edit-medicine` | `/patient/medications/[id]/edit` | planned | 3 | |
| `(app)/medicines-history` | `/patient/medications/history` | planned | 3 | |
| `(app)/refill` | `/patient/medications` | done | 0 | refill-due sheet on the medications page |
| `(app)/prescriptions` | `/patient/prescriptions` | planned | 3 | |
| `(app)/prescription-detail` | `/patient/prescriptions/[id]` | planned | 3 | |
| `(app)/verify/[id]` | `/portal/verify/[id]` | planned | 3 | exists on web; move under /patient |
| `(app)/appointments` | `/patient/appointments` | done | 0 | |
| `(app)/appointment-detail` | `/patient/appointments/[id]` | done | 0 | |
| `(app)/book-appointment` | `/patient/appointments/book` | planned | 4 | |
| `(app)/rate-visit/[appointmentId]` | `/patient/appointments/[id]/rate` | planned | 4 | |
| `(app)/doctor/[id]` | `/patient/doctors/[id]` | planned | 4 | |
| `(app)/teleconsult/[roomId]` | `/patient/teleconsult/[roomId]` | planned | 4 | room UI exists at /portal/teleconsult |
| `(app)/inbox` | `/patient/messages` | done | 0 | |
| `(app)/inbox/[id]` | `/patient/messages/[id]` | done | 0 | |
| `(app)/notifications` | `/patient/notifications` | done | 0 | |
| `(app)/notification-preferences` | `/patient/notifications/preferences` | planned | 8 | |
| `(app)/profile` | `/patient/profile` | done | 0 | read-only; editing in 5 |
| `(app)/edit-profile` | `/patient/profile/edit` | planned | 5 | |
| `(app)/appearance` | `/patient/settings/appearance` | planned | 5 | |
| `(app)/change-password` | `/patient/settings/password` | planned | 5 | |
| `(app)/support` | `/patient/support` | planned | 5 | |
| `(app)/email-import` | `/patient/settings/email-import` | planned | 5 | |
| `(app)/app-lock` | — | n-a-native | — | No browser SecureStore equivalent; session expiry covers it |
| `(auth)/login` | `/patient/login` | done | 0 | |
| `(auth)/register` | `/patient/register` | planned | 5 | |
| `(auth)/forgot-password` | `/patient/forgot-password` | planned | 5 | |
| `(auth)/verify-otp` | `/patient/verify-otp` | planned | 5 | |
| `(auth)/mfa-setup` | `/patient/mfa/setup` | planned | 5 | |
| `(auth)/mfa-challenge` | `/patient/mfa/challenge` | planned | 5 | |
| `(auth)/request-demo` | `/request-demo` | planned | 5 | marketing-site surface, not patient-gated |
| `(app)/family` | `/patient/family` | done | 0 | invites and lock in 8 |
| `(app)/caretakers` | `/patient/caretakers` | done | 0 | |
| `(app)/care-team` | `/patient/care-team` | done | 0 | add-member in 8 |
| `(app)/care-team-add` | `/patient/care-team/add` | planned | 8 | |
| `(app)/marketplace` | `/patient/marketplace` | planned | 8 | |
| `(app)/marketplace/[caretakerId]` | `/patient/marketplace/[id]` | planned | 8 | |
| `(app)/marketplace-inquiries` | `/patient/marketplace/inquiries` | planned | 8 | |
| `(app)/share` | `/patient/share` | planned | 1 | exists at /portal/me/share |
| `(app)/export` | `/patient/export` | done | 0 | |
| `(app)/audit` | `/patient/audit` | planned | 1 | exists at /portal/me/audit |
| `(app)/activity` | `/patient/activity` | planned | 9 | |
| `(app)/emergency` | `/patient/emergency` | done | 0 | |
| `(app)/health-id` | `/patient/health-id` | done | 0 | |
| `(app)/ai/chat` | `/patient/ai/chat` | planned | 6 | |
| `(app)/ai/summary` | `/patient/ai` | done | 0 | |
| `(app)/ai/drug-check` | `/patient/ai` | done | 0 | |
| `(app)/ai/lab-explain` | `/patient/ai/lab-explain` | planned | 6 | |
| `(app)/ai/lab-trend` | `/patient/ai/lab-trend` | planned | 6 | |
| `(app)/ai/clinical-note` | `/patient/ai/clinical-note` | planned | 6 | |
| `(app)/ai/ocr` | `/patient/ai/ocr` | planned | 6 | file upload, not camera |
| `(app)/ai/vaccination-card` | `/patient/ai/vaccination-card` | planned | 6 | file upload, not camera |
| `(app)/test-catalog` | `/patient/diagnostic-tests` | done | 0 | |
| `(app)/test-detail/[slug]` | `/patient/diagnostic-tests/[slug]` | done | 0 | |
| `(app)/test-packages` | `/patient/diagnostic-tests/packages` | planned | 7 | |
| `(app)/test-package-detail/[slug]` | `/patient/diagnostic-tests/packages/[slug]` | planned | 7 | |
| `(app)/book-test` | `/patient/diagnostic-tests/[slug]` | done | 0 | booking form on the detail page |
| `(app)/test-bookings` | `/patient/diagnostic-tests/bookings` | planned | 7 | |
| `(app)/test-booking-detail/[id]` | `/patient/diagnostic-tests/bookings/[id]` | planned | 7 | |
| `(app)/test-result/[bookingId]` | `/patient/diagnostic-tests/bookings/[id]/result` | planned | 7 | |
| `(app)/rate-test/[bookingId]` | `/patient/diagnostic-tests/bookings/[id]/rate` | planned | 7 | |
| `(app)/insurance/index` | `/patient/insurance` | planned | 1 | exists at /portal/me/insurance |
| `(app)/insurance/marketplace` | `/patient/insurance/marketplace` | planned | 1 | exists at /portal/me |
| `(app)/insurance/marketplace/[providerId]` | `/patient/insurance/marketplace/[providerId]` | planned | 1 | exists at /portal/me |
| `(app)/insurance/plans/[planId]` | `/patient/insurance/plans/[planId]` | planned | 1 | exists at /portal/me |
| `(app)/insurance/quote` | `/patient/insurance/quote` | planned | 1 | exists at /portal/me |
| `(app)/insurance/enroll/[planId]` | `/patient/insurance/enroll/[planId]` | planned | 1 | exists at /portal/me |
| `(app)/insurance/payment/[enrollmentId]` | `/patient/insurance/payment/[enrollmentId]` | planned | 1 | exists at /portal/me |
| `(app)/insurance/policy/[id]` | `/patient/insurance/policy/[id]` | planned | 1 | exists at /portal/me |
| `(app)/insurance/ecard/[id]` | `/patient/insurance/ecard/[id]` | planned | 1 | exists at /portal/me |
| `(app)/insurance/coverage-check` | `/patient/insurance/coverage-check` | planned | 1 | exists at /portal/me |
| `(app)/insurance/claims/index` | `/patient/insurance/claims` | planned | 1 | exists at /portal/me |
| `(app)/insurance/claims/new` | `/patient/insurance/claims/new` | planned | 1 | exists at /portal/me |
| `(app)/insurance/claims/[id]` | `/patient/insurance/claims/[id]` | planned | 1 | exists at /portal/me |
| `(app)/tenants/index` | `/patient/tenants` | planned | 9 | |
| `(app)/tenants/[id]` | `/patient/tenants` | planned | 9 | switcher, not a page per tenant |
| `(app)/hospital/*` | — | n-a-native | — | Mobile screens are deep-link redirects into the web hospital portal |
| push notifications | — | n-a-native | — | In-app feed plus SSE covers delivery on web |
```

- [ ] **Step 2: Write the enforcing test**

Create `apps/marketing/src/patient/parity.test.ts`:

```ts
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const MANIFEST = path.join(REPO_ROOT, "docs/parity-manifest.md");
const PATIENT_APP_DIR = path.join(
  REPO_ROOT,
  "apps/marketing/src/app/patient"
);

interface ParityRow {
  mobile: string;
  web: string;
  status: string;
  subProject: string;
  notes: string;
}

/** Parse the manifest's data rows, skipping the status-legend table. */
export function parseManifest(markdown: string): ParityRow[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| `") || line.startsWith("| push"))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim().replace(/^`|`$/g, ""));
      return {
        mobile: cells[0],
        web: cells[1],
        status: cells[2],
        subProject: cells[3],
        notes: cells[4] ?? "",
      };
    });
}

/**
 * Resolve a served route to its page file, trying the `(app)` route group
 * first since every authenticated patient page lives there.
 */
function pageFileFor(webRoute: string): string | null {
  const rel = webRoute.replace(/^\/patient\/?/, "");
  const candidates = [
    path.join(PATIENT_APP_DIR, "(app)", rel, "page.tsx"),
    path.join(PATIENT_APP_DIR, rel, "page.tsx"),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

const rows = parseManifest(readFileSync(MANIFEST, "utf8"));

describe("parity manifest", () => {
  it("has rows", () => {
    expect(rows.length).toBeGreaterThan(50);
  });

  it("uses only known status values", () => {
    for (const row of rows) {
      expect(["done", "planned", "n-a-native"]).toContain(row.status);
    }
  });

  const doneRows = rows.filter(
    (r) => r.status === "done" && r.web.startsWith("/patient")
  );

  it.each(doneRows.map((r) => [r.mobile, r.web]))(
    "%s is marked done, so %s must resolve to a page file",
    (_mobile, web) => {
      expect(pageFileFor(web), `no page.tsx found for ${web}`).not.toBeNull();
    }
  );

  it("requires a reason for every n-a-native row", () => {
    for (const row of rows.filter((r) => r.status === "n-a-native")) {
      expect(row.notes.length, `${row.mobile} needs a reason`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run it**

Run: `cd apps/marketing && bun run test src/patient/parity.test.ts`
Expected: PASS. If a `done` row fails to resolve, either the route in the manifest is wrong or the status is optimistic — fix the manifest, not the test.

- [ ] **Step 4: Verify the test actually fails when the manifest lies**

Temporarily change the `(app)/index` row's web route to `/patient/does-not-exist`, re-run, confirm FAIL, then revert. A guard that cannot fail is not a guard.

- [ ] **Step 5: Run the whole suite**

Run: `cd apps/marketing && bun run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/parity-manifest.md apps/marketing/src/patient/parity.test.ts
git commit -m "test(patient): parity manifest with an enforcing route test"
```

---

## Acceptance

From the spec's §8, all six must hold when Task 8 lands:

1. `packages/shared/src/contracts/` exists, exported as `./contracts`, and the existing web patient hooks import their paths, types, and query keys from it. — Tasks 2, 3, 4, 5, 6
2. `src/patient/hooks/index.ts` is a re-export barrel over per-domain modules. — Task 6
3. `useRealtime` is mounted on `app/patient/(app)/layout.tsx` with `["patient", ...]` invalidation coverage. — Task 7
4. `docs/parity-manifest.md` exists, seeded, every row statused and assigned. — Task 8
5. `apps/marketing/src/patient/parity.test.ts` passes and fails correctly on a bad row. — Task 8, Step 4
6. All pre-existing tests pass unchanged. — verified at every task's test step
