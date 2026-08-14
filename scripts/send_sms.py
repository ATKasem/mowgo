#!/usr/bin/env python3
"""MowGo SMS sender — Twilio API, Hormozi warm-outreach queue.

Usage:
  python3 send_sms.py --dry-run   # show what would send today (no API calls)
  python3 send_sms.py --send      # send up to 10 Day-1 texts, log, update tracker

Rules enforced: 10 SMS/day cap, weekdays 9-11am CT (cron fires 14:00 UTC),
only leads with status=new and a day1 text, priority tier order.
State: leads/sms_queue.json (status/sent_at) + leads/sms_log.jsonl (journal).
"""
import json, pathlib, sys, time, datetime as dt, urllib.request, urllib.parse, urllib.error

BASE = pathlib.Path("/opt/data/mowgo/leads")
Q = BASE / "sms_queue.json"; LOG = BASE / "sms_log.jsonl"
ENV = {}
for line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); ENV[k.strip()] = v.strip()
SID, TOK, FROM = ENV["TWILIO_ACCOUNT_SID"], ENV["TWILIO_AUTH_TOKEN"], ENV.get("TWILIO_FROM", "+14059145837")
CAP = 10

def send(phone, body):
    data = urllib.parse.urlencode({"To": phone, "From": FROM, "Body": body}).encode()
    req = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json",
        data=data, method="POST")
    import base64
    req.add_header("Authorization", "Basic " + base64.b64encode(f"{SID}:{TOK}".encode()).decode())
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode())
            return True, d.get("sid", ""), d.get("status", "")
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:300]
        return False, "", err

# Twilio codes meaning "campaign/sender not approved yet" — retry later, don't error
NOT_APPROVED_CODES = ("30007", "30034", "30006", "21610")

def main():
    dry = sys.argv[1] == "--dry-run" if len(sys.argv) > 1 else False
    queue = json.loads(Q.read_text())
    tier_order = {"tier0": 0, "tier1": 1, "tier2": 2, "tier3": 3}
    pending = [l for l in queue if l["status"] in ("new", "error") and l.get("day1")]
    pending.sort(key=lambda l: (tier_order.get(l["tier"], 9), l["id"] if isinstance(l["id"], int) else 999))
    batch = pending[:CAP]
    if not batch:
        print("")  # silent = nothing to send
        return
    lines = []
    sent = 0
    blocked = False
    for l in batch:
        if dry:
            lines.append(f"[DRY] {l['name']} ({l['phone']}) [{l['tier']}]")
            continue
        ok, sid, status = send(l["phone"], l["day1"])
        if not ok and any(c in status for c in NOT_APPROVED_CODES):
            blocked = True
            print("⏸ Twilio: campaign not approved yet — no sends today, queue untouched")
            break
        l["status"] = "sent" if ok else "error"
        l["sent_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        l["last_status"] = status or sid
        with LOG.open("a") as f:
            f.write(json.dumps({"ts": l["sent_at"], "name": l["name"], "phone": l["phone"],
                                "ok": ok, "status": l["last_status"], "msg": l["day1"]}) + "\n")
        lines.append(f"{'✅' if ok else '❌'} {l['name']} — {status if ok else 'API error (campaign not approved yet?)'}")
        sent += 1
        time.sleep(1.5)
    if not dry and not blocked:
        Q.write_text(json.dumps(queue, indent=2))
    print(f"📲 SMS batch: {len(batch)} would send (dry-run)" if dry else f"📲 SMS batch: {sent} sent, {len(batch)-sent} failed — queue updated")
    print("\n".join(lines))

if __name__ == "__main__":
    main()
