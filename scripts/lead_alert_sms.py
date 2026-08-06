#!/usr/bin/env python3
"""MowGo qualified-lead SMS alert — texts the owner when a REAL ICP lead
submits a route audit (10-50 lawns/wk + solo/2-3 crew — same filter as the
Discord alert in route-audit.js). Watchdog pattern: SILENT when nothing new;
prints one line per SMS sent (stdout delivered verbatim by the cron).

Owner notification (not a consumer campaign) — sent from the MowGo Twilio
number to BLASIAN_PHONE. Creds from /opt/data/.env (send_sms.py convention).

  python3 lead_alert_sms.py            # poll once, send for new qualified leads
  python3 lead_alert_sms.py --force    # ignore state, alert all qualified today (test)
"""
import json, sys, pathlib, base64, urllib.parse, urllib.request, urllib.error, datetime as dt

ENV = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1)
        ENV[_k.strip()] = _v.strip()

SUPABASE_URL = ENV.get("SUPABASE_URL", "")
SERVICE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
SID = ENV.get("TWILIO_ACCOUNT_SID", "")
TOK = ENV.get("TWILIO_AUTH_TOKEN", "")
FROM = ENV.get("TWILIO_FROM", "+14059145837")
TO = ENV.get("BLASIAN_PHONE", "")

STATE_DIR = pathlib.Path("/opt/data/.hermes/scripts/state")
STATE_FILE = STATE_DIR / "lead_alert_seen.json"

QUALIFIED_LAWNS = {"10_25", "25_50"}
QUALIFIED_CREWS = {"solo", "2_3"}
BUCKET_LABELS = {"under_10": "Under 10", "10_25": "10-25", "25_50": "25-50", "50_plus": "50+"}


def load_state():
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"last_id": None}


def save_state(state):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state))


def fetch_new_qualified(after_id):
    params = [
        ("select", "id,name,email,zip,lawns_bucket,crew_bucket,revenue_impact_month,created_at"),
        ("order", "created_at.asc"),
    ]
    if after_id:
        params.append(("id", f"gt.{after_id}"))
    qs = "&".join(
        f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(str(v), safe='(),.:*')}" for k, v in params
    )
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/route_audits?{qs}")
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            rows = json.loads(r.read().decode())
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print(f"route_audits query failed: {e}", file=sys.stderr)
        return []
    return [
        row for row in rows
        if row.get("lawns_bucket") in QUALIFIED_LAWNS
        and row.get("crew_bucket") in QUALIFIED_CREWS
        and row.get("email")
    ]


def send_sms(body):
    data = urllib.parse.urlencode({"To": TO, "From": FROM, "Body": body}).encode()
    req = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json",
        data=data, method="POST",
    )
    req.add_header("Authorization", "Basic " + base64.b64encode(f"{SID}:{TOK}".encode()).decode())
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return True, json.loads(r.read().decode()).get("status", "")
    except urllib.error.HTTPError as e:
        return False, e.read().decode()[:300]


def main():
    force = "--force" in sys.argv
    if not TO:
        print("BLASIAN_PHONE not set in /opt/data/.env", file=sys.stderr)
        sys.exit(1)
    state = load_state() if not force else {"last_id": None}
    rows = fetch_new_qualified(state.get("last_id"))
    if not rows:
        return  # silent — nothing new
    sent = 0
    for row in rows:
        body = (
            f"🔔 New MowGo route-audit lead: {row['name']} · "
            f"{BUCKET_LABELS.get(row['lawns_bucket'], row['lawns_bucket'])} lawns/wk · "
            f"~${row.get('revenue_impact_month', 0):,}/mo impact · {row['email']} · {row.get('zip', '')}"
        )
        ok, info = send_sms(body)
        if ok:
            sent += 1
            print(f"📲 SMS sent → {TO}: {row['name']} ({info})")
        else:
            print(f"❌ SMS failed for {row['name']}: {info}", file=sys.stderr)
        state["last_id"] = row["id"]
    save_state(state)
    if sent == 0:
        sys.exit(1)  # failed sends shouldn't silently pass


if __name__ == "__main__":
    main()
