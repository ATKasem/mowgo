
import json
import re
import os
from datetime import datetime

LEADS_FILE = '/opt/data/mowgo/leads/needs_email_filtered_clean.json'
RESULTS_FILE = '/opt/data/mowgo/leads/manta_emails_batch2.json'

JUNK_DOMAINS = [
    'example.com', 'test.com', 'sentry.io', 'wixpress.com', 'w3.org',
    'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
    'twitter.com', 'instagram.com', 'youtube.com', 'cloudflare.com',
    'wordpress.org', 'wordpress.com', 'jsdelivr.net', 'github.com',
    'wix.com', 'squarespace.com', 'weebly.com', 'godaddy.com',
    'mailchimp.com', 'constantcontact.com', 'akamai.net', 'cloudfront.net'
]

def extract_emails(text):
    if not text:
        return []
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text.lower())
    clean = []
    for e in emails:
        skip = any(d in e for d in JUNK_DOMAINS)
        if not skip and len(e) > 6:
            clean.append(e)
    return list(set(clean))

# Load leads
with open(LEADS_FILE) as f:
    leads = json.load(f)

# Load existing results
existing = []
if os.path.exists(RESULTS_FILE):
    with open(RESULTS_FILE) as f:
        existing = json.load(f).get('leads', [])

processed_urls = {r['website'] for r in existing}
unprocessed = [l for l in leads if l['website'] not in processed_urls]

print(f"Total: {len(leads)}, Processed: {len(existing)}, Remaining: {len(unprocessed)}")

# Save batch info for processing
batch = unprocessed[:10]
urls = [l['website'] for l in batch]

with open('/tmp/current_batch.json', 'w') as f:
    json.dump({"leads": batch, "urls": urls}, f)

print(f"Batch of {len(batch)} leads ready")
for l in batch:
    print(f"  {l['business']} | {l['website']}")
