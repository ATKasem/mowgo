#!/usr/bin/env python3
"""Parse all 6 RSS feeds, list entries <48h old with keyword flags."""
import xml.etree.ElementTree as ET
import re
from datetime import datetime, timezone

ns = {'atom': 'http://www.w3.org/2005/Atom'}
KW = re.compile(r'(soft|app|crm|invoice|billing|schedul|estimating|payment|jobber|yardbook|software|tool|route|manage|client|book|quote|estimate|track)', re.I)

SUBS = ['LawnCarePros', 'lawncare', 'smallbusiness', 'landscaping', 'sweatystartup', 'Entrepreneur']
now = datetime.now(timezone.utc)

for sub in SUBS:
    path = f'/opt/data/mowgo/.tmp_rss/{sub}.xml'
    try:
        tree = ET.parse(path)
    except Exception as e:
        print(f'--- {sub}: PARSE FAIL {e}')
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
        flag = '<<KW' if KW.search(title) else ''
        print(f'{age_h:5.1f}h | {dt.strftime("%m-%d %H:%M")} | {title[:95]} | {url} {flag}')
