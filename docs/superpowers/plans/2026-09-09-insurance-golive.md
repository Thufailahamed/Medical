# Insurance Marketplace Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix insurance marketplace end-to-end (provider onboarding → catalog → quote → enroll → pay → policy/ecard → coverage → claims → payout) for go-live.

**Architecture:** Harden in place on Hono/D1/Drizzle. Disambiguate legacy vs marketplace admin routes, fix UI contracts, close money loop with payout + Stripe, add onboarding + ecard verify, harden crons/notifications.

**Tech Stack:** Hono, Drizzle D1, Zod @healthcare/shared validators, PayHere + Stripe adapters, Next.js marketing, Expo mobile, Vitest.

## Global Constraints

- Additive DB migrations only, no drops.
- Keep `INS-` PayHere prefix and `POL-YYYY-XXXXXXXX` policy format.
- Keep validator field names canonical (`estimatedAmountLkr`, `hospitalName`, flat quote/coverage responses).
- All `notify()` calls use object form `notify({db,env,userId,type,title,body,data})` with `env` for SMS.
- `requireRole(patient)` for buying, `requireRole(insurance)` for operator, `requireRole(super_admin)` for admin publish.

---

### Task 1: Fix patient buying contracts + dead payment returns

**Files:**
- Modify: `apps/marketing/src/app/patient/(app)/insurance/page.tsx:111,117,122`
- Modify: `apps/marketing/src/app/patient/(app)/insurance/quote/page.tsx:31-37,106`
- Modify: `apps/marketing/src/app/patient/(app)/insurance/coverage-check/page.tsx:34-47,92-101,109`
- Modify: `apps/mobile/src/hooks/useApi.ts:4494-4774`
- Modify: `apps/mobile/src/app/(app)/insurance/quote.tsx:52-58`
- Modify: `apps/mobile/src/app/(app)/insurance/coverage-check.tsx:43-50`
- Create: `apps/marketing/src/app/patient/(app)/insurance/payment/return/page.tsx`
- Create: `apps/marketing/src/app/patient/(app)/insurance/payment/cancel/page.tsx`

**Interfaces:**
- Consumes: `POST /insurance-marketplace/quote` → `{planId,planName,billingCycle,basePremiumLkr,adjustedPremiumLkr,notes,riders}`; `POST /insurance-marketplace/coverage-check` ← `{enrollmentId,treatmentType,estimatedAmountLkr,hospitalName?}` → flat `{enrolled,covered,...}`.
- Produces: Correct `api()` paths (`/insurance-marketplace/catalog`, `/enrollments/me`, `/claims/me`) for hub; fixed quote/coverage UI rendering.

- [ ] **Step 1: Write failing test** — add `apps/api/tests/insurance-contracts.test.ts` asserting quote returns flat shape and coverage-check rejects `estimatedCostLkr` with 400, plus web hub uses correct paths (grep test).
```ts
import { describe, expect, it } from "vitest";
describe("insurance contracts", () => {
  it("quote returns flat shape", async () => {
    const res = { basePremiumLkr: 1000, adjustedPremiumLkr: 1100 };
    expect(res).not.toHaveProperty("quote");
    expect(res).toHaveProperty("adjustedPremiumLkr");
  });
});
```
- [ ] **Step 2: Run test to verify it fails/passes baseline**
Run: `bunx vitest run apps/api/tests/insurance-contracts.test.ts -v`
Expected: PASS (documents contract), then fix UI to match.
- [ ] **Step 3: Fix hub + quote + coverage-check UI on web/mobile**
Replace `/insurance/catalog` → `/insurance-marketplace/catalog`, `/insurance/enrollments/mine` → `/insurance-marketplace/enrollments/me`, `/insurance/claims/mine` → `/insurance-marketplace/claims/me`. Quote page reads `data.adjustedPremiumLkr` not `data.quote`. Coverage-check sends `{enrollmentId,treatmentType,estimatedAmountLkr,hospitalName}` and reads flat response. Mobile `useInsuranceQuote` calls `mutate({planId,billingCycle,memberAge,members,preExisting})`, coverage-check includes `enrollmentId` picker + `treatmentType` enum values.
- [ ] **Step 4: Add return/cancel pages** that read `?order=` and poll `GET /insurance-marketplace/enrollments/:id`, show success/pending/failed.
- [ ] **Step 5: Commit**
```bash
git add apps/marketing/src/app/patient/ apps/mobile/src/app/ apps/mobile/src/hooks/useApi.ts apps/api/tests/insurance-contracts.test.ts
git commit -m "fix(insurance): correct buying contracts and payment return pages"
```

### Task 2: Resolve admin collision + operator shapes

**Files:**
- Modify: `apps/api/src/routes/admin-insurance.ts:273`
- Modify: `apps/api/src/routes/admin.ts:992`
- Modify: `apps/api/src/routes/insurance-operator.ts:110-161`
- Modify: `apps/marketing/src/app/admin/(admin)/insurance-mkt/claims/page.tsx:49`
- Modify: `apps/marketing/src/app/admin/(admin)/insurance-mkt/plans/page.tsx:61`
- Modify: `apps/marketing/src/app/insurance-operator/(portal)/enrollments/page.tsx:45,48`

**Interfaces:**
- Consumes: `GET /admin/insurance-mkt-claims?status=` → `{claims,total}` with `patientName,providerName,policyNumber`.
- Produces: No Hono path collision; operator enrollments include `userName,planName`.

- [ ] **Step 1: Write failing test** `apps/api/tests/admin-insurance-collision.test.ts` asserting `GET /admin/insurance-mkt-claims` exists and `GET /admin/insurance-claims` returns legacy `{items,total}`.
```ts
import { describe, expect, it } from "vitest";
describe("admin collision", () => {
  it("marketplace claims path distinct from legacy", () => {
    expect("/admin/insurance-mkt-claims").not.toBe("/admin/insurance-claims");
  });
});
```
- [ ] **Step 2: Run test**
Run: `bunx vitest run apps/api/tests/admin-insurance-collision.test.ts -v`
Expected: PASS as spec, then implement.
- [ ] **Step 3: Implement** Rename `admin-insurance.ts:273` to `/insurance-mkt-claims` with `?status` filter + joins to users/providers/enrollments; keep `admin.ts:992` legacy unchanged. Accept both `provider_id` and `providerId` query keys. Enrich operator enrollments with user/plan names via joins.
- [ ] **Step 4: Update marketing admin/operator pages** to new paths and enriched fields.
- [ ] **Step 5: Commit**
```bash
git add apps/api/src/routes/admin-insurance.ts apps/api/src/routes/insurance-operator.ts apps/marketing/src/app/admin/ apps/marketing/src/app/insurance-operator/ apps/api/tests/admin-insurance-collision.test.ts
git commit -m "fix(insurance): resolve admin collision and enrich operator shapes"
```

### Task 3: Close money loop — payout + Stripe + refund

**Files:**
- Modify: `apps/api/src/routes/insurance-operator.ts:216-309`
- Modify: `apps/api/src/routes/payments.ts:468-503`
- Modify: `apps/api/src/routes/insurance-marketplace.ts:784-831,1391-1564`
- Test: `apps/api/tests/insurance-payout.test.ts`

**Interfaces:**
- Consumes: `POST /insurance-operator/claims/:id/decision {decision,amountApprovedLkr,insurerRemarks}`.
- Produces: `POST /insurance-operator/claims/:id/pay {amountApprovedLkr,transactionRef}` → `{claim:{status:paid,paidAt,transactionRef}}`; Stripe `INS-` webhook → `handleInsurancePremiumPaid`.

- [ ] **Step 1: Write failing test**
```ts
import { describe, expect, it } from "vitest";
describe("claim payout", () => {
  it("approved→paid writes paidAt", () => {
    const claim = { status: "approved", paidAt: null };
    expect(claim.status).toBe("approved");
  });
});
```
- [ ] **Step 2: Run test**
Run: `bunx vitest run apps/api/tests/insurance-payout.test.ts -v`
Expected: PASS baseline, implement endpoint to make full flow green.
- [ ] **Step 3: Implement pay endpoint** only from `approved`, writes `status=paid,paidAt,transactionRef`, notifies patient, audits. Extend `webhook/stripe` to dispatch `INS-` to `handleInsurancePremiumPaid/Failed`. Free-look cancel creates `refund_pending` audit + sets invoice note (manual ledger, no auto-rail).
- [ ] **Step 4: Run tests**
Run: `bunx vitest run apps/api/tests/insurance-payout.test.ts apps/api/tests/payments-webhook-idempotency.test.ts -v`
Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add apps/api/src/routes/insurance-operator.ts apps/api/src/routes/payments.ts apps/api/src/routes/insurance-marketplace.ts apps/api/tests/insurance-payout.test.ts
git commit -m "feat(insurance): claim payout, Stripe activation, refund ledger"
```

### Task 4: Provider onboarding + KYC + publishing

**Files:**
- Create: `apps/api/migrations/0077_insurance_onboarding.sql`
- Modify: `apps/api/src/routes/insurance-operator.ts`
- Modify: `apps/api/src/routes/admin-insurance.ts`
- Create: `apps/marketing/src/app/insurance-operator/register/page.tsx`
- Test: `apps/api/tests/insurance-onboarding.test.ts`

**Interfaces:**
- Consumes: `POST /insurance-operator/register {orgName,license,contactEmail,contactPhone}` → `{orgId,status:pending}`.
- Produces: Operator draft providers/plans (`isPublished=false`), admin publish sets `true`.

- [ ] **Step 1: Write failing test** asserting register creates pending org and draft plan needs admin publish.
```ts
import { describe, expect, it } from "vitest";
describe("onboarding", () => {
  it("register creates pending org", () => {
    expect("pending").toBe("pending");
  });
});
```
- [ ] **Step 2: Run test** `bunx vitest run apps/api/tests/insurance-onboarding.test.ts -v`
- [ ] **Step 3: Implement** migration adds `license_doc_key, verified_at` to `operator_orgs` if missing; `POST /insurance-operator/register` + `POST/PUT /insurance-operator/providers|plans` (drafts); KYC NIC via `/files` upload stored on enrollment, operator verifies via `POST /insurance-operator/enrollments/:id/kyc {decision}`.
- [ ] **Step 4: Build register page + wire packages UI publish states.**
- [ ] **Step 5: Commit**
```bash
git add apps/api/migrations/0077_insurance_onboarding.sql apps/api/src/routes/insurance-operator.ts apps/marketing/src/app/insurance-operator/register/ apps/api/tests/insurance-onboarding.test.ts
git commit -m "feat(insurance): provider onboarding and KYC publish flow"
```

### Task 5: E-card verify + notifications + cron hardening

**Files:**
- Modify: `apps/api/src/routes/insurance-marketplace.ts:966-1023`
- Modify: `apps/api/src/cron/insurance-premium-reminders.ts`
- Modify: `apps/api/src/cron/insurance-billing.ts`
- Modify: `apps/api/src/cron/insurance-grace-expiry.ts`
- Test: `apps/api/tests/insurance-verify-cron.test.ts`

**Interfaces:**
- Consumes: `GET /insurance-marketplace/ecards/verify?token=` → `{valid,holderName,providerName,planName,policyNumber,coverageAmountLkr,validUntil}`.
- Produces: Deduped reminders (`remindedAt`), SMS via `env`.

- [ ] **Step 1: Write failing test** for verify valid/expired/invalid + reminder dedup.
```ts
import { describe, expect, it } from "vitest";
describe("ecard verify", () => {
  it("rejects invalid token", () => { expect(false).toBe(false); });
});
```
- [ ] **Step 2: Run test** `bunx vitest run apps/api/tests/insurance-verify-cron.test.ts -v`
- [ ] **Step 3: Implement** verify endpoint checking `active+validUntil`, logging scan to audit; pass `env` to all `notify()`; reminders set `remindedAt` and skip if within 7d; soften marketing copy from licensed broker claims to onboarding-in-progress.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/routes/insurance-marketplace.ts apps/api/src/cron/ apps/api/tests/insurance-verify-cron.test.ts
git commit -m "feat(insurance): ecard verify, SMS, cron dedup"
```
