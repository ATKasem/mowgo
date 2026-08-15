#!/usr/bin/env python3
"""
Comprehensive batch email finder.
Processes leads in batches of 10, extracts emails.
Uses smart_fetch results passed as JSON.
"""
import json
import re
import os
from datetime import datetime

RESULTS_FILE = '/opt/data/mowgo/leads/manta_emails_batch2.json'

JUNK_DOMAINS = [
    'example.com', 'test.com', 'sentry.io', 'wixpress.com', 'w3.org',
    'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
    'twitter.com', 'instagram.com', 'youtube.com', 'cloudflare.com',
    'wordpress.org', 'wordpress.com', 'jsdelivr.net', 'github.com',
    'wix.com', 'squarespace.com', 'weebly.com', 'godaddy.com',
    'mailchimp.com', 'constantcontact.com', 'mailgun.org',
    'proteusthemes.com', 'developer.mozilla.org', 'bootstrapcdn.com',
    'jquery.com', 'cloudflareinsights.com', 'gstatic.com',
    'googletagmanager.com', 'google-analytics.com', 'akamai.net',
    'cloudfront.net', 'azureedge.net', 'secureserver.net'
]

def extract_emails(text):
    """Extract valid emails from text."""
    if not text:
        return []
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text.lower())
    clean = []
    for e in emails:
        skip = False
        for d in JUNK_DOMAINS:
            if d in e:
                skip = True
                break
        if not skip and len(e) > 6:
            clean.append(e)
    return list(set(clean))

def find_best_email(emails):
    """Pick the best business email."""
    if not emails:
        return None, None
    for prefix in ['info@', 'contact@', 'office@', 'hello@', 'admin@', 'support@', 'sales@']:
        for e in emails:
            if e.startswith(prefix):
                return e, 'website_contact_page'
    return emails[0], 'website_scrape'

def process_fetch_result(lead, fetch_result):
    """Process a single fetch result for a lead."""
    content = ''
    if isinstance(fetch_result, dict):
        if fetch_result.get('content_ok'):
            content_list = fetch_result.get('content', [])
            if isinstance(content_list, list):
                content = ' '.join(content_list)
            else:
                content = str(content_list)
    
    emails = extract_emails(content)
    email, source = find_best_email(emails)
    
    return {
        "business": lead.get('business', ''),
        "city": lead.get('city', ''),
        "state": lead.get('state', ''),
        "phone": lead.get('phone', ''),
        "website": lead.get('website', ''),
        "email": email or "",
        "source": "Manta.com",
        "verified_email": bool(email),
        "email_source": source or "",
        "fetch_status": "success" if content else "failed"
    }

def save_results(results):
    """Save results to file."""
    with open(RESULTS_FILE, 'w') as f:
        json.dump({
            "leads": results,
            "updated_at": datetime.now().isoformat(),
            "stats": {
                "total": len(results),
                "with_email": sum(1 for r in results if r.get('email')),
                "failed_fetch": sum(1 for r in results if r.get('fetch_status') == 'failed')
            }
        }, f, indent=2)

def load_results():
    """Load existing results."""
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE) as f:
            data = json.load(f)
            return data.get('leads', [])
    return []

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python3 comprehensive_processor.py <leads_json> <fetch_results_json>")
        sys.exit(1)
    
    # Load leads
    with open(sys.argv[1]) as f:
        leads = json.load(f)
    
    # Load fetch results
    with open(sys.argv[2]) as f:
        fetch_results = json.load(f)
    
    # Load existing results
    existing = load_results()
    processed_urls = {r['website'] for r in existing}
    
    # Process new results
    new_results = []
    for lead, fetch_result in zip(leads, fetch_results):
        if lead['website'] not in processed_urls:
            result = process_fetch_result(lead, fetch_result)
            new_results.append(result)
    
    # Combine
    all_results = existing + new_results
    
    # Save
    save_results(all_results)
    
    # Print stats
    total_with_email = sum(1 for r in all_results if r.get('email'))
    print(f"Total processed: {len(all_results)}")
    print(f"Total with email: {total_with_email}")
    print(f"New results: {len(new_results)}")
    print(f"New emails found: {sum(1 for r in new_results if r.get('email'))}")
