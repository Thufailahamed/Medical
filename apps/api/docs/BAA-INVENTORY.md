# Vendor BAA / DPA Inventory

Last updated: 2026-08-30

## Vendors handling PHI/PII

| Vendor | Data sent | BAA / DPA status | Mitigation |
|---|---|---|---|
| Twilio (SMS) | phone, OTP, reminder text | Twilio intl BAA available — **must sign before prod** | Default to `SMS_PROVIDER=smslenz` or `dialog-lk` (SL local) until Twilio BAA executed |
| SMSLenz (SMS) | phone, OTP, reminder text | DPA on file | Default provider for SL local traffic; acceptable for OTPs (single-use 5min TTL) |
| Dialog.lk (SMS) | phone, OTP, reminder text | No formal BAA — SL local provider | Acceptable for non-regulated reminders; OTPs single-use 5min |
| PayHere (payments) | invoice ref, amount, customer phone/email | DPA on file | Invoice refs only; no card data hits our servers |
| Stripe (payments) | invoice ref, amount, card via Stripe Elements | Stripe DPA signed | Card data never touches our backend |
| Expo Push | device token, notification payload | Expo ToS + DPA | Token scoped per device; opt-out on `DeviceNotRegistered` |
| Cloudflare R2 | file blobs (PDFs, images, Rx PDFs) | Cloudflare DPA | Envelope-encrypted at rest with per-tenant DEK |
| Cloudflare Workers AI | redacted text only | Cloudflare DPA | PII redaction in `lib/redact.ts` BEFORE call |
| Anthropic (fallback) | redacted text | Anthropic API ToS + DPA | Same redaction; circuit breaker caps daily calls (`ANTHROPIC_DAILY_CAP`) |

## Pre-prod checklist

1. Sign Twilio BAA (intl) OR keep `SMS_PROVIDER=smslenz|dialog-lk` for all PHI traffic.
2. Confirm PayHere merchant DPA.
3. Confirm Stripe DPA covers LKR settlement.
4. Confirm Cloudflare enterprise DPA covers Workers AI for PHI.
5. Confirm `notification_opt_outs` rows are written on Twilio `21610` (handled by `sendSmsWithOptOut`).

## Per-channel opt-out

- **SMS**: `notification_opt_outs(user_id, channel='sms')`. Written by `sendSmsWithOptOut` on Twilio `21610`. Checked before every send.
- **Email**: not yet implemented — `RESEND_API_KEY` provider lacks unsubscribe webhook handling. TODO before scale.
- **Push**: implicit via `DeviceNotRegistered` from Expo receipts (handled by `pollReceipts` cron, Task R10).
