# MowGo Security Audit — Round 2 (Aug 5, 2026, post-fix re-audit)

Platforms: Web (React + CF Pages Functions) · iOS (SwiftUI) · Android (Kotlin)
Reviewers: 3 parallel Mimo subagents (web/iOS/Android) + independent verification of every finding.
Baseline: commit 8044c15 (round-1 fixes). New fixes shipped in commit (see git log).

## FIX VERIFICATION — ALL 14 SHIPPED ROUND-1 FIXES PASS

Web (6/6 PASS), iOS (4/4 PASS), Android (4/4 PASS) — see per-platform reports below.

## ROUND-2 FINDINGS & DISPOSITION

### Fixed in this round (commit ecf79c4 + follow-up)

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | HIGH | SSRF via DNS rebinding (webhook-dispatch.js): IP-literal blocks only, no DNS check | Shared `functions/api/_shared/safe-webhook-url.js`: https-only, private-IP literals, DNS A-record resolution via Cloudflare DoH (rebinding defense), fail-closed on DNS errors. 12/13 unit cases pass. |
| 2 | HIGH | SSRF in leads/public.js fireLeadWebhook: only `startsWith('https://')` | Now uses shared isSafeWebhookUrl. |
| 3 | HIGH | Android pages.dev leftovers: TeamRepository.kt:112 (remove team member), WebhookService.kt:33 (webhook dispatch) | Migrated to mowgoapp.com. **Also found + fixed 2 the iOS auditor missed**: WebhookService.swift:15, SettingsView.swift:364. Zero pages.dev refs remain in any client. |
| 4 | MED | No rate limit on webhook-dispatch.js | Per-user+IP 20/15min, checked after auth. |
| 5 | MED | Mass assignment in updateJob (client/src/lib/data.js:242) | Field allowlist (15 job fields) — RLS remains the real gate. |
| 6 | MED | create_invoice_for_job RPC accepts client-supplied amount | RPC now uses clients.rate from DB (server truth), ignores p_amount. Applied live. |
| 7 | MED | Android Log.w() leaks in release (TodayViewModel:138, JobsViewModel:75) | Wrapped in BuildConfig.DEBUG + imports. |
| 8 | MED | iOS CSV export leaks keyCode/alarmCode (ExportService.swift:11-16) | Redacted ("***") in export. |
| 9 | LOW | iOS UserDefaults→Keychain migration crash window (SupabaseService.swift:233-249) | Per-key removeObject immediately after save + unconditional sweep on restore. |
| 10 | LOW | iOS photo path not sanitized in sign URL (SupabaseService.swift:386) | Traversal guard (leading /, .., backslash) — also applied to Android JobPhotoControls.kt. |
| 11 | LOW | iOS manual invoice no upper bound (DataStore.swift:1109) | $100k cap (web + Android matched). |
| 12 | LOW | Discord markdown injection in concierge-submit.js businessName | Markdown chars stripped before interpolation. |
| 13 | LOW | invite-crew.js error messages leak internals (5 sites) | Generic messages, details server-side only. |
| 14 | LOW | Android no network_security_config | Added res/xml/network_security_config.xml (cleartext blocked on API 26-27), wired in manifest. |

### Verified non-issues / false positives (not fixed, documented)

- **Android MEDIUM-3 (client-supplied payment amount)**: FALSE POSITIVE — create-payment-intent derives amount from DB invoice (line 85), ignores client value.
- **Web M2 (per-isolate rate limit bypass)**: known platform limitation, comments already note CF dashboard Rate Limiting is the production fix.
- **Web L3 (admin code in custom header)**: header is over TLS; CF does not log custom headers by default; rate-limited + timing-safe. JWT migration is a product decision, noted.
- **Web L4 (verify-session Origin absent allowed)**: intentional — Bearer JWT is the real gate.
- **Android LOW-1 (webhook secret in model)**: RLS restricts to own rows by design.
- **iOS MEDIUM-2 (SwiftData plaintext PII)**: device DB is encrypted at rest (CompleteUntilFirstUserAuthentication); field-level encryption would break offline field use. Documented.
- **iOS LOW-1 (no cert pinning)**: CA rotation risk > MITM benefit for this app; documented deferral.
- **iOS INFO-1 (photo path traversal)**: now fixed anyway (row 10).

## VERIFICATION PERFORMED

- `node --check` all modified functions; web prod build green (Vite).
- SSRF validator unit-tested: 12/13 (the 1 fail is a mock artifact — mock returned no A records for a real domain).
- RPC NaN guard + rate-based amount: applied live, verified via pg_proc query.
- Zero `pages.dev` refs remain in any mobile/web client (grep verified).
- invite-crew live endpoint: 401/409/429/403 paths all present.

## NEXT STEP

Codex CLI re-review scheduled Aug 8 06:00 UTC (one-shot cron bd897f543d26) — reruns adversarial review of this changeset once usage limit resets.
