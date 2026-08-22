#!/usr/bin/env python3
"""MowGo Email Outreach — sends from verified lead database via Resend.
Runs as a cron job M-F to send up to 100 emails/day.
Rotates 3 safe variants (all ACA framework, inbox-safe)."""
import json, subprocess, datetime, pathlib, os, random

LEADS_FILE = "/opt/data/mowgo/leads/master_leads.json"
_env = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1); _env[_k.strip()] = _v.strip()
API_KEY = os.environ.get("RESEND_API_KEY") or _env.get("RESEND_API_KEY", "")
MAX_PER_DAY = 100
FROM_NAMES = ["Aaron <aaron@mowgoapp.com>", "Aaron <hello@mowgoapp.com>"]
UNSUB_LINK = "https://mowgoapp.com/unsubscribe"

def load_leads():
    with open(LEADS_FILE) as f:
        return json.load(f)

def save_leads(data):
    with open(LEADS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def send_email(to_email, subject, text_body, from_idx):
    from_name, from_addr = FROM_NAMES[from_idx].split(" <")
    from_addr = from_addr.rstrip(">")
    # Add unsubscribe link to body
    body_with_unsub = text_body + "\n\nUnsubscribe: " + UNSUB_LINK
    payload = json.dumps({
        "from": f"{from_name} <{from_addr}>",
        "to": [to_email],
        "subject": subject,
        "text": body_with_unsub,
        "reply_to": "hermes.assistant.job@gmail.com",
        "open_tracking": True,
        "click_tracking": True,
        "headers": {
            "List-Unsubscribe": f"<{UNSUB_LINK}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        }
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

def personalize(lead, templates, variant):
    name = lead.get("name") or ""
    city = lead.get("city") or ""
    business = lead.get("business") or ""

    has_name = name and lead.get("verified_name")
    subj_key = f"subject_with_name{'_v'+variant if variant != '1' else ''}"
    body_key = f"html_body_with_name{'_v'+variant if variant != '1' else ''}"

    if not has_name:
        subj_key = f"subject_without_name{'_v'+variant if variant != '1' else ''}"
        body_key = f"html_body_without_name{'_v'+variant if variant != '1' else ''}"

    subject = templates[subj_key]
    body = templates[body_key]

    if name:
        subject = subject.replace("{{NAME}}", name)
        body = body.replace("Hi {{NAME}},", f"Hi {name},")
        body = body.replace("Hi {{NAME}}.", f"Hi {name}.")
    subject = subject.replace("{{CITY}}", city)
    body = body.replace("{{CITY}}", city).replace("{{BUSINESS}}", business)

    if not has_name:
        greeting = f"Hey {business} Team," if business else "Hi there,"
        body = body.replace("Hey {{BUSINESS}} Team,", greeting)
        body = body.replace("Hey {{BUSINESS}} Team.", greeting)

    return body, subject

def main():
    data = load_leads()
    leads = data["leads"]
    templates = data["template"]

    ready = [l for l in leads if l.get("verified_email") and l.get("email")
             and not l.get("sent") and not l.get("bounced")]

    if not ready:
        print(f"No leads to send ({datetime.datetime.now().isoformat()})")
        return

    batch = ready[:min(MAX_PER_DAY, len(ready))]
    sent_count = {"1": 0, "2": 0, "3": 0}

    for idx, lead in enumerate(batch):
        from_idx = idx % len(FROM_NAMES)
        # Random variant rotation
        variant = random.choice(["1", "2", "3"])
        body, subject = personalize(lead, templates, variant)
        result = send_email(lead["email"], subject, body, from_idx)
        name = lead.get("name") or lead.get("business", "?")

        if result.get("success"):
            lead["sent"] = True
            lead["sent_date"] = datetime.datetime.now().isoformat()
            lead["last_event"] = "sent"
            lead["variant"] = f"v{variant}"
            sent_count[variant] += 1
            print(f"  [v{variant}] Sent to {name} ({lead.get('city','')}, {lead.get('state','')})")
        else:
            lead["last_event"] = "failed"
            if "bounce" in str(result).lower() or "reject" in str(result).lower():
                lead["bounced"] = True
                print(f"  [X] BOUNCED: {lead['email']}")
            else:
                print(f"  [X] Failed for {lead['email']}: {result}")

    total = sum(sent_count.values())
    data["stats"]["sent_today"] = total
    data["stats"]["total_sent"] = data["stats"].get("total_sent", 0) + total
    data["stats"]["last_run"] = datetime.datetime.now().isoformat()
    save_leads(data)

    print(f"\nSent {total} emails. v1: {sent_count['1']}, v2: {sent_count['2']}, v3: {sent_count['3']}.")
    print(f"Total sent all time: {data['stats']['total_sent']}")

if __name__ == "__main__":
    main()