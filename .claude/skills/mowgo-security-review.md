---
name: mowgo-security-review
description: "Adversarial security review of MowGo changesets (web/iOS/Android/Supabase/CF functions). Use when asked to review code, audit security, verify fixes, or give a SHIP/NO-SHIP verdict."
---

# MowGo Security Review

Adversarial review loop for MowGo. Read actual source — never guess. Verify every claim before reporting.

## Ground rules
1. **RLS is the authz ground truth.** Client-side checks are UX. Before claiming an authz bypass, verify the RLS policies in `supabase/migrations/*.sql`.
2. **Verify with real commands:** `node --check <file>`, `timeout 90 npx supabase db query --linked "SELECT ..."` (from repo root), `grep`/`rg` for call sites, `od -c` for raw bytes.
3. **The `***` redaction trap:** tool displays redact `Bearer ` as `***`. If a line looks like a broken template literal, confirm with `od -c` before reporting.
4. **Read-only:** never modify files during review. Report findings; let the orchestrator fix.
5. **Check boundary values:** regex ranges (private IPs, CGNAT 100.64-127, multicast 224-239), caps (invoice $100k), null/NaN handling (Postgres `NaN <= 0` is NULL).

## Output format
For each requested concern: **PASS/FAIL** with `file:line` evidence and exact remediation.
Then **NEW ISSUES** (severity-ranked: CRITICAL/HIGH/MEDIUM/LOW — each with file:line, title, impact, exploit path, remediation).
Final verdict: **SHIP or NO-SHIP** (NO-SHIP if any CRITICAL/HIGH or functional regression).

## What to check per platform
- **Web (`client/src/` + `functions/api/`):** XSS (`dangerouslySetInnerHTML`), mass assignment (field allowlists), SSRF (`isSafeWebhookUrl` — https-only, DNS-rebinding, no private IPs; never boolean-return contract), rate limits AFTER auth, CORS whitelist (never echo arbitrary origin), error message leaks, secrets in bundle (`VITE_`).
- **iOS (`ios-native/MowGo/`):** Keychain accessibility, `print()` in `#if DEBUG` (returns OUTSIDE guards), photo path→signed-URL-at-render flow, CSV export redaction (key/alarm codes), invoice caps, deep links/WebView (should be none).
- **Android (`client/android-native/`):** EncryptedSharedPreferences session (not plain), `allowBackup=false`, `Log.w` in `BuildConfig.DEBUG`, network_security_config (cleartext off), exported components, path traversal guards before signing photo paths.
- **Supabase:** RLS on every table (webhook_events, storage objects), SECURITY DEFINER functions (search_path set, server-truth amounts, NaN guards), column-scoped grants.
- **Cross-cutting:** pages.dev should be GONE from all clients (mowgoapp.com only — server ALLOWED_ORIGINS may keep both during transition), no hardcoded secrets, RPC return values used for display (no stale local rates).

## Known-fixed history (do not re-report as new)
- C1 invite takeover (Flow-2 data-existence guard), H1-H3 (escapeHtml, rate limits, webhook dedup), M1-M6 (encrypted storage, keychain, CORS, concierge, photo RLS, dead code), SSRF DNS-rebinding validator, CSV redactions, invoice caps + server-truth RPC, keychain migration atomicity, network_security_config. See `reports/security-audit-round2-2026-08-05.md`.
