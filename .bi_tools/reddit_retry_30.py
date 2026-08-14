#!/usr/bin/env python3
import json, urllib.request, os, re, sys, time

KEY = os.environ.get("MCP_COMPOSIO_API_KEY", "").strip()
URL = "https://connect.composio.dev/mcp"

def rpc(method, params, session=None, rid=1):
    body = json.dumps({"jsonrpc": "2.0", "id": rid, "method": method, "params": params}).encode()
    req = urllib.request.Request(URL, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json, text/event-stream")
    req.add_header("x-consumer-api-key", KEY)
    if session: req.add_header("Mcp-Session-Id", session)
    with urllib.request.urlopen(req, timeout=90) as resp:
        session = resp.headers.get("Mcp-Session-Id") or session
        data = resp.read().decode()
    result = None
    for line in data.splitlines():
        if line.startswith("data: "): result = json.loads(line[6:])
    return result, session

TEXT = """don't pay for one yet. i started my lawn thing the same way, spreadsheet and calendar reminders, it works until it doesn't. the flip hits around 15-20 regular clients, when you start forgetting to invoice or a weekly customer slips a week and you don't catch it for a month. that's when the money starts leaking and a $40-50 tool pays for itself.

when you get there, the only features that matter solo are recurring schedules that auto-build your route and an invoice that goes out the second the job's done with a pay link. everything else is noise until you hire.

how many yards a week are you realistically aiming for season one?"""

print("sleeping 600s for cooldown...", flush=True)
time.sleep(600)

init, session = rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "hermes-retry", "version": "1.0"}})
_, session = rpc("notifications/initialized", {}, session, rid=2)

for attempt in range(1, 5):
    res, session = rpc("tools/call", {
        "name": "COMPOSIO_MULTI_EXECUTE_TOOL",
        "arguments": {"tools": [{"tool_slug": "REDDIT_POST_REDDIT_COMMENT", "arguments": {"thing_id": "t3_1vcr90y", "text": TEXT}}], "memory": {}, "session_id": None}
    }, session, rid=3)
    txt = res["result"]["content"][0]["text"]
    d = json.loads(txt)
    r = d.get("data", {}).get("results", [{}])[0].get("response", {})
    ok = r.get("successful", False)
    print(f"attempt {attempt} successful: {ok}", flush=True)
    if not ok:
        msg = str(r.get("message") or r.get("error") or "")[:150]
        print("err:", msg, flush=True)
        m = re.search(r"(\d+) minute\(s\) and (\d+) second", msg)
        if m:
            wait = int(m.group(1))*60 + int(m.group(2)) + 60
            print(f"waiting {wait}s...", flush=True)
            time.sleep(wait)
            continue
        time.sleep(120)
        continue
    # success — verify visibility
    time.sleep(5)
    res2, session = rpc("tools/call", {
        "name": "COMPOSIO_MULTI_EXECUTE_TOOL",
        "arguments": {"tools": [{"tool_slug": "REDDIT_RETRIEVE_POST_COMMENTS", "arguments": {"article": "1vcr90y", "limit": 100}}], "memory": {}, "session_id": None}
    }, session, rid=4)
    s2 = json.dumps(json.loads(res2["result"]["content"][0]["text"]))
    idx = s2.find('"author": "Blasianzsz"')
    if idx > 0:
        seg = s2[max(0,idx-300):idx+150]
        names = re.findall(r'"name": "(t1_[a-z0-9]+)"', seg)
        bodies = re.findall(r'"body": "([^"]{0,60})', seg)
        cid = (names[-1] if names else "?").split("_")[1]
        print(f"VISIBLE ✅ comment id t1_{cid}", flush=True)
        print(f"permalink: https://www.reddit.com/r/CRM/comments/1vcr90y/comment/{cid}", flush=True)
    else:
        print("POSTED but NOT VISIBLE in listing (possible removal)", flush=True)
    sys.exit(0)

print("GAVE UP after 4 attempts", flush=True)
sys.exit(1)
