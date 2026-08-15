import json

with open('/opt/data/mowgo/leads/email_verified_leads.json') as f:
    data = json.load(f)

leads = data.get('leads', [])
print(f'Total leads: {len(leads)}')

existing_names = set()
existing_emails = set()
existing_phones = set()

for l in leads:
    name = l.get('name') or ''
    email = l.get('email') or ''
    phone = l.get('phone') or ''
    existing_names.add(name.lower().strip())
    existing_emails.add(email.lower().strip())
    existing_phones.add(phone.strip())

print(f'Unique names: {len(existing_names)}')
print(f'Unique emails: {len(existing_emails)}')
print(f'Unique phones: {len(existing_phones)}')

# Save for import
with open('/opt/data/mowgo/leads/existing_hashes.json', 'w') as f:
    json.dump({
        'names': list(existing_names),
        'emails': list(existing_emails),
        'phones': list(existing_phones)
    }, f)

print('Saved existing hashes')
