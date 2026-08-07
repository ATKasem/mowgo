# MowGo Morning Standup — Sun Aug 2, 2026 (9am CST)

**Source:** 7am scan (daily_scan.json) + 8am action run (daily_actions.json) · Part 3/3

---

## ✅ Done this morning

**CRITICAL bug fixed & deployed (Day 1)**
- verify-session success-page bug: browsers send **no Origin on same-origin GETs** (and JS can't set it), so the JWT+Origin-gated function 403'd every real checkout → paying customers saw "Could not verify payment" even though payment succeeded.
- Fix (via Codex CLI + manual diff + lint 0 + build): `Subscribe.jsx` now sends `Authorization: Bearer <supabase token>`; function rejects only *present-but-disallowed* origins — JWT + `metadata.user_id` match stays the security gate.
- **Deployed & live-verified** (wrangler `cddb397c`, `uses_functions: True`): no-Origin → 401 ✅ · evil Origin → 403 ✅ (security intact).
- ⚠️ **Deploy lesson logged:** git push does NOT trigger CF builds on this project; correct flow = `npm run build` → re-copy `functions/` into `dist/functions` → `wrangler pages deploy client/dist` from repo root.

**Quick wins shipped (8/8 bot-executable)**
1. Landing copy: "Coming soon: Stripe payments" → **"Stripe payments are live."** (EN+ES)
2. Compare page (EN+ES): **+SoloOp +TurfHop columns**, MowGo Stripe marked live, LawnPro corrected $0–$39 w/ free tier, **free-tier count → 6**, "2% skim" line, TurfHop 500-error reliability note, "Updated August 2026"
3. IBISWorld verified: **$176.7B and $188.8B are BOTH real IBISWorld** (market-size dashboard vs industry report — different scopes of NAICS 561730). Rule: attribute the product when citing. Flag resolved.
4. Bilingual claim: **verified absent from shipped copy** (client + marketing audit) — never reintroduce.
5. Lead lookups: **Spray Masters = strong match** (Spray Masters Turf Management, Owasso OK, LLC filed Mar 2026, FB Messenger is the only contact); **Lawton duo = no public footprint** → reply in the FB group thread.
6. **Monday plate packaged** → `monday_plate_2026-08-03.md` (order: Blasian → follow-ups → FB threads → Jobber posts → Reddit → decisions → directories → new-lead DMs; ~1.5–2h).
7. Autopilot public face scoped (0.5d, `docs/autopilot-public-face-scope.md`) — ships existing 14-tool Autopilot as landing chat widget; explicitly excludes the false AI-estimates claim.
8. Research compiled: SoloOp ($0/mo, 3.5%+$0.50 card fee passed to client — MowGo's flat $39 has no fee anywhere), TurfHop /pricing/ + /features/ both 500 (reliability ammo).

Commits: `051857c`, `9a701bd`, `db0892a` pushed.

---

## 🔴 Needs YOU today (with ask)

| # | Item | Ask |
|---|---|---|
| 1 | **Jobber promo-expiry posts — window ends ~Aug 3** | Post drafts A/B/D (ready). New ammo: $29 Core + **$29/user on every tier**; gates auto-reminders + QB behind Connect $119 → "MowGo includes them flat." |
| 2 | **4 overdue follow-ups** (Emerge, Metro Green, Bigfoot, Simply) + Campbell & Sons due Aug 3 | Send drafts (10 min). New angle: *"Stripe payments went live — card links on every invoice."* |
| 3 | **Reply to Blasian** (#🌱mowgo-leads, Day 5) | Draft ready — say the word and I post it verbatim. Restarts the human loop (no human msg since Jul 29). |
| 4 | **Logged-in test checkout (5 min)** | Only way to prove Stripe/Supabase **env var VALUES** end-to-end (Day 17). The 403 gate is gone; this is now the sole remaining Stripe risk. |
| 5 | **Reddit (Day 11)** | 6 targets incl. new r/WhichCRM `1unfily`; 28 drafts ready. Still 403-blocked for me. |
| 6 | **SoftwareWorld + directories (Day 19)** | Capterra/G2/SoftwareAdvice/GetApp self-serve (10–15 min each); guide in `marketing/comparison-site-submission-guide.md`. |
| 7 | **Delete mowflow project** (CF dashboard) | Stub retired Aug 2; project remains. CF guard blocks my API deletion. |
| 8 | **3 decisions** | Trial 7 vs 14 days (checkout grants 7, copy says 14) · CF cleanup (legacy `VITE_STRIPE_PRICE_SOLO`, `VITE_FORCE_DEMO=true`, add `STRIPE_PRICE_CREW`) · Blasian: bot-send vs copy-paste |

## 🚧 Blockers (unchanged, all manual)
Env-var proof (D17) · SoftwareWorld (D19) · Reddit 403 (D11) · Blasian loop (D5) · follow-ups overdue · mowflow deletion.

## 📈 Watch list (no action needed)
SoloOp ($0) ships auto-pay/rain-mode/route-sequencing — roadmap #3/#6/#7 pulled forward; Quotes v1 + competitor import remain the highest-leverage builds; 8 new OK leads queued in Monday plate.
