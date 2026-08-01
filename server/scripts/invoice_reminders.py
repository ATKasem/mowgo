#!/usr/bin/env python3
"""
MowGo Invoice Reminders — v1 (0.5-day build, kicked off Aug 1 by 8am action)

Sends payment reminders for unpaid invoices older than REMIND_AFTER_DAYS days.
Runs as a hermes cron job (daily ~12:30Z / 7:30am CST).

Flow:
  1. Read credentials from server/.env (SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, APP_URL)
  2. Query Supabase: invoices where status=eq.unpaid and created_at < now - REMIND_AFTER_DAYS
  3. Skip invoices already reminded within COOLDOWN_DAYS (local state file)
  4. Send Resend email: "Payment reminder — Invoice from MowGo" with pay link
  5. Record reminder in state file; append to /opt/data/logs/invoice_reminders.log

Usage:
  python3 invoice_reminders.py            # send due reminders
  python3 invoice_reminders.py --dry-run  # show what would be sent (no email, no state write)
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.request
import urllib.error

REPO = "/opt/data/mowgo"
STATE_FILE = os.path.join(REPO, ".invoice_reminder_state.json")
LOG_FILE = "/opt/data/logs/invoice_reminders.log"
REMIND_AFTER_DAYS = int(os.environ.get("REMIND_AFTER_DAYS", "7"))
COOLDOWN_DAYS = int(os.environ.get("COOLDOWN_DAYS", "7"))
SENDER = "MowGo <invoices@mowgo.app>"


def load_env(path):
    env = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env


def log(msg):
    line = f"[{dt.datetime.now(dt.timezone.utc).isoformat()}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def supabase_get(url, service_key, path, query):
    req = urllib.request.Request(
        f"{url}{path}?{query}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def send_resend(api_key, to, subject, html):
    body = json.dumps({"from": SENDER, "to": [to], "subject": subject, "html": html}).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env = load_env(os.path.join(REPO, "server/.env"))
    url = env.get("SUPABASE_URL", "").rstrip("/")
    service_key = env.get("SUPABASE_SERVICE_KEY", "")
    resend_key = env.get("RESEND_API_KEY", "")
    app_url = env.get("APP_URL", "https://mowgo.pages.dev").rstrip("/")

    missing = [n for n, v in [("SUPABASE_URL", url), ("SUPABASE_SERVICE_KEY", service_key),
                              ("RESEND_API_KEY", resend_key)] if not v]
    if missing:
        log(f"ABORT — missing env vars in server/.env: {missing}")
        sys.exit(1)

    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=REMIND_AFTER_DAYS)).isoformat().replace("+00:00", "Z")
    try:
        invoices = supabase_get(
            url, service_key, "/rest/v1/invoices",
            f"select=id,amount,status,created_at,clients(email,name)&status=eq.unpaid"
            f"&created_at=lt.{cutoff}&order=created_at.asc",
        )
    except urllib.error.HTTPError as e:
        log(f"ABORT — Supabase query failed: HTTP {e.code} {e.read().decode()[:200]}")
        sys.exit(1)

    state = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                state = json.load(f)
        except (json.JSONDecodeError, OSError):
            state = {}

    due = []
    for inv in invoices:
        client = inv.get("clients") or {}
        email = client.get("email")
        if not email:
            log(f"SKIP invoice {inv['id']} — client has no email")
            continue
        last = state.get(str(inv["id"]))
        if last:
            last_dt = dt.datetime.fromisoformat(last)
            if (dt.datetime.now(dt.timezone.utc) - last_dt).days < COOLDOWN_DAYS:
                continue
        due.append(inv)

    if not due:
        log(f"OK — no unpaid invoices older than {REMIND_AFTER_DAYS}d "
            f"({len(invoices)} unpaid found, {len(invoices) - len(due)} skipped/cooldown)")
        return

    log(f"FOUND {len(due)} invoice(s) due for reminder:")
    for inv in due:
        client = inv.get("clients") or {}
        log(f"  - {inv['id']} ${inv.get('amount')} → {client.get('email')} (created {inv.get('created_at')})")

    if args.dry_run:
        log("DRY RUN — no emails sent, state not written")
        return

    sent = 0
    for inv in due:
        client = inv.get("clients") or {}
        name = client.get("name") or "there"
        amount = inv.get("amount")
        pay_url = f"{app_url}/pay/{inv['id']}"
        subject = f"Payment reminder — MowGo invoice ${amount}"
        html = (
            f"<p>Hi {name},</p>"
            f"<p>This is a friendly reminder that your lawn care invoice of "
            f"<strong>${amount}</strong> is due.</p>"
            f"<p><a href=\"{pay_url}\" style=\"background:#16a34a;color:#fff;padding:10px 18px;"
            f"border-radius:6px;text-decoration:none\">Pay online</a></p>"
            f"<p style=\"color:#666\">Or copy: {pay_url}</p>"
            f"<p>— MowGo</p>"
        )
        try:
            result = send_resend(resend_key, client["email"], subject, html)
            state[str(inv["id"])] = dt.datetime.now(dt.timezone.utc).isoformat()
            log(f"SENT reminder for {inv['id']} → {client['email']} (id {result.get('id')})")
            sent += 1
        except urllib.error.HTTPError as e:
            log(f"FAILED reminder for {inv['id']}: HTTP {e.code} {e.read().decode()[:200]}")
        except Exception as e:  # noqa: BLE001
            log(f"FAILED reminder for {inv['id']}: {e}")

    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    log(f"DONE — sent {sent}/{len(due)} reminders")


if __name__ == "__main__":
    main()
