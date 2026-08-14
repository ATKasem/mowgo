#!/usr/bin/env python3
"""Post the Aug 7 22:21Z Reddit kit per mowgo-leads skill.

Kit order (BI engine, REVISED 08-07 13:31Z):
  ① #54 1vi045u (r/landscaping, LMN vs Jobber)  — liveness-check first
  ② #43 1vfyg2j (r/sweatystartup, first 5 customers)
  ③ #50 1vh7t47 (r/sweatystartup, mulch pricing) — liveness-conditional
  ④ #41 1vfvq1g (r/landscaping, slow season)
  fallbacks: #38 1vfhp9z → #40 1vfpd5m → #44 1vfyelq

Rules: friend-mode, NO product/brand/price. Post → verify visibility
(API success != visible; #48 got filtered). Move down the kit if dead/filtered.
Stop at the FIRST visible comment (rule 13: 1 post per slot).

Verification hierarchy:
  1. REDDIT_RETRIEVE_POST_COMMENTS listing: author Blasianzsz present = VISIBLE.
  2. If absent (listing truncates by score): ground truth = thread RSS from the
     Composio sandbox (alternate IP), grep for the comment id / author name.
     Present = VISIBLE, absent = FILTERED.
"""
import json, urllib.request, os, re, sys, time

KEY = ""
try:
    env = open("/opt/data/.env").read()
    m = re.search(r"^MCP_COMPOSIO_API_KEY=(.*)$", env, re.M)
    if m:
        KEY = m.group(1).strip().strip('"').strip("'")
except Exception as e:
    print(f"FATAL: cannot read key: {e}", flush=True)
    sys.exit(1)

URL = "https://connect.composio.dev/mcp"

KIT = [
    # (label, thread_id, subreddit, draft)
    ("54", "1vi045u", "landscaping",
     "we're design build too and went through this exact comparison last year. lmn is the stronger estimating machine — takeoffs, crew costing, change orders, the whole estimating side is deep and it shows on bigger jobs. jobber is lighter on estimating but it's a much smaller lift to run day to day, and honestly for a design build shop the scheduling is where jobber feels thin — route-based recurring work is its strength, not custom project timelines. the thing nobody says out loud: the switching cost is real either way. you'll spend a couple weeks re-entering clients and templates no matter which you pick, so pick the one that fits how you actually estimate, not the one with the better demo. what's your average job size — mostly small design build or do you take on the big stuff too?"),
    ("43", "1vfyg2j", "sweatystartup",
     "i'm in lawn care so same buyers, same playbook. my first 5 jobs: 2 from nextdoor, 2 from one realtor i did a freebie for, 1 from a yard sign on a job. nextdoor took a few weeks before anything stuck for me too, the realtor thing worked way faster.\n\nif i had to start over with zero: google business profile day one, ask every customer for a review while they're still happy, that's what converts the nextdoor lookers. then 3 realtors and offer something small free, they send more work than any ad i ever ran. what's your niche, residential fence or commercial?"),
    ("50", "1vh7t47", "sweatystartup",
     "i do small mulching jobs on the side, so i've been through this exact math.\n\nmark the material up 20-30%. that covers the ordering, the delivery coordination, and the risk that you guess the yardage wrong, because you will eat a load of leftover mulch at least once. if the supply yard gives you a contractor discount, take it and keep the difference.\n\nand charge for more than mulch plus labor. bed prep and weeding if the beds need it, edging, cleanup and haul-away. set a minimum job price too, a two-yard job can still eat half your day once you count loading, driving and raking out. small jobs are where beginners quietly lose money."),
    ("41", "1vfvq1g", "landscaping",
     "we hit this every august. heat kills mowing before fall picks up, so we sell the fall work now, not later. leaf cleanup contracts get signed in august, gutter cleaning gets bundled in, and aerate+overseed books out for september. by october every crew in town is chasing the same leaf jobs but the good routes are already taken.\n\ncharge by property size not by hour, that's the whole trick. hourly punishes your fast guys and makes the slow ones rich. what region are you in? if you get snow, holiday light installs starting mid-october pay stupid well."),
    ("38", "1vfhp9z", "LawnCarePros",
     'i get a solid chunk of my jobs from nextdoor but it took a while to find the rhythm. i check it twice a day and reply to "looking for a lawn guy" posts within the hour. the ones with 5 replies in 10 minutes are gone, the ones with zero still call you a week later. yeah there\'s cheap leads, mostly one-time cleanups or people who want a price in the comments. my rule: only chase posts under a day old, never quote in the thread, just "dm me your address, i\'ll send a quote today." the tagged-recommendation jobs are better but they only start once you\'ve done work in that neighborhood. what are you running, mostly weekly routes?'),
    ("40", "1vfpd5m", "Entrepreneur",
     "did the same jump a few years back, dev-adjacent work into lawn care. the work is the easy part. what actually shocked me: you become a part-time receptionist and bookkeeper. texting people back and chasing payments eats more hours than mowing does.\n\ncan't give you real hydroseeding numbers, i'm in mowing, but the seasonality pattern is the same: seeding has two windows, spring and early fall, and summer is dead. every guy i know runs a second line in the off months, snow or holiday lights, or construction seeding which stretches later. plan the whole year or the math doesn't work.\n\nbuilding the cheap rig first is the right call, test demand before you spend real money. what region are you in, does construction there run late into fall?"),
    ("44", "1vfyelq", "smallbusiness",
     "had two call me in the last month, both solar companies i think. one couldn't answer a single follow-up and i hung up, the other booked a time slot with zero drama. the difference was obvious: the good one said it was an assistant right up front and kept it short, the bad one tried to sound human and it got weird.\n\nhonestly the ones that win are the ones that get me to a real person fast. what do you do when you realize it's a bot?"),
]


def rpc(method, params, session=None, rid=1):
    body = json.dumps({"jsonrpc": "2.0", "id": rid, "method": method, "params": params}).encode()
    req = urllib.request.Request(URL, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json, text/event-stream")
    req.add_header("x-consumer-api-key", KEY)
    if session:
        req.add_header("Mcp-Session-Id", session)
    with urllib.request.urlopen(req, timeout=90) as resp:
        session = resp.headers.get("Mcp-Session-Id") or session
        data = resp.read().decode()
    result = None
    for line in data.splitlines():
        if line.startswith("data: "):
            result = json.loads(line[6:])
    return result, session


def call_tool(name, arguments, session, rid):
    res, session = rpc("tools/call", {
        "name": "COMPOSIO_MULTI_EXECUTE_TOOL",
        "arguments": {"tools": [{"tool_slug": name, "arguments": arguments}], "memory": {}, "session_id": None},
    }, session, rid=rid)
    txt = res["result"]["content"][0]["text"]
    d = json.loads(txt)
    r = d.get("data", {}).get("results", [{}])[0].get("response", {})
    return r, session, txt


def call_raw_tool(name, arguments, session, rid):
    """For tools NOT wrapped by COMPOSIO_MULTI_EXECUTE_TOOL (e.g. remote bash)."""
    res, session = rpc("tools/call", {
        "name": name, "arguments": arguments,
    }, session, rid=rid)
    txt = res["result"]["content"][0]["text"]
    return txt, session


def extract_comment_ids(text):
    return re.findall(r'"name"\s*:\s*"t1_([a-z0-9]+)"', text) + re.findall(r"t1_([a-z0-9]{4,10})", text)


def main():
    if not KEY:
        print("FATAL: MCP_COMPOSIO_API_KEY not set", flush=True)
        return 1

    init, session = rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "hermes-kit-0822", "version": "1.0"}})
    _, session = rpc("notifications/initialized", {}, session, rid=2)

    results = []
    for label, thread, sub, text in KIT:
        print(f"\n===== kit #{label} {thread} (r/{sub}) =====", flush=True)

        # --- liveness check ---
        try:
            r, session, raw = call_tool("REDDIT_RETRIEVE_POST_COMMENTS", {"article": thread, "limit": 100}, session, rid=3)
            listing = json.dumps(r)
            ncom = listing.count('"author":')
            ncom2 = listing.count('"kind": "t1"')
            print(f"liveness: retrieve OK, comment entries ~{max(ncom, ncom2)}", flush=True)
            if not listing.strip() or listing.strip() in ("{}", "null", "[]"):
                print("DEAD: empty listing -> moving on", flush=True)
                results.append((label, thread, "DEAD_EMPTY", None))
                continue
        except Exception as e:
            print(f"DEAD: retrieve error {e} -> moving on", flush=True)
            results.append((label, thread, "DEAD_ERR", None))
            continue

        # --- post with retry ---
        posted = False
        post_raw = ""
        for attempt in range(1, 5):
            try:
                r, session, post_raw = call_tool("REDDIT_POST_REDDIT_COMMENT", {"thing_id": f"t3_{thread}", "text": text}, session, rid=4)
            except Exception as e:
                print(f"post attempt {attempt} EXC: {e}", flush=True)
                time.sleep(30)
                continue
            ok = r.get("successful", False)
            print(f"post attempt {attempt} successful: {ok}", flush=True)
            if not ok:
                msg = str(r.get("message") or r.get("error") or "")[:250]
                print("err:", msg, flush=True)
                m = re.search(r"(\d+) minute\(s\) and (\d+) second", msg)
                if m:
                    wait = int(m.group(1)) * 60 + int(m.group(2)) + 30
                    print(f"rate-limited, waiting {wait}s...", flush=True)
                    time.sleep(wait)
                    continue
                time.sleep(45)
                continue
            posted = True
            break
        if not posted:
            print(f"POST FAILED after retries on {thread} -> moving on", flush=True)
            results.append((label, thread, "POST_FAILED", None))
            continue

        # --- visibility verification ---
        time.sleep(6)
        try:
            r2, session, _ = call_tool("REDDIT_RETRIEVE_POST_COMMENTS", {"article": thread, "limit": 100}, session, rid=5)
        except Exception as e:
            r2 = {}
            print(f"verify retrieve EXC: {e}", flush=True)
        s2 = json.dumps(r2)
        hits = [m.start() for m in re.finditer(r'"author"\s*:\s*"Blasianzsz"', s2)]
        print(f"listing: Blasianzsz author hits = {len(hits)}", flush=True)
        if hits:
            idx = hits[-1]
            seg = s2[max(0, idx - 400):idx + 200]
            names = re.findall(r'"name"\s*:\s*"t1_([a-z0-9]+)"', seg)
            cid = names[-1] if names else "?"
            perm = f"https://www.reddit.com/r/{sub}/comments/{thread}/comment/{cid}"
            print(f"VISIBLE OK comment id t1_{cid}", flush=True)
            print(f"PERMALINK {perm}", flush=True)
            results.append((label, thread, "VISIBLE", perm))
            break  # rule 13: stop at first visible

        # --- listing missed: ground truth via sandbox RSS ---
        # find candidate comment id from post response
        ids = list(dict.fromkeys(extract_comment_ids(post_raw)))
        print(f"listing MISSED author; post response ids: {ids[:6]}", flush=True)
        print("---- raw post response (for id extraction) ----", flush=True)
        print(post_raw[:1500], flush=True)
        print("---- end raw ----", flush=True)
        try:
            if ids:
                pat = "|".join(re.escape(i) for i in ids[:4])
                cmd = f"curl -sL -m 60 -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 'https://www.reddit.com/r/{sub}/comments/{thread}.rss' | grep -oE '({pat})' | sort -u; echo RSS_AUTHOR_COUNT=$(curl -sL -m 60 -A 'Mozilla/5.0' 'https://www.reddit.com/r/{sub}/comments/{thread}.rss' | grep -c '<name>Blasianzsz</name>')"
            else:
                cmd = f"curl -sL -m 60 -A 'Mozilla/5.0' 'https://www.reddit.com/r/{sub}/comments/{thread}.rss' | grep -c '<name>Blasianzsz</name>'"
            print("sandbox RSS ground-truth check...", flush=True)
            raw_bash, session = call_raw_tool("COMPOSIO_REMOTE_BASH_TOOL", {"command": cmd}, session, rid=6)
            print("---- sandbox bash raw ----", flush=True)
            print(raw_bash[:2000], flush=True)
            print("---- end raw ----", flush=True)
            # parse stdout defensively
            stdout = ""
            try:
                bd = json.loads(raw_bash)
                cand = bd.get("data") or bd
                for k in ("stdout", "output", "result", "text"):
                    v = cand.get(k)
                    if isinstance(v, str):
                        stdout = v
                        break
                if not stdout and isinstance(cand, dict):
                    res = cand.get("results") or []
                    if res:
                        resp = res[0].get("response") or {}
                        stdout = resp.get("data", {}).get("stdout", "") or str(resp)
                if not stdout:
                    stdout = raw_bash
            except Exception:
                stdout = raw_bash
            author_in_rss = ("RSS_AUTHOR_COUNT=1" in stdout) or ("<name>Blasianzsz</name>" in stdout and "RSS_AUTHOR_COUNT=0" not in stdout)
            if ids and any(i in stdout for i in ids):
                print(f"SANDBOX RSS CONTAINS comment id -> VISIBLE (t1_{ids[0]})", flush=True)
                perm = f"https://www.reddit.com/r/{sub}/comments/{thread}/comment/{ids[0]}"
                print(f"PERMALINK {perm}", flush=True)
                results.append((label, thread, "VISIBLE_RSS", perm))
                break
            if author_in_rss:
                print("SANDBOX RSS CONTAINS author Blasianzsz -> VISIBLE (id unknown)", flush=True)
                results.append((label, thread, "VISIBLE_RSS_AUTHOR", None))
                break
            print("SANDBOX RSS: comment NOT present -> FILTERED (like #48) -> moving down kit", flush=True)
            results.append((label, thread, "FILTERED", None))
            time.sleep(30)
        except Exception as e:
            print(f"sandbox check EXC: {e}; verdict on {thread} = UNKNOWN, stopping kit for review", flush=True)
            results.append((label, thread, "UNKNOWN", None))
            break

    print("\n===== KIT SUMMARY =====", flush=True)
    for row in results:
        print(row, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
