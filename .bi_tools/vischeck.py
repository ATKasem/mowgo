#!/usr/bin/env python3
"""Verify visibility of u/Blasianzsz comments on 1vcr90y + 1ve82mp via public comment listing."""
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

init, session = rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "hermes-vischeck", "version": "1.0"}})
_, session = rpc("notifications/initialized", {}, session, rid=2)

for article, target in [("1vcr90y", "p19x1fo"), ("1ve82mp", "p1j4w02")]:
    print(f"=== {article}: looking for {target} ===", flush=True)
    try:
        res, session = rpc("tools/call", {
            "name": "COMPOSIO_MULTI_EXECUTE_TOOL",
            "arguments": {"tools": [{"tool_slug": "REDDIT_RETRIEVE_POST_COMMENTS", "arguments": {"article": article, "limit": 100}}], "memory": {}, "session_id": None}
        }, session, rid=3)
        s = json.dumps(json.loads(res["result"]["content"][0]["text"]))
        found = target in s
        author_hits = [m.start() for m in re.finditer(r'"author": "Blasianzsz"', s)]
        print(f"target id present: {found}; Blasianzsz author hits: {len(author_hits)}", flush=True)
        for idx in author_hits[:5]:
            seg = s[max(0,idx-400):idx+200]
            names = re.findall(r'"name": "(t1_[a-z0-9]+)"', seg)
            cid = (names[-1] if names else "?").split("_")[1]
            print(f"  author hit -> comment id t1_{cid}", flush=True)
        if found:
            idx = s.find(target)
            seg = s[max(0,idx-200):idx+100]
            body = re.findall(r'"body": "([^"]{0,80})', seg)
            print(f"  body snippet: {body[-1] if body else 'n/a'}", flush=True)
    except Exception as e:
        print(f"  ERROR: {e}", flush=True)
    time.sleep(8)
print("DONE", flush=True)
