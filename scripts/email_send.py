#!/usr/bin/env python3
"""MowGo Email Outreach — sends from verified lead database via Resend.
Runs as a cron job M-F to send up to 100 emails/day.
Uses the trifecta+board+humanizer approved template."""

import json, os, subprocess, sys, datetime

LEADS_FILE = "/opt/data/mowgo/leads/master_leads.json"
API_KEY = "re_HmpHTudU_FSrWq3JMd7vcFMSozCRRfVu5"

def load_leads():
    with open(LEADS_FILE) as f:
        return json.load(f)

def save_leads(data):
    with open(LEADS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

FROM_NAMES = ["Aaron <aaron@mowgoapp.com>", "Aaron <hello@mowgoapp.com>"]

def send_email(to_email, subject, html_body, from_idx):
    """Send single email via Resend API"""
    payload = json.dumps({
        "from": FROM_NAMES[from_idx],
        "to": to_email,
        "reply_to": "hermes.assistant.job@gmail.com",
        "subject": subject,
        "html": html_body
    })
    result = subprocess.run(
        ["curl", "-s", "-X", "POST", "https://api.resend.com/emails",
         "-H", f"Authorization: Bearer {API_KEY}",
         "-H", "Content-Type: application/json",
         "-d", payload],
        capture_output=True, text=True, timeout=30
    )
    return json.loads(result.stdout)

def personalize(template, name, city):
    """Replace placeholders in template"""
    # If no name, use a generic greeting
    greeting = f"Hi {name}," if name else "Hi there,"
    html = template.replace("{{NAME}}", name)
    html = html.replace("{{CITY}}", city)
    html = html.replace("Hi {{NAME}},", greeting)
    return html

def main():
    data = load_leads()
    template = data["template"]["html_body"]
    subject = data["template"]["subject"]
    leads = data["leads"]
    
    # Only send to leads with verified emails (name optional — template handles missing names)
    ready = [l for l in leads if l.get("verified_email") and l.get("email") and not l.get("sent")]
    
    if not ready:
        print(f"No leads to send ({datetime.datetime.now().isoformat()})")
        return
    
    # Cap at 100/day
    batch = ready[:min(100, len(ready))]
    
    sent_count = 0
    for i, lead in enumerate(batch):
        # Alternate from address: aaron@ / hello@ to spread volume
        from_idx = i % len(FROM_NAMES)
        # Use first name if we have it, otherwise "there" — template needs a name
        name = lead.get("name") or ""
        html = personalize(template, name, lead["city"])
        result = send_email(lead["email"], subject, html, from_idx)
        if result.get("id"):
            lead["sent"] = True
            lead["sent_date"] = datetime.datetime.now().isoformat()
            sent_count += 1
            print(f"  ✅ Sent to {lead['name']} at {lead['email']} ({lead['city']}, {lead['state']})")
        else:
            print(f"  ❌ Failed for {lead['email']}: {result}")
    
    data["stats"]["sent_today"] = sent_count
    data["stats"]["total_sent"] = data["stats"].get("total_sent", 0) + sent_count
    data["stats"]["last_run"] = datetime.datetime.now().isoformat()
    save_leads(data)
    
    print(f"\nSent {sent_count} emails. Total sent all time: {data['stats']['total_sent']}")

if __name__ == "__main__":
    main()