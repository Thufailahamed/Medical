# Slice 1: Patient Consents + Insurance Callbacks + Doctor Walk-ins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 mobile screens that close web→mobile gaps without new roles or native deps: `(app)/consents.tsx`, `insurance/payment/return.tsx`, `insurance/payment/cancel.tsx`, `(doctor)/walk-ins.tsx`.

**Architecture:** Pure UI screens reusing existing hooks in `apps/mobile/src/hooks/useApi.ts` (consents hooks L3905–3954, walk-ins hooks L2062–2123, `useInsuranceEnrollment` L4730). Screens registered as hidden push routes in tab layouts; entry links from `profile.tsx` (consents) and `schedule.tsx`/`queue.tsx` (walk-ins). Web mirrors: `patient/(app)/consents/page.tsx`, `insurance/payment/{return,cancel}/`, `portal/(portal)/walk-ins/page.tsx`.

**Tech Stack:** Expo SDK 52 (package.json: `expo ~52.0.0`), RN 0.76, expo-router, TanStack Query v5, `lucide-react-native`, `react-i18next`, existing `@/components/ui` primitives.

## Global Constraints

- Tokens via `useTheme()` from `@/theme/ThemeProvider`; never hardcode brand colors.
- No CSS `boxShadow` — use `shadow.*` tokens only.
- Card edges `colors.hairline`; in-card dividers `colors.separator`.
- i18n: add strings to `src/i18n/locales/{en,si,ta}.json` via targeted text insert only — never JSON round-trip the whole file.
- New hidden screens MUST be registered in the group `_layout.tsx` with `href: null, tabBarStyle: { display: "none" }` (see `(doctor)/_layout.tsx:110-113` pattern, `(app)/_layout.tsx:252` pattern).
- Files starting `// @ts-nocheck` stay that way for new screens (matches `insurance/payment/[enrollmentId].tsx:1`); verification is tsc-diff on touched files, not zero errors.
- Verification after every task: `cd apps/mobile && npx tsc --noEmit`, filter out `TS2786`, compare only touched files (baseline has ~400 pre-existing TS2786).

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/mobile/src/app/(app)/consents.tsx` (create) | Consents list + issue form + revoke + audit (Task 1) |
| `apps/mobile/src/app/(app)/profile.tsx` (modify ~1 block) | Add Consents menu row (Task 1) |
| `apps/mobile/src/app/(app)/_layout.tsx` (modify ~1 block) | Register `consents` hidden screen (Task 1) |
| `apps/mobile/src/app/(app)/insurance/payment/return.tsx` (create) | payments.lk success callback → poll → route to policy (Task 2) |
| `apps/mobile/src/app/(app)/insurance/payment/cancel.tsx` (create) | payments.lk cancel callback → cancelled state + retry (Task 2) |
| `apps/mobile/src/app/(app)/_layout.tsx` (modify ~1 block) | Register the 2 callback screens (Task 2) |
| `apps/mobile/src/app/(doctor)/walk-ins.tsx` (create) | Walk-in queue + register + status transitions (Task 3) |
| `apps/mobile/src/app/(doctor)/_layout.tsx` (modify ~1 block) | Register `walk-ins` hidden screen (Task 3) |
| `apps/mobile/src/app/(doctor)/schedule.tsx` (modify ~1 block) | Entry link to walk-ins (Task 3) |
| `src/i18n/locales/{en,si,ta}.json` (modify, targeted inserts) | `consents.*`, `insurance.payment.return/cancel.*`, `walkIns.*` keys (each task) |

---

### Task 1: Patient consents screen

**Files:**
- Create: `apps/mobile/src/app/(app)/consents.tsx`
- Modify: `apps/mobile/src/app/(app)/profile.tsx` (menu array, next to audit row ~L231-235)
- Modify: `apps/mobile/src/app/(app)/_layout.tsx` (next to `name="share"` block ~L252)
- Modify: `src/i18n/locales/{en,si,ta}.json` (targeted inserts)

**Interfaces:**
- Consumes: `useConsentsMine`, `useConsentAudit`, `useIssueConsent`, `useRevokeConsent` from `@/hooks/useApi` (signatures at useApi.ts:3905-3954; issue body `{purpose, label?, durationDays?}`, revoke takes `id: string`).
- Produces: route `/(app)/consents` (pushed from profile, no return contract).

- [ ] **Step 1: Register route + profile link + i18n keys (skeleton first)**
  In `(app)/_layout.tsx`, after the `share` Tabs.Screen block, add:
  ```tsx
  <Tabs.Screen
    name="consents"
    options={{ href: null, tabBarStyle: { display: "none" } }}
  />
  ```
  In `profile.tsx` menu array after the auditLog entry add:
  ```tsx
  {
    labelKey: "profile.item.consents.label",
    ...
    onPress: () => router.push("/(app)/consents" as any),
  },
  ```
  (Copy icon/subtitle shape from the neighboring auditLog row exactly.)
  Insert keys (en shown; si/ta = translator-provided equivalents, same key paths):
  ```json
  "profile": { "item": { "consents": { "label": "Consents & authorizations" } } },
  "consents": {
    "title": "Consents", "subtitle": "Control who may access your records",
    "issueTitle": "New authorization", "purpose": "Purpose", "duration": "Duration",
    "labelHint": "Label (optional)", "grant": "Grant access", "revoke": "Revoke",
    "active": "Active grants", "audit": "Audit trail", "empty": "No authorizations yet",
    "granted": "Authorization granted", "revoked": "Authorization revoked",
    "purposes": { "care_coordination": "Care coordination", "second_opinion": "Second opinion", "insurance_claim": "Insurance claim", "research": "Clinical research", "other": "Other" },
    "durations": { "7": "7 days", "30": "30 days", "90": "90 days", "365": "1 year" }
  }
  ```

- [ ] **Step 2: Write the screen**
  Create `consents.tsx` starting with `// @ts-nocheck` (line 1, matches sibling screens). Structure:
  ```tsx
  import { useState } from "react";
  import { View, Text, ScrollView, Alert } from "react-native";
  import { useTranslation } from "react-i18next";
  import { Screen, ScreenHeader, Card, Button, Chip, TextInput, Skeleton, EmptyState } from "@/components/ui";
  import { useTheme } from "@/theme/ThemeProvider";
  import { useConsentsMine, useConsentAudit, useIssueConsent, useRevokeConsent } from "@/hooks/useApi";

  const PURPOSES = ["care_coordination", "second_opinion", "insurance_claim", "research", "other"];
  const DURATIONS = ["7", "30", "90", "365"];
  ```
  Sections: (a) issue form — purpose chips (single-select, default `care_coordination`), duration chips (default `"30"`), optional label `TextInput`, Grant `Button` calling `issue.mutateAsync({ purpose, label: label.trim() || undefined, durationDays: Number(durationDays) })` then clearing label; on error show `Alert.alert` with `err.message`. (b) Active grants — `mine.data?.items ?? []` filtered `status === "active"`, each row shows purpose label + expiry date + Revoke button calling `revoke.mutateAsync(id)`. (c) Audit trail — `audit.data?.items ?? []` rows (action + timestamp). Loading: `Skeleton` blocks while `mine.isLoading || audit.isLoading`; error: `EmptyState` with retry (`mine.refetch()` + `audit.refetch()`). Disable Grant/Revoke buttons while their mutation `isPending`.

- [ ] **Step 3: Verify**
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep -i "consents\|profile\|_layout" || echo CLEAN`
  Expected: `CLEAN` (no new errors in touched files).
  Smoke (Expo dev): login as patient → profile → Consents → issue a 7-day grant → revoke it → confirm list + audit update.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/mobile/src/app/\(app\)/consents.tsx apps/mobile/src/app/\(app\)/profile.tsx apps/mobile/src/app/\(app\)/_layout.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
  git commit -m "feat(mobile): patient consents screen (issue/revoke/audit)"
  ```

---

### Task 2: Insurance payment return/cancel callbacks

**Files:**
- Create: `apps/mobile/src/app/(app)/insurance/payment/return.tsx`
- Create: `apps/mobile/src/app/(app)/insurance/payment/cancel.tsx`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx` (next to `insurance/payment/[enrollmentId]` ~L452)
- Modify: `src/i18n/locales/{en,si,ta}.json` (targeted inserts)

**Interfaces:**
- Consumes: `useInsuranceEnrollment(id)` from `@/hooks/useApi` (returns `{ enrollment }`, statuses include `active`/`cancelled`; see `payment/[enrollmentId].tsx:25-40` for poll pattern).
- Produces: routes `/(app)/insurance/payment/return` and `/cancel`, opened via `?enrollmentId=<id>` param; return routes to `/(app)/insurance/policy/[id]` when active.

- [ ] **Step 1: Register routes + i18n keys**
  In `(app)/_layout.tsx` after the `insurance/payment/[enrollmentId]` block add `insurance/payment/return` and `insurance/payment/cancel` hidden screens (same `href: null` options). Insert keys:
  ```json
  "insurance": { "payment": {
    "returnTitle": "Payment complete", "returnPending": "Confirming your payment…",
    "cancelTitle": "Payment cancelled", "cancelBody": "No amount was charged. You can retry when ready.",
    "viewPolicy": "View policy", "retry": "Try again", "backToPlans": "Back to plans"
  } }
  ```

- [ ] **Step 2: Write `return.tsx`**
  `// @ts-nocheck` line 1. Read `enrollmentId` via `useLocalSearchParams`. Poll `useInsuranceEnrollment(enrollmentId)` with the 3s `setInterval` refetch pattern copied from `[enrollmentId].tsx:32-40` until `status === "active"` (stop interval when active or after 20 tries → show pending-timeout state with manual "View policy" button). When active: success `Card` (ShieldCheck icon, emerald tone) + `Button` → `router.replace("/(app)/insurance/policy/${enrollment.id}")`. Loading: `Skeleton`; missing `enrollmentId` param: `EmptyState` + back button.

- [ ] **Step 3: Write `cancel.tsx`**
  `// @ts-nocheck` line 1. Static screen (no polling): cancelled `Card` (amber tone), body text, two buttons — `Try again` → `router.replace("/(app)/insurance/payment/${enrollmentId}")` (or marketplace if no id), `Back to plans` → `router.replace("/(app)/insurance/marketplace")`. `enrollmentId` optional via params.

- [ ] **Step 4: Verify**
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep -i "payment/return\|payment/cancel\|_layout" || echo CLEAN`
  Expected: `CLEAN`.
  Smoke: deep-link `.../insurance/payment/return?enrollmentId=<pending-id>` → confirm it flips to success; cancel screen buttons route correctly.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/mobile/src/app/\(app\)/insurance/payment/return.tsx apps/mobile/src/app/\(app\)/insurance/payment/cancel.tsx apps/mobile/src/app/\(app\)/_layout.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
  git commit -m "feat(mobile): insurance payment return/cancel callbacks"
  ```

---

### Task 3: Doctor walk-ins screen

**Files:**
- Create: `apps/mobile/src/app/(doctor)/walk-ins.tsx`
- Modify: `apps/mobile/src/app/(doctor)/_layout.tsx` (hidden screens list, after `queue` ~L159-161)
- Modify: `apps/mobile/src/app/(doctor)/schedule.tsx` (entry button — find queue-link area; if none, add header action)
- Modify: `src/i18n/locales/{en,si,ta}.json` (targeted inserts)

**Interfaces:**
- Consumes: `useWalkIns({status?})`, `useCreateWalkIn` (`{patientId, doctorId, reason?, priority?}`), `useUpdateWalkIn` (`{id, status?, notes?}`), `useWalkInSearch(q)` from `@/hooks/useApi` (useApi.ts:2062-2123). `doctorId` = current user id from `useAuthStore`.
- Produces: route `/(doctor)/walk-ins` (pushed from schedule; no return contract).

- [ ] **Step 1: Register route + i18n keys**
  Add hidden `walk-ins` Tabs.Screen after `queue` in `(doctor)/_layout.tsx`. Insert keys:
  ```json
  "walkIns": {
    "title": "Walk-ins", "subtitle": "Same-day arrivals without appointments",
    "register": "Register walk-in", "searchPatient": "Search patient (name, phone, NIC)",
    "reason": "Reason for visit", "priority": "Priority", "routine": "Routine", "urgent": "Urgent",
    "start": "Start consultation", "complete": "Complete", "markNoShow": "No-show",
    "empty": "No walk-ins in this state", "registered": "Walk-in registered",
    "statuses": { "waiting": "Waiting", "in_consultation": "In consultation", "completed": "Completed", "no_show": "No-show", "all": "All" }
  }
  ```

- [ ] **Step 2: Write the screen**
  `// @ts-nocheck` line 1. Status filter chips (`waiting` default, plus `in_consultation`, `completed`, `no_show`, `all`) driving `useWalkIns({ status: filter === "all" ? undefined : filter })` (30s auto-refetch built into hook). Rows show patient name, reason, arrival time, priority chip; actions per status: `waiting` → Start (`in_consultation`); `in_consultation` → Complete (`completed`) + No-show (`no_show`). Each action calls `update.mutateAsync` with the row id; disable row buttons while `update.isPending`. Register sheet (BottomSheet per `@/components/ui` exports; check `share.tsx` or `refill.tsx` for the established BottomSheet pattern in this codebase and copy it): patient search `TextInput` (min 2 chars) → `useWalkInSearch` results list → select → reason input + priority chips → Register button → `create.mutateAsync({ patientId, doctorId: user.id, reason, priority })`. On success close sheet; on error `Alert.alert` with message.

- [ ] **Step 3: Entry link + verify**
  In `schedule.tsx` add a walk-ins entry (button/link → `router.push("/(doctor)/walk-ins")`); check `queue.tsx` for an existing walk-ins affordance first and reuse its label pattern if present.
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep -i "walk-ins\|schedule\|doctor/_layout" || echo CLEAN`
  Expected: `CLEAN`.
  Smoke (doctor login): open walk-ins from schedule → register test walk-in → transition waiting → in-consultation → completed.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/mobile/src/app/\(doctor\)/walk-ins.tsx apps/mobile/src/app/\(doctor\)/_layout.tsx apps/mobile/src/app/\(doctor\)/schedule.tsx apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
  git commit -m "feat(mobile): doctor walk-ins queue and registration"
  ```

---

## Self-Review

- **Spec coverage:** Slice 1 items all tasked — consents (§2a→Task 1), payment return/cancel (§2b→Task 2), walk-ins (§2c→Task 3). Slices 2–3 intentionally excluded (separate plans per scope check).
- **Placeholder scan:** No TBD/TODO; hook signatures pinned to file lines; i18n key paths explicit; shell commands copy-pasteable. One adaptation: no unit-test steps — `apps/mobile` has no test runner (`scripts` = start/android/ios/typecheck only), so verification is tsc-diff + Expo smoke, stated in Global Constraints.
- **Type consistency:** Hook names match `useApi.ts` exports (`useConsentsMine`, `useConsentAudit`, `useIssueConsent`, `useRevokeConsent`, `useWalkIns`, `useCreateWalkIn`, `useUpdateWalkIn`, `useWalkInSearch`, `useInsuranceEnrollment`); route paths match expo-router file conventions used by siblings.
- **Correction from spec:** backend operator role is `insurance` (+`operatorOrgId`), not `insurance_operator` (found in `apps/api/src/routes/insurance-operator.ts:102`) — recorded here for the Slice 3 plan; Slice 1 unaffected.
