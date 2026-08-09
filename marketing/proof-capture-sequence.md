# MowGo Proof-Capture Sequence — First 3 Operators
**Goal:** 3 operators → 3 approved testimonials + 1 case study with real numbers, live on the landing page within the concierge sprint's 14 days.

**Why this is the #1 lever (Hormozi, from the library):**
> "If you have 100 pieces of proof and a terrible offer versus an amazing offer and no proof, the guy with 100 pieces of proof is going to win. You need proof that is similar enough to them that they will believe what you did for that person will also work for them." (`HsQeQM1jUeg`)

The landing page is structurally a grand slam (scored 64/100, proof = 2/10). This sequence moves proof from 2 → 8, which is the single biggest score jump available. **Capture at the win moment, in their words, never rewritten, never fabricated.**

---

## How the infrastructure works (what's already built)

1. **Capture:** `ReviewPrompt.jsx` — in-app modal that inserts the operator's own quote into `testimonials` (their auth, so it's provably theirs). Lives in Settings; also fires contextually.
2. **Storage:** `testimonials` table — `quote` (2–600 chars), `name`, `role` (e.g. "Solo operator, OKC"), `plan`, `approved` (default false).
3. **Publish:** Landing page reads ONLY `approved=true` rows — section is hidden until real quotes exist. **You approve in Supabase** (no admin UI yet): `UPDATE testimonials SET approved=true, role='...', plan='solo' WHERE id='...'`.
4. **Real-only rule (locked):** screenshots and quotes must be genuine — never fabricate, never paste invented numbers. Negative WOM runs 5–37x.

---

## The three capture moments (per operator)

### Moment 1 — Activation (day of setup, first scheduled job)
The operator just saw their clients imported and their week laid out. Ask *during* the wow:

> "Real talk — what did your old system look like for this? How were you handling [rain/scheduling] before?"

**Capture:** their answer, verbatim. This is the "before" half of the story — you need it to make the "after" land later. Note it in the tracker immediately (their words, not your summary).

### Moment 2 — The win moment (first delivered value — THE one)
Hormozi's rule: capture at the peak, not later. This is when they say something spontaneously — a rain delay that moved 8 jobs in one tap, a client who paid the invoice text, the first week without a missed text.

**The exact ask (right after they say something positive):**
> "Wait — say that again, that's the whole story. Can I put that on our site? Real operators, real words. I'll send you the exact text before anything goes live."

**Capture (all three):**
- [ ] Their quote, **verbatim** — the raw sentence, not polished
- [ ] The number that proves it (hours saved, jobs moved, invoices paid)
- [ ] A real screenshot (their before/after, or the MowGo screen that did the thing)

**If they hesitate:** drop the ask. Never pressure — proof that's coerced reads as fake. Come back at Moment 3.

### Moment 3 — Conversion (day 30, the paid ask)
They've said yes to staying. The testimonial is now a *fair trade*, not a favor:

> "You're saving [X] hours a week — that's the whole point. Mind putting that in your own words for the site? Two sentences is plenty. And if you refer another crew, I'll give you a free month."

**Capture:** the quote + their permission to use name/business/photo (ask explicitly — a real face multiplies proof value).

---

## The approval workflow (5 minutes per quote)

1. Operator submits in-app (or pastes to you — you enter it for them if they prefer, but it must be THEIR words).
2. You review in Supabase: `SELECT id, quote, name, created_at FROM testimonials WHERE approved = false;`
3. Approve + enrich: `UPDATE testimonials SET approved = true, role = 'Solo operator, OKC', plan = 'solo' WHERE id = '<id>';`
   - **role field is the credibility multiplier** — "Solo operator" + city reads as a real peer, which is Hormozi's "similar enough to them" requirement.
4. It appears on the landing page automatically (no deploy needed).
5. Send the operator the live link: *"You're on the site — [link]. Thank you, that genuinely helps other crews find this."* (This also makes them a fan → referral.)

---

## The case study (1, with real numbers)

The testimonials prove it works. The case study proves it *for them*. Structure (all real numbers from the sprint tracker):

- **Before:** their old process (missed texts, rain chaos, invoice chasing) — from Moment 1 capture
- **The setup:** what we migrated, in 48h (concierge)
- **After:** the measured win — "X hours/week saved", "Y jobs moved in one tap", "first invoice paid via text"
- **The quote:** their Moment 2/3 words
- **The ask at the end:** "Run your next 5 clients free" (the landing's existing CTA)

**Lands at:** a `/case-study` page or the landing's proof section, plus the Compare page's "why switch" area.

---

## Where proof lands on the page (in order)

1. **Landing testimonials section** (built, hidden until `approved=true`) — the 3 quotes + roles
2. **Stats band** — once real: "X hours saved by real crews" REPLACES the generic <1% card as the third slot *when the number is real* (never before)
3. **Compare page** — a real-operator line under the price table ("Frankies: 'Moved 8 jobs in one tap when the rain hit'")
4. **Case study** — the full before/after with numbers
5. **Then** the quotes feed ads/referrals (Hormozi: "screenshots ARE ads")

---

## Anti-patterns (hard rules)

- **Never** polish a quote into something they didn't say — verbatim or nothing
- **Never** fabricate a screenshot or number — real only (locked in memory)
- **Never** put proof on the page before `approved=true` (the RLS already enforces this — don't bypass it)
- **Never** use the "100 pieces of proof" quote to justify volume over truth — 3 real beats 30 invented, every time

---

## Sequence check (this week)

| # | Action | Owner |
|---|---|---|
| 1 | Moment-1 capture on first setup call (Emerge, NG, or Frankies) | Blasian |
| 2 | Moment-2 capture at first delivered value | Blasian |
| 3 | Approval + role/plan enrichment in Supabase (5 min) | Blasian (or Hermes) |
| 4 | Live-link thank-you to operator | Blasian |
| 5 | Case study drafted once numbers are real | Hermes |
| 6 | Quotes → landing (auto), case study → /case-study page | Hermes |

**Definition of done:** 3 approved testimonials live on the landing page + 1 case study with real numbers, all captured at the win moment in the operators' own words.
