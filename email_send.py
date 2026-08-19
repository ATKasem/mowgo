#!/usr/bin/env python3
"""MowGo Email Outreach — sends from verified lead database via Resend.
Runs as a cron job M-F to send up to 100 emails/day.
Uses the trifecta+board+humanizer approved template (plain text)."""

import json, subprocess, datetime, pathlib, os

LEADS_FILE = "/opt/data/mowgo/leads/master_leads.json"
# Use Resend API key from .env, fallback to env var
_env = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1); _env[_k.strip()] = _v.strip()
API_KEY = os.environ.get("RESEND_API_KEY") or _env.get("RESEND_API_KEY", "")
MAX_PER_DAY = 100

TEMPLATES = {}
SUBJECTS = {}
FROM_NAMES = ["Aaron <aaron@mowgoapp.com>", "Aaron <hello@mowgoapp.com>"]

def load_leads():
    with open(LEADS_FILE) as f:
        return json.load(f)

def save_leads(data):
    with open(LEADS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def send_email(to_email, subject, text_body, from_idx):
    """Send plain text email via Resend API"""
    from_name, from_addr = FROM_NAMES[from_idx].split(" <")
    from_addr = from_addr.rstrip(">")
    payload = json.dumps({
        "from": f"{from_name} <{from_addr}>",
        "to": [to_email],
        "subject": subject,
        "text": text_body,
        "reply_to": "hermes.assistant.job@gmail.com"
    })
    result = subprocess.run(
        ["curl", "-s", "-w", "\n%{http_code}", "-X", "POST", "https://api.resend.com/emails",
         "-H", f"Authorization: Bearer {API_KEY}",
         "-H", "Content-Type: application/json",
         "-H", "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
         "-d", payload],
        capture_output=True, text=True, timeout=30
    )
    parts = result.stdout.strip().split("\n")
    http_code = parts[-1] if parts else "000"
    return {"success": http_code == "200"}

def personalize(lead):
    """Pick template by name availability, fill placeholders"""
    name = lead.get("name") or ""
    city = lead.get("city") or ""
    business = lead.get("business") or ""
    
    if name and lead.get("verified_name"):
        template = TEMPLATES["with_name"]
        subject = SUBJECTS["with_name"]
        greeting = f"Hi {name},"
        body = template.replace("{{NAME}}", name)
    else:
        template = TEMPLATES["without_name"]
        subject = SUBJECTS["without_name"].replace("{{CITY}}", city)
        greeting = f"Hey {business} Team," if business else "Hi there,"
        body = template
    
    body = body.replace("{{CITY}}", city)
    body = body.replace("{{BUSINESS}}", business)
    body = body.replace("Hi {{NAME}},", greeting)
    body = body.replace("Hey {{BUSINESS}} Team,", greeting)
    return body, subject

def main():
    data = load_leads()
    leads = data["leads"]
    templates = data["template"]
    TEMPLATES["with_name"] = templates["html_body_with_name"]
    TEMPLATES["without_name"] = templates["html_body_without_name"]
    SUBJECTS["with_name"] = templates["subject_with_name"]
    SUBJECTS["without_name"] = templates["subject_without_name"]
    
    # Only send to verified, unsent, non-bounced leads
    ready = [l for l in leads if l.get("verified_email") and l.get("email") 
             and not l.get("sent") and not l.get("bounced")]
    
    if not ready:
        print(f"No leads to send ({datetime.datetime.now().isoformat()})")
        return
    
    # Cap at 100/day
    batch = ready[:min(MAX_PER_DAY, len(ready))]
    
    sent_count = 0
    bounce_count = 0
    for i, lead in enumerate(batch):
        from_idx = i % len(FROM_NAMES)
        body, subject = personalize(lead)
        result = send_email(lead["email"], subject, body, from_idx)
        name = lead.get("name") or lead.get("business", "?")
        
        if result.get("success"):
            lead["sent"] = True
            lead["sent_date"] = datetime.datetime.now().isoformat()
            lead["last_event"] = "sent"
            sent_count += 1
            print(f"  ✅ Sent to {name} at {lead['email']} ({lead['city']}, {lead['state']})")
        else:
            # Check for bounce/rejection
            lead["last_event"] = "failed"
            error_msg = str(result)
            if "bounce" in error_msg.lower() or "reject" in error_msg.lower() or "invalid" in error_msg.lower():
                lead["bounced"] = True
                bounce_count += 1
                print(f"  ❌ BOUNCED: {lead['email']} — marked as bounced")
            else:
                print(f"  ❌ Failed for {lead['email']}: {result}")
    
    data["stats"]["sent_today"] = sent_count
    data["stats"]["total_sent"] = data["stats"].get("total_sent", 0) + sent_count
    data["stats"]["total_bounced"] = data["stats"].get("total_bounced", 0) + bounce_count
    data["stats"]["last_run"] = datetime.datetime.now().isoformat()
    save_leads(data)
    
    print(f"\nSent {sent_count} emails. Bounced: {bounce_count}. Total sent: {data['stats']['total_sent']}")

if __name__ == "__main__":
    main()