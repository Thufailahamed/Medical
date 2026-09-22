# Video Consulting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make video consulting work end-to-end for doctors and patients on web and mobile.

**Architecture:** Keep the designed dual-stack (web = custom WebRTC via `TeleconsultRoom` DO signaling; mobile = Whereby in WebView). Fix the broken auth/identity/hydration joints in the backend, repair the patient join path on web, and close the navigation/deep-link gaps on mobile. Fail closed (no fake URLs, no silent swallows).

**Tech Stack:** Hono/Cloudflare Workers + D1 + Durable Objects (backend); Next.js + `TeleconsultRoom` WebRTC client (web); Expo + `react-native-webview` Whereby (mobile).

## Global Constraints

- One source of truth: `teleconsult_sessions` row; `roomId` is the DO instance name.
- `teleconsult_sessions.doctor_id` stores `users.id` (verified in `apps/api/src/routes/teleconsult.ts:221` + FK in `packages/db/src/schema.ts:866-868`).
- Never emit fake/dead meeting URLs; never silently swallow session-lifecycle errors.
- WebRTC stack stays custom (no third-party video SDK keys to add).

---

### Task 1: Fix doctor identity check (backend, critical)

**Files:**
- Modify: `apps/api/src/routes/teleconsult.ts:88-104` (`resolveParticipant`)

**Interfaces:**
- Consumes: `doctors` table (`id`, `userId`), session row (`doctorId` = users.id, `patientUserId`)
- Produces: `{ role: "doctor"|"patient", userId }` used by GET :id, start, end, ws-ticket, ws

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/tests/teleconsult-participant.test.ts
import { describe, it, expect } from "vitest";
// resolveParticipant is module-private; test via GET /teleconsult/sessions/:id
// with a doctor caller (doctors.id !== users.id) using the existing MockD1 harness
// pattern from tests/teleconsult.test.ts. Expect 200, currently 403.
```

Run: `bun run test -- --run tests/teleconsult-participant.test.ts` (from `apps/api`)
Expected: FAIL (403 for doctor caller)

- [ ] **Step 2: Fix the comparison**

```ts
const [doctor] = await db
  .select({ id: doctors.id, userId: doctors.userId })
  .from(doctors)
  .where(eq(doctors.userId, userId))
  .limit(1);
if (doctor && doctor.userId === session.doctorId) {
  return { role: "doctor", userId };
}
```

- [ ] **Step 3: Run tests**

Run: `bun run test -- --run tests/teleconsult-participant.test.ts tests/teleconsult.test.ts tests/teleconsult-room.test.ts`
Expected: PASS

### Task 2: Fix DO hydration (backend, critical)

**Files:**
- Modify: `apps/api/src/durable-objects/teleconsult-room.ts:64-94` (hydrate)
- Modify: `apps/api/src/routes/teleconsult.ts:449-458` (end), `:547-564` (ws upgrade)

**Interfaces:**
- Consumes: session row (`id`, `appointmentId`, `doctorId`, `patientUserId`)
- Produces: DO instance pre-loaded with session context (no D1 reverse lookup)

- [ ] **Step 1: Route stamps session context headers**

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

Same headers on the `POST /close` poke (end path): `stub.fetch("https://do/close", { method: "POST", headers: { "X-Teleconsult-Session-Id": id, ... } })`.

- [ ] **Step 2: DO prefers headers, falls back to D1**

```ts
async fetch(request) {
  await this.hydrated;
  const h = (n: string) => request.headers.get(n);
  if (h("X-Teleconsult-Session-Id") && !this.sessionId) {
    this.sessionId = h("X-Teleconsult-Session-Id");
    this.appointmentId = h("X-Teleconsult-Appointment-Id");
    this.doctorUserId = h("X-Teleconsult-Doctor-Id");
    this.patientUserId = h("X-Teleconsult-Patient-Id");
  }
  ...
}
```

- [ ] **Step 3: Room-full rejects pre-upgrade**

Replace `return new Response("Room full", { status: 101 })` with `{ status: 409 }`.

- [ ] **Step 4: Run tests**

Run: `bun run test -- --run tests/teleconsult.test.ts tests/teleconsult-room.test.ts`
Expected: PASS

### Task 3: Doctor telemedicine toggle + appointment mode guard (backend)

**Files:**
- Modify: `apps/api/src/routes/doctor-portal.ts` (add `PATCH /doctor-portal/profile`)
- Modify: `apps/api/src/routes/teleconsult.ts:127-145` (mode check on session create)

- [ ] **Step 1: Add toggle endpoint**

```ts
doctorPortalRouter.patch("/profile", authMiddleware, requireRole("doctor"), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // accepts { telemedicineEnabled: boolean }, updates doctors row for caller, audits
});
```

- [ ] **Step 2: Enforce video mode on session create**

After the status check in `POST /teleconsult/sessions`, add: if `appt.mode !== "video"` return 409 `appointment_not_video`.

- [ ] **Step 3: Run tests**

Run: `bun run test -- --run tests/appointment-mode-video.test.ts tests/doctor-portal-queue-mode.test.ts tests/teleconsult.test.ts`
Expected: PASS (update fixtures that create sessions for in_person appointments to use mode video)

### Task 4: Caretaker join + by-room lookup + Whereby honesty (backend)

**Files:**
- Modify: `apps/api/src/routes/teleconsult.ts` (`resolveParticipant`, `GET /sessions/me/active`, new `GET /sessions/by-room/:roomId`, Whereby block `:183-215`)

- [ ] **Step 1: Caretaker principal resolution**

In `resolveParticipant`, after doctor/patient checks, look up `patient_links` (`caretakerUserId=userId`, `status=active`) and match `principalPatientId` → patient userId === `session.patientUserId`. Return `{ role: "patient", userId, viaCaretaker: true }`. Mirror in `me/active` (collect principal userIds, `inArray` query).

- [ ] **Step 2: Add by-room lookup**

```ts
teleconsultRouter.get("/sessions/by-room/:roomId", async (c) => {
  // find live row by roomId, participant-gate via resolveParticipant, return same shape as GET :id
});
```

- [ ] **Step 3: Whereby fail-closed in prod, labeled fallback in dev**

```ts
if (!wherebyRoomUrl) {
  if (String(c.env.ENVIRONMENT || "").toLowerCase() === "production") {
    return c.json({ error: "Video provider unavailable", code: "whereby_unavailable" }, 502);
  }
  // dev fallback with explicit mode flag
}
```

Return `wherebyMode: "live"|"dev-fallback"` in create response + include in `me/active` + `GET :id`.

- [ ] **Step 4: Run tests**

Run: `bun run test -- --run tests/teleconsult.test.ts tests/caretaker-access.test.ts`
Expected: PASS

### Task 5: Patient join path on web

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/teleconsult/[roomId]/page.tsx:32-62` (use by-room endpoint)
- Modify: `apps/marketing/src/app/patient/(app)/appointments/[id]/page.tsx` (add Join button)
- Modify: `apps/marketing/src/app/patient/(app)/appointments/page.tsx:502-513` (link to room when session live)
- Modify: `apps/marketing/src/patient/components/dashboard/UpcomingAppointment.tsx:89-94` (fix phantom reschedule link + Join CTA)
- Modify: `apps/portal/components/teleconsult/TeleconsultRoom.tsx` (role prop, explicit end navigation, surface endSession errors)

- [ ] **Step 1: Patient room page uses by-room lookup**

Replace the `/teleconsult/sessions/me?status=active` fetch with `GET /teleconsult/sessions/by-room/${roomId}` → `{ session: { id, ... } }`.

- [ ] **Step 2: Detail page Join button**

After resolving `data.appointment`, query `GET /teleconsult/sessions/me/active`; if `session.appointmentId === id`, render Join link to `/patient/teleconsult/${session.roomId}`.

- [ ] **Step 3: List + dashboard CTAs**

List: same active-session query; Join Call links to the room when live, else detail page. Dashboard: replace `/reschedule` href with the appointment detail href + add Join when live.

- [ ] **Step 4: TeleconsultRoom role-aware**

Add `role: "doctor"|"patient"` + `onEndedHref: string` props. Empty state uses `waitingForDoctor` for patients. `endCall` pushes `onEndedHref` (never bare `back()`), toasts on `endSession` failure instead of swallowing.

- [ ] **Step 5: Verify**

Run: `bunx eslint` on touched files; `bun run test` in `apps/marketing` (must stay green).

### Task 6: Doctor web flow (start call + multi-session)

**Files:**
- Modify: `apps/marketing/src/app/portal/(portal)/teleconsult/[roomId]/page.tsx` (by-room lookup, call startSession)
- Modify: `apps/marketing/src/portal/components/teleconsult/PatientSidebar.tsx` (remove stub docstring or implement timeline fetch)

- [ ] **Step 1: By-room lookup + start**

Replace `getActiveForMe` + roomId-match with `GET /teleconsult/sessions/by-room/${roomId}`; on mount call `startSession(id)` best-effort (surface errors via toast, don't block join).

- [ ] **Step 2: Sidebar honesty**

Delete the misleading `PatientChartTimeline` docstring; render the allergies banner + working tabs as-is.

- [ ] **Step 3: Verify** (eslint + marketing tests green)

### Task 7: Mobile join + navigation gaps

**Files:**
- Modify: `apps/mobile/src/components/teleconsult/DoctorSidePanel.tsx:105-113` (`router.push` instead of `Linking.openURL`)
- Modify: `apps/mobile/src/app/(app)/_layout.tsx` (mount patient waiting banner)
- Modify: `apps/mobile/src/app/(doctor)/queue.tsx` (Resume/Join when live session for appointment)
- Modify: `apps/mobile/src/lib/pushNavigation.ts` (teleconsult deep-link on `roomId`)
- Modify: `apps/mobile/src/app/(app)/record-detail.tsx` — no; `apps/mobile/src/components/teleconsult/TeleconsultRoom.tsx` (duration timer + explicit post-call navigation + ended receipt)

- [ ] **Step 1: Fix openFullChart**

```tsx
router.push({ pathname: "/(doctor)/patient-detail", params: { id: patientId } });
```

- [ ] **Step 2: Patient banner**

Create `PatientWaitingBanner` (mirror of `DoctorWaitingBanner`, uses `useActiveTeleconsultSession`, pushes `/(app)/teleconsult/[roomId]`) and mount in `(app)/_layout.tsx`.

- [ ] **Step 3: Queue resume + push deep-link**

Queue: if `activeSession.session.appointmentId === item.id`, show Join instead of Start. Push: if payload has `roomId`, push `/(app)/teleconsult/[roomId]` (patient) or `/(doctor)/teleconsult/[roomId]` (doctor).

- [ ] **Step 4: In-call polish**

Duration timer from mount, explicit Leave → appointments/queue navigation, ended-receipt text via existing `consult.ended` string.

- [ ] **Step 5: Verify** (`tsc --noEmit` shows no NEW errors in touched files)

## Self-Review

- Spec coverage: backend auth/identity (T1), signaling persistence (T2), booking gate (T3), caretaker + lookup + provider honesty (T4), web patient join (T5), web doctor flow (T6), mobile gaps (T7). In-call chrome (mute/camera toggles on mobile WebView) intentionally out of scope — Whereby web UI owns it.
- Type consistency: `doctorId` = users.id everywhere; `roomId` = DO name; `wherebyMode` new field consumed by mobile only.
