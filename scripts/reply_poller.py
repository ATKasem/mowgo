#!/usr/bin/env python3
"""MowGo SMS reply poller — fetches inbound texts to the MowGo Twilio number,
posts new ones to the outreach channel (stdout = cron delivery), updates queue
status (STOP -> opted_out, YES/OFFERS/START -> replied so senders skip them).

Silent when nothing new (cron no_agent pattern)."""
import json, pathlib, sys, datetime as dt, urllib.request, urllib.parse, urllib.error, base64

BASE = pathlib.Path("/opt/data/mowgo/leads")
Q = BASE / "sms_queue.json"
SEEN = BASE / "sms_replies_seen.json"
KEYWORDS_STOP = {"stop", "cancel", "quit", "optout", "unsubscribe", "stopall", "revoke", "end", "unsub"}
KEYWORDS_YES = {"yes", "yep", "sure", "start", "send it", "send it over", "ok", "okay", "yeah"}
REPORT_URL = "https://mowgoapp.com/rates"
# verified per-city avg mow prices (what-to-charge-ok-report.md, LawnStarter 08-03-2026)
CITY_PRICE = {
    "broken arrow": "$67.08", "claremore": "$65.13", "yukon": "$59.36", "edmond": "$58.02",
    "tulsa": "$56.93", "oklahoma city": "$54.73", "okc": "$54.73", "norman": "$52.89",
    "guthrie": "$51.22", "chickasha": "$50.82", "bethany": "$48.01",
}
STATE_AVG = "$55.25"

ENV = {}
for line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); ENV[k.strip()] = v.strip()
SID, TOK, FROM = ENV["TWILIO_ACCOUNT_SID"], ENV["TWILIO_AUTH_TOKEN"], ENV.get("TWILIO_FROM", "")
AUTH = base64.b64encode(f"{SID}:{TOK}".encode()).decode()

def fetch_inbound():
    qs = urllib.parse.urlencode({"Direction": "inbound", "PageSize": 100})
    req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json?{qs}")
    req.add_header("Authorization", "Basic " + AUTH)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode())
    msgs = []
    for m in data.get("messages", []):
        if m.get("direction") != "inbound":
            continue
        if FROM and m.get("to") != FROM:
            continue
        msgs.append(m)
    msgs.sort(key=lambda m: m.get("date_sent", ""))
    return msgs

def norm(p):
    return "".join(ch for ch in (p or "") if ch.isdigit())[-10:]

def report_msg(lead):
    """Personalized report delivery line: city price when known, else state avg."""
    hay = f"{lead.get('name','')} {lead.get('day1','')} {lead.get('day2','')}".lower()
    city, price = None, None
    for c, p in CITY_PRICE.items():
        if c in hay:
            city, price = c.title(), p
            break
    if city and city == "Okc":
        city = "OKC"
    head = f"Here you go — {city} crews average {price} a cut (state avg {STATE_AVG})." if city else \
           f"Here you go — the OK state average is {STATE_AVG} a cut."
    return f"{head} Full one-pager: {REPORT_URL} — Aaron, MowGo. Reply STOP to cancel."

def send_report(phone, body):
    data = urllib.parse.urlencode({"To": phone, "From": FROM, "Body": body}).encode()
    req = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json",
        data=data, method="POST")
    req.add_header("Authorization", "Basic " + AUTH)
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return True, json.loads(r.read().decode()).get("status", "")
    except urllib.error.HTTPError as e:
        return False, e.read().decode()[:200]
    except Exception as e:
        return False, str(e)[:200]

def main():
    seen = set()
    if SEEN.exists():
        try: seen = set(json.loads(SEEN.read_text()))
        except Exception: seen = set()
    msgs = fetch_inbound()
    fresh = [m for m in msgs if m.get("sid") not in seen]
    if not fresh:
        print(""); return  # silent
    queue = json.loads(Q.read_text()) if Q.exists() else []
    by_phone = {norm(l.get("phone", "")): l for l in queue if l.get("phone")}
    lines, changed = [], False
    for m in fresh[:10]:
        sid, body, phone = m.get("sid", ""), (m.get("body") or "").strip(), m.get("from", "")
        lead = by_phone.get(norm(phone))
        name = f"{lead['name']} ({phone})" if lead else phone
        low = body.lower()
        if any(k in low for k in KEYWORDS_STOP):
            if lead and lead.get("status") not in ("opted_out",):
                lead["status"] = "opted_out"; lead["last_status"] = "STOP"; changed = True
            lines.append(f"🚫 Opt-out — {name}: {body}")
        elif any(k in low for k in KEYWORDS_YES):
            sent_report = False
            if lead and not lead.get("report_sent"):
                ok, st = send_report(phone, report_msg(lead))
                if ok:
                    lead["report_sent"] = True
                    lead["status"] = "report_sent"
                    lead["last_status"] = f"report_sent:{st}"
                    changed = True
                    sent_report = True
                else:
                    lines.append(f"⚠️ Report send failed for {name} ({st[:120]})")
            elif lead and lead.get("status") in ("new", "error"):
                lead["status"] = "replied"; lead["last_status"] = "engaged"; changed = True
            lines.append(f"{'📤 REPORT SENT — ' if sent_report else '📥 '}{name}: {body}")
        else:
            if lead and lead.get("status") in ("new", "error"):
                lead["status"] = "replied"; lead["last_status"] = "engaged"; changed = True
            lines.append(f"📥 {name}: {body}")
    if len(fresh) > 10:
        lines.append(f"…and {len(fresh) - 10} more")
    if changed:
        Q.write_text(json.dumps(queue, indent=2))
    # persist seen sids (keep last 500)
    for m in fresh:
        seen.add(m.get("sid", ""))
    seen = set(list(seen)[-500:])
    SEEN.write_text(json.dumps(sorted(seen)))
    print("\n".join(lines))

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"❌ Reply poller error: {e}")
        sys.exit(1)
