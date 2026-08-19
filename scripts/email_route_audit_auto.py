#!/usr/bin/env python3
"""Send route-audit reply and follow-up emails through SendGrid."""

import json
import os
import pathlib
import tempfile
import urllib.error
import urllib.request
from contextlib import contextmanager

import fcntl

ENV_FILE = pathlib.Path("/opt/data/.env")
SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"
FROM_EMAIL = "aaron@mowgoapp.com"
FROM_NAME = "Aaron"
REPLY_TO_EMAIL = "hermes.assistant.job@gmail.com"
STATE_FILE = pathlib.Path("/opt/data/mowgo/leads/route_audit_replies.json")
LOCK_FILE = STATE_FILE.with_suffix(".lock")

AUTO_SUBJECT = "Your route audit - next steps"
AUTO_BODY = """Thanks for the OK.

I'll map your route and send it over within 24 hours.

While you wait, here's what I'd do if I were you: start a free trial of MowGo. It's free for your first 5 clients. No card needed.

The reason: the 3 fixes I sent you work, but they're manual. MowGo does them automatically: zone scheduling, route optimization, recurring jobs. One click.

You're losing $17,887/year. MowGo is $468/year. That math works no matter how you slice it.

Start here (no card): https://mowgoapp.com/#/subscribe

I'll follow up with your route map tomorrow.

- Aaron"""

FOLLOWUP_1_SUBJECT = "Your optimized route map is ready"
FOLLOWUP_1_BODY = """I mapped your route. Here's what I found:

Fixing the route order saves you about 2 hours/day. That's 10 hours/week. That's $2,484/month back in your pocket.

MowGo does this automatically, every day, every route. You set it up once and it reorders stops by proximity.

I can't send the map as an attachment here, but if you start a free trial, it's the first thing you'll see on your Today screen.

Free for 5 clients. No card: https://mowgoapp.com/#/subscribe

- Aaron"""

FOLLOWUP_2_SUBJECT = "Your route map expires Friday"
FOLLOWUP_2_BODY = """I'm only doing 10 of these this week. Your route analysis is still in the queue.

If you want it, start a trial at https://mowgoapp.com/#/subscribe and I'll send your map immediately.

If not, no hard feelings. The audit email has the 3 fixes. Those alone will save you 5-10 hours/week.

- Aaron"""


def _load_api_key():
    """Load the key from the process first, then the shared dotenv file."""
    if os.environ.get("SENDGRID_API_KEY"):
        return os.environ["SENDGRID_API_KEY"]
    if not ENV_FILE.exists():
        return ""
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            if key.strip() == "SENDGRID_API_KEY":
                return value.strip()
    return ""


def load_environment():
    values = dict(os.environ)
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values.setdefault(key.strip(), value.strip())
    return values


def _read_state():
    if not STATE_FILE.exists():
        return []
    data = json.loads(STATE_FILE.read_text())
    if not isinstance(data, list):
        raise RuntimeError(f"Expected a JSON list in {STATE_FILE}")
    return data


def _write_state(records):
    with tempfile.NamedTemporaryFile("w", dir=STATE_FILE.parent, delete=False) as handle:
        json.dump(records, handle, indent=2)
        handle.write("\n")
        temporary = pathlib.Path(handle.name)
    temporary.replace(STATE_FILE)


@contextmanager
def locked_state():
    """Lock the shared JSON state for one read-modify-write transaction."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_FILE.open("a+") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        records = _read_state()
        try:
            yield records
        except Exception:
            raise
        else:
            _write_state(records)
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def send_email(to_email, subject, text_body):
    """Send a plain-text email. Return True only for SendGrid's 202 response."""
    api_key = _load_api_key()
    if not api_key:
        print("  SENDGRID_API_KEY not configured - email not sent")
        return False

    payload = json.dumps({
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": FROM_EMAIL, "name": FROM_NAME},
        "reply_to": {"email": REPLY_TO_EMAIL, "name": FROM_NAME},
        "subject": subject,
        "content": [{"type": "text/plain", "value": text_body}],
    }).encode()
    request = urllib.request.Request(SENDGRID_URL, data=payload, method="POST")
    request.add_header("Authorization", f"Bearer {api_key}")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
            return response.status == 202
    except urllib.error.HTTPError as error:
        print(f"  SendGrid error: {error.code} {error.read().decode(errors='replace')[:200]}")
    except Exception as error:
        print(f"  SendGrid error: {error}")
    return False


def send_auto_response(to_email):
    return send_email(to_email, AUTO_SUBJECT, AUTO_BODY)


def send_followup_1(to_email):
    return send_email(to_email, FOLLOWUP_1_SUBJECT, FOLLOWUP_1_BODY)


def send_followup_2(to_email):
    return send_email(to_email, FOLLOWUP_2_SUBJECT, FOLLOWUP_2_BODY)
