#!/bin/bash
# Deploy script for HealthHub Frontend (@healthcare/marketing) to Cloudflare.
# Exit immediately on any uncaught error
set -e

echo "=========================================================="
echo "🚀 HealthHub Frontend Deployment Script"
echo "=========================================================="
echo ""

# Go to repository root
cd "$(dirname "$0")"

echo "📦 Step 1: Building frontend with OpenNext Cloudflare..."
cd apps/marketing
bunx opennextjs-cloudflare build
echo "✅ Build completed."
echo ""

echo "🌐 Step 2: Deploying to Cloudflare Workers & Assets..."
bunx wrangler deploy
echo "✅ Frontend deployed to Cloudflare."
echo ""

echo "=========================================================="
echo "🎉 Frontend Deployment Completed Successfully!"
echo "=========================================================="
