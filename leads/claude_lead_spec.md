# Find Lawn Care Leads with Emails (Outside Oklahoma)

## Goal
Find 200+ lawn care/landscaping business leads with email addresses, outside of Oklahoma. Save to /opt/data/mowgo/leads/claude_leads.json.

## Existing leads to avoid duplicating
Load /opt/data/mowgo/leads/email_verified_leads.json (991 leads) and /opt/data/mowgo/leads/hound_fresh_leads.json (112 leads). Do NOT include any business already in either file.

## How to find leads
1. Search Google for "lawn care landscaping contractors directory [state] email"
2. Try states: Texas, Georgia, Florida, North Carolina, South Carolina, Tennessee, Virginia, Alabama, Missouri, Illinois, Indiana, Ohio, Michigan, Pennsylvania, Colorado, Arizona, Washington, Oregon
3. Look for chamber of commerce directories, state landscape association directories, BBB listings, or any business directory that lists emails
4. Extract: business name, city, state, email, phone, website

## Skip
- TruGreen, LawnStarter, LawnDoctor, Weed Man, GreenPal, Spring-Green, US Lawns, Lawn Love
- Any franchise/aggregator

## Output format
{"leads": [{"name": "", "business": "", "city": "", "state": "", "email": "", "phone": "", "website": "", "source": "claude_search"}]}

## Tools available
- curl for web requests
- grep/sed for parsing
- Python for JSON processing