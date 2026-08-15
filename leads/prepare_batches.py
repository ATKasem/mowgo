#!/usr/bin/env python3
"""
Aggressive email finder - processes all leads efficiently.
For each lead:
1. Try main website
2. Try /contact page
3. Use web_search as fallback
"""
import json
import re
import os
from datetime import datetime

RESULTS_FILE = '/opt/data/mowgo/leads/manta_emails_batch2.json'
LEADS_FILE = '/opt/data/mowgo/leads/needs_email_filtered_clean.json'

JUNK_DOMAINS = [
    'example.com', 'test.com', 'sentry.io', 'wixpress.com', 'w3.org',
    'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
    'twitter.com', 'instagram.com', 'youtube.com', 'cloudflare.com',
    'wordpress.org', 'wordpress.com', 'jsdelivr.net', 'github.com',
    'wix.com', 'squarespace.com', 'weebly.com', 'godaddy.com',
    'mailchimp.com', 'constantcontact.com', 'akamai.net', 'cloudfront.net',
    'proteusthemes.com', 'developer.mozilla.org', 'bootstrapcdn.com',
    'jquery.com', 'cloudflareinsights.com', 'gstatic.com'
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

def find_best_email(emails):
    if not emails:
        return None, None
    for prefix in ['info@', 'contact@', 'office@', 'hello@', 'admin@', 'support@', 'sales@']:
        for e in emails:
            if e.startswith(prefix):
                return e, 'website_contact_page'
    return emails[0], 'website_scrape'

def get_contact_urls(website):
    """Generate contact page URLs to try."""
    base = website.rstrip('/')
    urls = [
        base + '/contact',
        base + '/contact-us',
        base + '/about',
        base + '/about-us',
        base + '/contact.html',
    ]
    return urls

def process_fetch_results(leads, fetch_results, source_type='main'):
    """Process fetch results for a batch of leads."""
    results = {}
    for lead, fetch_result in zip(leads, fetch_results):
        url = lead['website']
        if url not in results:
            results[url] = {
                'lead': lead,
                'emails_found': [],
                'fetch_status': 'pending'
            }
        
        if isinstance(fetch_result, dict) and fetch_result.get('content_ok'):
            content_list = fetch_result.get('content', [])
            content = ' '.join(content_list) if isinstance(content_list, list) else str(content_list)
            emails = extract_emails(content)
            results[url]['emails_found'].extend(emails)
            results[url]['fetch_status'] = 'success'
        else:
            if results[url]['fetch_status'] == 'pending':
                results[url]['fetch_status'] = 'failed'
    
    return results

def main():
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
    
    # Generate batches for processing
    batch_size = 10
    batches = []
    for i in range(0, len(unprocessed), batch_size):
        batch = unprocessed[i:i+batch_size]
        batches.append(batch)
    
    print(f"Total batches: {len(batches)}")
    
    # Save batch info
    batch_info = {
        'batches': [],
        'total_batches': len(batches)
    }
    for i, batch in enumerate(batches):
        urls = [l['website'] for l in batch]
        contact_urls = []
        for l in batch:
            contact_urls.extend(get_contact_urls(l['website']))
        
        batch_info['batches'].append({
            'batch_num': i,
            'leads': batch,
            'urls': urls,
            'contact_urls': contact_urls[:5]  # Limit contact URLs
        })
    
    with open('/opt/data/mowgo/leads/batch_info.json', 'w') as f:
        json.dump(batch_info, f, indent=2)
    
    print(f"\nBatch info saved to batch_info.json")
    print(f"\nFirst batch URLs:")
    for url in batch_info['batches'][0]['urls']:
        print(f"  {url}")

if __name__ == '__main__':
    main()
