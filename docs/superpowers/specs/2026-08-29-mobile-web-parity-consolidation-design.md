# Mobile ↔ Web Patient Parity — Sub-project 1 (Consolidation)

**Date:** 2026-08-29
**Status:** Approved
**Scope:** Move every patient-facing page currently under `/portal/me/*` to its `/patient/*` equivalent. Delete the two duplicate pages. Preserve old paths as redirects. Out of scope for this sub-project: insurance write-path (3), appointment booking (4), auth/settings (5), AI (6), diagnostics bookings (7), relationships (8), remainder (9), and the cross-role teleconsult / public-verify routes.

---

## 1. Goal

Bring the web patient portal's URL surface into one shell. Today the patient uses two: `/portal/me/*` (legacy, ~5,000 lines, separate shell) and `/patient/*` (new, under the parity program). Parity demands every patient-facing URL live under `/patient/*`. `/portal/me/*` becomes redirect-only.

Foundations seeded five stubs under `/patient/*` that `redirect("/portal/me/...")`. Those stubs get replaced by the real pages they currently point at. Functionality doesn't change; only the URL surface consolidates.

### Definition of done

| | |
|---|---|
| **1.** | Every `/portal/me/X` URL that exists today returns either its real implementation (if a destination page now serves) or a 2xx redirect (if the legacy URL still needs to work). |
| **2.** | `/patient/insurance` and all 12 `/patient/insurance/*` sub-routes serve real pages — the moved code. |
| **3.** | `/patient/share`, `/patient/audit`, `/patient/imaging`, `/patient/imaging/[studyUid]` serve real pages — the moved code. |
| **4.** | `/portal/me/records` and `/portal/me/notifications` redirect to `/patient/records` and `/patient/notifications`. |
| **5.** | `apps/marketing/src/patient/parity.test.ts` passes — every insurance sub-route row that previously said `planned` now says `done` and resolves to a real page file. |
| **6.** | Marketing test count unchanged: no new failures. |

---

## 2. What's in scope

| Source | Destination | Approx. lines |
|---|---|---|
| `/portal/me/insurance` | `/patient/insurance` | 441 |
| `/portal/me/insurance/claims` | `/patient/insurance/claims` | |
| `/portal/me/insurance/claims/new` | `/patient/insurance/claims/new` | |
| `/portal/me/insurance/claims/[id]` | `/patient/insurance/claims/[id]` | |
| `/portal/me/insurance/coverage-check` | `/patient/insurance/coverage-check` | |
| `/portal/me/insurance/ecard/[id]` | `/patient/insurance/ecard/[id]` | |
| `/portal/me/insurance/enroll/[planId]` | `/patient/insurance/enroll/[planId]` | |
| `/portal/me/insurance/marketplace` | `/patient/insurance/marketplace` | |
| `/portal/me/insurance/marketplace/[providerId]` | `/patient/insurance/marketplace/[providerId]` | |
| `/portal/me/insurance/payment/[enrollmentId]` | `/patient/insurance/payment/[enrollmentId]` | |
| `/portal/me/insurance/plans/[planId]` | `/patient/insurance/plans/[planId]` | |
| `/portal/me/insurance/policy/[id]` | `/patient/insurance/policy/[id]` | |
| `/portal/me/insurance/quote` | `/patient/insurance/quote` | |
| `/portal/me/share` | `/patient/share` | 361 |
| `/portal/me/audit` | `/patient/audit` | 110 |
| `/portal/me/imaging` | `/patient/imaging` | 65 |
| `/portal/me/imaging/[studyUid]` | `/patient/imaging/[studyUid]` | 99 |
| `/portal/me/records` | **delete** (duplicate of `/patient/records`) | 151 |
| `/portal/me/notifications` | **delete** (duplicate of `/patient/notifications`) | 194 |

Five `/patient/*` stubs today (`insurance`, `share`, `audit`, `imaging`, `imaging/[studyUid]`) are `redirect("/portal/me/...")` — they get overwritten by the real moved code.

`/portal/me/page.tsx` already redirects to `/patient`; leave.

### Out of scope (later sub-projects)

| Route | Reason | Sub-project |
|---|---|---|
| `/portal/verify/[id]` | Public route, no auth, used by pharmacist QR scans. Mobile's `(app)/verify/[id]` is login-gated — different audiences. | 3 (consolidation records it as `kept at /portal/verify/[id]`) |
| `/portal/(portal)/teleconsult/[roomId]` | Doctor-facing. Mobile's `(app)/teleconsult/[roomId]` is patient-facing — separate work. | 4 |
| Insurance write-path mutations | Already work at the new URL — they're just live in the moved code. | 3 owns follow-up UX |
| Records write-path | Already partly under `/patient/*`; write actions come with sub-project 2 | 2 |

---

## 3. Approach

**Physical move + URL-level redirects.** Each `/portal/me/X/page.tsx` body moves to `/patient/X/page.tsx`. The source becomes a one-line `redirect()`. The `(patient)` route group becomes a redirect shell, then is removed.

### Step 1 — Move pages (17 files)

For each of the 17 destinations in the table above:

```bash
mv apps/marketing/src/app/portal/\(patient\)/me/X/page.tsx \
   apps/marketing/src/app/patient/\(app\)/X/page.tsx
```

The destination's existing stub (if any) is overwritten. Insurance has 13 destinations (root + 12 sub-routes); the others are 1:1.

### Step 2 — Replace each moved-from source with a redirect

Every page that just got moved is replaced with a one-liner. Same pattern as today's stubs:

```ts
import { redirect } from "next/navigation";

export default function LegacyInsurancePage() {
  redirect("/patient/insurance");
}
```

For the 12 insurance sub-routes with `[id]` / `[planId]` / `[providerId]` / `[enrollmentId]` params, the redirect preserves nothing — those pages don't take client input, they take route params from the URL itself. `/portal/me/insurance/marketplace/[providerId]` → `/patient/insurance/marketplace/[providerId]` works because Next.js rewrites the URL, not because the redirect extracts params. **The page-level `redirect()` does NOT preserve dynamic segments.**

This is the trap. Two options:

**Option A (recommended): `next.config.js` route-level redirects.** Define one redirect per dynamic segment so the param passes through:

```js
async redirects() {
  return [
    { source: "/portal/me/insurance/marketplace/:providerId",
      destination: "/patient/insurance/marketplace/:providerId",
      permanent: true },
    // ... 11 more
  ];
}
```

**Option B: route-level `redirect()` per page with no params.** Same as today but each source page still has its dynamic segment; the redirect loses it. `/portal/me/insurance/marketplace/foo` lands at `/patient/insurance/marketplace` — wrong.

**Option A wins.** All redirects live in one place (`next.config.js`), preserve params via `:param` syntax, and don't add 17 new files.

### Step 3 — Delete duplicates and redirect them

`/portal/me/records` and `/portal/me/notifications` page files are deleted. Their functionality exists at `/patient/records` and `/patient/notifications`. Redirects from the legacy URLs go in `next.config.js`:

```js
{ source: "/portal/me/records", destination: "/patient/records", permanent: true },
{ source: "/portal/me/notifications", destination: "/patient/notifications", permanent: true },
```

### Step 4 — Remove the `(patient)` shell

`apps/marketing/src/app/portal/(patient)/layout.tsx` (194 lines, has the legacy nav strip with Records/Imaging/Share/Audit/Insurance) renders nothing after the move — every child is a redirect. Delete it.

The `(patient)` route group itself can stay (empty dirs are fine in Next.js; they exist only for URL grouping and the redirects live in `next.config.js`).

### Step 5 — Update tests

The legacy pages had their own tests. Find them via `find apps/marketing -name '*test*' -path '*portal/(patient)/me*'`. For each:

- Tests that mock `/portal/me/X` behaviour → delete. Behaviour lives at `/patient/X`.
- Tests that test the legacy URL → delete. The URL is gone; coverage lives at the new URL's test.
- Tests for `next.config.js` redirects → write new ones (see §6).

### Step 6 — Update the parity manifest

Flip the affected rows from `planned` → `done`:

| mobile | web | old | new |
|---|---|---|---|
| `(app)/insurance/index` | `/patient/insurance` | done | done (already correct) |
| `(app)/insurance/marketplace` | `/patient/insurance/marketplace` | planned | done |
| `(app)/insurance/marketplace/[providerId]` | `/patient/insurance/marketplace/[providerId]` | planned | done |
| `(app)/insurance/plans/[planId]` | `/patient/insurance/plans/[planId]` | planned | done |
| `(app)/insurance/quote` | `/patient/insurance/quote` | planned | done |
| `(app)/insurance/enroll/[planId]` | `/patient/insurance/enroll/[planId]` | planned | done |
| `(app)/insurance/payment/[enrollmentId]` | `/patient/insurance/payment/[enrollmentId]` | planned | done |
| `(app)/insurance/policy/[id]` | `/patient/insurance/policy/[id]` | planned | done |
| `(app)/insurance/ecard/[id]` | `/patient/insurance/ecard/[id]` | planned | done |
| `(app)/insurance/coverage-check` | `/patient/insurance/coverage-check` | planned | done |
| `(app)/insurance/claims/index` | `/patient/insurance/claims` | planned | done |
| `(app)/insurance/claims/new` | `/patient/insurance/claims/new` | planned | done |
| `(app)/insurance/claims/[id]` | `/patient/insurance/claims/[id]` | planned | done |

For `(app)/verify/[id]`, add a row:

```
| `(app)/verify/[id]` | `/portal/verify/[id]` | done | 1 | Public route, ungated; mobile's verify is login-gated and separate |
```

---

## 4. Constraints

- **Next.js 16.2.10 / React 19.2.4.** `next.config.js` `redirects()` API is stable across recent majors. Read `node_modules/next/dist/docs/04-community/01-contribution-guide.md` and the redirects reference before editing the config. Per `apps/marketing/AGENTS.md`.
- **No user-visible behaviour change.** Same pages, same data, just at new URLs (with redirects preserving the old).
- **No removals of existing functionality.** Records and notifications lose their `/portal/me/*` URL but their functionality lives at `/patient/*`. Insurance/share/audit/imaging lose nothing — same code, new URL.
- **`next.config.js` redirects vs page-level `redirect()`.** Route-level redirects in `next.config.js` are evaluated before routing. Page-level `redirect()` runs only when the page matches. For dynamic segments (`:providerId`, `:planId`, etc.), route-level preserves the param; page-level drops it. **All consolidation redirects go in `next.config.js`.**
- **`permanent: true` vs `permanent: false`.** `permanent: true` maps to HTTP 308 (preserves method, caches). `permanent: false` maps to 307. Use `permanent: true` — these are real "moved permanently" semantics and crawlers/users benefit from the cache.
- **Test command from `apps/marketing`**: `bun run test`. Typecheck: `bun run typecheck`. Repo-root `bun run typecheck` runs all packages; mobile typecheck has a pre-existing ReactNode/bigint error unrelated to this work.
- **Branch: `feat/mobile-web-parity`.**

---

## 5. Architecture (data flow unchanged)

Move doesn't change runtime. Each page already calls `/insurance/...` (etc.) endpoints via `api()` — those endpoints don't move. The mobile twin already hits them.

The auth flow is the one thing that does change:

- **Before:** a `/portal/me/...` URL renders under `(patient)/layout.tsx`, which gates on `useAuthStore.token` and role `patient`. Redirects to `/portal/login?next=...` if no token.
- **After:** a `/portal/me/...` URL hits `next.config.js` redirect → 308 to `/patient/insurance/...` → renders under `/patient/(app)/layout.tsx`, which gates on the same `useAuthStore` but with the new patient gate and the new `PatientShell`. Same auth, different shell.

The new shell (`/patient/(app)/layout.tsx`, with `PatientShell` and `useRealtime` mounted) is what the rest of `/patient/*` uses. The consolidation brings insurance under that same shell, which is the right behaviour.

---

## 6. Testing

Foundations §6 pattern: per-page vitest with `vi.mock("@/patient/hooks")`. Consolidation adds three test layers:

1. **No regression on existing tests.** Run `cd apps/marketing && bun run test`. Failure count must not exceed baseline (8 pre-existing).
2. **New tests for the moved pages.** Each moved page is a real React component under `/patient/X/page.tsx`. If the existing test under `/portal/me/X/page.test.tsx` covered rendering, copy it to `/patient/X/page.test.tsx` and update the mock specifier to `@/patient/hooks` (since the moved pages import from there). Delete the old test file.
3. **New tests for the redirects.** `apps/marketing/src/portal/(patient)/me/.redirects.test.tsx` (or in the marketing config's portal scope) verifies that `GET /portal/me/X` returns a 308 to `/patient/X`. This is the parity guarantee: the old URLs still work.

For the redirect tests, two patterns work:

- **Vitest fetch test:** spin up a fetch against a known Next.js dev server, assert the 308. Heavy.
- **Static config test:** read `apps/marketing/next.config.js`, parse the `redirects()` return value, assert the entries exist. Light. Catches the most common regression (someone deletes a redirect).

Use the static config test. It catches the regression at low cost.

### Test files

| Path | Action |
|---|---|
| `apps/marketing/src/app/portal/(patient)/me/insurance/page.test.tsx` (if exists) | delete |
| `apps/marketing/src/app/portal/(patient)/me/share/page.test.tsx` (if exists) | delete |
| `apps/marketing/src/app/portal/(patient)/me/audit/page.test.tsx` (if exists) | delete |
| `apps/marketing/src/app/portal/(patient)/me/imaging/page.test.tsx` (if exists) | delete |
| `apps/marketing/src/app/portal/(patient)/me/imaging/[studyUid]/page.test.tsx` (if exists) | delete |
| `apps/marketing/src/app/patient/(app)/insurance/page.test.tsx` | create if no equivalent exists |
| `apps/marketing/src/app/patient/(app)/share/page.test.tsx` | create |
| `apps/marketing/src/app/patient/(app)/audit/page.test.tsx` | create |
| `apps/marketing/src/app/patient/(app)/imaging/page.test.tsx` | create |
| `apps/marketing/src/app/patient/(app)/imaging/[studyUid]/page.test.tsx` | create |
| `apps/marketing/src/portal/redirects.test.ts` | create — asserts `next.config.js` redirects |

---

## 7. Sub-project boundaries

What this sub-project owns:
- Physical move of 17 pages from `/portal/me/*` to `/patient/*`.
- `next.config.js` redirects for all moved paths plus the two duplicates.
- Manifest updates.
- `(patient)/layout.tsx` deletion.

What this sub-project explicitly does NOT own:
- Any new feature work on the moved pages (insurance write-path, etc.) — sub-project 3.
- Auth/settings/registration — sub-project 5.
- Mobile teleconsult room — sub-project 4.

---

## 8. Acceptance criteria

1. Every `/portal/me/X` URL that existed before this sub-project returns either a 2xx (served by `/patient/X`) or a 308 redirect to its `/patient/*` equivalent.
2. `/patient/insurance` + 12 sub-routes serve real pages (the moved code).
3. `/patient/share`, `/patient/audit`, `/patient/imaging`, `/patient/imaging/[studyUid]` serve real pages (the moved code).
4. `/portal/me/records` and `/portal/me/notifications` redirect to their `/patient/*` equivalents.
5. `apps/marketing/src/patient/parity.test.ts` passes — the 13 insurance rows flip from `planned` to `done` and resolve to real page files.
6. Marketing test suite count of failing tests ≤ baseline (8 pre-existing failures, all unrelated to this work).
