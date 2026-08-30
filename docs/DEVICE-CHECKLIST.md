# Device Verification Checklist

Last updated: 2026-08-30

## Pre-flight

- [ ] `bun run seed:demo` completes; `users` table contains demo accounts.
- [ ] `bun run typecheck` green for `@healthcare/api` (mobile has pre-existing LucideIcon errors — unrelated).
- [ ] API running on `localhost:8787` (or remote staging URL).
- [ ] Expo Go installed on test device OR TestFlight/internal track build installed.

## iOS

- [ ] `eas build --profile production --platform ios` succeeds.
- [ ] TestFlight install OK.
- [ ] Login as `demo+patient1@healthhub.lk` works.
- [ ] Trigger a notification (admin broadcast OR booking reminder cron within 24h of seeded appointment).
- [ ] Push arrives with correct deep link to `appointment-detail`.
- [ ] Switch locale to **si** → all UI strings localized (auth, records, profile).
- [ ] Switch locale to **ta** → all UI strings localized.
- [ ] Take photo of lab PDF → record created + classified correctly (existing extraction pipeline).

## Android

- [ ] `eas build --profile production --platform android` succeeds.
- [ ] Internal track install OK.
- [ ] Same login + push + i18n checks as iOS.

## Web (marketing + portals)

- [ ] `/pricing` renders 3-tier table.
- [ ] `/about` renders contact info.
- [ ] `/demo` renders credentials table.
- [ ] Hospital portal `/hospital/billing/new` "Pay now" button calls `/payments/checkout` (Stripe) and redirects to `checkout.stripe.com`.
- [ ] Doctor portal `/portal/patients/[id]` shows `<DoctorBadge>` in chart header (SLMC + reply-time).
- [ ] Mobile records screen shows `<DoctorChip>` on shared records.

## Verification commands

```bash
# Run all api tests
bun test --filter '*api*'

# Typecheck api only (mobile has pre-existing errors)
cd apps/api && bun run typecheck

# Apply pending migrations locally
cd apps/api && npx wrangler d1 execute healthcare-db --local --file=migrations/0075_notification_push_status.sql
```

## Rollback plan

If a release breaks prod:

1. `wrangler rollback` to last green deployment.
2. For DB migrations: keep migration forward-compatible (no destructive ALTER). If a column rename is needed, do it as 2-step: add new → migrate data → drop old.
3. For feature flags: each Block A integration is gated by env var — flip `STRIPE_SECRET_KEY=<empty>` to disable Stripe, `SMS_PROVIDER=console` to disable real SMS, etc.
