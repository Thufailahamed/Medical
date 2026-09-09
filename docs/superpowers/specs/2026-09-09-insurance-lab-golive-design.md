# Insurance + Lab Test Go-Live Design — 2026-09-09

Approved approach: **B — Harden in place + close money loop** (patch-only rejected as incomplete, re-platform rejected as 3-4x scope).

Verdict from audit: both tracks NOT ready. Insurance ~40% as regulated sale, ~70% as demo. Lab demoable on mobile with mocks, web 404s, fulfillment stalls.

## 1. Architecture

- Keep Hono/Workers + D1/Drizzle + Next.js portals + Expo. No new services.
- Keep two insurance tracks but disambiguate: legacy BYO (`/insurance/*`, tables `insurance`/`insurance_claims`) stays read-only manual; marketplace (`/insurance-marketplace/*`, `insurance_enrollments` etc) is the sellable product. Admin routes split: `/admin/insurance-claims` (legacy) vs `/admin/insurance-mkt-claims` (marketplace). Fixes Hono shadowing (`admin-insurance.ts:273` vs `admin.ts:992`).
- Lab: single `test_bookings` store; deprecate parallel `lab_reports`/`lab_orders` for D2C (keep for doctor-ordered + cross-hospital routing). No schema rebuild; additive migrations only.
- Payments: PayHere stays primary for insurance (`INS-` prefix) + extend to `test_bookings`; Stripe wired to both via `handleInsurancePremiumPaid` reuse, not generic-only.

## 2. Components

### Insurance
1. **Catalog/quote/enroll/pay/policy/ecard/coverage/claims UI (web+mobile):** fix hub `insurance/page.tsx:111,117,122` (`/insurance/*` → `/insurance-marketplace/*`); fix quote response (`{quote:{...}}` → flat `{basePremiumLkr,adjustedPremiumLkr,...}`) both platforms + mobile `useInsuranceQuote` mutate bug; fix coverage-check request (`estimatedCostLkr/incurringFacility` → `estimatedAmountLkr/hospitalName`) + response (`{coverage}` → flat); add missing `payment/return` + `payment/cancel` pages (PayHere `return_url/cancel_url` currently 404).
2. **Back-office:** `GET /admin/insurance-mkt-claims?status` with joins (`patientName,providerName,policyNumber,total`); fix `?providerId` vs `?provider_id`; return `userName/planName` in `GET /insurance-operator/enrollments`; keep operator decision but add `POST /insurance-operator/claims/:id/pay {amountApprovedLkr,transactionRef}` → `approved→paid` + `paidAt`.
3. **Money loop:** `webhook/stripe` → `handleInsurancePremiumPaid` when `orderId startsWith INS-`; free-look cancel triggers refund record (no auto-rail, manual ledger + status); billing cron dedup per-day kept, reminders dedup via `remindedAt`.
4. **Onboarding:** `POST /insurance-operator/register {orgName,license,contact}` → creates `operator_orgs(kind=insurance,status=pending)` + user `role=insurance,status=pending`; super_admin approves via existing `account_pending_review` flow; operator `POST/PUT /insurance-operator/providers|plans` creates drafts (`isPublished=false`), super_admin publishes. KYC: NIC upload via `/files`, `kycStatus pending→verified` manual by operator (remove auto-verify claim).
5. **E-card/cashless:** `GET /insurance-marketplace/ecards/verify?token=` checks `active+validUntil`, logs scan, returns coverage; `network_hospitals` lookup via existing `networkHospitalCount` → new read-only registry table (id,name,city,cashless bool) seeded minimal; QR payload unchanged.

### Lab
1. **Contracts:** mobile `test-catalog.tsx:436` (`tests`→`items`), `useApi.ts:4317` (`search`→`q`), `test-detail` (`data.test`→bare DTO), `test-packages.tsx:252` (`packages`→`items`); web `contracts/paths.ts:259-265` (`/me/bookings`,`/packages/:slug/book`,`/rating` → `/book`,`/bookings`,`/bookings/:id/rating`); lab-portal `useCompleteBooking` (`POST .../results` → `PATCH .../complete`).
2. **Fulfillment:** fix 8× `notify(db,userId,{...})` → `notify({db,userId,...})` + pass `env` for SMS; map all `test_booking_*` types to `lab_ready` (no DB enum migration); add `PATCH /lab-portal/bookings/:id/en-route` (`phlebotomist_assigned→sample_collection_en_route`) and surface it in lab-portal timeline; enforce slot capacity minimal.
3. **Payments:** extend `POST /payments/initiate {testBookingId}` + `notify` branch `TB-` prefix → `pending→paid`; `paid→refunded` via rail stub + flag; disable `card/online` in UI until wired or label “pay on collection” interim.
4. **Results:** `/files` presigned + R2 for `resultPdfUrl`; file picker in lab-portal result modal; reconcile `test_bookings.result*` canonical, link `lab_reports` only for doctor orders.
5. **Onboarding/roster/ratings:** lab self-register page (license/accreditation/address/hours/bank) → `pending→active` inline on `admin/laboratories`; real `phlebotomists` table + CRUD (replace free-text assign, keep back-compat); wire packages create/edit + `diagnostic-tests-availability` UI; new `test_booking_ratings` + `POST /diagnostic-tests/bookings/:id/rating` (completed-only, upsert) + aggregate on catalog.

## 3. Data flow

Insurance happy path: catalog (public) → provider/plan detail → quote (stateless, not persisted) → enroll (`payment_pending`+`open` invoice) → pay (PayHere/Stripe order `INS-`) → webhook (`paid`+`active`+`policyNumber POL-`+ecard) → policy/renew/cancel → ecard verify at hospital → coverage-check (advisory) → claim draft→submit→operator decision→pay (`paid`). Lab happy path: catalog (`items`+`nextCursor`) → detail/packages → book (`pending`, `pending|cash_on_collection`) → bookings list/detail → lab confirm→assign→en-route?→collect (`cash→paid`)→in-progress→complete (`resultPdfUrl`) → result view → rating. All state changes emit `notify({db,env,...})` (in-app+push+SMS if opted-in).

## 4. Error handling

- Keep 503 when PayHere env missing; explicit 501 removed once Stripe wired for both.
- Quote/coverage 400 on validator mismatch preserved; UI aligned to validator field names.
- Booking 409 on duplicate active same date preserved; reschedule resets to `pending` + clears phlebotomist (documented, no silent new row).
- Claim decision only from `submitted,under_review,more_info_needed`; pay only from `approved`.
- Webhook idempotency via existing `payment_webhook_events` + `invoice open→paid` guard.
- Cron guards `x-cron-secret|cookie|isDev` preserved; reminders deduped.

## 5. Testing

- Insurance: new `insurance-marketplace.test.ts` (catalog→quote→enroll→pay notify mock→active+ecard→claim→submit→decision→pay), admin collision test, webhook idempotency test.
- Lab: fix `lab-partner-portal.test.ts` harness (`await buildTestApp`), seed-shape drift, `/:slug` vs `/time-slots` order; add notify-signature, contract (`items`/`q`), complete (`PATCH`), rating, payment branch tests.
- Gate: `bun run test` green for touched suites + `typecheck` for api/marketing/mobile.

## 6. Out of scope (YAGNI)

Full underwriting, actuarial pricing, license/partner integration (Sri Lanka Insurance/Ceylinco/AIA copy must be softened to “partner onboarding in progress” until signed), hospital cashless settlement ledger, geofenced dispatch, AI result parsing for bookings, WhatsApp/email for insurance.
