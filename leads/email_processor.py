import json
import re
import os

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
        'sentry-next.wixpress.com', 'sentry.io', 'proteusthemes.com',
        'developer.mozilla.org', 'bootstrapcdn.com', 'jquery.com',
        'cloudflareinsights.com', 'gstatic.com', 'googletagmanager.com',
        'google-analytics.com', 'googlesyndication.com', 'googleadservices.com',
        'doubleclick.net', 'amazonaws.com', 'stripe.com', 'paypal.com'
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

def find_email_in_content(content, business_name=''):
    """Find best email from content."""
    emails = extract_emails_from_text(content)
    if not emails:
        return None, None
    
    # Prioritize common business email patterns
    priority_prefixes = ['info@', 'contact@', 'office@', 'hello@', 'admin@', 'support@', 'sales@']
    for prefix in priority_prefixes:
        for email in emails:
            if email.startswith(prefix):
                return email, 'website_contact_page'
    
    # Try to find email that matches business name
    if business_name:
        name_parts = business_name.lower().replace("'", "").replace(".", "").replace(",", "").split()
        for email in emails:
            for part in name_parts:
                if len(part) > 3 and part in email:
                    return email, 'website_business_email'
    
    # Return first clean email
    return emails[0], 'website_scrape'

def save_results(results, filepath):
    """Save results to file."""
    with open(filepath, 'w') as f:
        json.dump({"leads": results}, f, indent=2)

# Load leads
with open('/opt/data/mowgo/leads/needs_email_filtered_clean.json') as f:
    leads = json.load(f)

print(f"Loaded {len(leads)} leads to process")

# Check if we have partial results
results_file = '/opt/data/mowgo/leads/manta_emails_batch2.json'
existing_results = []
processed_urls = set()

if os.path.exists(results_file):
    with open(results_file) as f:
        existing_data = json.load(f)
        existing_results = existing_data.get('leads', [])
        processed_urls = {r['website'] for r in existing_results}
        print(f"Found {len(existing_results)} existing results")

# Filter to unprocessed leads
unprocessed = [l for l in leads if l['website'] not in processed_urls]
print(f"Unprocessed leads: {len(unprocessed)}")

# Print batch info
batch_size = 5
total_batches = (len(unprocessed) + batch_size - 1) // batch_size
print(f"Will process in {total_batches} batches of {batch_size}")
print(f"\nFirst 5 unprocessed:")
for l in unprocessed[:5]:
    print(f"  {l['business']} | {l['website']}")
