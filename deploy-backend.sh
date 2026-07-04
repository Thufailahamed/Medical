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

# Step 3 (Local migrations) has been removed at user request.
echo ""

echo "🌐 Step 4: Deploying API Worker to Cloudflare..."
npx wrangler deploy
echo "✅ API Worker deployed."
echo ""

echo "=========================================================="
echo "🎉 Deployment Completed Successfully!"
echo "=========================================================="