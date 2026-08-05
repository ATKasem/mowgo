#!/usr/bin/env python3
"""Post-process SEO static dumps: per-page canonical, OG tags, and app-loader redirect."""
import re
import os

BASE = "https://mowgo.pages.dev"
SEO = "public/seo"

PAGES = {
    "compare": {
        "title": "MowGo vs Jobber, LawnPro, QuoteIQ & more — Honest Comparison (2026)",
        "desc": "Side-by-side pricing and feature comparison of lawn care software. Updated August 2026 from public pricing pages and hands-on testing.",
    },
    "blog/jobber-price-increase-2026": {
        "title": "Jobber Price Increase 2026 — What 1-3 Person Lawn Crews Pay",
        "desc": "Jobber's 2026 pricing changes: Core, Connect, and Grow costs plus per-user fees — and what Oklahoma lawn crews pay instead.",
    },
    "switch-from-lawnpro": {
        "title": "Switch from LawnPro to MowGo — Keep Your Week, Move 5 Clients Free",
        "desc": "Leave LawnPro without losing your week. Move your first 5 clients free. Rain delay auto-reschedule, offline mode, $39 flat pricing.",
    },
    "quoteiq-alternative": {
        "title": "QuoteIQ Alternative for Lawn Care — Free Plan, 5 Clients",
        "desc": "QuoteIQ discontinued its free plan in July 2026. MowGo gives lawn crews a real free tier — rain delay, offline mode, no per-user fees.",
    },
    "compare/ruunly": {
        "title": "Ruunly Real Cost Calculator — $19/mo or $169/mo?",
        "desc": "Ruunly's platform fees add up: $19/mo becomes $119–$269. MowGo Solo is $39 flat with free rain delay. See the real math.",
    },
    "compare/probase": {
        "title": "ProBase vs MowGo — Honest Comparison for Lawn Crews",
        "desc": "ProBase is free — until it rains. No rain delay, no offline mode, no accounting sync. See the full comparison with MowGo.",
    },
    "route-audit": {
        "title": "Free Route Audit for Oklahoma Lawn Care Crews",
        "desc": "Get a free route audit for your lawn care business. See how much drive time and gas you can save with MowGo routing.",
    },
    "privacy": {
        "title": "Privacy Policy — MowGo",
        "desc": "MowGo privacy policy. Your data stays yours — no ads, no selling, no funny business.",
    },
}

for path, meta in PAGES.items():
    fp = os.path.join(SEO, path, "index.html")
    if not os.path.exists(fp):
        print("MISSING", fp)
        continue
    html = open(fp, encoding="utf-8").read()

    # 1. Doctype (outerHTML serialization drops it)
    if not html.lstrip().lower().startswith("<!doctype"):
        html = "<!doctype html>\n" + html

    # 2. Drop the FAQPage schema node (none of these pages is the landing; FAQ lives in / index.html)
    def strip_faq(m):
        try:
            import json as _json
            data = _json.loads(m.group(1))
            graph = data.get("@graph", [])
            data["@graph"] = [n for n in graph if n.get("@type") != "FAQPage"]
            return '<script type="application/ld+json">' + _json.dumps(data, ensure_ascii=False) + "</script>"
        except Exception:
            return m.group(0)
    html = re.sub(r'<script type="application/ld\+json">(.*?)</script>', strip_faq, html, flags=re.S)

    # canonical
    canonical = f'<link rel="canonical" href="{BASE}/{path}" />'
    html = re.sub(r'<link rel="canonical"[^>]*>', "", html)
    html = html.replace("</head>", f"    {canonical}\n  </head>", 1)

    # per-page OG: replace landing OG values
    html = re.sub(r'<meta property="og:title"[^>]*>', f'<meta property="og:title" content="{meta["title"]}" />', html)
    html = re.sub(r'<meta property="og:description"[^>]*>', f'<meta property="og:description" content="{meta["desc"]}" />', html)
    html = re.sub(r'<meta property="og:url"[^>]*>', f'<meta property="og:url" content="{BASE}/{path}" />', html)
    html = re.sub(r'<meta property="og:image:width"[^>]*>', '<meta property="og:image:width" content="1536" />', html)
    html = re.sub(r'<meta property="og:image:height"[^>]*>', '<meta property="og:image:height" content="643" />', html)
    html = re.sub(r'<meta name="twitter:title"[^>]*>', f'<meta name="twitter:title" content="{meta["title"]}" />', html)
    html = re.sub(r'<meta name="twitter:description"[^>]*>', f'<meta name="twitter:description" content="{meta["desc"]}" />', html)

    # ensure title + description are per-page
    html = re.sub(r"<title>[^<]*</title>", f"<title>{meta['title']}</title>", html, count=1)
    html = re.sub(r'<meta name="description"[^>]*>', f'<meta name="description" content="{meta["desc"]}" />', html, count=1)

    # loader: redirect humans to the hash app after the static snapshot is visible
    loader = (
        f'<script>if(location.pathname!==\'/\'){{'
        f'setTimeout(function(){{location.replace(\'/#/{path}\');}},1600);'
        f'}}</script>'
    )
    html = re.sub(r"<script>if\(location\.pathname[^<]*</script>", "", html)
    html = html.replace("</body>", f"    {loader}\n  </body>", 1)

    open(fp, "w", encoding="utf-8").write(html)
    print("processed", path, f"({len(html)} chars)")
print("Done.")
