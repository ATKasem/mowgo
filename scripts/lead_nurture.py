#!/usr/bin/env python3
"""MowGo speed-to-lead Day-2/Day-7 nurture — Efti/Hormozi sales lane.

Reads lead_touches (kind='day2'|'day7', status='queued') due by day-offset
from created_at. DB-backed via the Supabase REST service role (SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY) for email; SMS uses Twilio creds
read from /opt/data/.env the same way send_sms.py does. Two SMS senders must
not stack in one cron window — this runs 9:30am CT, staggered from
send_sms.py (9:00) and mowgo_activation_emails.py (9:15).

Usage:
  python3 lead_nurture.py --dry-run   # show what would send/defer (no API calls, no writes)
  python3 lead_nurture.py --send      # send up to the daily caps, log, update lead_touches, purge stale rows

Caps: 20/day email, 10/day SMS (separate counters — attempt_count/
last_attempt_at track retries so they don't double-count against a cap).
Real send failures: attempt_count++, max 7 attempts then status='failed'.
A2P gate (same approval check as send_sms.py — TWILIO_A2P_APPROVED in
/opt/data/.env): while not approved, SMS rows stay 'queued' forever,
attempt_count still increments so the row is visibly "checked", but it is
NEVER marked 'failed' for that reason — no SMS goes out before campaign
CMbadd01fd23d5a51b3cd5b00aeb923e40 is approved.
Retention: rows older than 90 days are purged on every --send run (no
orphaned PII) — signup-sourced rows also cascade via user_id FK on account
deletion; this purge covers anonymous route-audit rows the FK doesn't reach.
"""
import base64, json, sys, pathlib, datetime as dt, urllib.request, urllib.error, urllib.parse

ENV = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1); ENV[_k.strip()] = _v.strip()

SUPABASE_URL = ENV.get("SUPABASE_URL", "")
SERVICE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_API_KEY = ENV.get("RESEND_API_KEY", "")
TWILIO_SID = ENV.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = ENV.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = ENV.get("TWILIO_FROM", "+14059145837")
A2P_APPROVED = ENV.get("TWILIO_A2P_APPROVED", "").strip().lower() in ("1", "true", "yes")

EMAIL_CAP = 20
SMS_CAP = 10
MAX_ATTEMPTS = 7
PURGE_DAYS = 90


def iso(dt_obj):
    return dt_obj.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def _query_string(pairs):
    return "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(str(v), safe='(),.:*')}" for k, v in pairs)


def rest(method, path, body=None, params=None, prefer="return=representation"):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + _query_string(params)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", prefer)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return True, (json.loads(raw) if raw else [])
    except urllib.error.HTTPError as e:
        return False, e.read().decode()[:500]
    except urllib.error.URLError as e:
        return False, str(e)


def send_resend_email(to, subject, html):
    if not RESEND_API_KEY:
        return False, "RESEND_API_KEY not configured"
    payload = json.dumps({"from": "MowGo <invoices@mowgoapp.com>", "to": to, "subject": subject, "html": html}).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {RESEND_API_KEY}")
    req.add_header("Content-Type", "application/json")
    # Cloudflare blocks urllib's default Python-urllib UA with error 1010
    req.add_header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
            return True, ""
    except urllib.error.HTTPError as e:
        return False, e.read().decode()[:300]
    except urllib.error.URLError as e:
        return False, str(e)


def send_sms(phone, body):
    data = urllib.parse.urlencode({"To": phone, "From": TWILIO_FROM, "Body": body}).encode()
    req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json", data=data, method="POST")
    req.add_header("Authorization", "Basic " + base64.b64encode(f"{TWILIO_SID}:{TWILIO_TOKEN}".encode()).decode())
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            json.loads(r.read().decode())
            return True, ""
    except urllib.error.HTTPError as e:
        return False, e.read().decode()[:300]
    except urllib.error.URLError as e:
        return False, str(e)


# Day-2: value + honest objection (Efti). Every figure traceable to
# Compare.jsx:61-62 (verified 2026-08-05) — Solo=$39 single-owner, the crew
# comparison is $79 flat.
DAY2_EMAIL_SUBJECT = "Jobber charges per crew member. MowGo doesn't."
DAY2_EMAIL_HTML = (
    "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#17201b;line-height:1.6\">"
    "<h1>The honest comparison</h1>"
    "<p>Jobber is $139/mo + $29 per extra crew member. MowGo is $79 flat for crews — whole crew included, no per-user fees. Solo is $39 for single operators.</p>"
    "<p><a href=\"https://mowgoapp.com/#/compare\">See the full comparison</a></p>"
    "</body></html>"
)
DAY2_SMS = "MowGo: Jobber runs $139/mo + $29/user. MowGo Crew is $79 flat, whole crew included. Solo is $39. Reply STOP to opt out."

# Day-7: concierge pitch + real scarcity (20 new businesses onboarded/week —
# same figure quoted on RouteAudit.jsx's own scarcity line).
DAY7_EMAIL_SUBJECT = "We onboard 20 new businesses a week"
DAY7_EMAIL_HTML = (
    "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#17201b;line-height:1.6\">"
    "<h1>Free concierge setup — your clients imported, first 30 days pre-scheduled</h1>"
    "<p>We onboard 20 new businesses a week — reply to grab a setup slot.</p>"
    "<p><a href=\"https://mowgoapp.com/#/login?mode=signup\">Start free</a></p>"
    "<p style=\"margin-top:12px\"><a href=\"https://calendly.com/aaron-mowgo/15min\" style=\"color:#047857\">Book a free setup call →</a></p>"
    "</body></html>"
)
DAY7_SMS = "MowGo: We onboard 20 new businesses a week. Reply to grab a setup slot. mowgoapp.com Reply STOP to opt out."

# Day-3: rates report follow-up — how to raise prices (only for rates_report source)
DAY3_EMAIL_SUBJECT = "How to raise your prices (the right way)"
DAY3_EMAIL_HTML = (
    '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17201b;line-height:1.6">'
    '<h1>You got the rates. Now what?</h1>'
    '<p>The data in the report is real — but raising prices is where most crews freeze.</p>'
    '<p><strong>3 rules for a clean price bump:</strong></p>'
    '<ol>'
    '<li><strong>Raise on new customers first.</strong> Grandpa\'s Lawn Service doesn\'t know what your other customers pay. New prospects have nothing to compare against.</li>'
    '<li><strong>Grandfather your loyal ones.</strong> The customer who\'s been with you 3 years and pays on time? Keep them at their current rate. The value of a reliable payer beats a $5 bump.</li>'
    '<li><strong>Anchor with the high number.</strong> When quoting a new job, say "$65 for bi-weekly, $52 for weekly" — not "$52 for weekly, $65 for bi-weekly." The first number sets the anchor.</li>'
    '</ol>'
    '<p><a href="https://mowgoapp.com/#/">MowGo helps you track every client\'s rate, schedule, and history in one place →</a></p>'
    '</body></html>'
)

EMAIL_CONTENT = {"day2": (DAY2_EMAIL_SUBJECT, DAY2_EMAIL_HTML), "day3": (DAY3_EMAIL_SUBJECT, DAY3_EMAIL_HTML), "day7": (DAY7_EMAIL_SUBJECT, DAY7_EMAIL_HTML)}
SMS_CONTENT = {"day2": DAY2_SMS, "day7": DAY7_SMS}
DAY_OFFSET = {"day2": 2, "day3": 3, "day7": 7}


def due_rows(kind, now):
    cutoff = iso(now - dt.timedelta(days=DAY_OFFSET[kind]))
    ok, rows = rest("GET", "lead_touches", params=[
        ("select", "id,lead_email,lead_phone,channel,attempt_count"),
        ("kind", f"eq.{kind}"),
        ("status", "eq.queued"),
        ("created_at", f"lte.{cutoff}"),
    ])
    if not ok:
        print(f"lead_touches query failed ({kind}): {rows}", file=sys.stderr)
        return []
    return rows


def record(row_id, status, attempt_count, now):
    patch = {"status": status, "attempt_count": attempt_count, "last_attempt_at": iso(now)}
    if status == "sent":
        patch["sent_at"] = iso(now)
    rest("PATCH", "lead_touches", body=patch, params=[("id", f"eq.{row_id}")])


def purge_stale(now):
    cutoff = iso(now - dt.timedelta(days=PURGE_DAYS))
    ok, _ = rest("DELETE", "lead_touches", params=[("created_at", f"lt.{cutoff}")], prefer="return=minimal")
    if not ok:
        print("lead_touches purge failed", file=sys.stderr)


def run(dry_run):
    now = now_utc()
    if not dry_run:
        purge_stale(now)

    email_budget, sms_budget = EMAIL_CAP, SMS_CAP
    email_sent = email_failed = sms_sent = sms_deferred = sms_failed = 0
    lines = []

    for kind in ("day2", "day3", "day7"):
        for row in due_rows(kind, now):
            attempt_count = row["attempt_count"] + 1
            if row["channel"] == "email":
                if email_budget <= 0:
                    continue
                email_budget -= 1
                if dry_run:
                    lines.append(f"[DRY] email {kind} -> {row['lead_email']}")
                    continue
                subject, html = EMAIL_CONTENT[kind]
                ok, err = send_resend_email(row["lead_email"], subject, html)
                record(row["id"], "sent" if ok else ("failed" if attempt_count >= MAX_ATTEMPTS else "queued"), attempt_count, now)
                lines.append(f"{'✅' if ok else '❌'} email {kind} -> {row['lead_email']}" + ("" if ok else f" — {err}"))
                email_sent += 1 if ok else 0
                email_failed += 0 if ok else 1
            else:  # sms
                if sms_budget <= 0:
                    continue
                if not A2P_APPROVED:
                    # Gated: never counts against the cap, never fails — just
                    # re-checked next run until the campaign is approved.
                    sms_deferred += 1
                    if not dry_run:
                        record(row["id"], "queued", attempt_count, now)
                    lines.append(f"⏸ sms {kind} -> {row['lead_phone']} (A2P not approved yet)")
                    continue
                if not row.get("lead_phone"):
                    continue
                sms_budget -= 1
                if dry_run:
                    lines.append(f"[DRY] sms {kind} -> {row['lead_phone']}")
                    continue
                sms_body = SMS_CONTENT.get(kind)
                if sms_body is None:
                    print(f"⚠️ sms {kind}: no template — skipping", file=sys.stderr)
                    sms_deferred += 1
                    continue
                ok, err = send_sms(row["lead_phone"], sms_body)
                record(row["id"], "sent" if ok else ("failed" if attempt_count >= MAX_ATTEMPTS else "queued"), attempt_count, now)
                lines.append(f"{'✅' if ok else '❌'} sms {kind} -> {row['lead_phone']}" + ("" if ok else f" — {err}"))
                sms_sent += 1 if ok else 0
                sms_failed += 0 if ok else 1

    if not lines:
        print("")  # silent = nothing to send
        return
    header = (
        f"🎯 Lead nurture batch: {len(lines)} candidates"
        if dry_run else
        f"🎯 Lead nurture batch: {email_sent} email sent ({email_failed} failed), {sms_sent} sms sent ({sms_failed} failed, {sms_deferred} A2P-gated)"
    )
    print(header)
    print("\n".join(lines))


def main():
    if not SUPABASE_URL or not SERVICE_KEY:
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured", file=sys.stderr)
        sys.exit(1)
    mode = sys.argv[1] if len(sys.argv) > 1 else "--send"
    run(dry_run=(mode != "--send"))


if __name__ == "__main__":
    main()
