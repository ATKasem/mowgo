#!/usr/bin/env python3
"""Print OP text + comment count + top comments from a Reddit thread RSS dump."""
import xml.etree.ElementTree as ET
import sys, re
from datetime import datetime, timezone

ns = {'atom': 'http://www.w3.org/2005/Atom'}
now = datetime.now(timezone.utc)

def clean(t):
    return re.sub(r'\s+', ' ', (t or '')).strip()

for path in sys.argv[1:]:
    print(f"\n{'='*80}\nFILE: {path}")
    try:
        tree = ET.parse(path)
    except Exception as e:
        print(f'PARSE FAIL {e}'); continue
    root = tree.getroot()
    entries = root.findall('atom:entry', ns)
    print(f'entries: {len(entries)}')
    for i, e in enumerate(entries):
        title = clean(e.findtext('atom:title', default='', namespaces=ns))
        pub = e.findtext('atom:published', default='', namespaces=ns)
        author = clean(e.findtext('atom:author/atom:name', default='', namespaces=ns))
        content = clean(e.findtext('atom:content', default='', namespaces=ns))
        try:
            dt = datetime.fromisoformat(pub.replace('Z', '+00:00'))
            age = f'{(now - dt).total_seconds()/3600:.1f}h'
        except Exception:
            age = '??'
        # strip html tags for readability
        text = re.sub(r'<[^>]+>', ' ', content)
        text = clean(text)
        marker = ' [OP]' if i == 0 else ''
        print(f'--- {age}{marker} u/{author}: {title}')
        print(f'    {text[:700]}')
