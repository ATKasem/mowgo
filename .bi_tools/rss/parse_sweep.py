#!/usr/bin/env python3
"""Parse all fetched RSS feeds: <48h entries, keyword flags, dedupe vs seen list."""
import xml.etree.ElementTree as ET
import re, json
from datetime import datetime, timezone

ns = {'atom': 'http://www.w3.org/2005/Atom'}
KW = re.compile(r'(soft|app|crm|invoice|billing|schedul|estimating|payment|jobber|yardbook|quoteiq|turfhop|software|tool|route|manage|client|book|quote|estimate|track|text|remind)', re.I)
SUBS = ['LawnCarePros', 'lawncare', 'smallbusiness', 'landscaping', 'sweatystartup', 'Entrepreneur', 'CRM', 'WhichCRM']

try:
    state = json.load(open('/opt/data/mowgo/.bi_state.json'))
    seen = set(state.get('seen_reddit_urls', []))
except Exception:
    seen = set()

now = datetime.now(timezone.utc)
new_urls = []
for sub in SUBS:
    path = f'/opt/data/mowgo/.tmp_rss/{sub}.xml'
    try:
        tree = ET.parse(path)
    except Exception as e:
        print(f'--- r/{sub}: PARSE FAIL {e}')
        continue
    root = tree.getroot()
    entries = root.findall('atom:entry', ns)
    print(f'=== r/{sub}: {len(entries)} entries ===')
    for e in entries:
        title = (e.findtext('atom:title', default='', namespaces=ns) or '').strip()
        link = e.find('atom:link', ns)
        url = link.get('href') if link is not None else '?'
        pub = e.findtext('atom:published', default='', namespaces=ns)
        try:
            dt = datetime.fromisoformat(pub.replace('Z', '+00:00'))
        except Exception:
            dt = None
        if dt is None:
            continue
        age_h = (now - dt).total_seconds() / 3600
        if age_h > 48:
            continue
        is_new = url not in seen
        if is_new:
            new_urls.append(url)
        flag = '<<KW' if KW.search(title) else ''
        nf = 'NEW' if is_new else 'seen'
        print(f'{age_h:5.1f}h | {dt.strftime("%m-%d %H:%M")} | [{nf}] {title[:90]} | {url} {flag}')

print(f'\nTOTAL NEW URLS: {len(new_urls)}')
