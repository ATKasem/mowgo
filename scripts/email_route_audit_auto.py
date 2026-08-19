#!/usr/bin/env python3
"""Send route-audit reply and follow-up emails through Resend."""

import json
import os
import pathlib
import tempfile
import urllib.error
import urllib.request
from contextlib import contextmanager

import fcntl

ENV_FILE = pathlib.Path("/opt/data/.env")
RESEND_URL = "https://api.resend.com/emails"
FROM_EMAIL = "aaron@mowgoapp.com"
FROM_NAME = "Aaron"
REPLY_TO_EMAIL = "hermes.assistant.job@gmail.com"
STATE_FILE = pathlib.Path("/opt/data/mowgo/leads/route_audit_replies.json")
LOCK_FILE = STATE_FILE.with_suffix(".lock")

AUTO_SUBJECT = "Your route audit - next steps"
AUTO_BODY = """Thanks for the OK.

I'll map your route and send it over within 24 hours.

While you wait, the numbers from your audit: a crew your size is losing about $17,887 a year to route waste. That's drive time that could be billable hours.

MowGo fixes that automatically. It also handles the part that most owners tell me is the second biggest time sink: invoicing. You set a job to repeat, it schedules itself, and the invoice goes out when the work is done. No more building invoices from scratch each week.

Free for your first 5 clients. No card needed. https://mowgoapp.com/#/subscribe

I'll follow up with your route map tomorrow.

- Aaron"""

FOLLOWUP_1_SUBJECT = "Your optimized route map is ready"
FOLLOWUP_1_BODY = """Your route map is ready.

If you're running 10 or more stops a day, reordering them by proximity saves you about 10 to 15 hours a week. That's $2,484 a month in season, about $17,887 over the year.

MowGo does this automatically, every day, on every route. It also handles your invoicing: set the schedule once, the job shows up, and the invoice goes out when the work is done. No more Sunday nights building invoices.

The map is the first thing you'll see on your Today screen if you start a trial. Free for 5 clients, no card. https://mowgoapp.com/#/subscribe

- Aaron"""

FOLLOWUP_2_SUBJECT = "Your route map expires Friday"
FOLLOWUP_2_BODY = """I'm doing 10 of these route maps this week. Yours is still in the queue.

If you want it, start a trial at https://mowgoapp.com/#/subscribe and I'll send your map today. The route optimizer, invoice scheduler, and everything else in MowGo comes with it.

If not, no problem. The 3 fixes in your audit email will save you 5 to 10 hours a week on their own. MowGo just makes them automatic.

After Friday the map goes to the next crew.

- Aaron"""


def _load_api_key():
    """Load the key from the process first, then the shared dotenv file."""
    if os.environ.get("RESEND_API_KEY"):
        return os.environ["RESEND_API_KEY"]
    if not ENV_FILE.exists():
        return ""
    for line in ENV_FILE.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            if key.strip() == "RESEND_API_KEY":
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
    """Send a plain-text email via Resend. Return True for a 200 response."""
    api_key = _load_api_key()
    if not api_key:
        print("  RESEND_API_KEY not configured - email not sent")
        return False

    payload = json.dumps({
        "from": f"{FROM_NAME} <{FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "text": text_body,
        "reply_to": REPLY_TO_EMAIL,
    }).encode()
    request = urllib.request.Request(RESEND_URL, data=payload, method="POST")
    request.add_header("Authorization", f"Bearer {api_key}")
    request.add_header("Content-Type", "application/json")
    request.add_header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
            return response.status == 200
    except urllib.error.HTTPError as error:
        print(f"  Resend error: {error.code} {error.read().decode(errors='replace')[:200]}")
    except Exception as error:
        print(f"  Resend error: {error}")
    return False


def send_auto_response(to_email):
    return send_email(to_email, AUTO_SUBJECT, AUTO_BODY)


def send_followup_1(to_email):
    return send_email(to_email, FOLLOWUP_1_SUBJECT, FOLLOWUP_1_BODY)


def send_followup_2(to_email):
    return send_email(to_email, FOLLOWUP_2_SUBJECT, FOLLOWUP_2_BODY)
