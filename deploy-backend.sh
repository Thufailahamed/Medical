#!/bin/bash
# Deploy script — applies migrations to REMOTE D1, then to LOCAL D1
# (best-effort), then deploys the Worker.
#
# Local D1 note: the migrations/ folder contains incremental ALTERs that
# were applied in dependency-order over time. They aren't designed for
# a pure alphabetical apply on a fresh DB. Local D1 is for dev only —
# production is REMOTE. If local apply fails, log a warning and continue;
# the deploy still succeeds.

# Exit immediately on any uncaught error
set -e

# Clear screen
clear

echo "=========================================================="
echo "🚀 HealthHub Backend & Database Deployment Script"
echo "=========================================================="
echo ""

# Go to repository root
cd "$(dirname "$0")"

echo "📦 Step 1: Generating database migrations from schema changes..."
bun run db:generate 2>&1 | tail -20 || echo "(no schema diff)"
echo "✅ Migrations generated."
echo ""

echo "🗄️ Step 2: Applying database migrations to Cloudflare D1 (REMOTE)..."
cd apps/api
npx wrangler d1 migrations apply healthcare-db --remote
echo "✅ Remote migrations applied."
echo ""

echo "💻 Step 3: Applying database migrations to local D1 (LOCAL DEV)..."
# Best-effort: skip on failure. Remote is the source of truth for prod.
if npx wrangler d1 migrations apply healthcare-db --local 2>&1 | tee /tmp/local_migrate.log; then
  echo "✅ Local migrations applied."
else
  echo ""
  echo "⚠️  Local migration apply failed — likely pre-existing schema drift."
  echo "   Remote + Worker deploy still succeeded; local DB is dev-only."
  echo "   To fully reset local: rm .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite*"
  echo "   Then re-run: npx wrangler d1 execute healthcare-db --local --file ./schema.sql"
  echo "   Then:       npx wrangler d1 migrations apply healthcare-db --local"
  echo "   (see /tmp/local_migrate.log for the failure detail)"
fi
echo ""

echo "🌐 Step 4: Deploying API Worker to Cloudflare..."
npx wrangler deploy
echo "✅ API Worker deployed."
echo ""

echo "=========================================================="
echo "🎉 Deployment Completed Successfully!"
echo "=========================================================="