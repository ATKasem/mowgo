#!/bin/bash
# deploy-edge-functions.sh
# Deploy the iOS-owned Supabase Edge Function (ai-chat).
# Payments run in Cloudflare Pages Functions (functions/api/payments).
#
# Prerequisites:
#   1. Install Supabase CLI: brew install supabase/tap/supabase
#   2. Login: supabase login
#   3. Link project: supabase link --project-ref vqgiynfrpsqddjrayczc
#
# Usage: bash deploy-edge-functions.sh

set -euo pipefail

echo "🌾 MowGo Edge Functions Deployment"
echo "====================================="

# Check supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ supabase CLI not found. Install: brew install supabase/tap/supabase"
    exit 1
fi

echo ""
echo "📋 Setting secrets (skip if already set)..."
echo ""

# AI Chat
echo "  → ai-chat: OPENROUTER_API_KEY"
supabase secrets set OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" 2>/dev/null || echo "  ⚠️  Set OPENROUTER_API_KEY env var first"

echo ""
echo "🚀 Deploying functions..."
echo ""

supabase functions deploy ai-chat

echo ""
echo "✅ ai-chat deployed!"
echo ""
echo "📋 Deployed functions:"
supabase functions list
