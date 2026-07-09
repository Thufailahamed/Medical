#!/usr/bin/env bash
# ─── Set production secrets for healthcare-api ───────────
#
# Phase MVP-1 launch hardening. Generates 6 random base64 secrets
# (KEKs + JWT + CRON) via openssl, then prompts for 7 third-party
# API keys (WA, SMSLenz, Resend, PayHere), and pushes all 13 via
# `wrangler secret put` against the production Worker.
#
# The production Worker is deployed at
#   https://healthcare-api.thufailahamed627.workers.dev
# via `wrangler deploy` (no --env flag), so secrets are also set
# without --env.
#
# Re-runnable: `wrangler secret put` overwrites. KEKs are regenerated
# each run — DO NOT re-run without a KEK rotation plan (see
# apps/api/src/lib/envelope-crypto.ts:66-80 for the legacy
# `kek-2026-01` alias). For first-time setup, this is safe.
#
# Usage: cd apps/api && bash ../../scripts/set-prod-secrets.sh
#
# Requires: openssl, npx wrangler, working `wrangler whoami`.

set -euo pipefail

cd "$(dirname "$0")/../apps/api"

echo "▸ Generating 6 random secrets via openssl..."
RECORD_KEK_PRIMARY=$(openssl rand -base64 32)
DOCTOR_KEY_KEK=$(openssl rand -base64 32)
MFA_SECRET_KEK=$(openssl rand -base64 32)
MFA_RECOVERY_PEPPER=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -base64 32)

echo "▸ Pushing 6 random secrets (no prompts)..."
printf '%s' "$RECORD_KEK_PRIMARY"  | npx wrangler secret put RECORD_KEK_PRIMARY
printf '%s' "$DOCTOR_KEY_KEK"       | npx wrangler secret put DOCTOR_KEY_KEK
printf '%s' "$MFA_SECRET_KEK"       | npx wrangler secret put MFA_SECRET_KEK
printf '%s' "$MFA_RECOVERY_PEPPER"  | npx wrangler secret put MFA_RECOVERY_PEPPER
printf '%s' "$JWT_SECRET"           | npx wrangler secret put JWT_SECRET
printf '%s' "$CRON_SECRET"          | npx wrangler secret put CRON_SECRET

echo
echo "▸ Now pushing 7 third-party API secrets (interactive)."
echo "  Paste each value when prompted, then press Cmd-D (macOS) / Ctrl-D."
echo

# These are interactive — wrangler reads from stdin until EOF.
npx wrangler secret put WA_VERIFY_TOKEN
npx wrangler secret put WA_ACCESS_TOKEN
npx wrangler secret put SMSLENZ_USER_ID
npx wrangler secret put SMSLENZ_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put PAYHERE_MERCHANT_ID
npx wrangler secret put PAYHERE_SECRET

echo
echo "▸ Verifying..."
npx wrangler secret list

echo
echo "✓ Done. Run `npx wrangler deploy` from apps/api to push code."
