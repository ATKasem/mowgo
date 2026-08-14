# SPEC: Referral Program v1 — Hormozi §49/§25/§35 lane (ask at the moment of purchase)

**Date:** 2026-08-06 · **Rev:** 4 (post-review round 3 — CRIT-2 wiring landmine + residual MEDIUM + citation fixes closed) · **Source:** Hormozi digest §25/§35/§49 + board review action #7 (1-day build)

## Goal
A referral mechanic that turns MowGo's happiest moments into new signups: every user gets a referral code; when someone they refer **pays**, the referrer earns **1 free month**. Ask placed at the three moments Hormozi specifies — **moment of purchase** (post-checkout), **moment of deprivation** (free-cap wall), **moment of satisfaction** (first invoice paid). No new Stripe permissions, no new API keys, VA-applied credit (house delivery model).

## The Hormozi frame (why this design)
- §49: "customers (ask at the moment of purchase, three-way intro)" is a core acquisition channel — the ask is the engine, the reward is grease. Passive programs don't convert; **placed asks do**.
- §25 customer ladder: referrals come after Homies (proof) — MowGo has the proof engine running; referrals are the next rung.
- §35 local lead-gen priority: **GBP → referral program → paid ads last** — referrals outrank ads for this avatar.
- §27: zero-cost upsells / internal plays — a free month costs $39–$79 only when a referral actually pays; cheapest CAC in the stack.
- Single-sided reward (referrer only) keeps v1 honest and cheap; double-sided is v2 (cost 2×).

## Current state (VERIFIED 08-06 — repo walk + Claude review pass; corrected per review)
- `profiles` (001_initial_schema.sql): `id, business_name, phone, avatar_url, tier, stripe_customer_id, created_at` (+ activation columns via 20260806140500). **No referral fields.**
- Signup: `client/src/pages/Login.jsx` — **email confirmation is the standard path: `signUp()` returns `session === null` and the code sets `confirmSent` and returns (Login.jsx:114-117)**. Post-confirmation attribution must survive the round trip — see Build §2 (C1).
- **Existing solved pattern for post-confirmation continuity:** `mowgo_plan_intent` localStorage + `resumeCheckoutIntent()` (`client/src/lib/payments.js:48-83`), invoked after login in `Login.jsx` (call site by symbol — currently ~:138-139; was 128-129 before an unrelated lead-touch diff shifted it). The referral capture mirrors this exactly.
- `functions/api/stripe/webhook.js`: `checkout.session.completed` handler at :42; user resolved via `stripe_customer_id` inside `updateProfile()` (shared by completed + subscription.updated branches; **`fetchProfile()` hardcodes `select=id,tier` (:217-229) and `updateProfile()` returns nothing to the caller** — the earn step must NOT try to thread a value out of it; it gets its own scoped fetch (H3)). `logTierChange` writes `tier_events` (:201 — NOT tier_logs). `sendWinbackEmail`/`fetchUserEmail` exist (Resend, `invoices@mowgoapp.com`). Event dedup via `webhook_events` (:80).
- `client/src/pages/Subscribe.jsx`: success state at :121 (`status === 'success'`, after verify-session :75-106) — **the post-checkout moment**.
- `client/src/pages/Clients.jsx`: free-cap upgrade modal (:106, title "You've hit the free limit (5 clients)") — **the deprivation moment**.
- `client/src/pages/Dashboard.jsx`: renders OnboardingChecklist (:8,175,236) — host for the satisfaction-moment banner.
- Table pattern to mirror: `activation_touches` (20260806150000) / `lead_touches` (20260806150500) — RLS enabled, zero policies, REVOKE from anon/authenticated. SECURITY DEFINER RPC precedents: `create_invoice_for_job` (023 — includes `auth.uid() IS NULL` guard) and **027_revoke_anon_execute.sql: grants must REVOKE from PUBLIC, not just anon (anon inherits via PUBLIC)**.
- **GRANT trap (002_crew_features.sql:79-80 + every later profiles migration):** the repo convention is `GRANT UPDATE (<newcol>) ON profiles TO authenticated;` after adding a column — **this migration MUST NOT follow that convention** (C2).
- Pricing truth (Compare.jsx:61-62, Subscribe.jsx:41-42): Solo $39, Crew $79. No invented numbers.
- **No codegen/collision-retry precedent exists in the repo** — `enforce_free_client_limit` is a count+advisory-lock cap check, not a generator. The code generator is a NEW pattern (L1).

## Build

### 1. Migration — `20260806160000_referrals.sql`
- `ALTER TABLE profiles ADD COLUMN referral_code TEXT;` + `ADD COLUMN referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL;` + `UNIQUE (referral_code)`.
  - **FK choice (L3):** `referred_by` → `ON DELETE SET NULL` (audit trail survives referrer deletion; credit is moot but the row remains). `referrals.referred_user_id` → `ON DELETE CASCADE` (user deleted ⇒ no referral owed). Documented choice, not an accident.
- **NO `GRANT UPDATE (referral_code, referred_by) ON profiles TO authenticated;`** — both columns writable ONLY by SECURITY DEFINER RPC/trigger. Put an explicit comment in the migration flagging this departure from the 002 convention (022-comment style).
- **Code generation — NEW pattern (no repo precedent):** 6-char uppercase codes, unambiguous alphabet (no 0/O/1/I). Trigger `ensure_referral_code()` (BEFORE INSERT ON profiles, SECURITY DEFINER, `SET search_path = public`) with a collision-retry loop (`FOR i IN 1..10 LOOP ... EXIT WHEN inserted`; on `unique_violation` inside the loop, use a nested BEGIN/EXCEPTION block per attempt — aborting only that attempt, not the row insert). **`REVOKE ALL ON FUNCTION ensure_referral_code() FROM PUBLIC;`** alongside the trigger — Postgres grants EXECUTE to PUBLIC by default on ALL functions incl. trigger functions; 027's precedent revokes it on `handle_new_user()` for exactly this reason (round-2 HIGH).
- **Backfill existing users:** DO block, per-row loop; each row's generate+update wrapped in its own BEGIN/EXCEPTION `WHEN unique_violation THEN` sub-block (retry ≤10 then skip row with a notice — one bad collision must not abort the whole backfill; M4). Guard `WHERE referral_code IS NULL`. Case: store UPPERCASE only (M1). **Skipped rows are logged (RAISE NOTICE with id) and the migration is idempotent + re-runnable (`WHERE referral_code IS NULL`) — a follow-up run backfills any stragglers (round-2 LOW); at ~32^6 code space collisions are negligible at current scale.**
- NEW table `referrals`:
  ```
  id uuid pk default gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code_used text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','earned')),
  credit_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  earned_at timestamptz,
  UNIQUE (referred_user_id)   -- one credit per referred user, ever
  ```
- NEW SECURITY DEFINER RPCs (all `SET search_path = public`; **function grants split by role — round-2 CRITICAL #1:** the earn RPC is service-role ONLY (see below); the two client RPCs get `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` then `GRANT EXECUTE ... TO authenticated;` — 027 rule, not the anon-only mistake):
  - `apply_referral_code(p_code text) returns text` — internal guard `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'` (create_invoice_for_job pattern). Normalizes `UPPER(TRIM(p_code))` (M1); validates: code exists, `code != own code` (self-referral rejected), caller has no existing `referrals` row; sets `profiles.referred_by`; inserts `referrals` (status 'pending', code_used normalized); returns referrer's business_name for UI. **Re-entrancy is atomic (round-2 MEDIUM + round-3 residual):** guard the UPDATE with `WHERE referred_by IS NULL` AND wrap the INSERT in `BEGIN/EXCEPTION WHEN unique_violation THEN` no-op — both statements inside one exception block (double-submit / two tabs racing; UNIQUE(referred_user_id) swallows the second). Credit issuance never reads `profiles.referred_by` (earn re-derives referrer from the `referrals` row), so this is data-hygiene, but it's cheap and correct.
  - `referral_status() returns json` — internal auth guard; `{code, total_count, earned_count}` (M2: banner needs total_count to distinguish "never referred" from "pending in flight"). Grant: authenticated.
  - `earn_referral_credit(p_referred_user_id uuid) returns boolean` — **SERVICE-ROLE ONLY (round-2 CRITICAL #1): NO authenticated grant; `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` + `GRANT EXECUTE ... TO service_role;` + internal guard `IF auth.role() <> 'service_role' THEN RAISE EXCEPTION`** — without this any logged-in user could flip any pending referral to 'earned' and mint free months without paying. **The atomic cap+earn (H2):** `PERFORM pg_advisory_xact_lock(hashtext('referral_cap:' || referrer_id::text))`; re-check self-referral (`referred_by != id`); count earned for referrer; `IF count >= 3 THEN return false;` else `UPDATE referrals SET status='earned', earned_at=now() WHERE referred_user_id = p_referred_user_id AND status='pending'` and return `found`. Single transaction — no check-then-act split across REST calls. Webhook calls it with the service key (which requires no client grant).
- RLS: enable on `referrals`, zero policies, `REVOKE ALL ... FROM anon, authenticated` (service-role only — 027/lead_touches precedent). Client reads ONLY via `referral_status()`.

### 2. Signup capture — EDIT `client/src/pages/Login.jsx` + `client/src/lib/payments.js`-adjacent helper + i18n
- Optional "Referral code" field on the signup form (en/es). `?ref=CODE` in URL prefills it (referral links: `https://mowgoapp.com/#/login?mode=signup&ref=CODE`).
- **Email-confirmation-safe capture (C1 — round-2 CRITICAL #2, correct call sites):** on signup submit, stash the code in localStorage (`mowgo_ref_code` + timestamp) BEFORE calling `signUp()`. Apply it at BOTH session-bearing call sites:
  1. `client/src/App.jsx` — **`ResumeCheckoutIntent` (:123-142, mounted root-level :212) covers the email-confirmation return, which opens a NEW TAB and lands on the Landing route — this is the PRIMARY path C1 exists to fix. MANDATORY: `applyStashedRefCode()` must be an INDEPENDENT, UNGATED sibling `useEffect` — do NOT place it inside `ResumeCheckoutIntent` itself: that effect early-returns `if (!intent) return` (:128-129) and a referral-only signup never sets `mowgo_plan_intent`, so wiring inside it would silently never fire (round-3 CRIT-2 — the reviewer's exact wording: strike "or inside ResumeCheckoutIntent").**
  2. `Login.jsx` — the existing `resumeCheckoutIntent()` invocation (manual login after confirmation; currently ~:138-139 — the uncommitted lead-touch diff shifted it from 128-129; find it by symbol, not line).
  Sibling function `applyStashedRefCode()` in `client/src/lib/payments.js` (beside `resumeCheckoutIntent()`): reads + clears localStorage, calls `apply_referral_code` via supabase.rpc with the live session. Silent on failure (never blocks login); invalid/stale code (>7 days) dropped. Both call sites are session-guaranteed (they run post-auth).
- Never call the RPC from the `session === null` path — there is no `auth.uid()` there.

### 3. Earn the credit — EDIT `functions/api/stripe/webhook.js` (additive, scoped)
- In the `checkout.session.completed` branch ONLY (NOT subscription.updated — that path must never earn; H3): after the existing tier update, make a **dedicated fetch** `profiles?select=id,referred_by&stripe_customer_id=eq.<id>` (do NOT widen `fetchProfile`'s hardcoded select or thread values out of `updateProfile`). If `referred_by` set → call `earn_referral_credit(referred_user_id)` via service role (RPC is atomic; H2). If the RPC returns true: email the **referrer** via existing Resend pattern (`fetchUserEmail` on referrer id): "You earned a free month — {referred business} just subscribed to MowGo." + what happens next (credit applied to your next renewal). If false (cap hit): leave pending, no email.
- Everything wrapped in try/catch inside the existing handler — a referral failure must never fail checkout processing (dedup via `webhook_events` already guards replay; the UPDATE is idempotent by `status='pending'` + UNIQUE(referred_user_id)).

### 4. The three asks (client)
- **A. Moment of purchase — EDIT `Subscribe.jsx` success state (:121):** referral block under the success card: "Your next month is on us. Give this code to one crew you know:" + code (from `referral_status()` RPC — code + counts in one call) + copy-to-clipboard + share link (`?ref=CODE`).
- **B. Moment of deprivation — EDIT `Clients.jsx` free-cap modal (:106):** third CTA under "See plans"/"Not now": "Invite a crew — get a free month" → inline panel (same modal) with the code + link. No new route.
- **C. Moment of satisfaction — EDIT `Dashboard.jsx`:** dismissible banner (localStorage dismissal) shown when `referral_status().total_count = 0` AND user has ≥1 invoice AND tier is free — **duplicate the repo's defensive free-tier literal `[undefined, null, '', 'free']` (data.js:540 — a local const inside createClient(), NOT exported; Dashboard must inline the check; round-2/3 LOW citation fix)**. (M2: total_count, not earned_count — a pending referral must hide the banner.) Copy honest: "Refer a crew, earn a free month when they subscribe."

### 5. Ops — VA fulfillment (documented, not coded)
- `referrals.status='earned'` → concierge/VA applies 1 free month on the referrer's next renewal via Stripe dashboard (100% discount one cycle, or refund). **VA MUST verify the referred account's subscription is still active before applying (M3)** — weekly check query: `referrals WHERE status='earned' AND credit_applied=false`, cross-checked against Stripe. `credit_applied=true` after. Free-tier referrer: credit banks until they subscribe (applied to first renewal).
- **Accepted residual risk (L4):** multi-account self-referral farming (same person, two emails) is NOT technically blocked — only the 3-credit cap + VA review backstop it. Documented as deliberate for v1. v2 options: hold `earned` 14 days, listen to `charge.refunded`/`charge.dispute.created` to revert, double-sided reward.

## Files
- NEW `supabase/migrations/20260806160000_referrals.sql` (columns + no-GRANT comment + trigger + backfill + `referrals` table + 3 RPCs + RLS + PUBLIC-revoke grants)
- EDIT `functions/api/stripe/webhook.js` (completed-branch earn + email, additive, try/catch-wrapped)
- EDIT `client/src/pages/Login.jsx` (+ `?ref` prefill + localStorage stash)
- EDIT `client/src/lib/payments.js` (add `applyStashedRefCode()` beside `resumeCheckoutIntent()`)
- EDIT `client/src/pages/Subscribe.jsx` (success ask via `referral_status()`)
- EDIT `client/src/pages/Clients.jsx` (free-cap modal CTA)
- EDIT `client/src/pages/Dashboard.jsx` (satisfaction banner)
- EDIT `client/src/i18n/locales/en.json` + `es.json`
- DOC: this spec

## Constraints
- No new npm deps, no new env vars, no new Stripe permissions (credit applied manually by VA — restricted key untouched).
- **NO `GRANT UPDATE (referral_code, referred_by) ON profiles TO authenticated`** — RPC/trigger-only writes (C2). Migration comment required.
- RPC grants: `REVOKE ALL ... FROM PUBLIC` first (027 rule); internal auth guard on every RPC — `auth.uid() IS NULL` on the two client RPCs, **`auth.role() <> 'service_role'` on `earn_referral_credit` (service_role grant only — round-2 CRITICAL #1); `ensure_referral_code` trigger fn also REVOKEd from PUBLIC.**
- Cap: 3 earned credits/referrer, enforced atomically in `earn_referral_credit` (advisory lock on referrer_id).
- No invented numbers: reward = $39 (Solo) / $79 (Crew) real pricing.
- i18n both locales; dark+light verified; `git diff --check` clean; migration timestamped (no collision — latest is 20260806150500).
- Webhook edits additive + scoped to `checkout.session.completed`; `subscription.updated` must not earn.
- v2 (explicitly out of scope): double-sided reward, automatic Stripe coupon application (needs billing perms — rejected per no-new-keys rule), referral in day-7 activation email, referral leaderboard, refund/dispute clawback listeners, hold period.

## Report (after build)
Files changed, migration summary, RPC signatures, env vars (none new), deviations, verified moments (checkout success / cap modal / first-invoice banner) with screenshots.
