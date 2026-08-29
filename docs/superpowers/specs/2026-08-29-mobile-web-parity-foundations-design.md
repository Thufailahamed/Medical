# Mobile ↔ Web Patient Parity — Program Design & Sub-project 0 (Foundations)

**Date:** 2026-08-29
**Status:** Approved
**Scope of this document:** the parity program as a whole (Section 1–2), and the full design for Sub-project 0, Foundations (Section 3–7). Sub-projects 1–9 each get their own spec when they start.

---

## 1. Goal

The Expo mobile app (`apps/mobile`) and the web patient portal (`apps/marketing/src/app/patient`) must present one unified client experience: the same features, the same workflows, the same data, the same business logic, adapted to desktop/tablet layouts.

This is a parity program, not a redesign. Neither app is rebuilt. No new product features are introduced. Existing functionality on either side is preserved.

### Definition of done

Every patient-facing mobile screen is either:
- reachable at a documented `/patient/*` route with equivalent capabilities, or
- recorded as `n-a-native` in the parity manifest with a stated reason.

Both platforms call the same API endpoints, with shared types and endpoint definitions, and both invalidate their caches from the same server-sent events.

---

## 2. Audit result

### 2.1 The web portal has two patient surfaces

The decisive finding. Alongside the new `/patient/*` shell there is a legacy patient surface at `/portal/me/*` (`apps/marketing/src/app/portal/(patient)/`), roughly 5,100 lines, which several `/patient/*` pages currently `redirect()` into:

| Legacy route | Size | Status |
|---|---|---|
| `/portal/me/insurance` + 12 sub-routes | ~3,400 lines | functional |
| `/portal/me/share` | 361 lines | functional |
| `/portal/me/audit` | 110 lines | functional |
| `/portal/me/imaging`, `/imaging/[studyUid]` | 164 lines | functional |
| `/portal/me/notifications` | 194 lines | duplicate of `/patient/notifications` |
| `/portal/me/records` | 151 lines | duplicate of `/patient/records` |

Also already built on web: `/portal/verify/[id]` (prescription verification) and `/portal/teleconsult/[roomId]` (video room, doctor-side).

Parity work therefore splits into **consolidation** (feature exists, wrong shell) and **construction** (feature absent everywhere on web).

### 2.2 Gap summary

At parity today: messages, vitals, allergies, vaccinations, notes, trends. Imaging is ahead of mobile (web-only).

Needs consolidation: insurance, share links, audit, imaging, verify, teleconsult, realtime SSE.

Absent on web: records write-path; medicine add/edit/history; prescriptions; appointment booking and rating; diagnostics bookings; caretaker marketplace; family invites and lock; care-team add; notification preferences; profile editing and settings; auth completeness (register, reset, OTP, MFA, change password); six AI screens; timeline, health-summary and activity pages.

### 2.3 Scale

`apps/mobile/src/hooks/useApi.ts` is 4,897 lines and roughly 250 hooks. `apps/marketing/src/patient/hooks/index.ts` is 661 lines and roughly 50 hooks. Parity implies adding on the order of 150 hooks to the web side.

---

## 3. Decomposition

Ten sub-projects, built in order. Each has its own spec, plan, and verification, and each ships something usable on its own.

| # | Sub-project | Contents |
|---|---|---|
| 0 | **Foundations** | shared contracts package; web hook domain-split; SSE mount; parity manifest + enforcing test; nav IA rule |
| 1 | **Consolidation** | `/portal/me/*` → `/patient/*` for insurance ×13, share, audit, imaging; delete duplicate legacy records/notifications; legacy routes become redirects |
| 2 | Records write-path | create, edit, delete; upload/attachments + presign download; tags; archive/restore; move-to-family/return; structured child tabs (lab, imaging, discharge, vaccination, prescription); re-extract; smart folders; bulk operations; consents + revoke; DSAR; search |
| 3 | Medicines + prescriptions | add (interaction check, name suggestions, `X-Confirm-Warning` override), edit, stop, delete; history, adherence stats, missed doses; prescriptions list, detail, PDF download, share |
| 4 | Appointments | booking wizard (specialty → doctor search → availability → slot → confirm); rate-visit; doctor profile; patient teleconsult room |
| 5 | Auth + profile/settings | register, forgot/reset password, OTP verify, MFA setup + challenge, change password; edit-profile (demographics, photo, conditions, lifestyle, emergency contacts); appearance; support; email alias/import |
| 6 | AI suite | chat sessions; lab-explain; lab-trend; clinical-note; prescription OCR; vaccination-card OCR; add-record scan |
| 7 | Diagnostics bookings | packages + package detail; bookings list; booking detail (cancel, reschedule); results; rate-test |
| 8 | Relationships | caretaker marketplace (search, detail, inquiry, my inquiries); family invites + privacy lock; care-team add via doctor search; notification preferences |
| 9 | Remainder | timeline page; health-summary page; activity page; tenant switcher; dashboard FAB, critical-allergy banner, AI tile row |

### 3.1 Native-only capabilities

| Mobile capability | Web treatment |
|---|---|
| App-lock PIN + biometric (`expo-secure-store`) | Out of scope. No browser equivalent; session expiry covers the threat. Manifest: `n-a-native`. |
| Push notifications | Out of scope. In-app notification feed plus SSE covers delivery. Manifest: `n-a-native`. |
| Native share sheet (`expo-sharing`) | Blob download + copy-link, matching the existing `/patient/export` pattern. |
| Camera / `expo-image-picker` OCR | File-drop plus `<input type="file" capture>` against the same `/files/upload` and `/ai/ocr/*` endpoints. In scope, sub-project 6. |
| Tenant switcher | Reuses the existing `activeHospitalId` / `activeClinicId` auth-store fields and their `x-active-*` headers. UI is a picker only. In scope, sub-project 9. |

---

## 4. Sub-project 0 — Foundations

Foundations exists to make the following nine sub-projects cheap and consistent. It ships no new user-facing feature. It is deliberately small so it lands fast.

### 4.1 Shared contracts package

**Problem.** Endpoint paths and response types are defined twice — once in the mobile 4,897-line `useApi.ts`, once in the web hooks. Nothing detects when they drift. The requirement "do not create separate or different business logic for web and mobile" has no enforcement today.

**Design.** A new directory `packages/shared/src/contracts/`, one module per domain, added to the package `exports` map as `"./contracts": "./src/contracts/index.ts"`.

Each domain module exports exactly three things:

1. **Path builders** — functions returning endpoint strings, e.g. `recordsPaths.detail(id)` → `/medical-records/${id}`.
2. **Request/response types** — the shapes the API actually returns, so both platforms type against one definition.
3. **Query-key factories** — the `["patient", ...]` key structure, so cache invalidation is consistent between platforms and with `useRealtime`.

Contracts hold no runtime dependency beyond the existing `zod` already in the package. No fetch logic, no React, no platform imports. This is why the boundary is cheap: it is types and string builders.

**Seeding.** Foundations retrofits the roughly 50 *existing* web patient hooks onto contracts. The pattern is proven against working, tested code before any new domain depends on it. No new domains are added in this sub-project.

**Mobile migration.** Per-domain and opportunistic: when sub-project *N* touches a domain, the mobile hooks for that domain move onto the same contract in the same change. There is no big-bang refactor of `useApi.ts`. That file is entangled with `expo-secure-store`, `expo-sharing` and `expo-image-picker`; rewriting it wholesale would risk a shipping app for a refactor the parity goal does not require.

### 4.2 Web hook domain-split

`apps/marketing/src/patient/hooks/index.ts` is 661 lines today and is the destination for roughly 150 more hooks. Left alone it becomes a second 5,000-line file with the same problems as the mobile one.

It splits into one module per domain, with `index.ts` reduced to a re-export barrel. The domain list is derived from the actual hook inventory, not fixed in advance; on today's contents that is `profile`, `vitals`, `records`, `medicines`, `appointments`, `messages`, `notifications`, `notes`, `allergies`, `vaccinations`, `timeline`, and `labs` (lab results and refill-due). Every hook currently exported from `index.ts` lands in exactly one module.

This is a pure mechanical move with no behaviour change. Every existing page test mocks the module specifier `@/patient/hooks`, so all 17 continue to pass untouched. Those passing tests are the regression gate for the split.

`useNotifications.ts` and `useActiveFamilyMember.ts` already live outside `index.ts` and stay where they are; the barrel re-exports them so import sites remain uniform.

### 4.3 Realtime sync

This is the mechanism behind "changes made on mobile immediately reflect on the web portal, and vice versa".

`useRealtime` already exists at `src/portal/hooks/useRealtime.ts`. It mints a short-lived ticket via `POST /realtime/token`, opens an `EventSource` against `/realtime`, and converts server events into React Query invalidations. It is mounted in the portal, admin, hospital, and *legacy* patient layouts.

It is **not** mounted in `app/patient/(app)/layout.tsx`. The new patient surface has no realtime sync at all.

Two changes:

**Mount it.** Add the hook to `app/patient/(app)/layout.tsx`, reading `token` and `user.id` from the auth store the layout already subscribes to.

**Close the key-coverage gaps.** The hook's two maps were written for clinician surfaces and are missing `["patient", ...]` prefixes:

- `TYPE_TO_QUERY_KEYS`: `medicine` lacks `["patient","medicines"]` and `["patient","doses"]`; `lab_ready` lacks `["patient","records"]`; `insurance`, `vaccination`, `emergency` lack patient prefixes entirely; `general` maps only to clinician inboxes.
- `EVENT_TO_QUERY_KEYS`: no events invalidate patient vitals, notes, allergies, or timeline.

Each added mapping must correspond to a query-key factory from §4.1, so contracts and invalidation cannot disagree.

The hook's existing failure behaviour is retained and is correct: if the ticket mint or the `EventSource` fails, it gives up silently and the page falls back to `staleTime` plus refetch-on-focus. Realtime is an optimisation, never a correctness requirement.

Mobile's `useRealtime` (`apps/mobile/src/hooks/useRealtime.ts`) is a near-twin with a slightly different map. Foundations does not merge them, but records the divergence in the manifest so a later sub-project can move both onto the shared query-key factories.

### 4.4 Parity manifest

`docs/parity-manifest.md`, one row per patient-facing mobile screen:

| Column | Meaning |
|---|---|
| `mobile` | Expo route, e.g. `(app)/add-record` |
| `web` | Target route, e.g. `/patient/records/new` |
| `status` | `done` \| `planned` \| `n-a-native` |
| `sub-project` | Owning sub-project number |
| `notes` | Reason, required when `n-a-native` |

Foundations seeds the manifest with every row from the audit, statuses set to today's reality.

**Enforcement.** `apps/marketing/src/patient/parity.test.ts` parses `docs/parity-manifest.md` and asserts that every `done` row resolves to a real page file under `apps/marketing/src/app/patient/`. A row cannot be marked done for a page that does not exist, so the manifest cannot silently rot as sub-projects land. It runs in the existing marketing vitest suite; the manifest path is resolved relative to the repo root.

The test deliberately checks route existence, not behaviour. Behaviour is covered by each page's own test. Its job is to keep the parity claim honest.

### 4.5 Navigation IA rule

Fixed now so that nine sub-projects do not each re-litigate where their pages belong.

- **Sidebar** holds the web equivalents of mobile's six bottom tabs — Dashboard, Records, Medications, Appointments, Messages, Profile — plus My Health and More. This is the current sidebar; it does not change.
- **`/patient/more`** is a categorised directory mirroring the section groupings of mobile's profile hub, which is where mobile puts everything outside its tab bar.
- **Default placement:** new pages land in a `/more` category. Promotion to the sidebar requires an explicit decision in that sub-project's spec.

As `/more` grows from 12 entries to roughly 40, it gains category headings matching mobile's profile-hub sections rather than remaining a flat grid.

---

## 5. Error handling

No new error paths. The existing infrastructure is reused as-is:

- `QueryBoundary` (`src/patient/components/primitives/`) for query loading/error states.
- `ApiError` from `src/portal/lib/api.ts` for surfacing failures, carrying `status` and `details`.
- Existing `Sheet` primitives for mutation forms.

Two flows already handled centrally in `portal/lib/api.ts` and explicitly not reimplemented: 401 → refresh-token → single retry → role-correct login bounce; and `410 family_member_gone` → clear `useActiveFamilyMemberStore`.

---

## 6. Testing

Follows the established pattern exactly — deviating would strand the new pages from the existing 17.

- Per-page vitest with `vi.mock("@/patient/hooks")` stubbing each hook the page uses.
- `QueryClientProvider` wrapper for query-dependent pages.
- `next/navigation` mocked per test.
- Auth store mocked through a mutable `mockState` with a selector.

Every new page ships with a test. For Foundations specifically, the acceptance gate is that all 17 existing page tests and all component/lib tests pass unchanged after the hook split — that is the evidence that existing web functionality is not broken.

---

## 7. Constraints

**Next.js 16.2.10 / React 19.2.4.** Per `apps/marketing/AGENTS.md`, this version has breaking changes relative to training data. The relevant guide under `apps/marketing/node_modules/next/dist/docs/` must be read before writing code, in every sub-project. Note the already-present awaitable-`params` pattern in `records/[id]` and `appointments/[id]`.

**No API changes anticipated.** Every mobile hook maps to an endpoint that already exists and already serves mobile traffic. If a sub-project finds a missing endpoint, that is a flagged deviation raised before implementation, not a silent addition.

**No removals.** Existing functionality on either platform is preserved. Legacy `/portal/me/*` routes become redirects rather than deletions, so external links and bookmarks continue to work.

---

## 8. Foundations acceptance criteria

1. `packages/shared/src/contracts/` exists, is exported as `./contracts`, and the roughly 50 existing web patient hooks import their paths, types, and query keys from it.
2. `src/patient/hooks/index.ts` is a re-export barrel over per-domain modules.
3. `useRealtime` is mounted in `app/patient/(app)/layout.tsx`, and its invalidation maps cover the `["patient", ...]` key space, sourced from the contract query-key factories.
4. `docs/parity-manifest.md` exists, seeded from the audit, with every row assigned a status and a sub-project.
5. `apps/marketing/src/patient/parity.test.ts` passes and fails correctly when a `done` row points at a non-existent page.
6. All pre-existing tests pass unchanged.
