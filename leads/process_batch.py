import json
import re
import sys

def extract_emails_from_text(text):
    """Extract email addresses from text, preferring business-relevant ones."""
    if not text:
        return None, None
    
    # Find all emails
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    all_emails = re.findall(email_pattern, text.lower())
    
    # Filter out common junk
    junk_patterns = [
        'example.com', 'test.com', 'sentry.io', 'wixpress.com', 'w3.org',
        'schema.org', 'googleapis.com', 'google.com', 'facebook.com',
        'twitter.com', 'instagram.com', 'youtube.com', 'cloudflare.com',
        'wordpress.org', 'wordpress.com', 'jquery', 'jsdelivr.net',
        'github.com', 'wix.com', 'squarespace.com', 'weebly.com',
        'godaddy.com', 'mailchimp.com', 'constantcontact.com',
        'no-reply', 'noreply', 'donotreply', 'mailer-daemon',
        'postmaster', 'abuse@', 'hostmaster', 'webmaster@',
        '.png', '.jpg', '.gif', '.svg', '.css', '.js',
        'cdn.', 'static.', 'assets.', 'media.', 'img.',
        'support.google', 'support@goog', 'accounts.google',
        'www.w3', 'xmlns', 'og:', 'twitter:'
    ]
    
    clean_emails = []
    for email in all_emails:
        skip = False
        for junk in junk_patterns:
            if junk in email:
                skip = True
                break
        if not skip:
            clean_emails.append(email)
    
    if not clean_emails:
        return None, None
    
    # Prioritize common business email patterns
    priority_prefixes = ['info@', 'contact@', 'office@', 'hello@', 'admin@', 'support@', 'sales@']
    for prefix in priority_prefixes:
        for email in clean_emails:
            if email.startswith(prefix):
                return email, 'website_contact_page'
    
    # Return first clean email
    return clean_emails[0], 'website_scrape'

def process_batch(leads_batch):
    """Process a batch of leads and return results."""
    urls = [l['website'] for l in leads_batch]
    results = []
    
    for i, lead in enumerate(leads_batch):
        url = lead['website']
        email = None
        email_source = None
        status = 'no_email'
        
        # We'll mark for web_search fallback
        results.append({
            'lead': lead,
            'email': None,
            'email_source': None,
            'status': 'needs_fetch',
            'url': url
        })
    
    return results

if __name__ == '__main__':
    with open('/opt/data/mowgo/leads/needs_email_filtered.json') as f:
        leads = json.load(f)
    
    # Skip big chains
    skip_names = ['trugreen', 'lawnstarter', 'lawndoctor', 'wikilawn', 'greenpal']
    filtered = []
    for l in leads:
        name_lower = l.get('business', '').lower()
        skip = False
        for s in skip_names:
            if s in name_lower:
                skip = True
                break
        if not skip:
            # Skip facebook/adt/gov sites
            website = l.get('website', '').lower()
            if 'facebook.com' in website or 'help.adt.com' in website or 'farmers.gov' in website or 'gov' in website:
                skip = True
        if not skip:
            filtered.append(l)
    
    print(f"After filtering chains/bad URLs: {len(filtered)} leads")
    
    # Save filtered list
    with open('/opt/data/mowgo/leads/needs_email_filtered_clean.json', 'w') as f:
        json.dump(filtered, f, indent=2)
    
    # Print first 10
    for i, l in enumerate(filtered[:10]):
        print(f"  {i+1}. {l['business']} | {l['website']}")
