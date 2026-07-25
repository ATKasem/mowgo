#!/bin/bash
# deploy-edge-functions.sh
# Deploy all 4 Supabase Edge Functions for MowFlow.
#
# Prerequisites:
#   1. Install Supabase CLI: brew install supabase/tap/supabase
#   2. Login: supabase login
#   3. Link project: supabase link --project-ref vqgiynfrpsqddjrayczc
#
# Usage: bash deploy-edge-functions.sh

set -euo pipefail

echo "🌾 MowFlow Edge Functions Deployment"
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

# Stripe
echo "  → Stripe: STRIPE_SECRET_KEY"
supabase secrets set STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}" 2>/dev/null || echo "  ⚠️  Set STRIPE_SECRET_KEY env var first"
echo "  → Stripe: STRIPE_PRICE_SOLO"
supabase secrets set STRIPE_PRICE_SOLO="${STRIPE_PRICE_SOLO:-}" 2>/dev/null || echo "  ⚠️  Set STRIPE_PRICE_SOLO env var first"
echo "  → Stripe: STRIPE_PRICE_CREW"
supabase secrets set STRIPE_PRICE_CREW="${STRIPE_PRICE_CREW:-}" 2>/dev/null || echo "  ⚠️  Set STRIPE_PRICE_CREW env var first"

echo ""
echo "🚀 Deploying functions..."
echo ""

supabase functions deploy ai-chat
supabase functions deploy create-payment-intent
supabase functions deploy confirm-payment
supabase functions deploy create-checkout-session

echo ""
echo "✅ All 4 functions deployed!"
echo ""
echo "📋 Deployed functions:"
supabase functions list
