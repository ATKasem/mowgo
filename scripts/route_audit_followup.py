#!/usr/bin/env python3
"""Send due route-audit follow-ups without double-sending."""

import datetime as dt
import json
import urllib.error
import urllib.parse
import urllib.request

try:
    from scripts.email_route_audit_auto import load_environment, locked_state, send_followup_1, send_followup_2
except ModuleNotFoundError:  # Support direct execution from scripts/.
    from email_route_audit_auto import load_environment, locked_state, send_followup_1, send_followup_2

UTC = dt.timezone.utc


def registered_emails():
    """Return registered auth emails, or None when the trial gate cannot be checked."""
    environment = load_environment()
    url = environment.get("SUPABASE_URL", "").rstrip("/")
    key = environment.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("Supabase not configured; follow-ups skipped")
        return None
    emails = set()
    page = 1
    while True:
        request = urllib.request.Request(f"{url}/auth/v1/admin/users?per_page=200&page={page}")
        request.add_header("apikey", key)
        request.add_header("Authorization", f"Bearer {key}")
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode())
        except (OSError, urllib.error.HTTPError, json.JSONDecodeError) as error:
            print(f"Could not check trial status: {error}")
            return None
        users = payload.get("users", []) if isinstance(payload, dict) else payload
        for user in users:
            if user.get("email"):
                emails.add(user["email"].strip().lower())
        if len(users) < 200:
            return emails
        page += 1


def parse_time(value):
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def process_followups(now=None):
    now = now or dt.datetime.now(UTC)
    signups = registered_emails()
    if signups is None:
        return False
    changed = False
    with locked_state() as records:
        for record in records:
            email = record.get("email", "").strip().lower()
            if email in signups:
                record["trial_started"] = True
                changed = True
            if record.get("trial_started") or not record.get("sent_auto"):
                continue
            try:
                elapsed = now - parse_time(record["replied_at"])
            except (KeyError, TypeError, ValueError):
                print(f"Skipping invalid route-audit record: {email or '<unknown>'}")
                continue

            had_f1 = bool(record.get("sent_f1"))
            if elapsed >= dt.timedelta(hours=24) and not had_f1:
                record["sent_f1"] = True  # Reserve before the network call.
                if send_followup_1(email):
                    changed = True
                    print(f"Sent route-audit follow-up 1 to {email}")
                else:
                    record["sent_f1"] = False
                    print(f"Failed route-audit follow-up 1 to {email}")

            if elapsed >= dt.timedelta(hours=72) and had_f1 and not record.get("sent_f2"):
                record["sent_f2"] = True  # Reserve before the network call.
                if send_followup_2(email):
                    changed = True
                    print(f"Sent route-audit follow-up 2 to {email}")
                else:
                    record["sent_f2"] = False
                    print(f"Failed route-audit follow-up 2 to {email}")
    return changed


if __name__ == "__main__":
    process_followups()
