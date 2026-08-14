#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import re
from datetime import datetime, timezone

ns = {'atom': 'http://www.w3.org/2005/Atom'}
KW = re.compile(r'(soft|crm|invoice|billing|schedul|estimat|payment|jobber|yardbook|app\b|tool|route|client|book|pricing|quote)', re.I)

for sub in ['LawnCarePros', 'smallbusiness']:
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
            hours = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
            age = f'{hours:.0f}h'
        except Exception:
            dt, age = None, '??'
        flag = '<<KW' if KW.search(title) else ''
        print(f'{age:>5} | {dt.strftime("%m-%d %H:%M") if dt else "??"} | {title[:95]} | {url.split("comments/")[-1][:12]} {flag}')
