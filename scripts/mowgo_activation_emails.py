#!/usr/bin/env python3
"""MowGo activation nudge emails — Hormozi/Barry activation lane.

T1 (24h after signup, no first_job_at), T2 (72h after signup, no
first_invoice_at), winback2 (7d after cancelled_at). DB-backed — NOT a
mirror of send_sms.py's local-JSON-queue architecture: this script reads
profiles + activation_touches via the Supabase REST service role and sends
through Resend, not Twilio. It shares only the cron cadence/cap/idempotency
shape with send_sms.py.

Usage:
  python3 mowgo_activation_emails.py --dry-run   # show what would send (no API calls, no writes)
  python3 mowgo_activation_emails.py --send      # send up to 20/day, log, update activation_touches
  python3 mowgo_activation_emails.py --report    # weekly activation cohort report (plain text, run Mondays)

Idempotency: UNIQUE(user_id, kind) on activation_touches + status guard —
safe to re-run. Failures are marked status='failed' with attempt_count/
last_attempt_at and retried on the next run, up to 7 attempts, then left
'failed' (dropped, no further retries).

Env (read from /opt/data/.env, same convention as send_sms.py):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
"""
import json, sys, pathlib, statistics, datetime as dt, urllib.request, urllib.error, urllib.parse

ENV = {}
for _line in pathlib.Path("/opt/data/.env").read_text().splitlines():
    if "=" in _line and not _line.strip().startswith("#"):
        _k, _v = _line.split("=", 1); ENV[_k.strip()] = _v.strip()

SUPABASE_URL = ENV.get("SUPABASE_URL", "")
SERVICE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_API_KEY = ENV.get("RESEND_API_KEY", "")
CAP = 20
MAX_ATTEMPTS = 7


def iso(dt_obj):
    return dt_obj.strftime("%Y-%m-%dT%H:%M:%S+00:00")


def now_utc():
    return dt.datetime.now(dt.timezone.utc)


def _query_string(pairs):
    # PostgREST filter syntax (in.(a,b), lte.X) needs '(', ')', ',', '.', ':'
    # left unescaped; repeated keys AND filters on the same column together.
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


def _greeting(name):
    if not name:
        return ""
    # HTML-escape user-supplied business_name before it lands in an email body
    # (self-only impact today — recipient == account that set the name — but
    # normalize with the rest of the batch, which escapes user input).
    escaped = (
        str(name)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )
    return f", {escaped}"


def t1_html(name):
    return (
        "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#17201b;line-height:1.6\">"
        f"<h1>Schedule your first job in 2 minutes{_greeting(name)}</h1>"
        "<ol>"
        "<li>Open <b>Clients</b> and add your first client (skip if you already have one).</li>"
        "<li>Open <b>Today</b> and tap + to schedule a job.</li>"
        "<li>Mark it done when you finish — the invoice is created automatically.</li>"
        "</ol>"
        "<p>Want us to do this for you? Reply and we'll import your clients and pre-schedule your first 30 days (Solo/Crew, 48h).</p>"
        "<p><a href=\"https://mowgoapp.com/#/app/today\">Open MowGo</a></p>"
        "</body></html>"
    )


def t2_html(name):
    return (
        "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#17201b;line-height:1.6\">"
        f"<h1>Your first invoice is 3 taps{_greeting(name)}</h1>"
        "<ol>"
        "<li>Open <b>Today</b> and mark a job complete.</li>"
        "<li>Your invoice is created automatically — no typing.</li>"
        "<li>Tap to text your client a one-tap payment link.</li>"
        "</ol>"
        "<p>30-day Rain-Proof Guarantee — refund if you're not more organized.</p>"
        "<p><a href=\"https://mowgoapp.com/#/app/today\">Open MowGo</a></p>"
        "</body></html>"
    )


def winback2_html(name):
    return (
        "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#17201b;line-height:1.6\">"
        f"<h1>We made it easy to come back{_greeting(name)}</h1>"
        "<p>Your clients and job history are still here — nothing was deleted. Export your data anytime from Settings, or pick up right where you left off.</p>"
        "<p>The Rain-Proof Guarantee still applies: unused months are refunded.</p>"
        "<p>Reply to this email and we'll help you get set back up.</p>"
        "<p><a href=\"https://mowgoapp.com/#/login\">Log back in</a></p>"
        "</body></html>"
    )


SUBJECTS = {
    "t1": "Schedule your first job in 2 minutes",
    "t2": "Your first invoice is 3 taps",
    "winback2": "We made it easy to come back",
}
HTML_BUILDERS = {"t1": t1_html, "t2": t2_html, "winback2": winback2_html}


def fetch_touches(user_ids, kind):
    if not user_ids:
        return {}
    ok, data = rest("GET", "activation_touches", params=[
        ("select", "id,user_id,status,attempt_count"),
        ("user_id", f"in.({','.join(user_ids)})"),
        ("kind", f"eq.{kind}"),
    ])
    if not ok:
        print(f"activation_touches query failed ({kind}): {data}", file=sys.stderr)
        return {}
    return {row["user_id"]: row for row in data}


def admin_emails():
    """id -> email for every auth user (GoTrue admin API, service role).
    profiles has no email column (001 schema); owner emails live in auth.users."""
    out = {}
    page = 1
    while True:
        url = f"{SUPABASE_URL}/auth/v1/admin/users?per_page=200&page={page}"
        req = urllib.request.Request(url)
        req.add_header("apikey", SERVICE_KEY)
        req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                payload = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            print(f"admin users fetch failed (page {page}): {e.read().decode()[:300]}", file=sys.stderr)
            return out
        except urllib.error.URLError as e:
            print(f"admin users fetch failed (page {page}): {e}", file=sys.stderr)
            return out
        rows = payload.get("users", []) if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            rows = []
        for row in rows:
            if row.get("id") and row.get("email"):
                out[row["id"]] = row["email"]
        if len(rows) < 200:
            break
        page += 1
    return out


def candidates_for_kind(kind, now, emails_cache):
    """emails_cache: mutable dict shared across the 3 kinds in one run so the
    paginated GoTrue admin-users scan happens at most once per run, not 3x
    (the user list can't change mid-run)."""
    if kind == "t1":
        params = [
            ("select", "id,business_name,created_at"),
            ("created_at", f"lte.{iso(now - dt.timedelta(hours=24))}"),
            ("created_at", f"gte.{iso(now - dt.timedelta(days=14))}"),
            ("cancelled_at", "is.null"),
            ("first_job_at", "is.null"),
        ]
    elif kind == "t2":
        params = [
            ("select", "id,business_name,created_at"),
            ("created_at", f"lte.{iso(now - dt.timedelta(hours=72))}"),
            ("created_at", f"gte.{iso(now - dt.timedelta(days=14))}"),
            ("cancelled_at", "is.null"),
            ("first_invoice_at", "is.null"),
        ]
    else:  # winback2 — window is on cancelled_at, NOT created_at (cancellations happen 14-30+ days after signup)
        params = [
            ("select", "id,business_name,cancelled_at"),
            ("cancelled_at", f"lte.{iso(now - dt.timedelta(days=7))}"),
            ("cancelled_at", f"gte.{iso(now - dt.timedelta(days=14))}"),
        ]
    ok, profiles = rest("GET", "profiles", params=params)
    if not ok:
        print(f"profiles query failed ({kind}): {profiles}", file=sys.stderr)
        return []
    emails = emails_cache if profiles else {}
    touches = fetch_touches([p["id"] for p in profiles], kind)
    out = []
    for p in profiles:
        existing = touches.get(p["id"])
        if existing and (existing["status"] == "sent" or existing["attempt_count"] >= MAX_ATTEMPTS):
            continue  # already sent, or exhausted retries — never re-attempt
        p["email"] = emails.get(p["id"], "")
        out.append((p, existing))
    return out


def record_result(kind, profile, existing, ok, now):
    attempt_count = (existing["attempt_count"] if existing else 0) + 1
    now_iso = iso(now)
    patch = {"status": "sent" if ok else "failed", "attempt_count": attempt_count, "last_attempt_at": now_iso}
    if ok:
        patch["sent_at"] = now_iso
    if existing:
        rest("PATCH", "activation_touches", body=patch, params=[("id", f"eq.{existing['id']}")])
    else:
        body = {"user_id": profile["id"], "kind": kind, **patch}
        # ignore-duplicates: another concurrent run may have inserted this
        # (user_id, kind) row first — the UNIQUE constraint makes that safe.
        rest("POST", "activation_touches", body=body, params=[("on_conflict", "user_id,kind")], prefer="return=minimal,resolution=ignore-duplicates")


def run_send(dry_run):
    now = now_utc()
    sent, failed, skipped_cap = 0, 0, 0
    lines = []
    budget = CAP
    # Resolve the id→email map ONCE per run (GoTrue admin scan is paginated and
    # expensive; the user list can't change mid-run) instead of per-kind.
    emails_cache = admin_emails()
    for kind in ("t1", "t2", "winback2"):
        for profile, existing in candidates_for_kind(kind, now, emails_cache):
            if budget <= 0:
                skipped_cap += 1
                continue
            name = profile.get("business_name") or ""
            email = profile.get("email") or ""
            if not email:
                continue
            if dry_run:
                lines.append(f"[DRY] {kind} -> {email} ({name or 'no business name'})")
                budget -= 1
                continue
            ok, err = send_resend_email(email, SUBJECTS[kind], HTML_BUILDERS[kind](name))
            record_result(kind, profile, existing, ok, now)
            lines.append(f"{'✅' if ok else '❌'} {kind} -> {email}" + ("" if ok else f" — {err}"))
            sent += 1 if ok else 0
            failed += 0 if ok else 1
            budget -= 1
    if not lines:
        print("")  # silent = nothing to send
        return
    header = f"📧 Activation batch: {len(lines)} candidates" if dry_run else f"📧 Activation batch: {sent} sent, {failed} failed — {skipped_cap} deferred to next run (cap {CAP}/day)"
    print(header)
    print("\n".join(lines))


def run_report():
    now = now_utc()
    ok, profiles = rest("GET", "profiles", params=[
        ("select", "id,created_at,first_client_at,first_job_at,first_invoice_at,cancelled_at"),
        ("created_at", f"gte.{iso(now - dt.timedelta(days=14))}"),
    ])
    if not ok:
        print(f"Weekly activation report failed: {profiles}", file=sys.stderr)
        sys.exit(1)
    n = len(profiles)
    if n == 0:
        print("Weekly activation report: 0 signups in the last 14 days.")
        return
    pct = lambda field: round(100 * sum(1 for p in profiles if p.get(field)) / n)
    hours_to_job = []
    for p in profiles:
        if p.get("created_at") and p.get("first_job_at"):
            created = dt.datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
            job = dt.datetime.fromisoformat(p["first_job_at"].replace("Z", "+00:00"))
            hours_to_job.append((job - created).total_seconds() / 3600)
    median_hours = round(statistics.median(hours_to_job), 1) if hours_to_job else None
    cancellations = sum(1 for p in profiles if p.get("cancelled_at"))
    print("📊 Weekly activation report — last 14 days")
    print(f"Signups: {n}")
    print(f"First client added: {pct('first_client_at')}%")
    print(f"First job scheduled: {pct('first_job_at')}%")
    print(f"First invoice created: {pct('first_invoice_at')}%")
    print(f"Median hours to first job: {median_hours if median_hours is not None else 'n/a'}")
    print(f"Cancellations: {cancellations}")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--dry-run"
    if not SUPABASE_URL or not SERVICE_KEY:
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured", file=sys.stderr)
        sys.exit(1)
    if mode == "--report":
        run_report()
    elif mode == "--send":
        run_send(dry_run=False)
    else:
        run_send(dry_run=True)


if __name__ == "__main__":
    main()
