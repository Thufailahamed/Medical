# Payments.lk Migration — Design

Date: 2026-09-25
Status: Approved (design walkthrough 2026-09-25)

## Summary

Replace the PayHere and Stripe integrations with a single gateway: **payments.lk**
(Payable). Every payment surface — consultation appointments (HH-), lab test
bookings (TB-), insurance premiums (INS-), and hospital-billing invoices — goes
through payments.lk's REST API + hosted checkout, with payment confirmation via
signed webhooks. Mobile keeps the open-browser-and-poll pattern; no new mobile
dependencies.

## Context

Current state:

- `apps/api/src/lib/payhere.ts` — PayHere form-post helpers (MD5 hash, notify
  verification). Used by appointments, lab bookings, insurance.
- `apps/api/src/lib/payments/` — adapter seam: `types.ts`
  (`PaymentProvider = 'payhere' | 'stripe'`), `errors.ts` (`PaymentError`),
  `stripe.ts` (`StripeAdapter`), `webhook-idempotency.ts` (backed by
  `payment_webhook_events` table, migration 0072).
- `apps/api/src/routes/payments.ts` — PayHere `/initiate` + `/notify`
  (form-encoded, order-prefix dispatch), Stripe-only generic `/checkout`,
  `/webhook/stripe`, `/refund`, `/me`, and patient polling `GET /payments/:id`.
- `apps/api/src/routes/insurance-marketplace.ts` — builds PayHere checkout
  fields for INS- premium orders.
- Mobile `src/lib/payhere.ts` — opens checkout URL in system browser
  (`expo-web-browser`), polls `GET /payments/:id` on AppState focus.
- Web portals redirect to `checkoutUrl` / `redirectUrl`.
- DB: `appointment_payments` has PayHere-named columns
  (`payhere_order_id`, `payhere_payment_id`, `payhere_status_code`,
  `payhere_method`); generic `payments` table already has neutral
  `provider` / `provider_charge_id`.

## Decisions (confirmed with user)

1. payments.lk **replaces PayHere** across all its flows.
2. Generic invoice path becomes **payments.lk only** — Stripe adapter is
   deleted entirely.
3. Mobile keeps the **open + poll** pattern (no `@payments-lk/react-native`
   dependency).
4. DB columns are **renamed** to gateway-neutral names via migration.

## payments.lk API facts (source: payments.lk/developers)

- `POST https://api.payments.lk/v1/checkouts` — `Authorization: Bearer
  sk_test_|sk_live_`, `Idempotency-Key` header (same key replays the first
  response; a retry never double-charges). Body:
  `{ amountCents, description, reference, successUrl, cancelUrl }`.
  Response: `{ id, url }` — redirect the customer to `url`.
- Sandbox and live share the same API base; the key prefix decides the
  environment. No separate sandbox URL.
- Amounts are whole LKR cents (Rs. 1,450.00 = 145000).
- Webhooks: JSON events signed over raw bytes in the `payments-signature`
  header. Events: `payment.succeeded`, `payment.failed`, `checkout.expired`,
  `card.saved`, `refund.succeeded`, `refund.failed`. Retries at 1/5/30 min,
  then 2/6/12 h. `event.data.reference` carries our order id,
  `event.data.amountCents` the amount. Fulfil from the webhook, never from
  the success redirect.
- `POST /v1/refunds` — full or partial refund of a payment.
- `GET /v1/checkouts/:id`, `GET /v1/payments` available for reconciliation
  (not required for this scope).

## Architecture

Adapter seam kept (matches existing `StripeAdapter` conventions and test
seams), single implementation:

```
apps/api/src/lib/payments/
  types.ts                  → PaymentProvider = 'paymentslk'
  errors.ts                 → unchanged (PaymentError + codes)
  paymentslk.ts             → new PaymentsLkAdapter
  webhook-idempotency.ts    → unchanged
  stripe.ts                 → DELETED
apps/api/src/lib/payhere.ts → DELETED
```

`PaymentsLkAdapter` (constructor takes `{ fetchImpl? }` for tests):

- `createCheckout(input: CheckoutInput, env): Promise<CheckoutResult>` —
  `POST /checkouts` with Bearer auth + `Idempotency-Key` set to our order id;
  body `{ amountCents: round(amountLkr * 100), description, reference,
  successUrl, cancelUrl }`. Maps to `CheckoutResult { redirectUrl: url,
  merchantOrderId: id, provider: 'paymentslk' }`.
- `verifyWebhook(rawBody, sigHeader, env): WebhookEvent` — HMAC over raw
  bytes, timing-safe compare of the `payments-signature` header; throws
  `PaymentError(WebhookSignatureInvalid)` on mismatch. Normalizes:
  `payment.succeeded → statusCode 2`, `payment.failed → -1`,
  `checkout.expired → -2`; `eventId = event.id`,
  `merchantOrderId = event.data.reference`,
  `amountMinor = event.data.amountCents`.
- `refund(input: RefundInput, env): Promise<RefundResult>` — `POST /refunds`
  `{ payment: paymentId, amount?: amountMinor }` with `Idempotency-Key`
  (every payments.lk write requires one; derive from payment id + amount so
  retries replay instead of double-refunding); maps to
  `RefundResult { refundId, status, provider }`.
- Non-2xx gateway responses throw
  `PaymentError(ProviderError, 'paymentslk', path, 'paymentslk <status>')`.

Env (on `AppEnvironment` in `apps/api/src/types/index.ts`):

- `PAYMENTS_LK_SECRET_KEY?: string` (sk_test_ / sk_live_)
- `PAYMENTS_LK_WEBHOOK_SECRET?: string`

Missing config: initiate/checkout routes → `503 {"error": "Payments not
configured. Set PAYMENTS_LK_SECRET_KEY."}`; webhook → `503` text.

## Routes

### Initiate flows (appointments, lab bookings, insurance)

`POST /payments/initiate` (appointments `{appointmentId}`, lab
`{testBookingId}`) and `POST /insurance/enrollments/:id/pay` keep: paths,
auth (`authMiddleware` + `requireRole('patient')`), ownership checks,
pending-order reuse, and the `HH-` / `TB-` / `INS-` order-id prefixes that
drive webhook dispatch. Change: instead of building PayHere form fields +
MD5 hash, each route calls `paymentsLkAdapter.createCheckout(...)` with

- `successUrl`: `{PUBLIC_URL}/payment/return?order=<id>` (appointments),
  `/lab/payment/return?order=<id>` (lab), `/insurance/payment/return?order=<id>`
  (insurance)
- `cancelUrl`: matching `/payment/cancel`, `/lab/payment/cancel`,
  `/insurance/payment/cancel`
- `description`: human-readable item (`Consultation <date> <time>`,
  `Lab test booking <date> <slot>`, `Health insurance premium <cycle>`)

Responses keep the shape clients consume but drop PayHere-only keys
(`hash`, `fields`, `sandbox`, `merchant_id` etc.):

```json
{ "orderId": "TB-…", "paymentId": "…", "amount": 1500,
  "currency": "LKR", "checkoutUrl": "https://pay.payments.lk/c/…",
  "provider": "paymentslk" }
```

Insurance route returns the same fields (orderId, invoiceId, amount,
checkoutUrl, provider). No per-request `notify_url` — the webhook endpoint is
registered once in the payments.lk dashboard.

### Generic invoice routes (payments.lk only)

- `POST /payments/checkout` `{ invoiceId, returnUrl, cancelUrl }` — `method`
  field removed. Creates payments.lk checkout, inserts `payments` row
  (`provider='paymentslk'`, `reference` + `provider_charge_id` =
  merchantOrderId, `paid_at` = now), audits `payments.checkout`, returns
  `{ redirectUrl, merchantOrderId, provider }`.
- `POST /webhook/paymentslk` (replaces `/webhook/stripe`) — public, no auth.
  Reads raw body, verifies signature (401 on failure), then
  `tryRecordWebhook(db, 'paymentslk', event.id, raw)` — duplicate deliveries
  short-circuit `200 {ok: true, idempotent: true}`. Dispatch:
  `INS-` orders → `handleInsurancePremiumPaid` (statusCode 2) /
  `handleInsurancePremiumFailed` (else), then `markWebhookProcessed` +
  audit. Other orders: `statusCode 2` → `UPDATE payments SET paid_at =
  datetime('now'), webhook_received_at = datetime('now') WHERE
  provider_charge_id = ?`; always `markWebhookProcessed` + audit
  `payments.webhook`.
- `POST /refund` (patient or super_admin) — resolves the `payments` row +
  invoice ownership, calls adapter `refund()` for
  `provider = 'paymentslk'`, audits `payments.refund`. Partial refunds via
  `amountMinor`. Unknown provider → `501` retained as defensive path.
- `GET /me` — unchanged.

### Patient polling

`GET /payments/:id` — unchanged. Accepts appointmentId, test-booking id, or
TB-/HH- order id; returns current status for the mobile/web poll loop.

## DB migration

`apps/api/migrations/0076_rename_payhere_columns.sql`:

```sql
ALTER TABLE appointment_payments RENAME COLUMN payhere_order_id TO gateway_order_id;
ALTER TABLE appointment_payments RENAME COLUMN payhere_payment_id TO gateway_payment_id;
ALTER TABLE appointment_payments RENAME COLUMN payhere_status_code TO gateway_status_code;
ALTER TABLE appointment_payments RENAME COLUMN payhere_method TO gateway_method;
```

- SQLite/D1 `RENAME COLUMN` carries indexes and the unique constraint on
  `payhere_order_id` along automatically.
- `raw_notify`, `failure_reason`, `refunded_amount_lkr` are already neutral —
  untouched.
- `packages/db/src/schema.ts`: `appointmentPayments` fields renamed
  (`gatewayOrderId`, `gatewayPaymentId`, `gatewayStatusCode`,
  `gatewayMethod`); PayHere comments updated to payments.lk.
- All code references renamed mechanically: `payhereOrderId` →
  `gatewayOrderId`, `payherePaymentId` → `gatewayPaymentId`,
  `payhereStatusCode` → `gatewayStatusCode`, `payhereMethod` →
  `gatewayMethod` (routes, webhook handlers, tests). The generic `payments`
  table's `provider` / `provider_charge_id` are already neutral and stay.
- Historical rows keep `provider='payhere'|'stripe'` values; they are
  audit history and are not rewritten.

## Clients

### Mobile (`apps/mobile`)

- `src/lib/payhere.ts` → `src/lib/payments.ts`:
  `runPaymentsCheckout({ checkoutUrl, pollStatus, timeoutMs })` —
  `WebBrowser.maybeCompleteAuthSession()` + `openBrowserAsync(checkoutUrl)`
  directly (hosted URL; no query-param building), same `AppState` focus
  listener + 2s poll-until-settled logic + 5 min default timeout.
- Call sites updated: `book-appointment.tsx`, `book-test.tsx`,
  `test-booking-detail/[id].tsx`, insurance screens (`policy/[id]`,
  `enroll/[planId]`, `payment/[enrollmentId]`) read `checkoutUrl` /
  `paymentRef` from the new response shape and call the new helper.

### Web (`apps/marketing`)

- `src/patient/hooks/diagnostic.ts` + `app/patient/(app)/diagnostic-tests/page.tsx`
  (lab flow) and `app/hospital/(hospital)/billing/[id]/page.tsx` (invoice
  flow): navigate to `checkoutUrl` / `redirectUrl`; drop any fields/hash
  handling. Existing return pages (`/payment/return`, `/lab/payment/return`,
  `/insurance/payment/return`) already read `?order=` and poll — unchanged.

## Config & deployment

- `apps/api/wrangler.toml`: replace PayHere comments/placeholders with
  `PAYMENTS_LK_*`; secrets set via `wrangler secret put
  PAYMENTS_LK_SECRET_KEY` / `PAYMENTS_LK_WEBHOOK_SECRET`.
- `.env.example`: add `PAYMENTS_LK_SECRET_KEY=sk_test_...`,
  `PAYMENTS_LK_WEBHOOK_SECRET=whsec_...`.
- Dashboard (manual, live): register webhook endpoint
  `{PUBLIC_URL}/api/payments/webhook/paymentslk`.

## Error handling

- `PaymentErrorCode` enum unchanged: `WebhookSignatureInvalid`,
  `WebhookReplay`, `ProviderError`, `UnsupportedProvider`, `NotFound`.
- Gateway non-2xx → `PaymentError(ProviderError, 'paymentslk', path,
  'paymentslk <status>')`.
- Webhook: signature failure → 401; duplicate delivery → 200 idempotent;
  unknown order/event → 200 ack (stops gateway retry storm); insurance
  dispatch failure → logged via `logger.error`, still acked + marked
  processed.
- Refund on a not-yet-settled payment → gateway error surfaced as
  `502 {error}`.

## Testing

Vitest under `apps/api/tests/`, mocked `fetchImpl` (follows
`payments-stripe.test.ts` conventions):

- NEW `payments-paymentslk.test.ts` — checkout request shape (Bearer,
  Idempotency-Key, LKR cents), webhook signature valid/invalid/replay,
  event normalization (succeeded/failed/expired), refund full/partial,
  ProviderError on non-2xx.
- `lab-payments.test.ts`, appointment payment tests, insurance payout tests —
  updated to the payments.lk flow: initiate returns hosted URL,
  webhook flips `pending→paid` (+ appointment/booking `confirmed`),
  idempotent replay of the same event, failed/expired paths.
- `payments-types.test.ts`, `payments-webhook-idempotency.test.ts` —
  provider value `'paymentslk'`.
- DELETED `payments-stripe.test.ts`.

Verification: `bun run test` and `bun run typecheck` (mobile's pre-existing
LucideIcon errors are out of scope and non-blocking).

## Out of scope (YAGNI)

- Saved cards / off-session charges (`card.saved`, `POST /v1/cards/:id/charge`
  — requires payments.lk Advanced plan).
- Payment links, pay button widget, MCP server integration.
- `GET /v1/payments` reconciliation sync job.
- Payouts/disputes feeds.
