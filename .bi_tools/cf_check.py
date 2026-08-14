#!/usr/bin/env python3
"""Check Cloudflare Pages project mowgo env vars (settle health-check contradiction)."""
import json
import os
import urllib.request

TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN") or os.environ.get("CF_API_TOKEN", "")
BASE = "https://api.cloudflare.com/client/v4"


def get(path):
    req = urllib.request.Request(
        BASE + path, headers={"Authorization": "Bearer " + TOKEN}
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def main():
    if not TOKEN:
        print("NO TOKEN")
        return 1
    acct = get("/accounts?per_page=1")
    if not acct.get("success"):
        print("ACCOUNT ERR:", acct.get("errors"))
        return 1
    aid = acct["result"][0]["id"]
    d = get(f"/accounts/{aid}/pages/projects/mowgo")
    if not d.get("success"):
        print("PROJECT ERR:", d.get("errors"))
        return 1
    r = d["result"]
    dc = r.get("deployment_configs", {}).get("production", {})
    ev = dc.get("env_vars", {})
    proj_ev = r.get("env_vars", {})
    print("project:", r.get("name"), "| latest deploy:", (r.get("latest_deployment") or {}).get("id"))
    print("production deployment env_vars (%d): %s" % (len(ev), sorted(ev.keys()) if ev else "EMPTY"))
    print("project-level env_vars (%d): %s" % (len(proj_ev), sorted(proj_ev.keys()) if proj_ev else "EMPTY"))
    print("last_deployment created:", (r.get("latest_deployment") or {}).get("created_on"))
    print("last_deployment source:", (r.get("latest_deployment") or {}).get("source"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
