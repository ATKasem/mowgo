import json

with open('/opt/data/mowgo/leads/manta_with_emails.json') as f:
    data = json.load(f)

leads = data['leads']
needs_email = [
    l for l in leads 
    if l.get('website') 
    and l.get('website', '').strip() 
    and (not l.get('email') or l.get('email', '').strip() == '')
]

print(f"Total leads: {len(leads)}")
print(f"Leads with website but no email: {len(needs_email)}")

with open('/opt/data/mowgo/leads/needs_email_filtered.json', 'w') as f:
    json.dump(needs_email, f, indent=2)

print("Saved filtered leads to needs_email_filtered.json")
for l in needs_email[:5]:
    print(f"  {l['business']} | {l['city']}, {l['state']} | {l['website']}")
print(f"\nLast 3:")
for l in needs_email[-3:]:
    print(f"  {l['business']} | {l['city']}, {l['state']} | {l['website']}")
