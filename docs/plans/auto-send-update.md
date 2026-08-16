Make these two changes:

## 1. Update functions/api/rates.js — email footer CTA

Change the footer paragraph in the emailHtml() function from:
```
<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">Built by <a href="https://mowgoapp.com/#/" style="color:#047857">MowGo</a> — scheduling, routing, and invoicing for Oklahoma lawn crews. Data: LawnStarter OK market, refreshed August 2026.</p>
```

To:
```
<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">Built by <a href="https://mowgoapp.com/#/" style="color:#047857">MowGo</a> — scheduling, routing, and invoicing for Oklahoma lawn crews. Data: LawnStarter OK market, refreshed August 2026.</p>
<p style="margin-top:12px;font-size:13px"><a href="https://mowgoapp.com/#/rates?source=email" style="color:#047857">Want pricing tips sent to your inbox? →</a></p>
```

This changes the CTA from "Try MowGo Free" (a product pitch in the report email) to "Want pricing tips?" (a value-add that leads back to the form page for nurture opt-in).

## 2. Update scripts/email_reply_checker.py — auto-send report on "yes" replies

Add the ability to auto-send the rates report when someone replies with a positive signal ("yes", "sure", "send it", "go ahead", "yeah", "ok").

After the existing reply-detection logic (around line 84 where it prints replies), add:

### New imports needed at the top:
```python
import urllib.request, urllib.error
import base64
```

### New function: send_rates_report(email_addr, name="")
Uses the Resend API to send the same HTML report as rates.js does:
- From: "Aaron <aaron@mowgoapp.com>"
- Reply-To: "Hermes <hermes.assistant.job@gmail.com>"
- To: the lead's email
- Subject: "Your Oklahoma Lawn Rates Report — What to Charge in Your City"
- HTML body: copy the full email HTML from functions/api/rates.js emailHtml() function (the city table, yard size table, revenue math, caveats, and the updated footer with pricing tips link)

The Resend API call:
```python
def send_rates_report(email_addr, name=""):
    api_key = ENV.get("RESEND_API_KEY", "")
    if not api_key:
        print("  ⚠️ RESEND_API_KEY not configured — can't auto-send report")
        return False
    personal_opener = f"<p>Hey{' ' + name if name else ''},</p><p>Here are those Oklahoma rates I mentioned.</p>" if name else ""
    html = f"""<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6">
{personal_opener}
<!-- rest of the report HTML copied from rates.js emailHtml() exactly -->
</body></html>"""
    payload = json.dumps({"from": "Aaron <aaron@mowgoapp.com>", "reply_to": "Hermes <hermes.assistant.job@gmail.com>", "to": email_addr, "subject": "Your Oklahoma Lawn Rates Report — What to Charge in Your City", "html": html}).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
            return True
    except urllib.error.HTTPError as e:
        print(f"  ❌ Resend error: {e.code} {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"  ❌ Resend error: {e}")
        return False
```

### New function: insert_lead_touches(email_addr)
Inserts lead_touches rows into Supabase via REST API (same pattern as rates.js):
- source: 'rates_report'
- lead_email: the email
- kind: 'instant' (sent), 'day3' (queued), 'day7' (queued)
- channel: 'email'
- status: 'sent' for instant, 'queued' for day3/day7

```python
def insert_lead_touches(email_addr):
    url = ENV.get("SUPABASE_URL", "")
    key = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("  ⚠️ Supabase not configured — can't insert lead_touches")
        return
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
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
            print(f"  ✅ lead_touches inserted")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"  ⚠️ lead_touches insert: {e.code} {body}")
    except Exception as e:
        print(f"  ⚠️ lead_touches insert: {e}")
```

### Positive signal detection
After the existing code that collects fresh replies (around line 73-82), add detection logic. A reply is a "yes" if the body (lowercased) matches any of these patterns: r'\byes\b', r'\bsure\b', r'\bsend it\b', r'\bgo ahead\b', r'\bye[ah]+\b', r'\bok\b', r'\bthat would be great\b', r'\bi want\b', r'\bplease\b.*\bsend\b', r'\bsend me\b'

For each "yes" reply, call send_rates_report() then insert_lead_touches(), and log the result.

The output should show both the original reply info AND whether the report was auto-sent:
```
📬 REPLY FROM: Some Guy <some@email.com>
   Subject: Re: Quick question from an OKC crew owner
   Body: yeah send it over
   📤 Report auto-sent ✅
   📝 Nurture sequence queued ✅
```

### Also add this import to the top:
Add `datetime.timezone` to the existing datetime import line if not already there.

Do NOT change any existing reply-checking behavior — only ADD the auto-send on positive replies.

Verify syntax after changes: python3 -c "import ast; ast.parse(open('scripts/email_reply_checker.py').read()); print('OK')" && node --check functions/api/rates.js