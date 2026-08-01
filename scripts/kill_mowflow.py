#!/usr/bin/env python3
"""Delete all Cloudflare Pages deployments for the mowflow project, then the project itself."""
import json, os, urllib.request, urllib.error

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
ACC = "8afa5f5ee7ebd9ed528e91aedf6f6286"
BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACC}/pages/projects/mowflow"

def req(method, url, body=None):
    r = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}

# paginate through ALL deployments
all_deps = []
page = 1
while True:
    s, d = req("GET", f"{BASE}/deployments?page={page}&per_page=50")
    deps = d.get("result") or []
    if not deps:
        break
    all_deps.extend(deps)
    if len(deps) < 50:
        break
    page += 1
print("total deployments found:", len(all_deps), flush=True)

# delete all, oldest first (active/latest last so it has no fallback target)
for dep in sorted(all_deps, key=lambda x: x.get("created_on", "")):
    s, _ = req("DELETE", f"{BASE}/deployments/{dep['id']}")
    print(f"  del {dep['id'][:8]} -> {s}", flush=True)

# now delete the project itself
s, d = req("DELETE", BASE)
print("DELETE project ->", s, d.get("success"), d.get("errors"), flush=True)
