#!/usr/bin/env python3
"""Probe MowGo Stripe endpoints for the functions-live check (expect 401 JSON)."""
import json
import urllib.request
import urllib.error

BASE = "https://mowgo.pages.dev"


def probe(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    )
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            head = r.read(200).decode(errors="replace")[:120]
            return r.status, head
    except urllib.error.HTTPError as e:
        head = e.read(200).decode(errors="replace")[:120]
        return e.code, head
    except Exception as e:
        return "ERR", str(e)[:120]


def main():
    cases = [
        ("checkout-subscription", "POST", "/api/stripe/checkout-subscription", {}),
        ("verify-session", "GET", "/api/stripe/verify-session?session_id=cs_test_dummy", None),
        ("create-portal-session", "POST", "/api/stripe/create-portal-session", {}),
        ("root", "GET", "/", None),
    ]
    for name, method, path, body in cases:
        status, head = probe(method, path, body)
        print(f"{name}: HTTP {status} | {head!r}")


if __name__ == "__main__":
    main()
