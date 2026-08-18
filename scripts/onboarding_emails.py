#!/usr/bin/env python3
"""MowGo Onboarding Email Sequence — Day 1/2/3/7 nurture for new signups.
Runs daily. Sends via SendGrid. Silent when nothing to send."""

import json, subprocess, datetime, pathlib, os

_env = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1); _env[_k.strip()] = _v.strip()
API_KEY = os.environ.get("SENDGRID_API_KEY") or _env.get("SENDGRID_API_KEY", "")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or _env.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_URL = "https://vqgiynfrpsqddjrayczc.supabase.co"
NOW = datetime.datetime.now(datetime.timezone.utc)

def api_get(url, headers):
    r = subprocess.run(["curl", "-s", url] + [f"-H{h}" for h in headers], capture_output=True, text=True, timeout=30)
    return r.stdout

def api_post(url, headers, body):
    r = subprocess.run(["curl", "-s", "-X", "POST", url, "-H", "Content-Type: application/json", "-d", json.dumps(body)] + [f"-H{h}" for h in headers], capture_output=True, text=True, timeout=30)
    return r.stdout

def send_email(to_email, subject, text_body):
    payload = json.dumps({
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": "aaron@mowgoapp.com", "name": "Aaron from MowGo"},
        "reply_to": {"email": "hello@mowgoapp.com", "name": "Aaron"},
        "subject": subject,
        "content": [{"type": "text/plain", "value": text_body}]
    })
    r = subprocess.run(["curl", "-s", "-w", "\n%{http_code}", "-X", "POST", "https://api.sendgrid.com/v3/mail/send",
         "-H", f"Authorization: Bearer {API_KEY}",
         "-H", "Content-Type: application/json",
         "-d", payload], capture_output=True, text=True, timeout=30)
    parts = r.stdout.strip().split("\n")
    return parts[-1] if parts else "000" == "202"

# ── Templates ────────────────────────────────────────────────────────────────

WELCOME = """Hi {{NAME}},

Welcome to MowGo. You're minutes away from running your crew without the chaos.

The fastest start:
1. Add a client → Clients tab, tap "Add Client"
2. Schedule a job → Today tab, pick a date, assign the client
3. Complete the job → MowGo creates the invoice automatically

Most crews add their first 5 clients in under 3 minutes.

Reply to this email if you get stuck — I help every new operator personally.

— Aaron"""

NO_CLIENT = """Hi {{NAME}},

You signed up for MowGo but haven't added any clients yet.

Your first client takes 10 seconds. After that, it's even faster.

Switching from Yardbook or another tool? Reply with your CSV export and I'll import everything for you within 24 hours.

Or add one now: https://mowgoapp.com/#/clients

— Aaron"""

NO_JOB = """Hi {{NAME}},

You added a client. Now let's book that first job.

On the Today screen, tap any date, pick the client, set a time, tap Save. Done.

When you mark it complete, MowGo creates an invoice automatically — no chasing payments.

https://mowgoapp.com/#/today

— Aaron"""

NO_INVOICE = """Hi {{NAME}},

You completed a job. Did you get paid yet?

MowGo creates an invoice the moment you mark a job done. One tap copies the payment text — send it via text, Venmo, Zelle, or Cash App. No fees.

Check your Invoices tab: https://mowgoapp.com/#/invoices

— Aaron"""

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    auth_headers = ["Authorization: Bearer " + SERVICE_KEY, "apikey: " + SERVICE_KEY]

    # Get recent users from auth
    cutoff = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    auth_raw = api_get(
        f"{SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200&filter%5Bcreated_at%5D=gte.{cutoff}",
        auth_headers
    )
    try:
        auth_data = json.loads(auth_raw)
    except:
        print("Could not parse auth response")
        return

    users = auth_data.get("users", []) if isinstance(auth_data, dict) else auth_data
    if not users:
        print("No new users in the last 7 days")
        return

    # Get profile data for all users
    uids = [u["id"] for u in users if "id" in u]
    if not uids:
        print("No valid user IDs")
        return

    profile_filter = "in.(" + ",".join(uids) + ")"
    profiles_raw = api_get(
        f"{SUPABASE_URL}/rest/v1/profiles?select=id,business_name,created_at,first_client_at,first_job_at,first_invoice_at&id={profile_filter}",
        auth_headers
    )
    try:
        profiles = json.loads(profiles_raw)
    except:
        profiles = []
    profile_map = {p["id"]: p for p in profiles if isinstance(p, dict)}

    # Get already-sent emails
    sent_raw = api_get(f"{SUPABASE_URL}/rest/v1/onboarding_emails?select=user_id,step", auth_headers)
    already_sent = set()
    try:
        for row in json.loads(sent_raw):
            already_sent.add((row["user_id"], row["step"]))
    except:
        pass

    sent_count = 0

    for au in users:
        uid = au.get("id")
        email = au.get("email")
        if not uid or not email:
            continue
        # Skip bot, test, and internal accounts
        if any(x in email.lower() for x in ["bot", "test", "checkouttest", "example.com", "mowgo.internal", "mowgobot"]):
            continue

        prof = profile_map.get(uid)
        if not prof:
            continue

        name = prof.get("business_name") or "there"
        created = prof.get("created_at")
        if not created:
            continue
        try:
            signup_date = datetime.datetime.fromisoformat(created.replace("Z", "+00:00"))
        except:
            continue

        days_since = (NOW - signup_date).days
        has_client = prof.get("first_client_at") is not None
        has_job = prof.get("first_job_at") is not None
        has_invoice = prof.get("first_invoice_at") is not None

        # Day 1: Welcome
        if days_since >= 0 and (uid, "day1_welcome") not in already_sent:
            if send_email(email, "Welcome to MowGo — your first 3 minutes", WELCOME.replace("{{NAME}}", name)):
                api_post(f"{SUPABASE_URL}/rest/v1/onboarding_emails", auth_headers, {"user_id": uid, "step": "day1_welcome"})
                sent_count += 1
                print(f"  Day 1 welcome → {email}")

        # Day 2: No client
        if days_since >= 1 and not has_client and (uid, "day2_no_client") not in already_sent:
            if send_email(email, "Your first client is 10 seconds away", NO_CLIENT.replace("{{NAME}}", name)):
                api_post(f"{SUPABASE_URL}/rest/v1/onboarding_emails", auth_headers, {"user_id": uid, "step": "day2_no_client"})
                sent_count += 1
                print(f"  Day 2 no-client → {email}")

        # Day 3: Client but no job
        if days_since >= 2 and has_client and not has_job and (uid, "day3_no_job") not in already_sent:
            if send_email(email, "Book your first job in 10 seconds", NO_JOB.replace("{{NAME}}", name)):
                api_post(f"{SUPABASE_URL}/rest/v1/onboarding_emails", auth_headers, {"user_id": uid, "step": "day3_no_job"})
                sent_count += 1
                print(f"  Day 3 no-job → {email}")

        # Day 7: Job but no invoice
        if days_since >= 6 and has_job and not has_invoice and (uid, "day7_no_invoice") not in already_sent:
            if send_email(email, "You completed a job — did you get paid?", NO_INVOICE.replace("{{NAME}}", name)):
                api_post(f"{SUPABASE_URL}/rest/v1/onboarding_emails", auth_headers, {"user_id": uid, "step": "day7_no_invoice"})
                sent_count += 1
                print(f"  Day 7 no-invoice → {email}")

    print(f"Sent {sent_count} onboarding emails")

if __name__ == "__main__":
    main()