# SPEC: Trial-First No-Card Flow (web) — "Use it 14 days, then ask"

**Date:** 2026-08-07 · **Rev:** 1 · **Source:** Blasian decision + Hormozi lens (free-trial = ultimate proof; sell at deprivation; friction kills)

## Goal
Replace the current "card at checkout for a paid trial" flow with a **no-card 14-day trial**: signup with plan intent → grant the paid tier immediately (no Stripe) → user uses the app with full paid features → in-app prompt at/after day 14 to subscribe (card collected only at conversion). Also fixes the reported verification-link bug: after email confirm, leaving the page and returning must still grant the trial (currently the intent expires/latches and the user silently stays on free tier after clicking Premium).

## Current state (VERIFIED 2026-08-07)
- **Signup intent flow:** plan CTA (Landing/Compare/Subscribe) → logged out → `localStorage` `mowgo_plan_intent`/`mowgo_interval_intent`/`mowgo_intent_time` → `/login?mode=signup&plan=X&interval=Y`. After auth, `resumeCheckoutIntent()` (client/src/lib/payments.js:48) fires → `startCheckout()` → Stripe Checkout with `subscription_data[trial_period_days]=14` AND `payment_method_types[0]=card` (card REQUIRED up front; `payment_method_collection` unset → Stripe default `always`).
- **The bug Blasian reported:** `resumeInFlight` module latch (payments.js:47,65) + 30-min TTL (payments.js:57) + intent cleared on success (payments.js:83-85). Click verification link → app mounts → `ResumeCheckoutIntent` (App.jsx:140) fires once. Leave and come back: latch returns `{status:'started'}` immediately or intent is gone → **no second card prompt, and no tier ever granted** (only the Stripe webhook sets tier). Result: paid-plan clickers stranded on `free` tier.
- **Tier enforcement ground truth:** `profiles.tier` (001:7, default `'free'`). Server-side free-client-cap trigger `20260806140000_free_client_cap.sql` reads `profiles.tier` at INSERT (5-client cap on free). Concierge gate `['solo','crew','premium']`. Route optimization gated by tier in client.
- **Webhook:** `functions/api/stripe/webhook.js` sets `profiles.tier` from Stripe subscription (checkout.session.completed / customer.subscription.updated / deleted). This stays — real subscriptions still drive tier.
- **Checkout:** `functions/api/stripe/checkout-subscription.js` (CF Pages, auth-gated, creates Checkout Session, returns `{url}`).
- No `trial_*` columns exist on `profiles`.

## Design (single source of truth stays `profiles.tier`)
`profiles.tier` remains THE runtime tier — all existing gates (client cap trigger, concierge, route opt, UI) keep working unchanged. Trial adds bookkeeping columns + a grant RPC + an expire RPC. **Granting the trial literally sets `tier = plan`**; expiry sets it back to `'free'`. This is the cleanest model: no effective-tier computation anywhere.

### DB migration `supabase/migrations/20260807160000_trial_columns.sql`
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_tier TEXT,           -- 'solo'|'crew'|'premium' — plan granted during trial
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Grant (or extend) the trial. SECURITY DEFINER, owner-scoped, idempotent.
-- Rules:
--   * Never touches users with a REAL paid tier from Stripe (tier NOT IN ('free') with a trial row absent
--     OR subscription active) — guard: only grant when profiles.tier = 'free'.
--   * If a trial is already active (trial_ends_at > now()): no-op (never reset the clock on re-entry).
--   * Sets tier = p_plan, trial_tier = p_plan, trial_started_at = now(), trial_ends_at = now() + 14 days.
--   * Caller must be the profile owner (auth.uid() = id).
CREATE OR REPLACE FUNCTION public.grant_trial(p_plan text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tier text;
  v_trial_end timestamptz;
BEGIN
  SELECT tier, trial_ends_at INTO v_tier, v_trial_end
    FROM public.profiles WHERE id = auth.uid();
  IF v_tier IS NULL THEN RETURN false; END IF;
  IF v_tier <> 'free' THEN RETURN false; END IF;              -- already paid (webhook) — never downgrade/override
  IF v_trial_end IS NOT NULL AND v_trial_end > now() THEN RETURN false; END IF; -- active trial — don't reset clock
  IF p_plan NOT IN ('solo','crew','premium') THEN RETURN false; END IF;
  UPDATE public.profiles
     SET tier = p_plan,
         trial_tier = p_plan,
         trial_started_at = now(),
         trial_ends_at = now() + interval '14 days'
   WHERE id = auth.uid();
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.grant_trial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_trial(text) TO authenticated;

-- Expire own trial if past end (call on app mount; idempotent, cheap).
CREATE OR REPLACE FUNCTION public.expire_trial()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trial_end timestamptz;
  v_trial_tier text;
BEGIN
  SELECT trial_ends_at, trial_tier INTO v_trial_end, v_trial_tier
    FROM public.profiles WHERE id = auth.uid();
  IF v_trial_end IS NOT NULL AND v_trial_end < now() AND v_trial_tier IS NOT NULL THEN
    UPDATE public.profiles
       SET tier = 'free', trial_tier = NULL, trial_started_at = NULL, trial_ends_at = NULL
     WHERE id = auth.uid() AND tier = v_trial_tier;   -- only revert if tier still equals the trial grant
    RETURN true;
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.expire_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_trial() TO authenticated;

-- Service-role backstop for ALL users (daily cron): expire every past trial.
CREATE OR REPLACE FUNCTION public.expire_all_trials()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.profiles
     SET tier = 'free', trial_tier = NULL, trial_started_at = NULL, trial_ends_at = NULL
   WHERE trial_ends_at IS NOT NULL AND trial_ends_at < now() AND tier = trial_tier;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.expire_all_trials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_all_trials() TO service_role;
```

### Client — `client/src/lib/payments.js`
- **Rename/replace `resumeCheckoutIntent` → `resumeTrialIntent`** (keep export name `resumeCheckoutIntent` as a thin alias if any caller imports it — callers: Login.jsx:162, App.jsx:149).
- New behavior: read `mowgo_plan_intent` (+ interval, but interval is unused for grant — trial is always 14 days). **Drop the 30-min TTL** (the reported bug): intent TTL extended to **7 days** for the trial path (`age < 7 * 24 * 60 * 60 * 1000`). Do NOT drop the in-flight latch (prevents double-fire) but reset it in `finally`.
- Logic:
  1. intent missing → `{status:'none'}`.
  2. If profile already paid (`tier` in solo/crew/premium AND no active trial) → clear intent, `{status:'none'}` (they're already subscribed; nothing to grant).
  3. Else call `supabase.rpc('grant_trial', { p_plan: intent })` (owner-scoped SECURITY DEFINER).
  4. `grant_trial` returns true (granted) or false (already paid / active trial / bad plan) → **either way clear the intent** (it was consumed) and return `{status:'granted'}`.
  5. RPC error (network) → keep intent, return `{status:'error', message, retryable:true}` (mirror existing retryable pattern).
- **Call `expire_trial()` first** in the same function (before grant): past trial → tier reverts to free → grant can then re-grant if a fresh intent exists. This makes leave-and-return AFTER expiry still recoverable.

### Client — `client/src/App.jsx`
- `ResumeCheckoutIntent` (line 140): keep mounted at root. It already calls `resumeCheckoutIntent()` on mount whenever an intent exists + session exists. With the TTL lifted to 7 days + idempotent `grant_trial`, **every app mount re-attempts the grant safely** — this is the fix for "leave the page and go back": returning to the app re-runs the effect, `grant_trial` no-ops if already granted or grants if not. Also call `supabase.rpc('expire_trial')` on mount (cheap, idempotent) so an expired trial's tier reverts even if the user never visits Settings.
- No other changes needed there (component already re-fires on mount; `navigate` back to `/login` on error only).

### Client — `client/src/pages/Login.jsx`
- `handleSubmit` signup branch (line 162): `const resume = await resumeCheckoutIntent()` — unchanged call, new behavior (grants trial, never opens Stripe). The copy at line 192/208 becomes **true**: "Start your 14-day Premium trial — unlimited clients, no credit card" + "After you confirm, we'll walk you through setting up your trial — no card needed." (Add new i18n key for the second string; en+es.)
- Also call `supabase.rpc('expire_trial')` alongside the resume (post-login, covers expired-trial re-login).

### New component — `client/src/components/TrialBanner.jsx`
- Rendered in `Layout.jsx` (below the header / above content — same slot pattern as the offline banner) AND on `Settings.jsx` plan card.
- Reads own profile (fetch `trial_tier, trial_ends_at, tier` — existing RLS read path in data.js). If `trial_tier` set and `trial_ends_at > now()`:
  - Banner: "**X days left in your {Plan} trial.** Subscribe to keep unlimited clients & jobs." CTA → `/subscribe` (logged-in checkout path). Days = `ceil((trial_ends_at - now) / 86400000)`.
  - When `trial_ends_at < now()` (and tier reverted by expire_trial): banner flips to "**Your trial ended.** Your clients are safe — subscribe to keep scheduling beyond 5." CTA → `/subscribe`.
- If tier is a real paid tier from Stripe (no trial row) → render nothing.
- i18n: new keys, en+es, slug rule ≤72 chars, dark+light.
- Do NOT fire-and-forget: after rendering, call `expire_trial()` (idempotent) so the UI state converges.

### Checkout — `functions/api/stripe/checkout-subscription.js`
- **Skip the Stripe trial when the user has an active or used app trial:** after fetching the profile (existing `profiles` fetch), read `trial_ends_at`. If `trial_ends_at IS NOT NULL` (they've had their app trial — active or expired): omit `subscription_data[trial_period_days]` → conversion bills immediately (no double-trial). Otherwise keep the existing 14-day trial param (covers direct-checkout edge cases like annual/mobile parity paths).
- Metadata: add `metadata[trial_used]='true'` when skipped (audit).

### Cron backstop (service role)
- Extend the existing daily keep-alive or add a no_agent cron script that runs `SELECT public.expire_all_trials();` via `scripts/supabase_query.sh` (PAT + curl pattern, one statement per call). Reports only when count > 0.

## Edge cases (must pass)
1. **Verification link → leave → return (Blasian's bug):** intent lives 7 days; every mount re-runs resume → `grant_trial` idempotent → trial granted on the return visit. ✅
2. **Signup with no plan intent:** no trial; stays free (5-client cap). ✅
3. **Free user clicks Start Premium:** grant_trial sets tier=premium for 14 days; banner shows; day 15 expire → free; cap re-engages; upgrade modal (existing Clients.jsx:124) prompts. ✅
4. **Trial user converts mid-trial:** checkout (no Stripe trial) → webhook sets tier → `grant_trial` guard (`tier <> 'free'`) no-ops forever after. Trial row stays but banner hides (tier real). Optional cleanup: clear trial fields on checkout.session.completed. ✅
5. **User re-clicks a plan CTA mid-trial:** grant_trial no-ops (active trial) — no clock reset. ✅
6. **expire_trial vs webhook race:** expire only reverts `WHERE tier = trial_tier` — if webhook already set a real tier, the UPDATE matches 0 rows. ✅
7. **Stripe webhook for trial-era user:** unchanged — subscription events still set tier. ✅
8. **Existing paid users (pre-trial era):** tier != free → grant_trial no-ops; no banner (no trial row). ✅

## Verification steps
- `node --check` on changed JS; `npm run build` clean.
- Migration: apply via `npx supabase db query --linked --file supabase/migrations/20260807160000_trial_columns.sql`, then confirm `\df grant_trial` exists + `grant_trial` returns false for a paid user and true for a fresh free user (test with throwaway auth user via PostgREST RPC; confirm `profiles.tier` flips).
- Live browser (mowgoapp.com): fresh signup with plan=premium intent → NO Stripe redirect → lands in app → Settings shows trial + days-left banner; leave page, return → still trial-granted (banner, no card prompt, tier=premium). Simulate expiry via `expire_trial()` RPC call in console → tier reverts, banner flips to "trial ended".
- Convert: click Subscribe from banner → Stripe Checkout WITHOUT trial period (verify session has no `trial_end`).

## Out of scope (note for later)
- Mobile (iOS edge function `create-checkout-session` + Android) parity — keeps card-at-checkout until this lands on web and is proven.
- Trial for non-signup paths (invite/crew) — owner-only grants for now.

---

## Security appendix (added 2026-08-07, post-Mimo review)

**Question:** can a user trick the system into free service? Audited live (not theorized) — RLS is the authz ground truth; every claim below was verified against the live DB / deployed functions on 2026-08-07.

### Verified protections
| Vector | Result | Mechanism |
|---|---|---|
| Self-upgrade `profiles.tier` via REST PATCH | 🔒 403 | Column-scoped grant: `GRANT UPDATE (business_name, phone)` (002) + later column grants exclude `tier`/`trial_*`. Mixed payload also 403. |
| Free user >5 clients via API | 🔒 400 | `enforce_free_client_limit()` trigger (20260806140000) + advisory lock against races |
| Expired trial → unlimited clients | 🔒 Fixed | Trigger now treats expired trial as free **at insert time** (20260807180000) — independent of `expire_trial()`/cron timing |
| Expired trial → free concierge (human work) | 🔒 Fixed | `concierge-submit.js` reads `trial_ends_at`; expired → 403 |
| Anonymous force-expiry of ALL trials | 🔒 401 | anon could call `expire_all_trials` (anonymous DoS on conversion funnel) — revoked; now service_role-only (20260807183000) |
| Anon EXECUTE on sensitive functions | 🔒 0 remain | `reorder_jobs`, `set_first_*`, `enforce_free_client_limit` revoked from anon/authenticated (20260807190000) — Supabase's default grants leak EXECUTE; `REVOKE FROM PUBLIC` doesn't cover them, need explicit role revokes |
| Referral self-free-month loop | 🔒 Impossible | `earn_referral_credit`/`claim_referral_credit` service_role-only + fire only from real Stripe `checkout.session.completed`; no-card trials never create Stripe subscriptions |
| Email-alias trial farming (+tags, dots, googlemail) | 🔒 Fixed | `used_trials` table keyed on **normalized email** (lowercase, +alias stripped, gmail dots stripped, googlemail→gmail; non-gmail lowercase only). One trial per human, **survives account deletion** (20260807193000). Verified live: `aaron+1@gmail.com` granted / `aaron+2@googlemail.com` blocked; `trialdot.name+1@gmail.com` granted / `trialdotname+2@gmail.com` blocked; `sara@yahoo.com`/`bob+tag@outlook.com` unaffected |
| Stripe customer-ID hijack (copy victim's `cus_xxx`) | 🔒 Fixed | Users can write `stripe_customer_id` (004, iOS). PostgREST PATCH matches ALL rows — old webhook fallback would upgrade both. Now resolves customer-ID to exactly ONE profile (1→patch by PK, >1→warn+refuse, 0→silent) in `updateProfile` + `handleSubscriptionDeleted` (7ef941f) |
| Trial grant audit trail | ✅ | `grant_trial` logs `tier_events` (source=`trial_grant`) |

### RLS / function-grant sweep (Mimo review, all PASS)
- All 22 tables `ENABLE ROW LEVEL SECURITY`; no cross-user leakage (referrals, webhook_configs, leads, route_audits PII, sms_threads all service-role/owner-scoped)
- Every SECURITY DEFINER function callable by authenticated users is `auth.uid()`-scoped (grant_trial, expire_trial, current_business_id, create_invoice_for_job, apply_rain_delay, void_invoice, apply_referral_code, referral_status); service-role-only functions guard on `auth.role() <> 'service_role'`
- Zero anon EXECUTE grants remain (verified live)

### Accepted tradeoffs (by design, not defects)
1. **Multi-account farming with real distinct inboxes** — bounded by email confirmation + Supabase rate limits (60/hr) + 14-day window. Phone verification is the kill-it-completely upgrade if ever needed.
2. **Direct-checkout Stripe trial (never had app trial)** — 14 free days with card on file; cancel before charge = free period. Requires a card; not a no-card vector. Kept for annual/mobile parity.
3. **Admin-deleted users can re-register** — `used_trials` survives deletion (email-keyed), so re-registration does NOT grant a new trial.

### Security principle applied
Enforcement (cap, concierge, trial expiry) reads `trial_ends_at` **directly at enforcement time** — never waits for `expire_trial()` (app mount) or the cron (daily backstop, silent unless count>0). This closed the "tier still premium after expiry" window at the DB boundary, covering API-only users and all platforms (RLS/triggers are client-agnostic).
