# MowGo Nightly Vault Sync — 2026-08-13
**Channels scanned: 3 (2 active, 1 deleted)**
**Messages synced: 100 total (10 new)**
**New extracted items: 18**

## Summary

### Channels
| Channel | Status | Messages |
|---------|--------|----------|
| #🌱mowgo | ✅ Active | 100 total, **10 new** (all bot — Blasian silent Day 20) |
| #🌱mowgo-outreach | ❌ Deleted (404) | 0 |
| #🤝mowgo-cowork | ✅ Empty | 0 — empty since Aug 6 cleanup |

### Extracted Items

- ✅ **Decisions:** 0 (none from this cycle)
- 📋 **Tasks/TODOs:** 6
- 🔬 **Research Findings:** 6
- ⚡ **Action Items:** 6

---

## 🚨 CRITICAL: HTTP 402 Credit Crisis

**Intel Engine has been non-functional for ~16 hours.** The only successful run was Aug 12 02:38 UTC (Reddit monitoring + Pricing Intelligence lane). All subsequent runs failed:

| Time | Component | Status |
|------|-----------|--------|
| Aug 12 02:38 | Intel Engine | ✅ Success — Reddit monitoring, Pricing Intelligence lane |
| Aug 12 06:38 | Intel Engine | ❌ HTTP 402 — credits exhausted |
| Aug 12 09:00 | Stripe health check | ❌ HTTP 402 — credits exhausted |
| Aug 12 10:38 | Intel Engine | ❌ HTTP 402 — credits exhausted |
| Aug 12 12:30 | Invoice reminders | ✅ OK — no unpaid invoices >7d |
| Aug 12 14:30 | Lead nurture | ⚠️ 0 email sent (1 failed — API key invalid), 0 SMS |
| Aug 12 14:39 | Intel Engine | ❌ HTTP 402 — credits exhausted |
| Aug 12 18:39 | Intel Engine | ❌ HTTP 402 — credits exhausted |
| Aug 12 22:39 | Intel Engine | ❌ HTTP 402 — credits exhausted |

**Reddit kit slot** also skipped due to inference cost gating.

---

## 📋 Tasks & TODOs

1. **Engage r/CRM thread** — Solo operator, 1yr, never used a CRM. Perfect MowGo Free→Solo pitch. No switching cost. URL: `reddit.com/r/CRM/comments/1uaa3yg/`
2. **Engage r/Contractor thread** — Paying $267/mo for Jobber, frustrated. 70% savings pitch for Crew ($79/mo). URL: `reddit.com/r/Contractor/comments/1qk5y04/`
3. **Engage r/CRM routing thread** — Jobber $200/mo can't lock route order. Specific competitor weakness. URL: `reddit.com/r/CRM/comments/1qvrjm6/`
4. **Monitor GreenRoute** — New low-cost threat. Free tier unlimited customers + invoicing, $10/mo route optimization. If they gain traction in solo market, MowGo's free tier (5 clients) may need re-evaluation.
5. **Engage r/WhichCRM "Anyone used QuoteIQ?"** — Intelligence gathering on most aggressive competitor. URL: `reddit.com/r/WhichCRM/comments/1phrj8r/`
6. **Run feature_ideas lane** — BI state v53, next lane is feature_ideas (once credits are restored).

## 🔬 Research Findings

1. **🔴 Container IP blocked from Reddit scraping** — Reddit returns "whoa there, pardner!" for all requests including JSON API and old.reddit.com. Google Cache also blocked. Thread summaries are search-metadata only. Aaron needs browser access for full thread content.

2. **QuoteIQ is the most aggressive competitor** — Heavy content marketing with comparison pages. "66-92% cheaper than Jobber" narrative. But they're a general contractor CRM, not lawn-specific. MowGo's lawn-specific features (rain delay, job photos, recurring scheduling) are moats QuoteIQ doesn't have.

3. **GreenRoute — new low-cost threat at $10/mo** — Free tier with unlimited customers + invoicing. Route optimization is a $10 add-on. Cheapest option in the market. Their Teams tier at $50/mo is well below MowGo Crew at $79.

4. **Jobber pricing pain is real** — Multiple Reddit threads (r/Contractor, r/CRM, r/WhichCRM) explicitly cite cost and add-on fees as frustrations. $267/mo for a 3-person crew is a common complaint. MowGo's wedge: $79/mo Crew vs $169-349/mo Jobber.

5. **Hidden costs are the industry norm** — Signup fees (Service Autopilot), per-user surcharges (Jobber $29/user, Housecall Pro $35/user), and locked features. MowGo's all-included pricing is a genuine differentiator.

6. **Market sweet spot: $50-150/mo for 1-3 person crews** — MowGo's $39-79/mo (Solo/Crew) is well positioned. Premium at $199 is above sweet spot — needs justification (AI Autopilot, offline mode).

## ⚡ Action Items

1. **🚨 Add OpenRouter credits** — HTTP 402 on every cron since 06:38 UTC. Visit https://openrouter.ai/settings to top up. Intel Engine needs ~21,885-31,264 tokens per run.

2. **Fix Lead Nurture API key** — `aaronkasemt@gmail.com` returns 401 "API key is invalid" on email day2. Check the email provider API key configuration.

3. **Engage 3 high-priority Reddit threads (after 12:00 UTC today)** — Drafts ready in the 02:38 Intel report. Threads: (1) r/CRM lawn care CRM, (2) r/Contractor Jobber frustration, (3) r/CRM Jobber routing issues.

4. **Monitor QuoteIQ user retention** — One user reported paying $450/mo previously, switched back to QuoteIQ because they "improved in just a few months." Strong retention signal.

5. **Re-evaluate MowGo free tier if GreenRoute gains traction** — GreenRoute's free tier has unlimited customers. If they start converting MowGo free-tier users, consider boosting to 10 free clients or adding a $19-29 "Starter" tier.

6. **Emphasize "all features included, no per-user fees"** in marketing copy — this is the #1 pain point competitors have, per multiple Reddit threads.

---

## State references
| Key | Value |
|-----|-------|
| BI state version | v53 |
| Next lane | feature_ideas |
| Reddit kit status | Skipped (inference cost gating) |
| Lead nurture | 0 sent (1 failed — API key), 0 SMS (A2P-gated) |
| Invoice reminders | OK — 0 unpaid >7d |
| Blasian silence | Day 20 |
| Cowork channel | Day 34 empty |

*Generated by MowGo nightly vault sync — 2026-08-13 02:00 UTC*