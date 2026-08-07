#!/usr/bin/env python3
"""Post banked reply draft on r/smallbusiness thread 1vhv10k (friend-mode, no brand),
then verify visibility via public comment listing (API success != visible; #48 was filtered).

Usage: python3 post_reply_1vhv10k.py
"""
import json, urllib.request, os, re, sys, time

KEY = os.environ.get("MCP_COMPOSIO_API_KEY", "").strip()
URL = "https://connect.composio.dev/mcp"

TEXT = """For a 2-truck mobile business, that dropdown is config, not custom dev — $2,400 is vendor-lock pricing. Real market: dedicated field-service apps run $29-79/mo for a solo/small crew and handle two-employee availability natively; Square Appointments runs ~$150/location. The $379/mo bundle is mostly hosting + email + hand-holding. If he owns the site files, he can split hosting (any registrar, ~$15-25/mo) from booking and keep both for less than half what he pays now. Just don't move mid-season, and make sure the new provider will port his client data before you cancel anything."""

THREAD = "1vhv10k"


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
    return r, session


def main():
    if not KEY:
        print("FATAL: MCP_COMPOSIO_API_KEY not set", flush=True)
        return 1

    init, session = rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "hermes-1vhv10k", "version": "1.0"}})
    _, session = rpc("notifications/initialized", {}, session, rid=2)

    for attempt in range(1, 5):
        r, session = call_tool("REDDIT_POST_REDDIT_COMMENT", {"thing_id": f"t3_{THREAD}", "text": TEXT}, session, rid=3)
        ok = r.get("successful", False)
        print(f"attempt {attempt} successful: {ok}", flush=True)
        if not ok:
            msg = str(r.get("message") or r.get("error") or "")[:200]
            print("err:", msg, flush=True)
            m = re.search(r"(\d+) minute\(s\) and (\d+) second", msg)
            if m:
                wait = int(m.group(1)) * 60 + int(m.group(2)) + 60
                print(f"waiting {wait}s...", flush=True)
                time.sleep(wait)
                continue
            time.sleep(120)
            continue

        # success — verify visibility
        time.sleep(5)
        r2, session = call_tool("REDDIT_RETRIEVE_POST_COMMENTS", {"article": THREAD, "limit": 100}, session, rid=4)
        s = json.dumps(r2)
        idx = s.find('"author": "Blasianzsz"')
        if idx > 0:
            seg = s[max(0, idx - 300):idx + 150]
            names = re.findall(r'"name": "(t1_[a-z0-9]+)"', seg)
            bodies = re.findall(r'"body": "([^"]{0,60})', seg)
            cid = (names[-1] if names else "?").split("_")[1]
            print(f"VISIBLE OK comment id t1_{cid}", flush=True)
            print(f"permalink: https://www.reddit.com/r/smallbusiness/comments/{THREAD}/comment/{cid}", flush=True)
        else:
            print("POSTED but NOT VISIBLE in listing (possible AutoMod filter) — needs manual paste", flush=True)
            return 2
        return 0

    print("GAVE UP after 4 attempts", flush=True)
    return 1


if __name__ == "__main__":
    sys.exit(main())
