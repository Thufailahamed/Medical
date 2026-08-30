# Block A — Pitch-Ready MVP Hardening — Design

**Date**: 2026-08-30
**Scope**: `/Users/thufailahamed/Downloads/App-2`
**Source**: `MVP-FOR-PITCH.md` Block A (5 items, ~5.5 dev-days)
**Approach**: Sequential A1 → A2 → A3 → A4 → A5, one merge per day. External credential setup (PayHere merchant, Twilio, EAS) runs in parallel during days 1-2.

---

## 1. Architecture

**Gateway adapter pattern** for all 3 external integrations (PayHere, SMS, Expo Push):

- `apps/api/src/lib/<provider>/index.ts` exposes single `send(input)` / `verify(webhook)` / `register(token)` surface.
- Provider impl hidden behind env flag (`SMS_PROVIDER=twilio|dialog-lk|console`).
- Wrangler `[secrets]` (encrypted) for credentials, `[vars]` for non-secret config. `.dev.vars` for local.
- Existing `audit_logs` extended with `provider`, `provider_ref`, `status` rows for every external call.
- Existing `notifications` table + SSE channel reused for delivery receipts.

**Demo seed** lives in `apps/api/scripts/seed-demo.ts` (idempotent UPSERT keyed on email/NIC). Wired to `package.json` `seed:demo`.

**Trust badge** = new shared types/contract in `@healthcare/shared` (web + mobile render separately).

---

## 2. Components (file map per item)

### A1 Payment gateway (PayHere + Stripe)

- `apps/api/src/lib/payments/{payhere,stripe,types,errors}.ts` — adapters
- `apps/api/src/routes/payments.ts` — `/payments/checkout`, `/payments/webhook/payhere` (HMAC MD5 verify), `/payments/webhook/stripe` (sig header verify), `/payments/me`, `/payments/refund`
- `apps/api/wrangler.toml` — `PAYHERE_*`, `STRIPE_*` as encrypted secrets
- `packages/shared/src/validators.ts` — extend `paymentSchema`
- `apps/marketing/src/app/hospital/(hospital)/billing/new/page.tsx` — wire "Pay now"
- `apps/marketing/src/app/portal/(portal)/prescriptions/[id]/page.tsx` — fee + "Pay & book"
- `apps/mobile/src/app/(app)/appointments/book-appointment.tsx` — fee summary + cancel policy
- DB: extend `payments` table with `provider`, `provider_charge_id`, `webhook_received_at`

### A2 SMS

- `apps/api/src/lib/sms.ts` — `twilio` + `dialog-lk` impls behind `SMS_PROVIDER` env
- `apps/api/.env.example` + `wrangler.toml` — `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_FROM`
- `apps/api/src/routes/auth.ts:629-634` — replace `console.log` with provider call
- Audit each `cron/{booking,dose,refill,vaccination}-reminders.ts` calls into `sms.send`
- New `apps/api/docs/BAA-INVENTORY.md`

### A3 Push prod

- `apps/mobile/eas.json` — `submit.production.ios.appleId`, `android.googleServicesFile`
- Add `google-services.json` + `GoogleService-Info.plist` (gitignored, env-supplied)
- `apps/mobile/app.config.js` — verify `android.package`, `ios.bundleIdentifier`
- `apps/mobile/src/lib/push.ts` — verify token register on auth success, channel bind to `/push/push-tokens`
- `apps/api/src/lib/notifications.ts` — verify Expo Push call + token format check
- `eas build --profile production` (manual step, not CI)

### A4 Pricing + About + Demo seed

- `apps/marketing/src/app/pricing/page.tsx` — 3 tiers (Patient free / Doctor Pro LKR 2,500 / Clinic Pro LKR 15,000)
- `apps/marketing/src/app/about/page.tsx` — founders, mission, contact, press kit
- `apps/marketing/src/components/Footer.tsx` — link to `/pricing`
- `apps/api/scripts/seed-demo.ts` — idempotent: 1 admin, 2 doctors (SLMC verified), 5 patients, 10 records each, 3 appts each, 2 Rx each
- `apps/marketing/src/app/demo/page.tsx` — public "Try demo" with login creds visible
- `package.json` — add `seed:demo` script

### A5 Doctor trust badges

- `packages/shared/src/doctor-badge.ts` — types/contract (verified pill, specialty, years, fee, reply-time)
- `apps/marketing/src/portal/components/doctor/DoctorBadge.tsx` — web render
- `apps/mobile/src/components/DoctorChip.tsx` — RN render (parallel impl)
- `apps/mobile/src/app/(app)/records.tsx` — doctor attribution chip on shared records
- `apps/mobile/src/app/(doctor)/profile.tsx` — fee input confirm
- `apps/marketing/src/app/portal/(portal)/patients/[id]/layout.tsx` — badge in chart header
- New API: `GET /doctors/:id/reply-time` — median minutes between inbound patient message and first doctor reply, computed over last 30 days of `messages` rows for that doctor, excluding auto-replies and system messages. Returns `{ medianMinutes, sampleSize, computedAt }`. Empty case (no messages) returns `{ medianMinutes: null, sampleSize: 0 }`.
- Wire reply-time badge into booking screens (mobile + web)

---

## 3. Data Flow

### Payment (PayHere path)

1. Patient clicks "Pay" → mobile/web POST `/payments/checkout { invoiceId, method }`.
2. API creates `payments` row (`status=pending`, `provider=payhere`), returns `{ redirectUrl, merchantOrderId }`.
3. Client opens PayHere checkout in WebView/redirect.
4. PayHere POSTs `/payments/webhook/payhere` with HMAC-MD5 over `merchant_id|order_id|amount|currency|status_code|merchant_secret` (md5 of secret).
5. API verifies HMAC, idempotency-keyed on `merchantOrderId`, updates `payments.status` to `paid|failed`, writes `audit_logs` row, fires SSE event to patient + hospital billing tabs.
6. On PayHere `status_code=2` (success), mark linked `invoices.paid_at = now()`, fire `notifications` row to patient. Other codes (`0`=pending, `1`=cancelled, `-1`=failed, `-2`=failed, `-3`=chargeback) update `payments.status` accordingly and skip downstream effects.
7. Refund = `POST /payments/refund { paymentId, amount }` → gateway adapter calls refund API, polls or waits for webhook, updates row.

### SMS dispatch

1. Any caller (`auth.sendOtp`, `cron.*-reminders`, `walk-in-notify`) invokes `sms.send({ to, template, vars })`.
2. Adapter selects impl from `SMS_PROVIDER`. Returns `{ providerRef, status }`.
3. `audit_logs` row + `notifications` row written. On `twilio` 429, exponential backoff (3 tries, 1s/3s/9s) then mark `failed` + SSE error.
4. Rate limit: existing per-user OTP cap (5/5min) honored at route layer; gateway-level adapter does NOT rate-limit (carrier handles).

### Push registration

1. Mobile app on auth success calls `apps/mobile/src/lib/push.ts:register()` → `expo-notifications.getExpoPushTokenAsync()`.
2. POST `/push/push-tokens { token, deviceId, platform, channel }` → D1 `push_tokens` row (unique on token).
3. On notification fan-out, `apps/api/src/lib/notifications.ts` reads all `push_tokens` for target user, batches via Expo Push API (100/batch).
4. Receipts from Expo polled via cron → update `notifications.status` (`delivered|failed`), retry once on transient failure.

### Demo seed

1. `bun run seed:demo` → reads `seed-demo.ts` fixture.
2. UPSERT on `users.email` / `users.nic_hash`. If exists → skip. If new → bcrypt hash, insert patient/doctor/admin rows + tenant + memberships.
3. Generate 10 records per patient via direct Drizzle insert (no upload pipeline — bypasses OCR).
4. Generate 3 appointments (past+future), 2 prescriptions (signed via existing `lib/signing.ts`).
5. Output console table of creds → paste into `/demo` page.

---

## 4. Error Handling

### Webhook idempotency (payments)

- Table `payment_webhook_events` (`provider`, `event_id`, `received_at`, `processed_at`). Insert-or-skip on `(provider, event_id)`. Stops replay attacks + duplicate processing.
- HMAC verification BEFORE any DB write. Failed HMAC → 401, log to `audit_logs`, no state change.
- PayHere/Stripe "test" mode events tagged separately, allow in dev only via `ALLOW_TEST_WEBHOOKS=true`.

### SMS failure

- Twilio/Dialog 4xx/5xx → mark `notifications.status=failed`, fire SSE error to caller UI.
- Twilio `21610` (unsubscribed) → blacklist in `notifications.opt_out` (per-user, per-channel), skip future sends.
- Provider totally down → adapter throws, cron job retries next tick (existing behavior).
- Never block auth flow on SMS failure — log + allow user to retry `/auth/send-otp` (rate limit still applies).

### Push failure

- Expo `DeviceNotRegistered` → delete `push_tokens` row, mark notification `failed` (no retry).
- Expo rate limit (`429`) → exponential backoff in cron, max 3 retries.
- Receipt poll failure → notification stays `sent` (best effort — push is fire-and-forget UX).
- Web fallback: if user has no `push_tokens`, deliver via SSE + email (existing).

### Demo seed failure

- Idempotent: re-run = safe. Partial failure leaves DB in consistent state (UPSERT pattern).
- Pre-flight: check `wrangler` auth + D1 binding before any insert.

### General

- All external calls wrapped in `withAudit({provider, op})` helper — auto-writes `audit_logs` row with status + latency.
- All secrets read via `c.env.<NAME>` — never logged, never returned in error responses.
- Feature flags per item (`ENABLE_PAYHERE=true`, `SMS_PROVIDER=console`, `PUSH_PROVIDER=expo`) — kill switch without redeploy.

---

## 5. Testing

### Unit (vitest)

- `apps/api/tests/payments-payhere.test.ts` — HMAC MD5 verify, replay rejection, idempotency.
- `apps/api/tests/payments-stripe.test.ts` — sig header verify, partial refund math.
- `apps/api/tests/sms.test.ts` — Twilio + Dialog adapter, retry/backoff, opt-out blacklist.
- `apps/api/tests/seed-demo.test.ts` — idempotent re-run, UPSERT key collision, FK integrity.
- `apps/api/tests/notifications-push.test.ts` — Expo batch, `DeviceNotRegistered` cleanup, rate-limit backoff.
- `apps/api/tests/doctors-reply-time.test.ts` — median calculation, empty case.

### Integration

- Sandbox end-to-end: PayHere sandbox merchant + Stripe test mode → click through full checkout from hospital billing page.
- Twilio test creds → verify OTP arrives.
- Expo push sandbox → token round-trip on physical iPhone + Android (manual, `bun run test:device` script).

### Manual device

- iOS: `eas build --profile production --platform ios` → TestFlight → verify push delivery + deep link to `appointment-detail`.
- Android: `eas build --profile production --platform android` → internal track → same.
- Trilingual smoke: switch locale to si/ta, walk through pricing → signup → record upload.

### Verification gate

- All new endpoints have curl example in `apps/api/docs/CURL.md`.
- `bun test` green in `apps/api/`.
- `bun run typecheck` green across all 4 packages.
- Manual device checklist (`docs/DEVICE-CHECKLIST.md`) signed off.
- Demo URL public, `/demo` page live, seed runs in <30s.

### Out of scope (explicit)

- Load testing (defer — pre-launch).
- Visual regression (defer — no Percy/Chromatic in stack).
- E2E Playwright (defer — none in stack today).

---

## 6. Build Order

| Day | Item | Parallel | Merge |
|---|---|---|---|
| 1 | A1 PayHere adapter + `/payments/checkout` + webhook HMAC + test | PayHere sandbox account setup (manual) | `feat(payments): payhere adapter + checkout + webhook` |
| 2 | A1 cont. (Stripe, refund, `/payments/me`) + A2 SMS adapter + replace `console.log` | Twilio account setup (manual) | `feat(sms): twilio + dialog-lk adapters + cron wiring` |
| 3 | A3 push creds + EAS config + device build + Expo Push verify | EAS/Firebase project config (manual) | `feat(push): production FCM/APNs creds + device verify` |
| 4 | A4 pricing/about pages + seed-demo + /demo page | — | `feat(pitch): pricing + about + demo seed + demo page` |
| 5 | A5 DoctorBadge + DoctorChip + reply-time API + booking wiring | — | `feat(doctors): trust badges + reply-time` |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| PayHere sandbox access delays | Run account setup day 1 in parallel; fallback Stripe-only if PayHere stalls |
| Twilio BAA scope unclear | Default to `dialog-lk` (local, no BAA needed); flag Twilio BAA in `BAA-INVENTORY.md` for legal review |
| EAS build requires Apple/Google dev accounts | Manual step day 3; if blocked, ship A1+A2+A4+A5 first (no device push) |
| Seed FK migration drift | Pin to current migration head; document required migrations in `seed-demo.ts` header |
| Demo URL not public | Use existing `deploy-backend.sh` + CF Pages preview; document DNS in `docs/DEPLOY.md` |
