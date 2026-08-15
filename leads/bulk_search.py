#!/usr/bin/env python3
"""
Bulk email finder using web_search.
Processes all leads by searching for their contact information.
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

def process_search_results(lead, search_results):
    """Process web search results for a lead."""
    all_text = ''
    if isinstance(search_results, dict):
        web_results = search_results.get('data', {}).get('web', [])
        for r in web_results:
            all_text += ' ' + str(r.get('description', ''))
            all_text += ' ' + str(r.get('title', ''))
    
    emails = extract_emails(all_text)
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
        "email_source": source or "web_search",
        "fetch_status": "search_success" if email else "search_no_email"
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
                "search_success": sum(1 for r in results if r.get('fetch_status') == 'search_success'),
                "search_no_email": sum(1 for r in results if r.get('fetch_status') == 'search_no_email')
            }
        }, f, indent=2)

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
    
    # Generate search queries for next batch
    batch_size = 10
    batch = unprocessed[:batch_size]
    
    queries = []
    for lead in batch:
        name = lead.get('business', '')
        city = lead.get('city', '')
        state = lead.get('state', '')
        query = f"{name} {city} {state} email contact"
        queries.append({
            'lead': lead,
            'query': query
        })
    
    print(f"\nGenerated {len(queries)} search queries:")
    for q in queries[:5]:
        print(f"  {q['query']}")
    
    # Save queries for processing
    with open('/tmp/search_queries.json', 'w') as f:
        json.dump(queries, f, indent=2)
    
    print(f"\nQueries saved to /tmp/search_queries.json")

if __name__ == '__main__':
    main()
