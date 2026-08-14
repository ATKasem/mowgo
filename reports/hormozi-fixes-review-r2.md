# MowGo Hormozi Fixes Batch 1 — Adversarial Review Round 2

**Scope:** Round-2 re-review of the Hormozi audit fixes batch (findings #2, #3, #4, #5, #6, #9, #10). Verifies the three round-1 NO-SHIP blockers and re-audits the full changeset, including files not covered in round 1.

**Files reviewed:**
- `client/src/pages/Clients.jsx` (modified)
- `client/src/pages/Dashboard.jsx` (modified)
- `client/src/components/OnboardingChecklist.jsx` (new)
- `client/src/i18n/locales/en.json` (modified — `onboarding` + `clients` namespaces)
- `functions/api/stripe/webhook.js` (modified — win-back/downsell section)
- `supabase/migrations/20260806140000_free_client_cap.sql` (new)
- `supabase/migrations/20260806140500_activation_timestamps.sql` (new)
- `/opt/data/.hermes/scripts/mowgo_activation_emails.py` (new, outside repo)

Read-only review. No files were modified.

---

## Round-1 blocker re-verification

### 1. Clients.jsx `finishConversion` catch → upgrade modal — **PASS**

`client/src/pages/Clients.jsx:48-56` (client-form save) and `:69-77` (`finishConversion`, lead conversion) both now catch on `err.message.includes('Free plan is limited to')` and open `upgradeOpen` instead of rendering the raw error string. `convertLeadToClient` (`client/src/lib/data.js:692-698`) calls `createClient` internally, so the lead-conversion path throws the identical message (`client/src/lib/data.js:545,570`: `` `Free plan is limited to ${FREE_CLIENT_LIMIT} clients...` ``) and is caught correctly. The modal (`Clients.jsx:106`) renders title, copy, and "See plans" (`Link to="/subscribe"`, confirmed route at `App.jsx:222`) / "Not now" buttons using existing `btn-primary`/`btn-secondary` classes (confirmed defined in `index.css:130`) and the existing `Modal` component (`Clients.jsx:111`). i18n keys present under the `clients` namespace (`en.json:172-175`) and correctly slugified per `textKey()` (`useLocalizedText.js`).

### 2. Cron script `mowgo_activation_emails.py` — **FAIL (new HIGH finding, see below)**

Reviewed in full (previously unreviewed in round 1). Time windows, dedupe-state shape, silent-failure paths, links, and sender are all sound (details below) — but the win-back-#2 candidate selection is broken by a real race between this script and the round-2 webhook code, such that win-back email #2 can never fire. See **Finding H-1**.

### 3. LOW fixes — **PASS** (see notes)

- **OnboardingChecklist hides for crew:** `fetchActivationCounts()` (`OnboardingChecklist.jsx:9-38`) unconditionally `return null`s when `profile?.role === 'crew'` (line 24), so the component never renders for crew regardless of `business_id`. Confirmed wired into both Dashboard render branches (`Dashboard.jsx:98` non-owner path, `:185` owner path) — correct, since the component self-guards. **Minor dead code** noted below (not a functional bug).
- **`pg_advisory_xact_lock` on free-client-cap trigger:** `20260806140000_free_client_cap.sql:25` takes `pg_advisory_xact_lock(hashtext('free_client_cap:' || NEW.user_id::text))` before the `SELECT count(*)`, inside a `BEFORE INSERT` trigger. Lock is transaction-scoped and auto-released at commit/rollback, so a second concurrent INSERT for the same `user_id` blocks until the first transaction commits, then re-counts and correctly sees the incremented total. Verified this correctly closes the TOCTOU race from round 1.

---

## Findings

### HIGH — Win-back email #2 can never fire: cron misreads the webhook's own cancellation log as a "resubscribe"
**Files:** `functions/api/stripe/webhook.js:262-297` (`handleSubscriptionDeleted`), `/opt/data/.hermes/scripts/mowgo_activation_emails.py:102-123` (`winback_candidates`)

**Impact:** The day-7 "come back" win-back email (fix #3/spec item D, win-back #2) is dead code in production — it will never select a single candidate, silently, forever.

**Root cause:** `winback_candidates()` treats *any* `tier_events` row with `created_at > cancelled_at` as proof the user resubscribed:

```python
for e in events:
    cancelled_at = by_row.get(e["user_id"])
    if cancelled_at and e["created_at"] > cancelled_at:
        resubscribed.add(e["user_id"])
```

There is no filter on `e["tier"]` — a tier_events row logging the transition *to* `'free'` (the cancellation itself) satisfies this condition just as well as a real resubscribe (transition to `solo`/`crew`/`premium`).

And `handleSubscriptionDeleted` in the webhook always produces exactly that row for every real cancellation:

```js
const patch = { tier: 'free', cancelled_at: new Date().toISOString(), ... };  // T0, computed in JS before the PATCH fetch fires
const matched = await patchProfile(env, filter, patch);
...
if (before && before.tier !== 'free') {
  await logTierChange(env, serviceKey, resolvedUserId, 'free');               // T1: DB now() at INSERT time
}
```

`cancelled_at` (T0) is a JS-computed timestamp captured *before* the `patchProfile` network round trip even starts. `logTierChange`'s `tier_events` row gets its `created_at` from the Postgres `now()` default (T1) at INSERT time, which happens strictly *after* the `patchProfile` call has already completed. So T1 > T0 for every single cancellation that has a genuine tier change (which is the only case `logTierChange` fires for) — the cancellation's own audit-log row always looks like a "resubscribe" to the cron's filter, permanently excluding that user from `winback_candidates()`.

Net effect: `winback_candidates()` returns `[]` for essentially 100% of real cancellations, in every run, forever. Because the script follows the intentional "silent when nothing due" convention, this failure produces no error, no log line, and no alert — it will not be noticed without code review or a deliberate manual test.

**Remediation:** Filter `winback_candidates()`'s resubscribe check to only count events where `e["tier"] in ("solo", "crew", "premium")` (i.e., an actual re-upgrade), not any tier_events row:

```python
resubscribed = set()
for e in events:
    if e["tier"] == "free":
        continue
    cancelled_at = by_row.get(e["user_id"])
    if cancelled_at and e["created_at"] > cancelled_at:
        resubscribed.add(e["user_id"])
```

---

### LOW — Dead code: crew branch of `ownerId` is unreachable
**File:** `client/src/components/OnboardingChecklist.jsx:21-24`

```js
const ownerId = profile?.role === 'crew' ? profile.business_id : user.id;
if (!ownerId) return null;
if (profile?.role === 'crew') return null;
```

The `role === 'crew'` ternary branch of `ownerId` is computed but never used — the very next unconditional check (`profile?.role === 'crew'`) returns `null` before `ownerId` is read in the `Promise.all` queries below. Functionally correct (crew is hidden either way), but the ternary is misleading dead code. Suggest simplifying to `if (profile?.role === 'crew') return null;` immediately after the profile fetch, then `const ownerId = user.id;`. Not blocking.

---

### LOW — Cron script exists but isn't registered anywhere
**File:** `/opt/data/.hermes/scripts/mowgo_activation_emails.py` (operational, not code)

`Active Crons.md` has no entry for this script (checked all MowGo rows). All sibling scripts (`mowgo_churn_report.py`, `invoice_reminders.py`) are wired into the cron scheduler; this one currently is not, so none of the day-0/3/7 or win-back-#2 emails will send until it's scheduled. Not a defect in the script itself — flagging so it isn't assumed "done" once this review ships.

---

## Non-findings (checked, no issue)

- **PII in cron output:** `mowgo_activation_emails.py:239-241` prints raw recipient email addresses to stdout on send. This exactly mirrors the existing, already-shipped `invoice_reminders.py:167` pattern (`log(f"SENT reminder for {inv['id']} → {client['email']} ...")`) — consistent with repo precedent, not a new regression. No action required.
- **Dedupe-state crash safety:** `activation_sent.json` is written once after the send loop completes (`mowgo_activation_emails.py:236-237`), not per-item, so a mid-run crash could lose dedupe state for already-sent emails in that run and cause a duplicate on the next run. This exactly matches `invoice_reminders.py`'s existing batch-write-at-end pattern (`STATE_FILE` write at line 174-175) — pre-existing repo-wide behavior, not introduced here.
- **Link correctness:** All links use path-based routes (`/subscribe`, `/app/clients`, `/app/settings`) — no hash routes. Confirmed against `App.jsx:222,241-244`.
- **Sender/domain validity:** `MowGo <invoices@mowgoapp.com>` used in both `webhook.js:sendWinbackEmail` and the cron script matches the existing verified sender in `functions/api/route-audit.js:36`.
- **Time-window logic:** `window(days_ago)` in the cron produces a 24h catch window offset 2h from the boundary — correct for a daily cron cadence; dedupe state additionally guards against double-sends on more-frequent runs. (Note: if the cron misses a day entirely, day-0 emails for users who fell in that gap are permanently skipped — day-3/day-7 are unaffected since they're independent windows. This is an inherent tradeoff of the design, not a bug, given the cadence assumption.)
- **`jobs.user_id` / `invoices.user_id` = owner claim:** Verified against `002_crew_features.sql` — `"Jobs: owner full access"` and `"Invoices: owner only"` RLS policies both require `auth.uid() = user_id AND auth.uid() = current_business_id()` on INSERT, and crew's only jobs policy is `FOR UPDATE` (no INSERT). So `jobs.user_id`/`invoices.user_id` are always the owner's id, matching the migration comments in `20260806140500_activation_timestamps.sql`. `set_first_job_at`/`set_first_invoice_at` triggers are correctly scoped.
- **`clients.user_id` = owner claim (free-client-cap trigger):** Verified `"Clients: owner full access"` RLS policy (`002_crew_features.sql:85-94`) — same `auth.uid() = user_id AND auth.uid() = current_business_id()` WITH CHECK, no crew INSERT policy exists. Trigger comment's reasoning holds.
- **Advisory-lock trigger correctness:** Confirmed `pg_advisory_xact_lock` correctly serializes concurrent inserts per-owner (transaction-scoped, released at commit/rollback); free-tier cap boundary (`>= 5`) matches client-side `FREE_CLIENT_LIMIT` and `FREE_TIERS` (`data.js:538-546`).
- **`node --check functions/api/stripe/webhook.js`** — passes.
- **`python3 -m py_compile mowgo_activation_emails.py`** — passes.
- **SECURITY DEFINER hygiene:** Both new migrations set `SET search_path = public` and `REVOKE ALL ... FROM PUBLIC` on all new trigger functions, consistent with repo convention.

---

## PASS/FAIL summary — round-1 blockers

| # | Blocker | Status |
|---|---|---|
| 1 | Clients.jsx upgrade modal on free-cap error (both create + lead-convert paths) | **PASS** |
| 2 | Cron script reviewed | **FAIL** — reviewed, and review surfaced a new HIGH bug that silently disables win-back email #2 |
| 3a | OnboardingChecklist hidden for crew | **PASS** |
| 3b | Free-client-cap trigger uses advisory lock to serialize concurrent inserts | **PASS** |

---

## Verdict: **NO-SHIP**

One HIGH finding blocks ship: the win-back email #2 flow (an explicit deliverable of this batch, fix #3/spec item D) is completely non-functional due to a resubscribe-detection bug that silently zeroes out every candidate, every run, permanently. The fix is small and contained (one filter condition in `mowgo_activation_emails.py:winback_candidates`), but it must land before this batch ships, since round 1 already flagged this exact file as unreviewed and round 2 was the gate for it.

The two LOW items (dead code in `OnboardingChecklist.jsx`, cron not yet scheduled) are non-blocking — fix at convenience, but call out the scheduling gap to whoever deploys this so the activation-email feature doesn't quietly go live as "shipped but not running."
