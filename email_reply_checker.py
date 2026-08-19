#!/usr/bin/env python3
"""MowGo email reply checker — checks hermes.assistant.job@gmail.com for replies
to outreach emails. Posts new replies to stdout for cron delivery.
Silent when nothing new."""

import json, imaplib, email, re, pathlib, datetime as dt
import urllib.request, urllib.error

BASE = pathlib.Path("/opt/data/mowgo/leads")
SEEN = BASE / "email_replies_seen.json"

# Read .env
ENV = {}
for line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); ENV[k.strip()] = v.strip()

# Keep in sync by hand with functions/api/rates.js CITY_PRICES / YARD_SIZES / emailHtml().
CITY_PRICES = [
    ("Broken Arrow", "$67.08"), ("Claremore", "$65.13"), ("Yukon", "$59.36"),
    ("Edmond", "$58.02"), ("Tulsa", "$56.93"), ("Oklahoma City", "$54.73"),
    ("Norman", "$52.89"), ("Guthrie", "$51.22"), ("Chickasha", "$50.82"),
    ("Bethany", "$48.01"),
]
STATE_AVERAGE = "$55.25"
YARD_SIZES = [
    ("1/8 acre", "$30.39", "$34.81", "$35.36"),
    ("1/4 acre", "$39.78", "$45.31", "$46.96"),
    ("1/3 acre", "$52.49", "$53.04", "$60.22"),
    ("1/2 acre", "$65.75", "$75.70", "$78.46"),
    ("1 acre", "$102.22", "$107.19", "$119.34"),
]
POSITIVE_RE = re.compile(
    r"\byes\b|\bsure\b|\bsend it\b|\bgo ahead\b|\bye[ah]+\b|\bok\b|"
    r"\bthat would be great\b|\bi want\b|\bplease\b.*\bsend\b|\bsend me\b",
    re.IGNORECASE,
)


def _cell(value, align="left"):
    return f'<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:{align}">{value}</td>'


def rates_report_html(name=""):
    city_rows = "".join(f"<tr>{_cell(city)}{_cell(price, 'right')}</tr>" for city, price in CITY_PRICES)
    yard_rows = "".join(
        f"<tr>{_cell(size)}{_cell(weekly, 'right')}{_cell(biweekly, 'right')}{_cell(monthly, 'right')}</tr>"
        for size, weekly, biweekly, monthly in YARD_SIZES
    )
    opener = f"<p>Hey{' ' + name if name else ''},</p><p>Here are those Oklahoma rates I mentioned.</p>" if name else ""
    return f"""<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6">
{opener}
<h1>Your Oklahoma Lawn Rates Report</h1>
<p>Here's what OK lawn crews are actually charging right now, city by city and by yard size.</p>
<h2>City averages</h2>
<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;border-bottom:2px solid #a7f3d0"><th style="padding:6px 10px">City</th><th style="padding:6px 10px;text-align:right">Avg. mow price</th></tr></thead><tbody>{city_rows}</tbody></table>
<p><strong>Oklahoma state average: {STATE_AVERAGE}</strong> per mow, across all yard sizes.</p>
<h2>By yard size</h2>
<table style="width:100%;border-collapse:collapse"><thead><tr style="text-align:left;border-bottom:2px solid #a7f3d0"><th style="padding:6px 10px">Yard size</th><th style="padding:6px 10px;text-align:right">Weekly</th><th style="padding:6px 10px;text-align:right">Bi-weekly</th><th style="padding:6px 10px;text-align:right">Monthly</th></tr></thead><tbody>{yard_rows}</tbody></table>
<h2>The revenue math</h2>
<p>$52.49/cut → ~$1,365/yr per customer (26 cuts). 20 customers = $27,300/yr. 30 customers = $41,000/yr. Extras like fertilization, edging, and cleanups add 30%+ on top.</p>
<h2>A few honest caveats</h2>
<ol>
<li>The market sets your ceiling — your work sets your price within it.</li>
<li>Yard size dominates the price more than city does.</li>
<li>Raise rates on new customers first; grandfather your loyal ones in.</li>
<li>Reliability beats a rate bump — showing up matters more than being cheap.</li>
</ol>
<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">Built by <a href="https://mowgoapp.com/#/" style="color:#047857">MowGo</a> — scheduling, routing, and invoicing for Oklahoma lawn crews. Data: LawnStarter OK market, refreshed August 2026.</p>
<p style="margin-top:12px;font-size:13px"><a href="https://mowgoapp.com/#/rates?source=email" style="color:#047857">Want pricing tips sent to your inbox? →</a></p>
</body></html>"""


def send_rates_report(email_addr, name=""):
    api_key = ENV.get("RESEND_API_KEY", "")
    if not api_key:
        print("  ⚠️ RESEND_API_KEY not configured — can't auto-send report")
        return False
    from_name, from_addr = "Aaron <aaron@mowgoapp.com>".split(" <")
    from_addr = from_addr.rstrip(">")
    payload = json.dumps({
        "from": f"{from_name} <{from_addr}>",
        "to": [email_addr],
        "reply_to": "hermes.assistant.job@gmail.com",
        "subject": "Your Oklahoma Lawn Rates Report — What to Charge in Your City",
        "html": rates_report_html(name),
    }).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "MowGo/1.0")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.getcode()
            return status == 200
    except urllib.error.HTTPError as e:
        print(f"  ❌ Resend error: {e.code} {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"  ❌ Resend error: {e}")
        return False


def _send_email(to_email, subject, text_body):
    """Send plain text email via Resend API."""
    api_key = ENV.get("RESEND_API_KEY", "")
    if not api_key:
        print("  ⚠️ RESEND_API_KEY not configured — can't send email")
        return False
    payload = json.dumps({
        "from": "Aaron <aaron@mowgoapp.com>",
        "to": [to_email],
        "reply_to": "hermes.assistant.job@gmail.com",
        "subject": subject,
        "text": text_body,
    }).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "MowGo/1.0")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.getcode()
            return status == 200
    except urllib.error.HTTPError as e:
        print(f"  ❌ Resend error: {e.code} {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"  ❌ Resend error: {e}")
        return False


def insert_lead_touches(email_addr):
    url = ENV.get("SUPABASE_URL", "")
    key = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("  ⚠️ Supabase not configured — can't insert lead_touches")
        return
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    rows = [
        {"source": "rates_report", "user_id": None, "lead_email": email_addr, "lead_phone": None, "kind": "instant", "channel": "email", "status": "sent", "sent_at": now},
        {"source": "rates_report", "user_id": None, "lead_email": email_addr, "lead_phone": None, "kind": "day3", "channel": "email", "status": "queued"},
        {"source": "rates_report", "user_id": None, "lead_email": email_addr, "lead_phone": None, "kind": "day7", "channel": "email", "status": "queued"},
    ]
    payload = json.dumps(rows).encode()
    req = urllib.request.Request(f"{url}/rest/v1/lead_touches", data=payload, method="POST")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal,resolution=ignore-duplicates")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            r.read()
            print("  ✅ lead_touches inserted")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"  ⚠️ lead_touches insert: {e.code} {body}")
    except Exception as e:
        print(f"  ⚠️ lead_touches insert: {e}")

def check_inbox():
    """Fetch unseen emails from the monitored inbox, return list of reply dicts."""
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(ENV["EMAIL_ADDRESS"], ENV["EMAIL_PASSWORD"])
    mail.select("INBOX")
    
    # Search for unseen messages
    _, data = mail.search(None, "UNSEEN")
    ids = data[0].split() if data[0] else []
    
    replies = []
    for uid in ids[-20:]:  # max 20 per check
        _, msg_data = mail.fetch(uid, "(RFC822)")
        raw = msg_data[0][1] if msg_data[0] else b""
        msg = email.message_from_bytes(raw)
        
        subject = msg.get("Subject", "")
        sender = msg.get("From", "")
        reply_to = msg.get("Reply-To", "")
        
        # Skip automated / non-replies
        if "mailer-daemon" in sender.lower() or "postmaster" in sender.lower():
            continue
            
        # Get body
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain":
                    body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                    break
        else:
            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
        
        # Extract sender email
        match = re.search(r'<([^>]+)>', sender)
        sender_email = match.group(1) if match else sender
        
        replies.append({
            "from": sender,
            "email": sender_email,
            "subject": subject,
            "body": body[:500].strip(),
            "date": str(dt.datetime.now())[:19]
        })
    
    mail.logout()
    return replies

def main():
    seen = set()
    if SEEN.exists():
        try: seen = set(json.loads(SEEN.read_text()))
        except: seen = set()
    
    replies = check_inbox()
    fresh = [r for r in replies if r["email"] not in seen]
    
    if not fresh:
        print("")  # silent — nothing new
        return
    
    # Mark seen
    for r in fresh:
        seen.add(r["email"])
    SEEN.write_text(json.dumps(list(seen)))
    
    # Output new replies
    for r in fresh:
        print(f"📬 REPLY FROM: {r['from']}")
        print(f"   Subject: {r['subject']}")
        print(f"   Body: {r['body'][:300]}")
        if POSITIVE_RE.search(r["body"].lower()):
            sent = send_rates_report(r["email"])
            print(f"   📤 Report auto-sent {'✅' if sent else '❌'}")
            if sent:
                insert_lead_touches(r["email"])
                print("   📝 Nurture sequence queued ✅")
        print("---")

if __name__ == "__main__":
    main()