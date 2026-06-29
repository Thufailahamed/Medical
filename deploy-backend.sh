#!/bin/bash
# Exit immediately if any command fails
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
bun run db:generate
echo "✅ Migrations generated successfully."
echo ""

echo "🗄️ Step 2: Applying database migrations to Cloudflare D1 (REMOTE)..."
cd apps/api
npx wrangler d1 migrations apply healthcare-db --remote
echo "✅ Remote migrations applied."
echo ""

echo "💻 Step 3: Applying database migrations to local D1 (LOCAL DEV)..."
npx wrangler d1 migrations apply healthcare-db --local
echo "✅ Local migrations applied."
echo ""

echo "🌐 Step 4: Deploying API Worker to Cloudflare..."
npx wrangler deploy
echo "✅ API Worker deployed."
echo ""

echo "=========================================================="
echo "🎉 Deployment Completed Successfully!"
echo "=========================================================="
