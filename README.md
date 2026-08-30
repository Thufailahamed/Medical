# HealthHub — Healthcare Platform

Monorepo: Expo mobile + Hono/Cloudflare Workers API + Next.js 16 marketing/portals + shared packages.

## Quick links

- [Demo](https://healthhub.lk/demo) — login credentials
- [Pricing](https://healthhub.lk/pricing) — 3 tiers (Patient / Doctor Pro / Clinic Pro)
- [About](https://healthhub.lk/about)

## Workspace layout

```
apps/
  api/         Hono on Cloudflare Workers + D1/SQLite (Drizzle)
  marketing/   Next.js 16 — marketing pages + doctor/hospital/patient portals
  mobile/      Expo SDK 51 (React Native) — patient + doctor apps
packages/
  db/          Drizzle schema + migrations
  shared/      Types, validators, vitals, records, doctor-badge
```

## Local dev

```bash
# Install
bun install

# Apply DB migrations (local D1)
npx wrangler d1 execute healthcare-db --local \
  --config apps/api/wrangler.toml \
  --file=migrations/0001_follow_up_status.sql
# ...repeat for each migration in apps/api/migrations/

# Seed demo accounts (idempotent)
bun run seed:demo

# Run services
bun run dev:api        # API on :8787
bun run dev:marketing  # Web on :3000
bun run dev:mobile     # Expo dev client
```

## Test

```bash
bun run test           # API unit tests via vitest
bun run typecheck      # All packages (mobile has pre-existing LucideIcon type errors)
```

## Key Block A additions (Aug 2026)

- Stripe adapter + generic `/payments/checkout` + webhook + refund + `/me` routes (`apps/api/src/lib/payments/`)
- Twilio + Dialog-lk SMS providers alongside existing SMSLenz (`apps/api/src/lib/sms.ts`)
- Per-user SMS opt-out (`notification_opt_outs` table, migration 0073)
- Webhook idempotency helper (`payment_webhook_events` table, migration 0072)
- Push receipt polling cron + `DeviceNotRegistered` cleanup (migration 0075)
- Reply-time API (`GET /doctors/:id/reply-time`)
- Demo seed (1 admin + 2 doctors + 5 patients + records + appointments)
- Pricing + About + Demo pages
- DoctorBadge web component + DoctorChip mobile component (not yet wired into surfaces)
- BAA/DPA inventory (`apps/api/docs/BAA-INVENTORY.md`)
- API CURL examples (`apps/api/docs/CURL.md`)
- Device verification checklist (`docs/DEVICE-CHECKLIST.md`)
- EAS production push setup (`apps/mobile/docs/PUSH-SETUP.md`)

## Migrations

Migrations live in `apps/api/migrations/` (number 0001–0075).

Apply locally:
```bash
cd apps/api
for f in migrations/00*.sql; do
  npx wrangler d1 execute healthcare-db --local --file="$f"
done
```

Apply remote (after Drizzle journal sync):
```bash
npx wrangler d1 migrations apply healthcare-db --remote
```

## Architecture decisions

See `docs/superpowers/specs/` for design docs, `docs/superpowers/plans/` for implementation plans.
