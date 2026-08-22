#!/usr/bin/env python3
"""MowGo Email Follow-up — 4-touch sequence. Runs Tue/Thu/Sat.
Touch 2 = Day 3, Touch 3 = Day 7, Touch 4 = Day 14.
Each touch uses variant-appropriate copy. All Hormozi + humanizer gated."""
import json, subprocess, datetime, pathlib, os

LEADS_FILE = "/opt/data/mowgo/leads/master_leads.json"
_env = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1); _env[_k.strip()] = _v.strip()
API_KEY = os.environ.get("RESEND_API_KEY") or _env.get("RESEND_API_KEY", "")
MAX_FOLLOW_UPS = 50
FROM_NAMES = ["Aaron <aaron@mowgoapp.com>", "Aaron <hello@mowgoapp.com>"]
UNSUB_LINK = "https://mowgoapp.com/unsubscribe"

# Day offsets for each follow-up touch
TOUCH_DAYS = {2: 3, 3: 7, 4: 14}  # touch_number: min days since first email

def load_leads():
    with open(LEADS_FILE) as f:
        return json.load(f)

def save_leads(data):
    with open(LEADS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def send_email(to_email, subject, text_body, from_idx):
    from_name, from_addr = FROM_NAMES[from_idx].split(" <")
    from_addr = from_addr.rstrip(">")
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

def days_since(date_str):
    try:
        # Handle both naive and aware timestamps consistently
        sent = datetime.datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        if sent.tzinfo is None:
            # Naive timestamp: treat as UTC to match now()'s tz
            sent = sent.replace(tzinfo=datetime.timezone.utc)
        return (now - sent).days
    except Exception:
        # On parse failure, return 0 (not due) rather than 999 (immediately due).
        # Failing open risks a mass-mail incident; failing closed just delays.
        return 0

def main():
    data = load_leads()
    leads = data["leads"]
    t = data["template"]
    now = datetime.datetime.now(datetime.timezone.utc)

    # Leads who got first email, haven't replied/bounced
    base = [l for l in leads if l.get("sent") and not l.get("replied") and not l.get("bounced")
            and l.get("verified_email") and l.get("email")]

    sent_count = 0

    # Enforce the daily cap: only process the first MAX_FOLLOW_UPS due leads.
    # Sort by sent_date so oldest leads get priority, never send a mass batch.
    due = []
    for lead in base:
        name = lead.get("name") or ""
        city = lead.get("city") or ""
        business = lead.get("business") or ""
        variant = lead.get("variant", "v1")
        sent_date = lead.get("sent_date", "")
        days = days_since(sent_date)

        touch = None
        if not lead.get("follow_up_sent") and days >= 3:
            touch = 2
        elif lead.get("follow_up_sent") and not lead.get("follow_up3_sent") and days >= 7:
            touch = 3
        elif lead.get("follow_up3_sent") and not lead.get("follow_up4_sent") and days >= 14:
            touch = 4
        if touch is not None:
            due.append((sent_date or "", lead, touch, days))

    due.sort(key=lambda x: x[0])  # oldest first
    due = due[:MAX_FOLLOW_UPS]

    for _, lead, touch, days in due:
        name = lead.get("name") or ""
        city = lead.get("city") or ""
        business = lead.get("business") or ""
        variant = lead.get("variant", "v1")

        # Pick copy for this touch + variant. v3 falls back to v2 copy (no v3 follow-up templates exist).
        has_name = bool(name) and bool(lead.get("verified_name"))
        is_v2 = variant == "v2"
        if touch == 2:
            fu_subj_key = "follow_up_subject_v2" if is_v2 else "follow_up_subject"
            fu_body_key = ("follow_up_with_name_v2" if is_v2 else "follow_up_with_name") if has_name else ("follow_up_without_name_v2" if is_v2 else "follow_up_without_name")
        elif touch == 3:
            fu_subj_key = "follow_up3_subject_v2" if is_v2 else "follow_up3_subject"
            fu_body_key = ("follow_up3_with_name_v2" if is_v2 else "follow_up3_with_name") if has_name else ("follow_up3_without_name_v2" if is_v2 else "follow_up3_without_name")
        else:  # touch 4
            fu_subj_key = "follow_up4_subject_v2" if is_v2 else "follow_up4_subject"
            fu_body_key = ("follow_up4_with_name_v2" if is_v2 else "follow_up4_with_name") if has_name else ("follow_up4_without_name_v2" if is_v2 else "follow_up4_without_name")

        subject = t[fu_subj_key]
        body = t[fu_body_key]

        # Fill placeholders. For unnamed leads, strip the {{NAME}} token from subjects
        # so they never receive a literal "{{NAME}}," prefix.
        if name and "{{NAME}}" in subject:
            subject = subject.replace("{{NAME}}", name)
        elif "{{NAME}}" in subject:
            subject = subject.replace("{{NAME}}, ", "").replace("{{NAME}},", "").replace("{{NAME}}", "")
        subject = subject.replace("{{CITY}}", city)
        body = body.replace("{{NAME}}", name).replace("{{CITY}}", city).replace("{{BUSINESS}}", business)
        if name:
            body = body.replace("Hi {{NAME}},", f"Hi {name},").replace("Hi {{NAME}}.", f"Hi {name}.")
        if not has_name:
            greeting = f"Hey {business} Team," if business else "Hi there,"
            body = body.replace("Hey {{BUSINESS}} Team,", greeting).replace("Hey {{BUSINESS}} Team.", greeting)

        result = send_email(lead["email"], subject, body, sent_count % len(FROM_NAMES))
        lead_name = name or business or "?"

        if result.get("success"):
            if touch == 2:
                lead["follow_up_sent"] = True
                lead["follow_up_date"] = now.isoformat()
            elif touch == 3:
                lead["follow_up3_sent"] = True
                lead["follow_up3_date"] = now.isoformat()
            elif touch == 4:
                lead["follow_up4_sent"] = True
                lead["follow_up4_date"] = now.isoformat()
            lead["last_event"] = f"follow_up{touch}_sent"
            sent_count += 1
            print(f"  [touch{touch}] {lead_name} ({lead['email']}) — day {days}")
        else:
            print(f"  [X] touch{touch} failed for {lead['email']}")

    data["stats"]["follow_ups_sent"] = data["stats"].get("follow_ups_sent", 0) + sent_count
    data["stats"]["last_follow_up_run"] = now.isoformat()
    save_leads(data)
    print(f"\nSent {sent_count} follow-ups. Sequence: Day3→Day7→Day14.")

if __name__ == "__main__":
    main()