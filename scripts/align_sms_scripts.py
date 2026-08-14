#!/usr/bin/env python3
"""Align SMS scripts: (1) strip pre-consent marketing lines (A2P 30913), (2) Hormozi
upgrades — real report numbers front-loaded, no phantom-asset promises, STOP line in Day 7.
Sources: what-to-charge-ok-report.md (verified Aug-2026) for all numbers."""
import json, pathlib, re, sys

BASE = pathlib.Path("/opt/data/mowgo/leads")
Q = BASE / "sms_queue.json"
MD = BASE / "sms-scripts-batch1.md"

# ---- new scripts: id -> (day1, day2, day7) ----
NEW = {
 1: ("Hey, this is Aaron with MowGo — I'm a local OKC guy. Saw Campbell & Sons covers Edmond and Moore too. I put together the real OK rates — Edmond runs ~$58 a cut, OKC ~$55. Want the one-pager? No cost, no pitch.",
     "The OKC metro rate sheet is still yours if you want it — just say the word.",
     "Last check on the rate sheet. If now's not the time, no worries — reply STOP and I won't text again. Stay busy!"),
 2: ("Hey, this is Aaron with MowGo — 24 years is a hell of a run, Tom. Real question: when storms wreck a Tulsa week, how long does it take you to rebook the soaked days? I ask every crew I reach.",
     "When storms hit, rebooking eats the afternoon. I put together the real Tulsa rates too — Tulsa averages $57 a cut. Want them sent over? No cost.",
     "Last one from me, Tom. If scheduling's handled, no worries — reply STOP and I won't text again. But if storms ever wreck your week, you know where I am."),
 3: ("Hey Randy, this is Aaron with MowGo. LBR's been going since 2004 — commercial AND residential is a lot of moving parts. Got a 30-second question for you — okay to text?",
     "Quick one: do you run your routes off a map, a book, or an app? I'll send the real Tulsa/BA rates while I'm at it — Broken Arrow averages $67 a cut, Tulsa $57.",
     "Last check — if you're happy with how scheduling works now, all good. Reply STOP and I won't text again. If not, the rate sheet's yours anytime."),
 4: ("Hey, this is Aaron with MowGo. Basic/Standard/Premium is a clean setup — most crews run one flat rate and eat the difference. How do you price across the three?",
     "Following up — I put together the real Tulsa-area rates by service level (Tulsa avg $57). Want it sent over? Free, no strings.",
     "Last one from me. If you're set, no worries — reply STOP and I won't text again. Wishing you a full book this season!"),
 5: ("Hey Austin, this is Aaron with MowGo — saw Hicks does residential AND commercial in Stillwater. Honest question: do you run both on one calendar or keep them separate?",
     "Stillwater crew question: does rain ever push your week into chaos? I asked around and most crews say it's their #1 headache. I'll send the OK rate map so you can check your pricing too — 2 min read, no pitch.",
     "Last check from me. If scheduling's handled, all good — reply STOP and I won't text again. The rate sheet's yours if you ever want it."),
 6: ("Hey Chad, this is Aaron with MowGo. Thogy's been in Ardmore 20+ years — that's a solid rep. Quick question: are you still doing schedules on paper or in your head, or are you using an app?",
     "If you're on paper — most Ardmore crews we talk to are too, and they say the same thing: invoicing is the painful part. I put together the real OK rates by city. Want the ones for your area sent over?",
     "Last one, promise. If it's not a fit, no hard feelings — reply STOP and I won't text again. Just wanted to reach out once."),
 7: ("Hey, this is Aaron with MowGo. Design, sprinklers, AND 24hr emergency — you wear more hats than anyone I've messaged. How do you keep all those jobs straight?",
     "Following up — I put together the real OK rates if you ever want to check your pricing against them. Free, no strings.",
     "Last check from me. Wishing you a dry season, Ardmore's been wild this year! Reply STOP and I won't text again."),
 8: ("Hey, this is Aaron with MowGo. Saw Premier does scheduled AND on-demand — that's a hard mix to run. Do you take bookings by phone and write them down, or is there an app?",
     "Quick follow-up — I put together the real OKC metro rates if you want a benchmark (OKC avg $55). No cost, no pitch. Most phone-only crews say pricing is the first thing they check.",
     "Last one. If it's not a fit, no problem — reply STOP and I won't text again. The rate sheet's yours anytime."),
 9: ("Hey Austin, this is Aaron with MowGo. Saw Eberly's covers 7 cities — that's a big service area to route. How do you plan your days when jobs span OKC to Choctaw?",
     "Following up — crews with big service areas tell me route order is where the time goes. I put together the OK rate map — OKC runs ~$55 a cut. Want it? Free.",
     "Last check from me. If you're set, all good — reply STOP and I won't text again. Just wanted to reach out once."),
 10: ("Hey, this is Aaron with MowGo. Lawn, trees, windows, AND snow — you've got 4 businesses in one. How do you keep the schedule straight year-round?",
      "Quick one — do you use the same calendar for all services, or juggle separate ones? Most multi-service crews say that's the pain point. I'll send the OK rate sheet — Yukon averages $59 a cut. Short read, free.",
      "Last check. If you're happy with how it's organized, no worries — reply STOP and I won't text again. Stay busy!"),
 11: ("Hey, this is Aaron with MowGo. 1959 — Atlas has seen every season OKC has. We're a local startup, so this is a genuine question: how do you track 7-step program visits across your route?",
      "Following up — 7-step programs mean a lot of visit types to track. I put together the OKC rate benchmarks (OKC avg $55) if useful — want them sent over? No cost.",
      "Last one from me. Respect for 58 years in this game. Reply STOP and I won't text again. The rate sheet's there if you ever want it."),
 12: ("Hey Milo, this is Aaron with MowGo. Saw A Plus runs on phone only — that's how a lot of OKC crews start. Quick question: do you text clients to remind them about jobs, or just show up?",
      "If you do — reminders are the easy win most crews miss. First though: the OKC rate sheet's free if you want it — OKC averages $55 a cut.",
      "Last check from me. If you're good, all good — reply STOP and I won't text again. Hope the season's treating you well!"),
 13: ("Hey, this is Aaron with MowGo. Top-rated in Lawton — that takes consistency, and most people don't know how hard that is. How do you keep the schedule tight?",
      "Quick follow-up — happy to send the OK rate sheet so you know where your pricing sits (state avg $55.25). Free, no pitch.",
      "Last one from me. If scheduling's handled, no worries — reply STOP and I won't text again. Keep up the good reviews!"),
 14: ("Hey Alejandro, this is Aaron with MowGo. 94 reviews at 4.9 — that's earned, not luck. With all the services you offer, how do you keep jobs from double-booking?",
      "Following up — if you're already set, all good, truly. But I put together the OK rate benchmarks — Claremore averages $65 a cut — if you want a second opinion on pricing. Free.",
      "Last check. If you're set, all good. Congrats on the reputation — that's earned! Reply STOP and I won't text again."),
 15: ("Hey Bo, this is Aaron with MowGo. Saw Natural Lawn covers Edmond to Choctaw — big area. Do you run the organic program visits on a set rotation, or does it vary week to week?",
      "Quick follow-up — if it varies, that's where most crews lose track. I put together the OK rate report — Edmond runs ~$58 a cut — free, no strings.",
      "Last one from me. If you're covered, no worries — reply STOP and I won't text again. Have a good season!"),
 16: ("Hey, this is Aaron with MowGo. Saw Custom Cuts does weekly AND bi-weekly across 5 cities — that's two different schedules to track. How do you keep them straight?",
      "Following up — if you're already set up, all good. If not, I've got the OKC rate sheet (OKC avg $55). Want it? Free.",
      "Last check from me. If it's not a fit, all good — reply STOP and I won't text again. The rate sheet's there whenever."),
 17: ("Hey Scott, this is Aaron with MowGo. Saw Scott's offers 7 services — mowing, bagging, edging, fertilizing... that's a lot for a small crew. Do you track all of them per client?",
      "Quick one — if you do, most crews your size say pricing per service is the first thing to nail. I've got the OK rate sheet (state avg $55) if you want to check yours. Free.",
      "Last one. If you're set, no problem. Just wanted to reach out once! Reply STOP and I won't text again."),
 18: ("Hey Jayden, this is Aaron with MowGo. Saw J&C's on Facebook only — that's how a lot of good crews fly under the radar. Do you book jobs through FB messages?",
      "If you do — the OKC rate sheet's free if you want a pricing check (OKC avg $55). Either way, no pitch.",
      "Last check from me. If you're good, all good — reply STOP and I won't text again. Stay busy out there!"),
 19: ("Hey, this is Aaron with MowGo. Saw Sungarden does commercial mowing — different beast than residential. Do you run commercial routes on a fixed weekly rotation?",
      "Following up — if you do, route order is where the profit hides. I put together the real Tulsa rates (residential avg $57) if you want a benchmark. Free.",
      "Last one from me. If you're covered, no worries — reply STOP and I won't text again. Have a strong season!"),
 20: ("Hey Blake, this is Aaron with MowGo. Saw Mow-Town's doing good things in Ardmore — 800+ likes on FB. Quick question: you still scheduling by hand or using an app?",
      "If by hand — most Ardmore crews say invoicing is the first thing they automate. I put together the real OK rates by city too. Want both sent over? Free.",
      "Last check, Blake. If it's not a fit, all good — reply STOP and I won't text again. The rate sheet's yours anytime."),
 21: ("Hey Butch, this is Aaron with MowGo. 20+ years AND you already send pre-service reminders — most crews don't bother, respect. Do you send those by hand every week?",
      "Following up — if you're hand-sending reminders now, I know how that adds up. The Tulsa rate report's free if you want it — Tulsa averages $57 a cut. Your call.",
      "Last one. If you're happy with your setup, no worries — reply STOP and I won't text again. Just wanted to reach out once."),
 "t0-1": ("Hey, this is Aaron. Saw NG Outdoor in Edmond — most crews your size schedule by phone. I made a one-page OK rate report — Edmond averages $58 a cut. Want it? Free.", "", ""),
 "t0-2": ("Hey, this is Aaron. Saw Frankies expanding from Norman into Noble and Slaughterville. I made a one-page OK rate report — Norman averages $53 a cut. Want it? Free.", "", ""),
}

# ---- 1. queue ----
queue = json.loads(Q.read_text())
updated = 0
for l in queue:
    key = l["id"]
    if key not in NEW:
        print(f"  !! no rewrite for id {key} ({l['name']})"); continue
    d1, d2, d7 = NEW[key]
    if d1: l["day1"] = d1
    if d2: l["day2"] = d2
    if d7: l["day7"] = d7
    updated += 1
Q.write_text(json.dumps(queue, indent=2))
print(f"queue: {updated}/{len(queue)} leads updated -> {Q}")

# ---- 2. manual scripts .md (replace old Day texts with new) ----
md = MD.read_text()
pairs = {
 # lead 1
 "I put together the real lawn rates for OKC metro from recent data — want me to send it over? No cost, no pitch.":
   "I put together the real OK rates — Edmond runs ~$58 a cut, OKC ~$55. Want the one-pager? No cost, no pitch.",
 # lead 2 d2
 "Most crews tell me it's a 2-hour phone-a-thon. I put together how OK crews handle rain-week rescheduling — it's a short read, want it sent over? No cost.":
   "When storms hit, rebooking eats the afternoon. I put together the real Tulsa rates too — Tulsa averages $57 a cut. Want them sent over? No cost.",
 # lead 2 d7
 "Last one from me, Tom. If scheduling's handled, no worries — but if storms ever wreck your week, you know where I am.":
   "Last one from me, Tom. If scheduling's handled, no worries — reply STOP and I won't text again. But if storms ever wreck your week, you know where I am.",
 # lead 3 d2
 "Quick one: do you run your routes off a map, a book, or an app? I'll send you what crews your size are switching to — and the real Tulsa rates while I'm at it.":
   "Quick one: do you run your routes off a map, a book, or an app? I'll send the real Tulsa/BA rates while I'm at it — Broken Arrow averages $67 a cut, Tulsa $57.",
 # lead 3 d7
 "Last check — if you're happy with how scheduling works now, all good. If not, happy to show you the free tier.":
   "Last check — if you're happy with how scheduling works now, all good. Reply STOP and I won't text again. If not, the rate sheet's yours anytime.",
 # lead 4 d2
 "Following up — I put together the real Tulsa-area rates by service level. Want me to send it over? Free, no strings.":
   "Following up — I put together the real Tulsa-area rates by service level (Tulsa avg $57). Want it sent over? Free, no strings.",
 # lead 4 d7
 "Last one from me. If you're set, no worries at all. Wishing you a full book this season!":
   "Last one from me. If you're set, no worries — reply STOP and I won't text again. Wishing you a full book this season!",
 # lead 5 d2
 "I asked around and most crews say it's their #1 headache. I'll send what the fix looks like — 2 min read, no pitch.":
   "I asked around and most crews say it's their #1 headache. I'll send the OK rate map so you can check your pricing too — 2 min read, no pitch.",
 # lead 5 d7
 "Last check from me. If scheduling's handled, all good — just wanted to make sure you knew about the free tier.":
   "Last check from me. If scheduling's handled, all good — reply STOP and I won't text again. The rate sheet's yours if you ever want it.",
 # lead 6 d2
 "I put together the real Ardmore rates too. Want both sent over?":
   "I put together the real OK rates by city. Want the ones for your area sent over?",
 # lead 6 d7
 "Last one, promise. If it's not a fit, no hard feelings — just wanted to reach out once.":
   "Last one, promise. If it's not a fit, no hard feelings — reply STOP and I won't text again. Just wanted to reach out once.",
 # lead 7 d2
 "Following up — if you ever want to see how crews with multiple service lines organize it, I'll send a quick rundown. Free. Also grabbed the Ardmore rates if useful.":
   "Following up — I put together the real OK rates if you ever want to check your pricing against them. Free, no strings.",
 # lead 7 d7
 "Last check from me. Wishing you a dry season, Ardmore's been wild this year!":
   "Last check from me. Wishing you a dry season, Ardmore's been wild this year! Reply STOP and I won't text again.",
 # lead 8 d2
 "I put together the real Midwest City/OKC rates if you want a benchmark. No cost, no pitch.":
   "I put together the real OKC metro rates if you want a benchmark (OKC avg $55). No cost, no pitch.",
 # lead 8 d7
 "Last one. If it's not a fit, no problem — but the free tier's always there if you want it later.":
   "Last one. If it's not a fit, no problem — reply STOP and I won't text again. The rate sheet's yours anytime.",
 # lead 9 d2
 "I put together the OKC metro rate map if you want it — free.":
   "I put together the OK rate map — OKC runs ~$55 a cut. Want it? Free.",
 # lead 9 d7
 "Last check from me. If you're set, all good — just wanted to reach out once.":
   "Last check from me. If you're set, all good — reply STOP and I won't text again. Just wanted to reach out once.",
 # lead 10 d2
 "Most multi-service crews say that's the pain point. I'll send how they fix it — short read, free.":
   "Most multi-service crews say that's the pain point. I'll send the OK rate sheet — Yukon averages $59 a cut. Short read, free.",
 # lead 10 d7
 "Last check. If you're happy with how it's organized, no worries at all. Stay busy!":
   "Last check. If you're happy with how it's organized, no worries — reply STOP and I won't text again. Stay busy!",
 # lead 11 d2
 "I put together the OKC rate benchmarks if useful — want them sent over? No cost.":
   "I put together the OKC rate benchmarks (OKC avg $55) if useful — want them sent over? No cost.",
 # lead 11 d7
 "Last one from me. Respect for 58 years in this game. If we can ever help, free tier's there.":
   "Last one from me. Respect for 58 years in this game. Reply STOP and I won't text again. The rate sheet's there if you ever want it.",
 # lead 12 d2
 "If you ever want automatic reminders so you never lose a job to a forgotten appointment, that's our thing — but first, the OKC rate sheet's free if you want it.":
   "If you do — reminders are the easy win most crews miss. First though: the OKC rate sheet's free if you want it — OKC averages $55 a cut.",
 # lead 12 d7
 "Last check from me. If you're good, all good. Hope the season's treating you well!":
   "Last check from me. If you're good, all good — reply STOP and I won't text again. Hope the season's treating you well!",
 # lead 13 d2
 "Quick follow-up — happy to send over the Lawton-area rates so you know where your pricing sits. Free, no pitch.":
   "Quick follow-up — happy to send the OK rate sheet so you know where your pricing sits (state avg $55.25). Free, no pitch.",
 # lead 13 d7
 "Last one from me. If scheduling's handled, no worries — just wanted to reach out once. Keep up the good reviews!":
   "Last one from me. If scheduling's handled, no worries — reply STOP and I won't text again. Keep up the good reviews!",
 # lead 14 d2
 "But I put together the Claremore/OK rate benchmarks if you want a second opinion on pricing. Free.":
   "But I put together the OK rate benchmarks — Claremore averages $65 a cut — if you want a second opinion on pricing. Free.",
 # lead 14 d7
 "Last check. If you're set, all good. Congrats on the reputation — that's earned!":
   "Last check. If you're set, all good. Congrats on the reputation — that's earned! Reply STOP and I won't text again.",
 # lead 15 d2
 "I put together the OKC rate report if you want a benchmark — free, no strings.":
   "I put together the OK rate report — Edmond runs ~$58 a cut — free, no strings.",
 # lead 15 d7
 "Last one from me. If you're covered, no worries at all. Have a good season!":
   "Last one from me. If you're covered, no worries — reply STOP and I won't text again. Have a good season!",
 # lead 16 d2
 "If not, I've got the OKC rate sheet and how crews run mixed schedules. Want both? Free.":
   "If not, I've got the OKC rate sheet (OKC avg $55). Want it? Free.",
 # lead 16 d7
 "Last check from me. If it's not a fit, all good — the free tier's there whenever.":
   "Last check from me. If it's not a fit, all good — reply STOP and I won't text again. The rate sheet's there whenever.",
 # lead 17 d2
 "I've got the Midwest City/OKC rates if you want to check yours. Free.":
   "I've got the OK rate sheet (state avg $55) if you want to check yours. Free.",
 # lead 17 d7
 "Last one. If you're set, no problem. Just wanted to reach out once!":
   "Last one. If you're set, no problem. Just wanted to reach out once! Reply STOP and I won't text again.",
 # lead 18 d2
 "If you do — a booking link might help you look bigger than you are. And the OKC rate sheet's free if you want a pricing check. Either way, no pitch.":
   "If you do — the OKC rate sheet's free if you want a pricing check (OKC avg $55). Either way, no pitch.",
 # lead 18 d7
 "Last check from me. If you're good, all good. Stay busy out there!":
   "Last check from me. If you're good, all good — reply STOP and I won't text again. Stay busy out there!",
 # lead 19 d2
 "I put together the Tulsa commercial rate benchmarks if you want them. Free.":
   "I put together the real Tulsa rates (residential avg $57) if you want a benchmark. Free.",
 # lead 19 d7
 "Last one from me. If you're covered, no worries. Have a strong season!":
   "Last one from me. If you're covered, no worries — reply STOP and I won't text again. Have a strong season!",
 # lead 20 d2
 "I put together the real Ardmore rates too. Want both sent over? Free.":
   "I put together the real OK rates by city too. Want both sent over? Free.",
 # lead 20 d7
 "Last check, Blake. If it's not a fit, all good — free tier's there if you ever want it.":
   "Last check, Blake. If it's not a fit, all good — reply STOP and I won't text again. The rate sheet's yours anytime.",
 # lead 21 d2
 "The Tulsa rate report's free if you want it, and I can show you what automated reminders look like. Your call.":
   "The Tulsa rate report's free if you want it — Tulsa averages $57 a cut. Your call.",
 # lead 21 d7
 "Last one. If you're happy with your setup, no worries — just wanted to reach out once.":
   "Last one. If you're happy with your setup, no worries — reply STOP and I won't text again. Just wanted to reach out once.",
 # lead 1 d7
 "Last check on the rate sheet. If now's not the time, no worries — I'll circle back after the season. Stay busy!":
   "Last check on the rate sheet. If now's not the time, no worries — reply STOP and I won't text again. Stay busy!",
}
miss = []
for old, new in pairs.items():
    if old in md:
        md = md.replace(old, new)
    else:
        miss.append(old[:60])
MD.write_text(md)
print(f".md: {len(pairs)-len(miss)}/{len(pairs)} replacements applied; missing: {miss}")
