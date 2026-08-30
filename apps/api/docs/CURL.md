# API CURL Examples

Last updated: 2026-08-30

Run from repo root with API on `localhost:8787`. Replace `$TOKEN` with a Bearer token obtained via `/auth/login`.

## PayHere appointment checkout (existing)

```bash
curl -X POST http://localhost:8787/payments/initiate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":"appt_1"}'
```

## Generic Stripe checkout (Block A — R5)

```bash
curl -X POST http://localhost:8787/payments/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"inv_1","method":"stripe","returnUrl":"http://localhost:3000/return"}'
```

## Stripe webhook (simulate)

Generate a signature in Node:

```js
const ts = Math.floor(Date.now() / 1000);
const payload = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", amount_total: 5000, currency: "usd" } },
});
const sig = require("crypto")
  .createHmac("sha256", "whsec_x")
  .update(`${ts}.${payload}`)
  .digest("hex");
console.log(`t=${ts},v1=${sig}`);
```

Then:

```bash
curl -X POST http://localhost:8787/payments/webhook/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=$TS,v1=$SIG" \
  -d '{"id":"evt_1","type":"checkout.session.completed","data":{"object":{"id":"cs_1","amount_total":5000,"currency":"usd"}}}'
```

Expected: `{"ok":true}` first call, `{"ok":true,"idempotent":true}` on replay.

## Doctor reply-time (Block A — R13)

```bash
curl http://localhost:8787/doctors/$DOCTOR_ID/reply-time \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

```json
{ "medianMinutes": 45, "sampleSize": 12, "computedAt": "2026-08-30T..." }
```

## SMS providers (Block A — R6)

Trigger an OTP send:

```bash
curl -X POST http://localhost:8787/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+94770000000"}'
```

Check `[sms:console]` log line (when `SMS_PROVIDER=console`), or Twilio/Dialog-lk dashboard (when configured).

## Push receipts cron (Block A — R10)

```bash
curl -X POST http://localhost:8787/__cron/push-receipts \
  -H "x-cron-secret: $CRON_SECRET"
```

Expected: `{"ok":true,"processed":N}` where N = tickets polled in last 24h.

## Demo seed (Block A — R12)

```bash
bun run seed:demo
```

Outputs counts and login credentials table. Idempotent.
