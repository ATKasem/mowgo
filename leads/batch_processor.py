#!/usr/bin/env python3
"""
Batch email finder for lawn care leads.
Processes leads in batches, extracts emails from websites.
Saves progress incrementally.
"""
import json
import re
import os
import sys
import time
from datetime import datetime

RESULTS_FILE = '/opt/data/mowgo/leads/manta_emails_batch2.json'
LEADS_FILE = '/opt/data/mowgo/leads/needs_email_filtered_clean.json'
PROGRESS_FILE = '/opt/data/mowgo/leads/batch2_progress.json'

def extract_emails_from_text(text):
    """Extract email addresses from text, preferring business-relevant ones."""
    if not text:
        return []
    
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    all_emails = re.findall(email_pattern, text.lower())
    
    junk_domains = [
        'example.com', 'test.com', 'sentry.io', 'wixpress.com', 'w3.org',
        'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
        'twitter.com', 'instagram.com', 'youtube.com', 'cloudflare.com',
        'wordpress.org', 'wordpress.com', 'jsdelivr.net', 'github.com',
        'wix.com', 'squarespace.com', 'weebly.com', 'godaddy.com',
        'mailchimp.com', 'constantcontact.com', 'mailgun.org',
        'sentry-next.wixpress.com', 'proteusthemes.com',
        'developer.mozilla.org', 'bootstrapcdn.com', 'jquery.com',
        'cloudflareinsights.com', 'gstatic.com', 'googletagmanager.com',
        'google-analytics.com', 'googlesyndication.com', 'googleadservices.com',
        'doubleclick.net', 'amazonaws.com', 'stripe.com', 'paypal.com',
        'akamai.net', 'akamaihd.net', 'edgecastcdn.net', 'fastly.net',
        'cloudfront.net', 'azureedge.net', 'secureserver.net'
    ]
    
    junk_prefixes = ['noreply', 'no-reply', 'donotreply', 'mailer-daemon', 'postmaster', 'abuse@', 'hostmaster']
    
    clean_emails = []
    for email in all_emails:
        skip = False
        for domain in junk_domains:
            if domain in email:
                skip = True
                break
        if not skip:
            for prefix in junk_prefixes:
                if email.startswith(prefix):
                    skip = True
                    break
        if not skip and len(email) > 6:
            clean_emails.append(email)
    
    return list(set(clean_emails))

def find_best_email(emails, business_name=''):
    """Find best email from list."""
    if not emails:
        return None, None
    
    priority_prefixes = ['info@', 'contact@', 'office@', 'hello@', 'admin@', 'support@', 'sales@']
    for prefix in priority_prefixes:
        for email in emails:
            if email.startswith(prefix):
                return email, 'website_contact_page'
    
    if business_name:
        name_parts = business_name.lower().replace("'", "").replace(".", "").replace(",", "").split()
        for email in emails:
            for part in name_parts:
                if len(part) > 3 and part in email:
                    return email, 'website_business_email'
    
    return emails[0], 'website_scrape'

def load_leads():
    """Load leads from file."""
    with open(LEADS_FILE) as f:
        return json.load(f)

def load_results():
    """Load existing results."""
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE) as f:
            return json.load(f).get('leads', [])
    return []

def save_results(results):
    """Save results to file."""
    with open(RESULTS_FILE, 'w') as f:
        json.dump({"leads": results, "updated_at": datetime.now().isoformat()}, f, indent=2)

def save_progress(progress):
    """Save progress to file."""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

def main():
    leads = load_leads()
    existing = load_results()
    processed_urls = {r['website'] for r in existing}
    
    unprocessed = [l for l in leads if l['website'] not in processed_urls]
    
    print(f"Total leads: {len(leads)}")
    print(f"Already processed: {len(existing)}")
    print(f"Unprocessed: {len(unprocessed)}")
    
    # Save progress
    save_progress({
        "total": len(leads),
        "processed": len(existing),
        "remaining": len(unprocessed),
        "updated_at": datetime.now().isoformat()
    })
    
    # Print next batch
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    next_batch = unprocessed[:batch_size]
    
    print(f"\nNext batch ({batch_size} leads):")
    for i, l in enumerate(next_batch):
        print(f"  {i+1}. {l['business']} | {l['website']}")
    
    # Output URLs for batch processing
    urls = [l['website'] for l in next_batch]
    print(f"\nURLS_TO_FETCH:{json.dumps(urls)}")
    print(f"BATCH_DATA:{json.dumps(next_batch)}")

if __name__ == '__main__':
    main()
