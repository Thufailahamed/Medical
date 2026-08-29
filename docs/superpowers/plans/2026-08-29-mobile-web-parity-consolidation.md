# Sub-project 1 — Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every patient-facing page from `/portal/me/*` to `/patient/*`, delete the two duplicate pages, and preserve old URLs as `next.config.js` redirects.

**Architecture:** Physical file move. The five existing `/patient/*` stubs that currently `redirect("/portal/me/...")` get overwritten by the real pages. The legacy `/portal/me/*` paths become `next.config.js` redirects — route-level, so dynamic segments (`[providerId]`, `[planId]`, etc.) pass through. The `(patient)` route group's layout shell becomes dead weight and gets deleted.

**Tech Stack:** Next.js 16.2.10 / React 19.2.4 (App Router), TypeScript, Vitest.

## Global Constraints

- **Next.js 16.2.10 / React 19.2.4.** Per `apps/marketing/AGENTS.md`, read the relevant guide under `apps/marketing/node_modules/next/dist/docs/` before writing app-router or `next.config.ts` code.
- **No user-visible behaviour change.** Same code, same data, new URLs.
- **All redirects go in `next.config.ts`.** Page-level `redirect()` drops dynamic segments; route-level redirects in `next.config.ts` preserve them.
- **`permanent: true`** for these redirects — they are real "moved permanently" semantics (HTTP 308).
- **Test command from `apps/marketing`**: `bun run test`. Typecheck: `bun run typecheck`. Marketing-only baseline failure count: 8 (pre-existing, unrelated).
- **Branch: `feat/mobile-web-parity`.**

---

### Task 1: Add `next.config.ts` redirects with a config-level test

The redirects land in the config first, before any file move. That way, even if a page move is partially rolled back, the old URLs still work and the test gives a green-or-red signal at every commit.

**Files:**
- Modify: `apps/marketing/next.config.ts` (add `async redirects()` block)
- Create: `apps/marketing/src/portal/redirects.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a static helper `consolidationRedirects()` exported from the config (so the test can import the same list without spinning up a Next server).

- [ ] **Step 1: Write the failing test**

Create `apps/marketing/src/portal/redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { consolidationRedirects } from "../../next.config";

/**
 * The /portal/me/* consolidation moves 17 pages to /patient/* and drops
 * two duplicates. The redirect list is a static helper exported from
 * next.config.ts so this test catches the most common regression —
 * someone deletes a redirect entry — without spinning up a Next server.
 */
const EXPECTED = [
  // 13 insurance paths (root + 12 sub-routes).
  ["/portal/me/insurance", "/patient/insurance"],
  ["/portal/me/insurance/marketplace", "/patient/insurance/marketplace"],
  ["/portal/me/insurance/marketplace/:providerId", "/patient/insurance/marketplace/:providerId"],
  ["/portal/me/insurance/plans/:planId", "/patient/insurance/plans/:planId"],
  ["/portal/me/insurance/quote", "/patient/insurance/quote"],
  ["/portal/me/insurance/enroll/:planId", "/patient/insurance/enroll/:planId"],
  ["/portal/me/insurance/payment/:enrollmentId", "/patient/insurance/payment/:enrollmentId"],
  ["/portal/me/insurance/policy/:id", "/patient/insurance/policy/:id"],
  ["/portal/me/insurance/ecard/:id", "/patient/insurance/ecard/:id"],
  ["/portal/me/insurance/coverage-check", "/patient/insurance/coverage-check"],
  ["/portal/me/insurance/claims", "/patient/insurance/claims"],
  ["/portal/me/insurance/claims/new", "/patient/insurance/claims/new"],
  ["/portal/me/insurance/claims/:id", "/patient/insurance/claims/:id"],
  // share / audit / imaging.
  ["/portal/me/share", "/patient/share"],
  ["/portal/me/audit", "/patient/audit"],
  ["/portal/me/imaging", "/patient/imaging"],
  ["/portal/me/imaging/:studyUid", "/patient/imaging/:studyUid"],
  // Two duplicates redirect to the real pages under /patient.
  ["/portal/me/records", "/patient/records"],
  ["/portal/me/notifications", "/patient/notifications"],
] as const;

describe("consolidationRedirects", () => {
  it.each(EXPECTED)("redirects %s to %s", (source, destination) => {
    const entry = consolidationRedirects().find((r) => r.source === source);
    expect(entry, `no redirect for ${source}`).toBeDefined();
    expect(entry!.destination).toBe(destination);
    expect(entry!.permanent).toBe(true);
  });

  it("returns no duplicate sources", () => {
    const sources = consolidationRedirects().map((r) => r.source);
    expect(new Set(sources).size).toBe(sources.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/marketing && bun run test src/portal/redirects.test.ts`
Expected: FAIL — `consolidationRedirects` is not exported.

- [ ] **Step 3: Implement the redirect list**

Replace the contents of `apps/marketing/next.config.ts` with:

```ts
import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/**
 * /portal/me/* → /patient/* consolidation redirects.
 *
 * Exported as a static helper so the redirects list is unit-testable
 * without spinning up a Next dev server. Each entry maps to a
 * `redirects()` config block via the helper below.
 */
export interface RedirectEntry {
  source: string;
  destination: string;
  permanent: boolean;
}

export function consolidationRedirects(): RedirectEntry[] {
  return [
    { source: "/portal/me/insurance", destination: "/patient/insurance", permanent: true },
    { source: "/portal/me/insurance/marketplace", destination: "/patient/insurance/marketplace", permanent: true },
    { source: "/portal/me/insurance/marketplace/:providerId", destination: "/patient/insurance/marketplace/:providerId", permanent: true },
    { source: "/portal/me/insurance/plans/:planId", destination: "/patient/insurance/plans/:planId", permanent: true },
    { source: "/portal/me/insurance/quote", destination: "/patient/insurance/quote", permanent: true },
    { source: "/portal/me/insurance/enroll/:planId", destination: "/patient/insurance/enroll/:planId", permanent: true },
    { source: "/portal/me/insurance/payment/:enrollmentId", destination: "/patient/insurance/payment/:enrollmentId", permanent: true },
    { source: "/portal/me/insurance/policy/:id", destination: "/patient/insurance/policy/:id", permanent: true },
    { source: "/portal/me/insurance/ecard/:id", destination: "/patient/insurance/ecard/:id", permanent: true },
    { source: "/portal/me/insurance/coverage-check", destination: "/patient/insurance/coverage-check", permanent: true },
    { source: "/portal/me/insurance/claims", destination: "/patient/insurance/claims", permanent: true },
    { source: "/portal/me/insurance/claims/new", destination: "/patient/insurance/claims/new", permanent: true },
    { source: "/portal/me/insurance/claims/:id", destination: "/patient/insurance/claims/:id", permanent: true },
    { source: "/portal/me/share", destination: "/patient/share", permanent: true },
    { source: "/portal/me/audit", destination: "/patient/audit", permanent: true },
    { source: "/portal/me/imaging", destination: "/patient/imaging", permanent: true },
    { source: "/portal/me/imaging/:studyUid", destination: "/patient/imaging/:studyUid", permanent: true },
    { source: "/portal/me/records", destination: "/patient/records", permanent: true },
    { source: "/portal/me/notifications", destination: "/patient/notifications", permanent: true },
  ];
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  transpilePackages: ["recharts"],
  async redirects() {
    return consolidationRedirects();
  },
};

export default nextConfig;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/marketing && bun run test src/portal/redirects.test.ts`
Expected: PASS (20 assertions — 19 redirects × 2 checks + 1 dup-source check).

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/next.config.ts apps/marketing/src/portal/redirects.test.ts
git commit -m "feat(portal): route-level redirects for /portal/me consolidation"
```

---

### Task 2: Move insurance + 12 sub-routes to `/patient/insurance/*`

The biggest batch. 13 files. Each destination currently has a 5-line stub OR nothing; both cases get overwritten by the move. Test suite acts as regression gate.

**Files:**
- Move 13 files from `apps/marketing/src/app/portal/(patient)/me/insurance/*` to `apps/marketing/src/app/patient/(app)/insurance/*`
- Create the destination directories as needed

**Interfaces:**
- Consumes: nothing new.
- Produces: 13 real pages under `/patient/insurance/*`. Old paths still serve (via redirects from Task 1).

- [ ] **Step 1: Move the insurance root**

Run:

```bash
cd /Users/thufailahamed/Downloads/App-2
mkdir -p "apps/marketing/src/app/patient/(app)/insurance"
mv "apps/marketing/src/app/portal/(patient)/me/insurance/page.tsx" \
   "apps/marketing/src/app/patient/(app)/insurance/page.tsx"
```

- [ ] **Step 2: Move claims and its three children**

```bash
mkdir -p "apps/marketing/src/app/patient/(app)/insurance/claims/new" \
         "apps/marketing/src/app/patient/(app)/insurance/claims/[id]"
mv "apps/marketing/src/app/portal/(patient)/me/insurance/claims/page.tsx" \
   "apps/marketing/src/app/patient/(app)/insurance/claims/page.tsx"
mv "apps/marketing/src/app/portal/(patient)/me/insurance/claims/new/page.tsx" \
   "apps/marketing/src/app/patient/(app)/insurance/claims/new/page.tsx"
mv "apps/marketing/src/app/portal/(patient)/me/insurance/claims/[id]/page.tsx" \
   "apps/marketing/src/app/patient/(app)/insurance/claims/[id]/page.tsx"
```

- [ ] **Step 3: Move the rest of the insurance sub-routes**

```bash
mkdir -p "apps/marketing/src/app/patient/(app)/insurance/coverage-check" \
         "apps/marketing/src/app/patient/(app)/insurance/ecard/[id]" \
         "apps/marketing/src/app/patient/(app)/insurance/enroll/[planId]" \
         "apps/marketing/src/app/patient/(app)/insurance/marketplace/[providerId]" \
         "apps/marketing/src/app/patient/(app)/insurance/payment/[enrollmentId]" \
         "apps/marketing/src/app/patient/(app)/insurance/plans/[planId]" \
         "apps/marketing/src/app/patient/(app)/insurance/policy/[id]" \
         "apps/marketing/src/app/patient/(app)/insurance/quote"

for path in coverage-check ecard/[id] enroll/[planId] marketplace marketplace/[providerId] \
            payment/[enrollmentId] plans/[planId] policy/[id] quote; do
  src="apps/marketing/src/app/portal/(patient)/me/insurance/$path/page.tsx"
  dst="apps/marketing/src/app/patient/(app)/insurance/$path/page.tsx"
  [ -f "$src" ] && mv "$src" "$dst"
done
```

After this step the `apps/marketing/src/app/portal/(patient)/me/insurance/` tree is empty except for any directories that had no `page.tsx`. Inspect:

```bash
find "apps/marketing/src/app/portal/(patient)/me/insurance" -type f 2>&1
```

Expected: only `page.tsx` files moved; the directories may be empty but no `page.tsx` should remain under `/portal/me/insurance`. If a stray file remains, move it.

- [ ] **Step 4: Run the redirect test and full marketing suite**

Run: `cd apps/marketing && bun run test src/portal/redirects.test.ts && bun run test`
Expected:
- Redirect test PASS.
- Marketing test count unchanged (≤ 8 failures, all pre-existing).
- New error to watch for: `Cannot find module '@/patient/hooks/useInsurance'` etc. — if any moved page imports something that lived under `/portal/...`, fix the import path. Document any such fix in the commit message.

- [ ] **Step 5: Commit**

```bash
git add -A "apps/marketing/src/app/portal/(patient)/me/insurance" "apps/marketing/src/app/patient/(app)/insurance"
git commit -m "refactor(patient): move insurance pages from /portal/me to /patient"
```

---

### Task 3: Move share, audit, imaging + imaging/[studyUid]

Smaller batch — 4 files. Same pattern.

**Files:**
- Move 4 files.

- [ ] **Step 1: Move share, audit, imaging**

```bash
cd /Users/thufailahamed/Downloads/App-2
mkdir -p "apps/marketing/src/app/patient/(app)/imaging/[studyUid]"

mv "apps/marketing/src/app/portal/(patient)/me/share/page.tsx" \
   "apps/marketing/src/app/patient/(app)/share/page.tsx"

mv "apps/marketing/src/app/portal/(patient)/me/audit/page.tsx" \
   "apps/marketing/src/app/patient/(app)/audit/page.tsx"

mv "apps/marketing/src/app/portal/(patient)/me/imaging/page.tsx" \
   "apps/marketing/src/app/patient/(app)/imaging/page.tsx"

mv "apps/marketing/src/app/portal/(patient)/me/imaging/[studyUid]/page.tsx" \
   "apps/marketing/src/app/patient/(app)/imaging/[studyUid]/page.tsx"
```

The destination stubs at `/patient/{share,audit,imaging}/page.tsx` (each was `redirect("/portal/me/...")`) get overwritten.

- [ ] **Step 2: Verify nothing remains under `/portal/me` except redirects-to-be-deleted**

```bash
find "apps/marketing/src/app/portal/(patient)/me" -type f 2>&1
```

Expected remaining files:
- `apps/marketing/src/app/portal/(patient)/me/page.tsx` — already redirects to `/patient`, leave
- `apps/marketing/src/app/portal/(patient)/me/records/page.tsx` — DELETE in Task 4
- `apps/marketing/src/app/portal/(patient)/me/notifications/page.tsx` — DELETE in Task 4

- [ ] **Step 3: Run the redirect test and full suite**

Run: `cd apps/marketing && bun run test src/portal/redirects.test.ts && bun run test`
Expected: PASS redirect test. Marketing test count ≤ 8.

- [ ] **Step 4: Commit**

```bash
git add -A "apps/marketing/src/app/portal/(patient)/me/share" \
         "apps/marketing/src/app/portal/(patient)/me/audit" \
         "apps/marketing/src/app/portal/(patient)/me/imaging" \
         "apps/marketing/src/app/patient/(app)/share" \
         "apps/marketing/src/app/patient/(app)/audit" \
         "apps/marketing/src/app/patient/(app)/imaging"
git commit -m "refactor(patient): move share/audit/imaging pages to /patient"
```

---

### Task 4: Delete duplicate pages and the `(patient)` layout shell

`/portal/me/records` and `/portal/me/notifications` are duplicates of `/patient/records` and `/patient/notifications` — delete them. The `(patient)/layout.tsx` renders nothing useful after the move — delete it too.

**Files:**
- Delete: `apps/marketing/src/app/portal/(patient)/me/records/page.tsx`
- Delete: `apps/marketing/src/app/portal/(patient)/me/notifications/page.tsx`
- Delete: `apps/marketing/src/app/portal/(patient)/layout.tsx`

- [ ] **Step 1: Delete the two duplicate pages**

```bash
cd /Users/thufailahamed/Downloads/App-2
rm "apps/marketing/src/app/portal/(patient)/me/records/page.tsx"
rm "apps/marketing/src/app/portal/(patient)/me/notifications/page.tsx"
```

The legacy URLs still work — Task 1's `next.config.ts` redirects handle them.

- [ ] **Step 2: Delete the `(patient)` layout shell**

```bash
rm "apps/marketing/src/app/portal/(patient)/layout.tsx"
```

The remaining tree at `/portal/(patient)/me/` is just `page.tsx` (the root, which already redirects to `/patient`). After this deletion, the `(patient)` route group is empty.

- [ ] **Step 3: Verify the marketing test suite**

Run: `cd apps/marketing && bun run test`
Expected: ≤ 8 failures (baseline). No new failures.

If a test imports from the deleted files, fix it: search with:

```bash
grep -rn 'portal/(patient)' apps/marketing/src 2>&1
```

Any hit should be a reference to a redirect target, an old import to update, or a test to delete.

- [ ] **Step 4: Commit**

```bash
git add -A "apps/marketing/src/app/portal/(patient)"
git commit -m "refactor(portal): delete duplicate records/notifications pages and (patient) shell"
```

---

### Task 5: Update parity manifest

Flip 13 insurance rows from `planned` to `done`. Add the verify row.

**Files:**
- Modify: `docs/parity-manifest.md`

- [ ] **Step 1: Update the manifest rows**

In `docs/parity-manifest.md`, change the `status` cell from `planned` to `done` for these 13 rows. The cells are unique enough that targeted Edit calls work; alternatively use a sed replacement on the exact strings.

Affected lines:

```
| `(app)/insurance/marketplace` | `/patient/insurance/marketplace` | planned → done
| `(app)/insurance/marketplace/[providerId]` | `/patient/insurance/marketplace/[providerId]` | planned → done
| `(app)/insurance/plans/[planId]` | `/patient/insurance/plans/[planId]` | planned → done
| `(app)/insurance/quote` | `/patient/insurance/quote` | planned → done
| `(app)/insurance/enroll/[planId]` | `/patient/insurance/enroll/[planId]` | planned → done
| `(app)/insurance/payment/[enrollmentId]` | `/patient/insurance/payment/[enrollmentId]` | planned → done
| `(app)/insurance/policy/[id]` | `/patient/insurance/policy/[id]` | planned → done
| `(app)/insurance/ecard/[id]` | `/patient/insurance/ecard/[id]` | planned → done
| `(app)/insurance/coverage-check` | `/patient/insurance/coverage-check` | planned → done
| `(app)/insurance/claims/index` | `/patient/insurance/claims` | planned → done
| `(app)/insurance/claims/new` | `/patient/insurance/claims/new` | planned → done
| `(app)/insurance/claims/[id]` | `/patient/insurance/claims/[id]` | planned → done
```

Then add the verify row (in the table near the existing `(app)/insurance/*` rows or anywhere it fits the manifest's order — keep rows grouped):

```
| `(app)/verify/[id]` | `/portal/verify/[id]` | done | 1 | Public route, ungated; mobile's verify is login-gated and separate |
```

Sub-project column: `1` (this work owns it).

- [ ] **Step 2: Run the parity test**

Run: `cd apps/marketing && bun run test src/patient/parity.test.ts`
Expected: PASS. The 13 new `done` rows must resolve to real page files under `/patient/insurance/*` — verified by the move in Tasks 2–3.

- [ ] **Step 3: Verify the test fails when a row is bogus (negative test)**

Temporarily edit one insurance row to point at a non-existent route, run the test, confirm it fails, then revert. Pattern:

```bash
sed -i '' 's|`/patient/insurance/marketplace` |`/patient/insurance/does-not-exist` |' docs/parity-manifest.md
cd apps/marketing && bun run test src/patient/parity.test.ts
git checkout docs/parity-manifest.md  # revert
```

Expected: 1 failure (the marketplace row) on the bad manifest, 0 failures after revert.

- [ ] **Step 4: Commit**

```bash
git add docs/parity-manifest.md
git commit -m "docs(parity): insurance sub-routes done under /patient"
```

---

### Task 6: Final regression sweep

**Files:** none.

- [ ] **Step 1: Run the marketing suite end-to-end**

Run: `cd apps/marketing && bun run test`
Expected: failure count ≤ 8 baseline. Count new passes vs. baseline.

- [ ] **Step 2: Typecheck the marketing app**

Run: `bunx tsc --noEmit -p apps/marketing/tsconfig.json`
Expected: same errors as baseline. New errors specific to moved files (e.g. an `@/portal/...` import that wasn't rewritten) are bugs — fix and commit.

- [ ] **Step 3: Repo-wide typecheck (informational)**

Run: `cd /Users/thufailahamed/Downloads/App-2 && bun run typecheck 2>&1 | tail -20`
Expected: same pre-existing mobile ReactNode error; nothing new.

---

## Acceptance

From the spec §8, all six must hold when Task 5 lands:

1. Every `/portal/me/X` URL either serves (at its new `/patient/*` URL) or 308s. — Tasks 1, 2, 3, 4
2. `/patient/insurance` + 12 sub-routes serve real pages. — Task 2
3. `/patient/share`, `/patient/audit`, `/patient/imaging`, `/patient/imaging/[studyUid]` serve real pages. — Task 3
4. `/portal/me/records` and `/portal/me/notifications` redirect. — Tasks 1, 4
5. Parity test passes after the 13 rows flip. — Task 5
6. No new test failures. — Tasks 2, 3, 4, 6
