# Autopilot Public Face — Scope (0.5 day)

**Created:** 2026-08-02 (8am action run) · **Status:** SCOPED — ready for build
**Why now:** AI front-office is the battleground — AutoRev (Jul 27), Jobber AI Receptionist ($99 add-on), QuoteIQ Virtual Call Team, TurfHop Orbit AI, Servinix ($300/mo, Sept 14). MowGo already HAS Autopilot (14 tools, function-calling, OpenRouter proxy — server/functions + client/src/hooks/useAutopilot.js + components/AutopilotChat.jsx) but it is **invisible/unmarketed**. 67% of commercial landscapers use AI for scheduling (verified trends intel); 83% of pros haven't adopted → headroom story.

## What ships (no new AI build — surface what exists)

1. **Chat widget on landing page** (`client/src/pages/Landing.jsx`)
   - Floating chat bubble (bottom-right, reuses AutopilotChat.jsx component)
   - Opens a chat panel: "Ask MowGo AI anything about your business — scheduling, invoicing, client lookup" (copy already exists in i18n `mowgo_ai` keys)
   - Unauthenticated visitors get a demo-mode answer or a "sign in to use Autopilot" gate → login CTA
   - Authed users get full function-calling Autopilot
2. **Landing copy section** (2-3 lines): "AI that answers questions and books jobs" — positioning line; NOT "AI estimates" (that claim is FALSE — do not add)

## What does NOT ship

- No new AI capabilities, no new tools, no estimates/measurements claims
- No changes to Autopilot's function-calling backend (server-side already live)

## Build steps

1. `Landing.jsx`: add `<AutopilotChat />` floating widget + i18n keys (en/es) for the bubble/CTA
2. Gate: `isDemoMode()` (client/src/lib/supabase.js) → demo response for visitors, real tools for logged-in users
3. Verify: build + wrangler deploy (client/dist + functions bundle — see daily_actions.json deploy lesson)
4. QA: authed chat returns real OpenRouter answers (autopilot endpoint verified working Aug 1)

## Files touched

- `client/src/pages/Landing.jsx`
- `client/src/i18n/locales/en.json` + `es.json`
- possibly `client/src/components/AutopilotChat.jsx` (props for embedded mode)

## Test plan

- [ ] Landing loads with chat bubble on mobile + desktop
- [ ] Logged-out: friendly demo/CTAs, no backend calls
- [ ] Logged-in: real answers (PONG test via autopilot endpoint)
- [ ] Spanish locale renders
- [ ] No AI-estimates claims introduced anywhere
