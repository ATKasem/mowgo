#!/usr/bin/env python3
"""Probe MowGo payment endpoints for the functions-live check.

Expect: config → 200 JSON; the others → 401 JSON for anonymous calls.
(File name kept so existing ops jobs that run it keep working.)
"""
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
        ("payments-config", "GET", "/api/payments/config", None),
        ("subscription-checkout", "POST", "/api/payments/subscription-checkout", {}),
        ("billing-portal", "POST", "/api/payments/billing-portal", {}),
        ("invoice-link", "POST", "/api/payments/invoice-link", {}),
        ("root", "GET", "/", None),
    ]
    for name, method, path, body in cases:
        status, head = probe(method, path, body)
        print(f"{name}: HTTP {status} | {head!r}")


if __name__ == "__main__":
    main()
