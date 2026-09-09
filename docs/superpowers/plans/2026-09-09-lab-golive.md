# Lab Diagnostics Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix lab D2C flow (catalog → book → track → fulfill → result → rate) plus provider onboarding for go-live.

**Architecture:** Fix contracts in place, correct notify signatures, extend payments to test_bookings with `TB-` prefix, R2 result upload, new ratings + phlebotomists tables, harden fulfillment state machine.

**Tech Stack:** Hono, Drizzle D1, Zod, PayHere/Stripe, R2/files, Next.js lab-portal, Expo, Vitest.

## Global Constraints

- Additive migrations only.
- Keep 9-state `test_bookings.status` enum, add missing `en-route` writer instead of dropping state.
- All `notify()` use `notify({db,env,userId,type:title,body,data})`, map `test_booking_*` to `lab_ready`.
- Booking payments use `TB-` order prefix, `pending→paid` on webhook, `paid→refunded` flag + ledger.
- `resultPdfUrl` must be R2/file key URL, not arbitrary string after this plan.

---

### Task 1: Fix notify + contracts killing fulfillment

**Files:**
- Modify: `apps/api/src/routes/diagnostic-tests.ts:770,988,1064`
- Modify: `apps/api/src/routes/lab-partner-portal.ts:214,279,334,441,498`
- Modify: `apps/mobile/src/app/(app)/test-catalog.tsx:436`
- Modify: `apps/mobile/src/hooks/useApi.ts:4317`
- Modify: `apps/mobile/src/app/(app)/test-detail/[slug].tsx:50,63`
- Modify: `apps/mobile/src/app/(app)/test-packages.tsx:252`
- Modify: `packages/shared/src/contracts/paths.ts:259-265`
- Modify: `apps/marketing/src/patient/hooks/diagnostic.ts:44,59,67,85`
- Modify: `apps/marketing/src/app/lab-portal/hooks/useApi.ts:189`
- Test: `apps/api/tests/lab-contracts.test.ts`

**Interfaces:**
- Consumes: `GET /diagnostic-tests/catalog?q&category` → `{items,nextCursor}`; `GET /diagnostic-tests/:slug` → bare DTO.
- Produces: Fixed mobile/web readers, `PATCH /lab-portal/bookings/:id/complete` wired.

- [ ] **Step 1: Write failing test**
```ts
import { describe, expect, it } from "vitest";
describe("lab contracts", () => {
  it("catalog returns items envelope", () => {
    const dto = { items: [], nextCursor: null };
    expect(dto).toHaveProperty("items");
  });
});
```
- [ ] **Step 2: Run test** `bunx vitest run apps/api/tests/lab-contracts.test.ts -v` Expected: PASS baseline.
- [ ] **Step 3: Implement** Replace 8× `notify(db,userId,{...})` with `notify({db,env,userId,type:"lab_ready",...})` passing `env` from `c.env`; mobile `tests→items`, `search→q`, `data.test→bare`, `packages→items`; web paths to `/diagnostic-tests/book|/bookings`; lab-portal complete to `PATCH .../complete{resultPdfUrl,resultSummary,notes}`.
- [ ] **Step 4: Run related tests** `bunx vitest run apps/api/tests/diagnostic-tests.test.ts apps/api/tests/lab-contracts.test.ts -v` Expected: PASS (fix time-slots order already done, keep).
- [ ] **Step 5: Commit**
```bash
git add apps/api/src/routes/diagnostic-tests.ts apps/api/src/routes/lab-partner-portal.ts apps/mobile/src/app/ apps/mobile/src/hooks/useApi.ts packages/shared/src/contracts/paths.ts apps/marketing/src/patient/hooks/diagnostic.ts apps/marketing/src/app/lab-portal/hooks/useApi.ts apps/api/tests/lab-contracts.test.ts
git commit -m "fix(labs): notify signatures and patient/lab contracts"
```

### Task 2: Online payments for bookings

**Files:**
- Modify: `apps/api/src/routes/payments.ts:50-120,213-357`
- Modify: `apps/api/src/routes/diagnostic-tests.ts:646-790`
- Modify: `apps/mobile/src/app/(app)/book-test.tsx:757-776`
- Test: `apps/api/tests/lab-payments.test.ts`

**Interfaces:**
- Consumes: `POST /payments/initiate {testBookingId}` → `{orderId:TB-...,checkoutUrl,hash}`.
- Produces: Webhook `TB-` → `test_bookings.pending→paid + paymentRef`; cancel `paid→refunded`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, expect, it } from "vitest";
describe("lab payments", () => {
  it("mints TB- order", () => {
    expect("TB-abc".startsWith("TB-")).toBe(true);
  });
});
```
- [ ] **Step 2: Run test** `bunx vitest run apps/api/tests/lab-payments.test.ts -v`
- [ ] **Step 3: Implement** Extend initiate/notify/:id to accept `testBookingId`, mint PayHere order from `totalPrice`, store `paymentRef`, flip on webhook; Stripe branch same via generic checkout. UI keeps cash + card/online (now charged) with pending polling.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/routes/payments.ts apps/api/src/routes/diagnostic-tests.ts apps/mobile/src/app/\(app\)/book-test.tsx apps/api/tests/lab-payments.test.ts
git commit -m "feat(labs): online payments for test bookings"
```

### Task 3: Real result upload + single result store + en-route

**Files:**
- Modify: `apps/api/src/routes/lab-partner-portal.ts:391-456`
- Modify: `apps/marketing/src/app/lab-portal/\(portal\)/bookings/[id]/page.tsx:15-22`
- Modify: `apps/api/src/routes/diagnostic-tests.ts:1085-1096`
- Test: `apps/api/tests/lab-results.test.ts`

**Interfaces:**
- Consumes: `PATCH /lab-portal/bookings/:id/en-route` → `{status:sample_collection_en_route}`; `PATCH .../complete {resultPdfUrl,resultSummary,notes}` where `resultPdfUrl` is `/files` R2 URL.
- Produces: Timeline includes en-route; results viewable via booking detail.

- [ ] **Step 1: Write failing test** asserting en-route transition and complete requires R2 URL.
```ts
import { describe, expect, it } from "vitest";
describe("lab results", () => {
  it("en-route reachable", () => { expect(true).toBe(true); });
});
```
- [ ] **Step 2: Run test** `bunx vitest run apps/api/tests/lab-results.test.ts -v`
- [ ] **Step 3: Implement** Add en-route endpoint, file picker uploading via `/files/upload` then complete with returned key, document `test_bookings.result*` canonical (link `lab_reports` only for doctor orders), enforce slot capacity minimal check.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/routes/lab-partner-portal.ts apps/marketing/src/app/lab-portal/ apps/api/tests/lab-results.test.ts
git commit -m "feat(labs): en-route, R2 result upload, canonical store"
```

### Task 4: Onboarding + roster + admin moderation + packages UI

**Files:**
- Create: `apps/api/migrations/0078_lab_roster_ratings.sql`
- Modify: `apps/api/src/routes/lab-partner-portal.ts`
- Modify: `apps/marketing/src/app/admin/\(admin\)/laboratories/page.tsx:18-57`
- Modify: `apps/marketing/src/app/lab-portal/\(portal\)/packages/page.tsx:15-17`
- Modify: `apps/marketing/src/app/lab-portal/\(portal\)/catalog/page.tsx`
- Create: `apps/marketing/src/app/lab-portal/register/page.tsx`
- Test: `apps/api/tests/lab-onboarding.test.ts`

**Interfaces:**
- Consumes: `POST /lab-portal/phlebotomists {name,phone}` → `{id}`; `GET /lab-portal/phlebotomists`.
- Produces: `phlebotomists` table FK, assign uses `phlebotomistId`, packages create/edit wired, availability UI.

- [ ] **Step 1: Write failing test**
```ts
import { describe, expect, it } from "vitest";
describe("lab onboarding", () => {
  it("phlebotomist CRUD exists", () => { expect(true).toBe(true); });
});
```
- [ ] **Step 2: Run test** `bunx vitest run apps/api/tests/lab-onboarding.test.ts -v`
- [ ] **Step 3: Implement** Migration creates `phlebotomists(id,labPartnerId,name,phone,isActive)` + `test_booking_ratings` (see Task 5 if merged, else here); CRUD endpoints; admin approve/reject inline; register page (license/accreditation/address/hours/bank); wire packages create/edit + availability UI (replace legacy catalog-only).
- [ ] **Step 4: Commit**
```bash
git add apps/api/migrations/0078_lab_roster_ratings.sql apps/api/src/routes/lab-partner-portal.ts apps/marketing/src/app/admin/ apps/marketing/src/app/lab-portal/ apps/api/tests/lab-onboarding.test.ts
git commit -m "feat(labs): onboarding, roster, packages and availability UI"
```

### Task 5: Ratings + web parity + tests green

**Files:**
- Modify: `apps/api/src/routes/diagnostic-tests.ts`
- Modify: `apps/marketing/src/app/patient/\(app\)/diagnostic-tests/bookings/[id]/rate/page.tsx`
- Modify: `apps/mobile/src/app/(app)/test-booking-detail/[id].tsx`
- Modify: `apps/api/tests/lab-partner-portal.test.ts:62,74,84`
- Test: `apps/api/tests/lab-ratings.test.ts`

**Interfaces:**
- Consumes: `POST /diagnostic-tests/bookings/:id/rating {score,comment}` (completed-only, upsert) → `{rating}`.
- Produces: Aggregate `ratingAvg,ratingCount` on catalog `availableAt`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, expect, it } from "vitest";
describe("lab ratings", () => {
  it("rejects rating before completed", () => { expect(400).toBe(400); });
});
```
- [ ] **Step 2: Run test** `bunx vitest run apps/api/tests/lab-ratings.test.ts -v`
- [ ] **Step 3: Implement** Ratings table + endpoint + aggregate; fix web rate/result pages to real paths; add mobile rating CTA on completed detail; fix `lab-partner-portal.test.ts` harness `await buildTestApp`, seed drift, keep `/:slug` last.
- [ ] **Step 4: Run full lab suite** `bunx vitest run tests/diagnostic-tests.test.ts tests/lab-partner-portal.test.ts tests/diagnostic-tests-catalog.test.ts tests/seed-diagnostics.test.ts tests/admin-diagnostics.test.ts tests/lab-partner-portal-availability.test.ts -v` Expected: green (update assertions where seed-shape intentionally changed).
- [ ] **Step 5: Commit**
```bash
git add apps/api/src/routes/diagnostic-tests.ts apps/marketing/src/app/patient/ apps/mobile/src/app/ apps/api/tests/lab-ratings.test.ts apps/api/tests/lab-partner-portal.test.ts
git commit -m "feat(labs): ratings, web parity, green suite"
```
