#!/usr/bin/env python3
"""MowGo Email Follow-up — sends Day 3 follow-up to non-repliers.
Runs M-W-F at noon to catch leads who were sent but didn't reply."""

import json, subprocess, datetime, pathlib, os

LEADS_FILE = "/opt/data/mowgo/leads/master_leads.json"
# Use Resend API key from .env, fallback to env var or hardcoded
_env = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1); _env[_k.strip()] = _v.strip()
API_KEY = os.environ.get("RESEND_API_KEY") or _env.get("RESEND_API_KEY", "")
MAX_FOLLOW_UPS = 25  # 25/day so total stays under 50/day across send+followup

FROM_NAMES = ["Aaron <aaron@mowgoapp.com>", "Aaron <hello@mowgoapp.com>"]

def load_leads():
    with open(LEADS_FILE) as f:
        return json.load(f)

def save_leads(data):
    with open(LEADS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def send_email(to_email, subject, text_body, from_idx):
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

def main():
    data = load_leads()
    leads = data["leads"]
    t = data["template"]
    
    # Leads who got first email but haven't replied and haven't gotten follow-up
    ready = [l for l in leads if l.get("sent") and not l.get("replied") 
             and not l.get("follow_up_sent") and not l.get("bounced")
             and l.get("verified_email") and l.get("email")]
    
    if not ready:
        print(f"No follow-ups needed ({datetime.datetime.now().isoformat()})")
        return
    
    batch = ready[:min(MAX_FOLLOW_UPS, len(ready))]
    sent_count = 0
    
    for i, lead in enumerate(batch):
        from_idx = i % len(FROM_NAMES)
        name = lead.get("name") or ""
        city = lead.get("city") or ""
        business = lead.get("business") or ""
        
        if name and lead.get("verified_name"):
            body = t["follow_up_with_name"].replace("{{NAME}}", name)
            subject = t["follow_up_subject"].replace("{{NAME}}", name).replace("{{CITY}}", city)
        else:
            body = t["follow_up_without_name"].replace("{{BUSINESS}}", business)
            subject = t["follow_up_subject"].replace("{{CITY}}", city)
        
        body = body.replace("{{CITY}}", city).replace("{{NAME}}", name).replace("{{BUSINESS}}", business)
        
        result = send_email(lead["email"], subject, body, from_idx)
        lead_name = name or business or "?"
        
        if result.get("success"):
            lead["follow_up_sent"] = True
            lead["follow_up_date"] = datetime.datetime.now().isoformat()
            lead["last_event"] = "follow_up_sent"
            sent_count += 1
            print(f"  ✅ Follow-up to {lead_name} at {lead['email']}")
        else:
            print(f"  ❌ Failed for {lead['email']}")
    
    data["stats"]["follow_ups_sent"] = data["stats"].get("follow_ups_sent", 0) + sent_count
    data["stats"]["last_follow_up_run"] = datetime.datetime.now().isoformat()
    save_leads(data)
    print(f"\nSent {sent_count} follow-ups")

if __name__ == "__main__":
    main()